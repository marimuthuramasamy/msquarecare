"""Backend API tests for MSquare Care Solutions."""
import io
import os
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
ADMIN_PASSCODE = "msquare2026"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    return sess


# ---------- /api/config ----------
def test_config(s):
    r = s.get(f"{BASE_URL}/api/config", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["whatsapp_number"] == "918072571879"
    assert isinstance(data["services"], list)
    assert len(data["services"]) == 7
    assert "General Insurance" in data["services"]
    assert "Term / Life Insurance" in data["services"]


# ---------- /api/leads ----------
CREATED_LEAD = {}


def test_create_lead(s):
    payload = {
        "name": "TEST_Lead_" + uuid.uuid4().hex[:6],
        "phone": "9999999999",
        "email": "test@example.com",
        "service": "Health Insurance",
        "city": "Trichy",
        "message": "Testing lead capture",
    }
    r = s.post(f"{BASE_URL}/api/leads", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == payload["name"]
    assert d["phone"] == payload["phone"]
    assert d["service"] == payload["service"]
    assert d.get("lead_id")
    assert d.get("status") == "new"
    CREATED_LEAD["lead"] = d


# ---------- /api/admin/leads ----------
def test_admin_leads_no_passcode(s):
    r = s.get(f"{BASE_URL}/api/admin/leads", timeout=30)
    assert r.status_code == 401


def test_admin_leads_wrong_passcode(s):
    r = s.get(f"{BASE_URL}/api/admin/leads",
              headers={"X-Admin-Passcode": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_admin_leads_ok(s):
    r = s.get(f"{BASE_URL}/api/admin/leads",
              headers={"X-Admin-Passcode": ADMIN_PASSCODE}, timeout=30)
    assert r.status_code == 200, r.text
    leads = r.json()
    assert isinstance(leads, list)
    created = CREATED_LEAD.get("lead")
    if created:
        assert any(l.get("lead_id") == created["lead_id"] for l in leads)


# ---------- /api/admin/leads/export ----------
def test_export_csv(s):
    r = s.get(f"{BASE_URL}/api/admin/leads/export",
              params={"passcode": ADMIN_PASSCODE}, timeout=30)
    assert r.status_code == 200, r.text
    assert "Name,Phone,Email" in r.text


def test_export_csv_wrong_passcode(s):
    r = s.get(f"{BASE_URL}/api/admin/leads/export",
              params={"passcode": "bad"}, timeout=30)
    assert r.status_code == 401


# ---------- /api/analyze-image ----------
def _make_jpg_bytes():
    img = Image.new("RGB", (400, 300), color=(200, 220, 250))
    # draw some rectangles to simulate content
    for x in range(0, 400, 40):
        for y in range(0, 300, 40):
            img.putpixel((x, y), (10, 10, 10))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def test_analyze_image(s):
    files = {"file": ("test.jpg", _make_jpg_bytes(), "image/jpeg")}
    data = {"context": "sample document"}
    r = s.post(f"{BASE_URL}/api/analyze-image", files=files, data=data, timeout=120)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "analysis" in body
    assert isinstance(body["analysis"], str)
    assert len(body["analysis"].strip()) > 20


# ---------- /api/chat ----------
def test_chat_stream(s):
    session_id = f"test-{uuid.uuid4()}"
    payload = {"session_id": session_id, "message": "Hi, what is term insurance in one line?"}
    with s.post(f"{BASE_URL}/api/chat", json=payload, stream=True, timeout=120) as r:
        assert r.status_code == 200, r.text
        chunks = []
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                chunks.append(chunk)
        full = "".join(chunks)
        assert len(full.strip()) > 10, f"Empty AI response: {full!r}"
