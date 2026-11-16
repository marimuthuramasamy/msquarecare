"""Automatic WhatsApp renewal reminders.

A scheduler (started from server.py) runs every RUN_INTERVAL_MIN minutes. Once the
configured send hour (IST) has passed each day it looks at every active/expired
policy and works out which reminder *stage* it has reached, e.g. with the default
schedule [30, 15, 7, 1, -3] a policy 12 days from expiry is at stage 15.

Exactly one reminder is ever recorded per (policy, stage): the `key` field is
unique, so overlapping runs or several server workers cannot double-send. Only the
latest stage reached is sent — if the server was down on day 15 and comes back on
day 6 the customer gets the 7-day reminder, not both.

Delivery modes:
- "api":    WhatsApp Business Cloud API (Meta) using an approved message template.
            Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in the environment.
- "manual": the reminder is queued with a ready-made wa.me link; staff send it with
            one click from the Renewals page and mark it sent.
Failed API sends are retried on later runs, up to MAX_ATTEMPTS.
"""
import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

import crm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/crm/reminders")

IST = timezone(timedelta(hours=5, minutes=30))
RUN_INTERVAL_MIN = 15
MAX_ATTEMPTS = 3
# Policies more than this many days past expiry are left alone.
EXPIRED_CUTOFF_DAYS = 30

WHATSAPP_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")

DEFAULT_BEFORE = (
    "Hi {name}, this is MSquare Care Solutions. Your {policy_type} policy {policy_number} with {insurer} "
    "is due for renewal on {end_date} ({days_text}). Renewal premium is approx. {premium}. "
    "Reply YES and we will renew it for you, or call us on 8072571879."
)
DEFAULT_AFTER = (
    "Hi {name}, your {policy_type} policy {policy_number} with {insurer} expired on {end_date}. "
    "You may not be covered right now — reply YES or call MSquare Care on 8072571879 and we will "
    "help you renew it today."
)

DEFAULTS = {
    "enabled": False,
    "mode": "manual",
    "schedule": [30, 15, 7, 1, -3],
    "send_hour": 10,
    "template_before": DEFAULT_BEFORE,
    "template_after": DEFAULT_AFTER,
    "api_template_name": os.environ.get("WHATSAPP_TEMPLATE_NAME", "policy_renewal_reminder"),
    "api_template_lang": os.environ.get("WHATSAPP_TEMPLATE_LANG", "en"),
}


def api_configured() -> bool:
    return bool(WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID)


def ist_now() -> datetime:
    return datetime.now(IST)


def _inr(n) -> str:
    return f"₹{float(n or 0):,.0f}"


def _fmt_date(s: str) -> str:
    d = crm._parse_date(s)
    return d.strftime("%d %b %Y") if d else (s or "")


# ---------------------------------------------------------------- settings
class ReminderSettings(BaseModel):
    enabled: bool = False
    mode: Literal["api", "manual"] = "manual"
    schedule: List[int] = Field(default_factory=lambda: list(DEFAULTS["schedule"]))
    send_hour: int = Field(10, ge=0, le=23)
    template_before: str = DEFAULT_BEFORE
    template_after: str = DEFAULT_AFTER
    api_template_name: str = DEFAULTS["api_template_name"]
    api_template_lang: str = DEFAULTS["api_template_lang"]

    @field_validator("schedule")
    @classmethod
    def _schedule(cls, v):
        v = sorted({int(x) for x in v}, reverse=True)
        if not v:
            raise ValueError("add at least one reminder day")
        if any(x > 120 or x < -EXPIRED_CUTOFF_DAYS for x in v):
            raise ValueError(f"reminder days must be between -{EXPIRED_CUTOFF_DAYS} and 120")
        return v

    @field_validator("template_before", "template_after")
    @classmethod
    def _template(cls, v):
        try:
            v.format(**_sample_fields())
        except (KeyError, IndexError, ValueError) as e:
            raise ValueError(f"unknown or malformed placeholder: {e}")
        return v


def _sample_fields() -> dict:
    return {"name": "Kumar", "policy_type": "Health", "policy_number": "HP-001", "insurer": "Star Health",
            "end_date": "12 Nov 2026", "premium": "₹18,500", "days": 15, "days_text": "in 15 days",
            "plan_name": "Family Health Optima", "vehicle_number": ""}


async def get_settings() -> dict:
    doc = await crm.db().settings.find_one({"key": "reminders"}) or {}
    out = dict(DEFAULTS)
    out.update({k: v for k, v in doc.items() if k in DEFAULTS})
    return out


# ---------------------------------------------------------------- core
def stage_for(days_to_expiry: int, schedule: List[int]) -> Optional[int]:
    """The latest schedule stage this policy has reached, or None if none yet."""
    reached = [o for o in schedule if days_to_expiry <= o]
    return min(reached) if reached else None


def render(policy: dict, customer: dict, settings: dict, days: int) -> str:
    if days > 1:
        days_text = f"in {days} days"
    elif days == 1:
        days_text = "tomorrow"
    elif days == 0:
        days_text = "today"
    else:
        days_text = f"{-days} days ago"
    fields = {
        "name": customer.get("name", "").split(" ")[0] or customer.get("name", ""),
        "policy_type": policy.get("policy_type", ""), "policy_number": policy.get("policy_number", ""),
        "insurer": policy.get("insurer", ""), "end_date": _fmt_date(policy.get("end_date")),
        "premium": _inr(policy.get("premium")), "days": days, "days_text": days_text,
        "plan_name": policy.get("plan_name") or "", "vehicle_number": policy.get("vehicle_number") or "",
    }
    tpl = settings["template_before"] if days >= 0 else settings["template_after"]
    try:
        return tpl.format(**fields)
    except (KeyError, IndexError, ValueError):
        return (DEFAULT_BEFORE if days >= 0 else DEFAULT_AFTER).format(**fields)


def _wa_number(customer: dict) -> Optional[str]:
    d = customer.get("phone_digits") or crm._digits(customer.get("phone", ""))
    return f"91{d}" if len(d) == 10 else None


async def send_whatsapp_template(to: str, settings: dict, params: List[str]) -> str:
    """Send an approved template via the WhatsApp Cloud API. Returns the message id."""
    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    body = {
        "messaging_product": "whatsapp", "to": to, "type": "template",
        "template": {
            "name": settings["api_template_name"],
            "language": {"code": settings["api_template_lang"]},
            "components": [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}],
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(url, json=body, headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"})
    if r.status_code >= 400:
        try:
            err = r.json().get("error", {})
            msg = err.get("error_user_msg") or err.get("message") or r.text
        except ValueError:
            msg = r.text
        raise RuntimeError(f"WhatsApp API {r.status_code}: {msg[:300]}")
    return (r.json().get("messages") or [{}])[0].get("id", "")


def api_params(policy: dict, customer: dict, days: int) -> List[str]:
    """Body parameters {{1}}..{{5}} for the Meta template (see README)."""
    return [
        customer.get("name", "").split(" ")[0] or "Customer",
        f"{policy.get('policy_type', '')} policy {policy.get('policy_number', '')}",
        policy.get("insurer", ""),
        _fmt_date(policy.get("end_date")),
        _inr(policy.get("premium")),
    ]


async def _claim(key: str, base: dict) -> Optional[dict]:
    """Atomically take ownership of a reminder; None if another run has it or it's done."""
    d = crm.db()
    try:
        doc = dict(base, key=key, status="sending", attempts=0)
        await d.reminders.insert_one(doc)
        return doc
    except DuplicateKeyError:
        res = await d.reminders.update_one(
            {"key": key, "status": "failed", "attempts": {"$lt": MAX_ATTEMPTS}},
            {"$set": {"status": "sending", "updated_at": crm.now_iso()}})
        if res.modified_count:
            return await d.reminders.find_one({"key": key})
        return None


async def run(force: bool = False, dry_run: bool = False) -> dict:
    """Process due reminders. `force` ignores the enabled flag and send hour."""
    settings = await get_settings()
    now = ist_now()
    summary = {"sent": 0, "queued": 0, "failed": 0, "skipped": 0}
    due: List[dict] = []
    if not force and (not settings["enabled"] or now.hour < settings["send_hour"]):
        return {"due": due} if dry_run else summary
    await ensure_indexes()
    mode = settings["mode"]
    if mode == "api" and not api_configured():
        mode = "manual"
    d = crm.db()
    today: date = now.date()
    schedule = settings["schedule"]
    horizon = (today + timedelta(days=max(schedule))).isoformat()
    floor = (today - timedelta(days=EXPIRED_CUTOFF_DAYS)).isoformat()
    pols = await d.policies.find({"status": {"$in": ["active", "expired"]},
                                  "end_date": {"$lte": horizon, "$gte": floor}}).to_list(20000)
    custs = await crm._customer_names([p["customer_id"] for p in pols])

    for p in pols:
        end = crm._parse_date(p.get("end_date"))
        if not end:
            continue
        days = (end - today).days
        stage = stage_for(days, schedule)
        if stage is None:
            continue
        key = f"{p['id']}:{stage}"
        c = custs.get(p["customer_id"])
        if not c:
            continue
        message = render(p, c, settings, days)
        to = _wa_number(c)
        if dry_run:
            existing = await d.reminders.find_one({"key": key})
            if not existing or (existing["status"] == "failed" and existing.get("attempts", 0) < MAX_ATTEMPTS):
                due.append({"policy_id": p["id"], "policy_number": p["policy_number"], "customer_name": c["name"],
                                       "customer_phone": c.get("phone"), "stage": stage, "days_to_expiry": days,
                                       "message": message, "opted_out": bool(c.get("whatsapp_opt_out"))})
            continue

        base = {"id": crm.new_id(), "policy_id": p["id"], "customer_id": c["id"], "policy_number": p["policy_number"],
                "customer_name": c["name"], "customer_phone": c.get("phone"), "stage": stage,
                "days_to_expiry": days, "end_date": p["end_date"], "message": message, "mode": mode,
                "created_at": crm.now_iso(), "updated_at": crm.now_iso()}
        rec = await _claim(key, base)
        if not rec:
            continue

        upd = {"updated_at": crm.now_iso(), "message": message, "mode": mode, "days_to_expiry": days}
        if c.get("whatsapp_opt_out"):
            upd.update(status="skipped", error="Customer opted out of WhatsApp reminders")
            summary["skipped"] += 1
        elif not to:
            upd.update(status="failed", error="Invalid mobile number", attempts=MAX_ATTEMPTS)
            summary["failed"] += 1
        elif mode == "manual":
            upd.update(status="pending", wa_link=f"https://wa.me/{to}?text={quote(message)}")
            summary["queued"] += 1
        else:
            try:
                mid = await send_whatsapp_template(to, settings, api_params(p, c, days))
                upd.update(status="sent", sent_at=crm.now_iso(), provider_message_id=mid, error=None)
                summary["sent"] += 1
                await crm.log_activity("customer", c["id"], "whatsapp",
                                       f"Automatic renewal reminder sent for {p['policy_number']} ({days} days to expiry)")
            except Exception as e:  # network / API errors are retried on the next run
                logger.warning(f"WhatsApp reminder failed for {key}: {e}")
                upd.update(status="failed", error=str(e)[:300])
                upd["attempts"] = rec.get("attempts", 0) + 1
                summary["failed"] += 1
        await d.reminders.update_one({"key": key}, {"$set": upd})

    if not dry_run and any(summary[k] for k in ("sent", "queued", "failed")):
        logger.info(f"Renewal reminders run: {summary}")
    return {"due": due} if dry_run else summary


async def ensure_indexes():
    try:
        await crm.db().reminders.create_index("key", unique=True)
        await crm.db().reminders.create_index("status")
    except Exception as e:
        logger.debug(f"reminder indexes: {e}")


async def scheduler_loop():
    await ensure_indexes()
    while True:
        try:
            await run()
        except Exception as e:  # never let the loop die
            logger.error(f"reminder scheduler error: {e}")
        await asyncio.sleep(RUN_INTERVAL_MIN * 60)


# ---------------------------------------------------------------- API
def _public_settings(s: dict) -> dict:
    return dict(s, api_configured=api_configured(),
                phone_number_id=(f"…{WHATSAPP_PHONE_NUMBER_ID[-4:]}" if WHATSAPP_PHONE_NUMBER_ID else None),
                placeholders=list(_sample_fields().keys()))


@router.get("/settings")
async def read_settings(_: dict = Depends(crm.current_user)):
    return _public_settings(await get_settings())


@router.put("/settings")
async def write_settings(body: ReminderSettings, _: dict = Depends(crm.admin_user)):
    if body.mode == "api" and not api_configured():
        raise HTTPException(status_code=400, detail="WhatsApp API is not configured on the server "
                                                    "(set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID).")
    await crm.db().settings.update_one({"key": "reminders"}, {"$set": body.model_dump()}, upsert=True)
    return _public_settings(await get_settings())


@router.get("/preview")
async def preview(_: dict = Depends(crm.current_user)):
    """What the next run would send (ignores the enabled flag and send hour)."""
    return (await run(force=True, dry_run=True))["due"]


@router.post("/run")
async def run_now(_: dict = Depends(crm.admin_user)):
    return await run(force=True)


@router.get("/log")
async def log(status: Optional[str] = None, limit: int = 200, _: dict = Depends(crm.current_user)):
    q = {"status": status} if status else {}
    docs = await crm.db().reminders.find(q).sort("updated_at", -1).to_list(min(limit, 1000))
    return [crm._clean(x) for x in docs]


@router.post("/{reminder_id}/mark-sent")
async def mark_sent(reminder_id: str, user: dict = Depends(crm.current_user)):
    r = await crm.db().reminders.find_one({"id": reminder_id})
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if r["status"] not in ("pending", "failed"):
        raise HTTPException(status_code=400, detail=f"Reminder is already {r['status']}")
    await crm.db().reminders.update_one({"id": reminder_id}, {"$set": {
        "status": "sent", "sent_at": crm.now_iso(), "sent_by": user["name"], "updated_at": crm.now_iso(), "error": None}})
    await crm.log_activity("customer", r["customer_id"], "whatsapp",
                           f"Renewal reminder sent on WhatsApp for {r['policy_number']}", user)
    return crm._clean(await crm.db().reminders.find_one({"id": reminder_id}))


@router.post("/{reminder_id}/dismiss")
async def dismiss(reminder_id: str, user: dict = Depends(crm.current_user)):
    res = await crm.db().reminders.update_one({"id": reminder_id, "status": {"$in": ["pending", "failed"]}},
                                              {"$set": {"status": "skipped", "error": f"Dismissed by {user['name']}",
                                                        "updated_at": crm.now_iso()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="No pending reminder with this id")
    return {"ok": True}
