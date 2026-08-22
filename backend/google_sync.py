"""Google Sheets + Gmail alert sync for MSquare Care Solutions leads.

Uses a single 'owner' OAuth connection (the business's own Google account).
On each new lead the row is appended to a Google Sheet and an alert email is
sent from the owner's Gmail. All calls are best-effort — failures never block
lead capture.
"""
import os
import base64
import asyncio
import logging
from datetime import datetime, timezone
from email.mime.text import MIMEText

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")
ALERT_EMAIL_TO = os.environ.get("ALERT_EMAIL_TO", os.environ.get("COMPANY_EMAIL", ""))
REDIRECT_URI = f"{APP_BASE_URL}/api/oauth/sheets/callback"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

HEADER = ["Name", "Phone", "Email", "Service", "City", "Message", "Source", "Status", "Created At"]


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and APP_BASE_URL)


def _client_config():
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }


def build_auth_url(state: str):
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=REDIRECT_URI)
    url, _ = flow.authorization_url(access_type="offline", prompt="consent", state=state,
                                    include_granted_scopes="true")
    return url


def _creds_from_doc(doc) -> Credentials:
    return Credentials(
        token=doc.get("access_token"),
        refresh_token=doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )


async def exchange_code(db, code: str):
    """Exchange auth code for tokens, store them, create/attach a sheet."""
    def _do():
        flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=REDIRECT_URI)
        flow.fetch_token(code=code)
        creds = flow.credentials
        email = ""
        try:
            info = build("oauth2", "v2", credentials=creds).userinfo().get().execute()
            email = info.get("email", "")
        except Exception as e:
            logger.warning(f"userinfo failed: {e}")
        return creds, email

    creds, email = await asyncio.to_thread(_do)
    doc = {
        "key": "google",
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "email": email,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = await db.integrations.find_one({"key": "google"})
    if existing and existing.get("spreadsheet_id"):
        doc["spreadsheet_id"] = existing["spreadsheet_id"]
    if not doc.get("refresh_token") and existing:
        doc["refresh_token"] = existing.get("refresh_token")
    await db.integrations.update_one({"key": "google"}, {"$set": doc}, upsert=True)

    if not doc.get("spreadsheet_id"):
        await _ensure_sheet(db)
    return email


async def _get_creds(db):
    doc = await db.integrations.find_one({"key": "google"})
    if not doc or not doc.get("refresh_token"):
        return None, doc
    creds = _creds_from_doc(doc)

    def _refresh():
        creds.refresh(GoogleRequest())
        return creds.token

    try:
        new_token = await asyncio.to_thread(_refresh)
        if new_token and new_token != doc.get("access_token"):
            await db.integrations.update_one({"key": "google"}, {"$set": {"access_token": new_token}})
    except Exception as e:
        logger.error(f"token refresh failed: {e}")
        return None, doc
    return creds, doc


async def _ensure_sheet(db):
    creds, doc = await _get_creds(db)
    if not creds:
        return None
    if doc and doc.get("spreadsheet_id"):
        return doc["spreadsheet_id"]

    def _create():
        service = build("sheets", "v4", credentials=creds)
        ss = service.spreadsheets().create(body={
            "properties": {"title": "MSquare Leads"},
            "sheets": [{"properties": {"title": "Leads"}}],
        }).execute()
        sid = ss["spreadsheetId"]
        service.spreadsheets().values().update(
            spreadsheetId=sid, range="Leads!A1",
            valueInputOption="RAW", body={"values": [HEADER]},
        ).execute()
        return sid

    sid = await asyncio.to_thread(_create)
    await db.integrations.update_one({"key": "google"}, {"$set": {"spreadsheet_id": sid}})
    return sid


async def status(db):
    doc = await db.integrations.find_one({"key": "google"})
    connected = bool(doc and doc.get("refresh_token"))
    sid = doc.get("spreadsheet_id") if doc else None
    return {
        "configured": is_configured(),
        "connected": connected,
        "email": doc.get("email") if doc else None,
        "spreadsheet_id": sid,
        "sheet_url": f"https://docs.google.com/spreadsheets/d/{sid}" if sid else None,
    }


async def sync_lead(db, lead: dict):
    """Best-effort: append the lead to the sheet and email an alert."""
    if not is_configured():
        return
    creds, doc = await _get_creds(db)
    if not creds:
        return
    sid = await _ensure_sheet(db)
    row = [
        lead.get("name", ""), lead.get("phone", ""), lead.get("email", "") or "",
        lead.get("service", ""), lead.get("city", "") or "", lead.get("message", "") or "",
        lead.get("source", ""), lead.get("status", ""), lead.get("created_at", ""),
    ]

    def _append():
        service = build("sheets", "v4", credentials=creds)
        service.spreadsheets().values().append(
            spreadsheetId=sid, range="Leads!A1",
            valueInputOption="RAW", insertDataOption="INSERT_ROWS",
            body={"values": [row]},
        ).execute()

    def _email():
        body = (
            f"New lead captured on MSquare Care website\n\n"
            f"Name: {lead.get('name')}\nPhone: {lead.get('phone')}\n"
            f"Email: {lead.get('email') or '-'}\nService: {lead.get('service')}\n"
            f"City: {lead.get('city') or '-'}\nMessage: {lead.get('message') or '-'}\n"
            f"Time: {lead.get('created_at')}\n"
        )
        msg = MIMEText(body)
        msg["to"] = ALERT_EMAIL_TO
        msg["subject"] = f"🟢 New Lead: {lead.get('name')} — {lead.get('service')}"
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        gmail = build("gmail", "v1", credentials=creds)
        gmail.users().messages().send(userId="me", body={"raw": raw}).execute()

    try:
        await asyncio.to_thread(_append)
    except Exception as e:
        logger.error(f"sheet append failed: {e}")
    try:
        if ALERT_EMAIL_TO:
            await asyncio.to_thread(_email)
    except Exception as e:
        logger.error(f"alert email failed: {e}")


async def disconnect(db):
    await db.integrations.delete_one({"key": "google"})
