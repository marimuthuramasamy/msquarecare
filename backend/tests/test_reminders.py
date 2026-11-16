"""Renewal reminder engine tests (in-memory Mongo, WhatsApp API mocked).

    cd backend && python -m pytest tests/test_reminders.py -n 0
"""
import asyncio
import os
import sys
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("CRM_ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("CRM_ADMIN_PASSWORD", "secret123")

import crm  # noqa: E402
import reminders  # noqa: E402


def d(offset: int) -> str:
    return (reminders.ist_now().date() + timedelta(days=offset)).isoformat()


@pytest.fixture()
def client(monkeypatch):
    database = AsyncMongoMockClient()["rem_test"]
    app = FastAPI()
    app.include_router(crm.router)
    app.include_router(reminders.router)
    asyncio.run(crm.bootstrap(database))
    monkeypatch.setattr(reminders, "WHATSAPP_TOKEN", "")
    monkeypatch.setattr(reminders, "WHATSAPP_PHONE_NUMBER_ID", "")
    with TestClient(app) as c:
        tok = c.post("/api/crm/auth/login", json={"email": "admin@test.com", "password": "secret123"}).json()["token"]
        c.headers["Authorization"] = f"Bearer {tok}"
        yield c


def add_policy(c, name, phone, end_offset, opt_out=False, number=None):
    cust = c.post("/api/crm/customers", json={"name": name, "phone": phone, "whatsapp_opt_out": opt_out}).json()
    pol = c.post("/api/crm/policies", json={
        "customer_id": cust["id"], "policy_number": number or f"P-{phone[-4:]}", "insurer": "Star Health",
        "policy_type": "Health", "premium": 18500, "start_date": d(end_offset - 364), "end_date": d(end_offset)}).json()
    return cust, pol


def set_policy_end(c, pid, end_offset):
    c.patch(f"/api/crm/policies/{pid}", json={"start_date": d(end_offset - 364), "end_date": d(end_offset)})


def test_stage_for():
    s = [30, 15, 7, 1, -3]
    assert reminders.stage_for(45, s) is None
    assert reminders.stage_for(30, s) == 30
    assert reminders.stage_for(12, s) == 15
    assert reminders.stage_for(0, s) == 1
    assert reminders.stage_for(-2, s) == 1
    assert reminders.stage_for(-10, s) == -3


def test_disabled_does_nothing_until_forced(client):
    add_policy(client, "Kumar R", "9000000001", 10)
    assert asyncio.run(reminders.run()) == {"sent": 0, "queued": 0, "failed": 0, "skipped": 0}
    assert client.get("/api/crm/reminders/log").json() == []


def test_manual_mode_queue_dedupe_and_stage_progression(client):
    _, pol = add_policy(client, "Kumar Raj", "9000000001", 12)
    add_policy(client, "Far Away", "9000000002", 90)
    preview = client.get("/api/crm/reminders/preview").json()
    assert len(preview) == 1 and preview[0]["stage"] == 15 and "Kumar" in preview[0]["message"]

    r = client.post("/api/crm/reminders/run").json()
    assert r["queued"] == 1
    # running again never re-queues the same stage
    assert client.post("/api/crm/reminders/run").json()["queued"] == 0
    log = client.get("/api/crm/reminders/log").json()
    assert len(log) == 1 and log[0]["status"] == "pending"
    assert log[0]["wa_link"].startswith("https://wa.me/919000000001?text=")
    assert client.get("/api/crm/dashboard").json()["reminders_pending"] == 1

    rid = log[0]["id"]
    assert client.post(f"/api/crm/reminders/{rid}/mark-sent").json()["status"] == "sent"
    assert client.post(f"/api/crm/reminders/{rid}/mark-sent").status_code == 400

    # a week later the policy reaches the 7-day stage -> exactly one new reminder
    set_policy_end(client, pol["id"], 5)
    assert client.post("/api/crm/reminders/run").json()["queued"] == 1
    assert {x["stage"] for x in client.get("/api/crm/reminders/log").json()} == {15, 7}


def test_opt_out_invalid_phone_and_renewed(client):
    add_policy(client, "No Thanks", "9000000003", 3, opt_out=True)
    add_policy(client, "Bad Phone", "12345", 3, number="BAD-1")
    _, pol = add_policy(client, "Renews Soon", "9000000004", 6)
    r = client.post("/api/crm/reminders/run").json()
    assert r == {"sent": 0, "queued": 1, "failed": 1, "skipped": 1}
    # renewing the policy clears its pending reminder and the new term isn't due yet
    client.post(f"/api/crm/policies/{pol['id']}/renew", json={})
    pending = client.get("/api/crm/reminders/log?status=pending").json()
    assert pending == []
    assert client.post("/api/crm/reminders/run").json()["queued"] == 0


def test_expired_policy_uses_after_template(client):
    add_policy(client, "Late Larry", "9000000005", -4)
    client.post("/api/crm/reminders/run")
    msg = client.get("/api/crm/reminders/log").json()[0]["message"]
    assert "expired" in msg


def test_api_mode_sends_and_retries(client, monkeypatch):
    # API mode is refused until credentials are configured
    assert client.put("/api/crm/reminders/settings", json={"enabled": True, "mode": "api"}).status_code == 400
    monkeypatch.setattr(reminders, "WHATSAPP_TOKEN", "tok")
    monkeypatch.setattr(reminders, "WHATSAPP_PHONE_NUMBER_ID", "1234567890")
    s = client.put("/api/crm/reminders/settings", json={"enabled": True, "mode": "api", "schedule": [7, 30, 30]}).json()
    assert s["schedule"] == [30, 7] and s["api_configured"] is True

    calls = []
    outcomes = iter([RuntimeError("WhatsApp API 500: boom"), "wamid.1"])

    async def fake_send(to, settings, params):
        calls.append((to, params))
        o = next(outcomes)
        if isinstance(o, Exception):
            raise o
        return o

    monkeypatch.setattr(reminders, "send_whatsapp_template", fake_send)
    add_policy(client, "Api Anand", "9000000006", 5)
    assert client.post("/api/crm/reminders/run").json()["failed"] == 1
    assert client.post("/api/crm/reminders/run").json()["sent"] == 1  # retried
    assert client.post("/api/crm/reminders/run").json()["sent"] == 0  # not resent
    assert calls[0][0] == "919000000006"
    assert calls[0][1][0] == "Api" and calls[0][1][4] == "₹18,500"
    rec = client.get("/api/crm/reminders/log").json()[0]
    assert rec["status"] == "sent" and rec["provider_message_id"] == "wamid.1"


def test_settings_validation(client):
    bad = client.put("/api/crm/reminders/settings", json={"template_before": "Hi {nme}"})
    assert bad.status_code == 422
    assert client.put("/api/crm/reminders/settings", json={"schedule": []}).status_code == 422
    ok = client.put("/api/crm/reminders/settings", json={"enabled": True, "send_hour": 9,
                                                         "template_before": "Hi {name}, {policy_number} due {days_text}"})
    assert ok.status_code == 200 and ok.json()["send_hour"] == 9
