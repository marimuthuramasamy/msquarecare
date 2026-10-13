"""Self-contained CRM tests: run against an in-memory Mongo (mongomock-motor).

    cd backend && python -m pytest tests/test_crm.py -n 0
"""
import asyncio
import os
import sys
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("CRM_ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("CRM_ADMIN_PASSWORD", "secret123")

import crm  # noqa: E402


def d(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


@pytest.fixture()
def client():
    database = AsyncMongoMockClient()["crm_test"]
    app = FastAPI()
    app.include_router(crm.router)
    app.include_router(crm.portal_router)
    asyncio.run(crm.bootstrap(database))
    with TestClient(app) as c:
        r = c.post("/api/crm/auth/login", json={"email": "admin@test.com", "password": "secret123"})
        assert r.status_code == 200, r.text
        c.headers["Authorization"] = f"Bearer {r.json()['token']}"
        yield c


def test_auth_required():
    app = FastAPI()
    app.include_router(crm.router)
    with TestClient(app) as c:
        assert c.get("/api/crm/dashboard").status_code == 401
        assert c.get("/api/crm/dashboard", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_bad_login(client):
    r = client.post("/api/crm/auth/login", json={"email": "admin@test.com", "password": "nope"})
    assert r.status_code == 401


def test_agent_cannot_manage_users(client):
    r = client.post("/api/crm/users", json={"name": "Ravi", "email": "ravi@test.com", "password": "agent123"})
    assert r.status_code == 200
    tok = client.post("/api/crm/auth/login", json={"email": "ravi@test.com", "password": "agent123"}).json()["token"]
    r = client.post("/api/crm/users", json={"name": "X", "email": "x@test.com", "password": "xxxxxx"},
                    headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
    # deactivated users can no longer log in
    uid = [u for u in client.get("/api/crm/users").json() if u["email"] == "ravi@test.com"][0]["id"]
    client.patch(f"/api/crm/users/{uid}", json={"active": False})
    assert client.post("/api/crm/auth/login", json={"email": "ravi@test.com", "password": "agent123"}).status_code == 401


def test_full_lifecycle(client):
    # lead -> pipeline -> convert
    lead = client.post("/api/crm/leads", json={"name": "Kumar", "phone": "+91 98765 43210",
                                               "service": "Health Insurance", "expected_premium": 18000}).json()
    lid = lead["lead_id"]
    assert client.patch(f"/api/crm/leads/{lid}", json={"status": "bogus"}).status_code == 400
    r = client.patch(f"/api/crm/leads/{lid}", json={"status": "quoted"})
    assert r.json()["status"] == "quoted"
    cust = client.post(f"/api/crm/leads/{lid}/convert").json()
    assert cust["name"] == "Kumar" and cust["phone_digits"] == "9876543210"
    assert client.get(f"/api/crm/leads/{lid}").json()["status"] == "won"
    # converting twice returns the same customer
    assert client.post(f"/api/crm/leads/{lid}/convert").json()["id"] == cust["id"]
    # duplicate phone rejected
    assert client.post("/api/crm/customers", json={"name": "Dup", "phone": "9876543210"}).status_code == 400

    # policy expiring in 10 days
    pol = client.post("/api/crm/policies", json={
        "customer_id": cust["id"], "policy_number": "HP-001", "insurer": "Star Health",
        "policy_type": "Health", "premium": 20000, "commission_pct": 15,
        "start_date": d(-355), "end_date": d(10)}).json()
    assert pol["days_to_expiry"] == 10 and pol["commission_amount"] == 3000
    bad = client.post("/api/crm/policies", json={
        "customer_id": cust["id"], "policy_number": "X", "insurer": "Y", "start_date": d(5), "end_date": d(1)})
    assert bad.status_code == 400

    dash = client.get("/api/crm/dashboard").json()
    assert dash["policies_active"] == 1 and dash["renewals_due_30"] == 1
    assert dash["premium_active"] == 20000 and dash["lead_stages"]["won"] == 1

    # renewal tasks are generated once
    assert client.post("/api/crm/renewals/generate-tasks?days=30").json()["created"] == 1
    assert client.post("/api/crm/renewals/generate-tasks?days=30").json()["created"] == 0
    assert len(client.get("/api/crm/tasks").json()) == 1
    assert len(client.get("/api/crm/policies?expiring_within=30").json()) == 1

    # renew -> old marked renewed, new term follows on, renewal task closed
    new = client.post(f"/api/crm/policies/{pol['id']}/renew", json={"premium": 21500}).json()
    assert new["start_date"] == d(11) and new["premium"] == 21500 and new["renewed_from"] == pol["id"]
    assert client.get(f"/api/crm/policies/{pol['id']}").json()["status"] == "renewed"
    assert client.post(f"/api/crm/policies/{pol['id']}/renew").status_code == 400
    assert client.get("/api/crm/tasks").json() == []

    # claim workflow with history
    claim = client.post("/api/crm/claims", json={"policy_id": new["id"], "claimed_amount": 50000}).json()
    upd = client.patch(f"/api/crm/claims/{claim['id']}", json={"status": "approved", "approved_amount": 45000}).json()
    assert [h["status"] for h in upd["history"]] == ["intimated", "approved"]
    assert client.get("/api/crm/claims?status=open").json()[0]["customer_name"] == "Kumar"

    # customer 360 includes everything and the activity timeline
    full = client.get(f"/api/crm/customers/{cust['id']}").json()
    assert len(full["policies"]) == 2 and len(full["claims"]) == 1
    assert any("Converted" in a["text"] for a in full["activities"])

    # cannot delete a policy with claims / a customer with policies
    assert client.delete(f"/api/crm/policies/{new['id']}").status_code == 400
    assert client.delete(f"/api/crm/customers/{cust['id']}").status_code == 400

    # CSV export
    csv_text = client.get("/api/crm/export/policies").text
    assert "HP-001" in csv_text and "Kumar" in csv_text


def test_portal(client):
    cust = client.post("/api/crm/customers", json={"name": "Meena", "phone": "9000000001"}).json()
    client.post("/api/crm/policies", json={
        "customer_id": cust["id"], "policy_number": "MOT-9", "insurer": "ICICI Lombard", "policy_type": "Motor",
        "premium": 9000, "commission_pct": 10, "start_date": d(-100), "end_date": d(265)})
    portal = TestClient(client.app)  # no auth header
    assert portal.post("/api/portal/lookup", json={"phone": "9000000002", "policy_number": "MOT-9"}).status_code == 404
    r = portal.post("/api/portal/lookup", json={"phone": "+91 90000 00001", "policy_number": "MOT-9"})
    assert r.status_code == 200
    body = r.json()
    assert body["policy"]["insurer"] == "ICICI Lombard"
    assert "commission_pct" not in body["policy"]  # internal fields are not exposed
    r = portal.post("/api/portal/requests", json={"phone": "9000000001", "policy_number": "MOT-9",
                                                   "kind": "claim", "message": "Rear bumper damage",
                                                   "claimed_amount": 12000})
    assert r.status_code == 200 and r.json()["reference"]
    assert len(client.get("/api/crm/claims").json()) == 1
    tasks = client.get("/api/crm/tasks").json()
    assert len(tasks) == 1 and "Claim intimation" in tasks[0]["title"]
