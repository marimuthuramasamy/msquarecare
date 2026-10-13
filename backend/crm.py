"""Insurance CRM for MSquare Care Solutions.

Staff-facing API (JWT auth) for the full insurance workflow:
leads pipeline -> customers -> policies -> renewals -> claims, with tasks,
an activity timeline and dashboard metrics. Also exposes a small public
customer portal (policy lookup + service requests).

All documents use a string `id` (uuid4); leads keep their historic `lead_id`.
Dates for policies/tasks are ISO `YYYY-MM-DD` strings; timestamps are ISO UTC.
"""
import csv
import hashlib
import io
import logging
import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/crm")
portal_router = APIRouter(prefix="/api/portal")

_db = None

JWT_SECRET = os.environ.get("JWT_SECRET") or hashlib.sha256(
    ("msquare-crm::" + os.environ.get("ADMIN_PASSCODE", "dev")).encode()).hexdigest()
JWT_TTL_HOURS = int(os.environ.get("JWT_TTL_HOURS", "12"))

LEAD_STAGES = ["new", "contacted", "quoted", "negotiation", "won", "lost"]
POLICY_TYPES = ["Health", "Motor", "Term / Life", "General", "Travel", "Home", "Business", "Other"]
POLICY_STATUSES = ["active", "pending", "lapsed", "cancelled", "renewed", "expired"]
CLAIM_STATUSES = ["intimated", "documents_pending", "submitted", "under_review", "approved",
                  "settled", "rejected"]
TASK_STATUSES = ["open", "done"]
ACTIVITY_KINDS = ["note", "call", "whatsapp", "email", "meeting", "system"]
ENTITY_TYPES = ["lead", "customer", "policy", "claim"]


def init(db):
    global _db
    _db = db


def db():
    if _db is None:
        raise RuntimeError("crm.init(db) was not called")
    return _db


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def today() -> date:
    return datetime.now(timezone.utc).date()


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is not None:
        doc.pop("_id", None)
    return doc


def _digits(phone: str) -> str:
    d = re.sub(r"\D", "", phone or "")
    return d[-10:] if len(d) >= 10 else d


# ---------------------------------------------------------------- auth
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"], "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def _public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("id", "name", "email", "phone", "role", "active", "created_at")}


async def user_from_token(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    u = await db().users.find_one({"id": payload["sub"]})
    if not u or not u.get("active", True):
        return None
    return u


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    token = authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None
    u = await user_from_token(token)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def bootstrap(database):
    """Create indexes and the first admin user if none exists."""
    init(database)
    d = db()
    for coll, keys in {
        "users": ["id", "email"], "leads": ["lead_id", "status", "assigned_to"],
        "customers": ["id", "phone_digits"], "policies": ["id", "customer_id", "end_date", "policy_number"],
        "claims": ["id", "policy_id", "customer_id"], "tasks": ["id", "due_date", "status"],
        "activities": ["entity_id"],
    }.items():
        for k in keys:
            try:
                await d[coll].create_index(k)
            except Exception as e:  # mongomock / permissions — never fatal
                logger.debug(f"index {coll}.{k}: {e}")
    if await d.users.count_documents({}) == 0:
        email = (os.environ.get("CRM_ADMIN_EMAIL") or os.environ.get("COMPANY_EMAIL")
                 or "admin@msquarecare.com").lower()
        pw = os.environ.get("CRM_ADMIN_PASSWORD") or os.environ.get("ADMIN_PASSCODE") or "msquare2026"
        await d.users.insert_one({
            "id": new_id(), "name": "Administrator", "email": email, "phone": "",
            "role": "admin", "active": True, "password_hash": hash_password(pw), "created_at": now_iso(),
        })
        logger.info(f"CRM bootstrap admin created: {email}")


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
async def login(body: LoginIn):
    u = await db().users.find_one({"email": body.email.strip().lower()})
    if not u or not u.get("active", True) or not verify_password(body.password, u.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": make_token(u), "user": _public_user(u)}


@router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return _public_user(user)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@router.post("/auth/password")
async def change_password(body: PasswordChange, user: dict = Depends(current_user)):
    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db().users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


# ---------------------------------------------------------------- users
class UserIn(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    role: Literal["admin", "agent"] = "agent"
    password: str = Field(min_length=6)


class UserPatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["admin", "agent"]] = None
    active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6)


@router.get("/users")
async def list_users(_: dict = Depends(current_user)):
    docs = await db().users.find().sort("name", 1).to_list(500)
    return [_public_user(u) for u in docs]


@router.post("/users")
async def create_user(body: UserIn, _: dict = Depends(admin_user)):
    email = body.email.strip().lower()
    if await db().users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    u = {"id": new_id(), "name": body.name, "email": email, "phone": body.phone or "", "role": body.role,
         "active": True, "password_hash": hash_password(body.password), "created_at": now_iso()}
    await db().users.insert_one(u)
    return _public_user(u)


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserPatch, me_: dict = Depends(admin_user)):
    upd = body.model_dump(exclude_none=True)
    if user_id == me_["id"] and (upd.get("active") is False or upd.get("role") == "agent"):
        raise HTTPException(status_code=400, detail="You cannot deactivate or demote yourself")
    if "password" in upd:
        upd["password_hash"] = hash_password(upd.pop("password"))
    res = await db().users.update_one({"id": user_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user(await db().users.find_one({"id": user_id}))


# ---------------------------------------------------------------- activities
async def log_activity(entity_type: str, entity_id: str, kind: str, text: str,
                       user: Optional[dict] = None, extra: Optional[dict] = None):
    doc = {"id": new_id(), "entity_type": entity_type, "entity_id": entity_id, "kind": kind, "text": text,
           "user_id": user["id"] if user else None, "user_name": user["name"] if user else "System",
           "created_at": now_iso()}
    if extra:
        doc.update(extra)
    await db().activities.insert_one(doc)
    return _clean(doc)


class ActivityIn(BaseModel):
    entity_type: Literal["lead", "customer", "policy", "claim"]
    entity_id: str
    kind: Literal["note", "call", "whatsapp", "email", "meeting"] = "note"
    text: str = Field(min_length=1)


@router.get("/activities")
async def list_activities(entity_id: Optional[str] = None, limit: int = 50,
                          _: dict = Depends(current_user)):
    q = {"entity_id": entity_id} if entity_id else {}
    docs = await db().activities.find(q).sort("created_at", -1).to_list(min(limit, 500))
    return [_clean(d) for d in docs]


@router.post("/activities")
async def add_activity(body: ActivityIn, user: dict = Depends(current_user)):
    return await log_activity(body.entity_type, body.entity_id, body.kind, body.text, user)


# ---------------------------------------------------------------- leads
class LeadIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    service: str = "Health Insurance"
    city: Optional[str] = None
    message: Optional[str] = None
    source: str = "walk-in"
    status: str = "new"
    assigned_to: Optional[str] = None
    expected_premium: Optional[float] = None
    follow_up_date: Optional[str] = None


class LeadPatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    service: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    expected_premium: Optional[float] = None
    follow_up_date: Optional[str] = None
    lost_reason: Optional[str] = None


def _check_stage(status: Optional[str]):
    if status is not None and status not in LEAD_STAGES:
        raise HTTPException(status_code=400, detail=f"status must be one of {LEAD_STAGES}")


@router.get("/leads")
async def list_leads(status: Optional[str] = None, assigned_to: Optional[str] = None,
                     q: Optional[str] = None, _: dict = Depends(current_user)):
    filt: dict = {}
    if status:
        filt["status"] = status
    if assigned_to:
        filt["assigned_to"] = assigned_to
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        filt["$or"] = [{"name": rx}, {"phone": rx}, {"email": rx}, {"city": rx}, {"service": rx}]
    docs = await db().leads.find(filt).sort("created_at", -1).to_list(5000)
    return [_clean(d) for d in docs]


@router.post("/leads")
async def create_lead(body: LeadIn, user: dict = Depends(current_user)):
    _check_stage(body.status)
    doc = body.model_dump()
    doc.update({"lead_id": new_id(), "created_at": now_iso(), "updated_at": now_iso()})
    await db().leads.insert_one(doc)
    await log_activity("lead", doc["lead_id"], "system", f"Lead created by {user['name']}", user)
    return _clean(doc)


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, _: dict = Depends(current_user)):
    d = await db().leads.find_one({"lead_id": lead_id})
    if not d:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _clean(d)


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadPatch, user: dict = Depends(current_user)):
    _check_stage(body.status)
    old = await db().leads.find_one({"lead_id": lead_id})
    if not old:
        raise HTTPException(status_code=404, detail="Lead not found")
    upd = body.model_dump(exclude_unset=True)
    upd["updated_at"] = now_iso()
    await db().leads.update_one({"lead_id": lead_id}, {"$set": upd})
    if "status" in upd and upd["status"] != old.get("status"):
        await log_activity("lead", lead_id, "system",
                           f"Stage changed: {old.get('status', 'new')} → {upd['status']}", user)
    if "assigned_to" in upd and upd["assigned_to"] != old.get("assigned_to"):
        a = await db().users.find_one({"id": upd["assigned_to"]}) if upd["assigned_to"] else None
        await log_activity("lead", lead_id, "system", f"Assigned to {a['name'] if a else 'nobody'}", user)
    return _clean(await db().leads.find_one({"lead_id": lead_id}))


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, _: dict = Depends(admin_user)):
    res = await db().leads.delete_one({"lead_id": lead_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db().activities.delete_many({"entity_id": lead_id})
    return {"ok": True}


class ConvertIn(BaseModel):
    address: Optional[str] = None
    dob: Optional[str] = None


@router.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: str, body: ConvertIn = ConvertIn(), user: dict = Depends(current_user)):
    lead = await db().leads.find_one({"lead_id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.get("customer_id"):
        cust = await db().customers.find_one({"id": lead["customer_id"]})
        if cust:
            return _clean(cust)
    # Reuse an existing customer with the same phone instead of duplicating
    cust = await db().customers.find_one({"phone_digits": _digits(lead["phone"])})
    if not cust:
        cust = {
            "id": new_id(), "name": lead["name"], "phone": lead["phone"], "phone_digits": _digits(lead["phone"]),
            "email": lead.get("email"), "city": lead.get("city"), "address": body.address, "dob": body.dob,
            "notes": lead.get("message"), "source": lead.get("source"), "lead_id": lead_id,
            "assigned_to": lead.get("assigned_to") or user["id"], "created_at": now_iso(),
        }
        await db().customers.insert_one(cust)
        await log_activity("customer", cust["id"], "system", f"Customer created from lead ({lead.get('service')})", user)
    await db().leads.update_one({"lead_id": lead_id}, {"$set": {
        "status": "won", "customer_id": cust["id"], "updated_at": now_iso()}})
    await log_activity("lead", lead_id, "system", f"Converted to customer {cust['name']}", user)
    return _clean(cust)


# ---------------------------------------------------------------- customers
class CustomerIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[str] = None
    pan: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    whatsapp_opt_out: bool = False


class CustomerPatch(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[str] = None
    pan: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    whatsapp_opt_out: Optional[bool] = None


@router.get("/customers")
async def list_customers(q: Optional[str] = None, _: dict = Depends(current_user)):
    filt: dict = {}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        filt["$or"] = [{"name": rx}, {"phone": rx}, {"email": rx}, {"city": rx}]
    docs = await db().customers.find(filt).sort("name", 1).to_list(5000)
    # attach policy counts / premium in one pass
    pols = await db().policies.find({"status": {"$in": ["active", "pending"]}}).to_list(20000)
    agg: dict = {}
    for p in pols:
        a = agg.setdefault(p["customer_id"], {"policy_count": 0, "total_premium": 0.0})
        a["policy_count"] += 1
        a["total_premium"] += float(p.get("premium") or 0)
    out = []
    for c in docs:
        c = _clean(c)
        c.update(agg.get(c["id"], {"policy_count": 0, "total_premium": 0.0}))
        out.append(c)
    return out


@router.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(current_user)):
    digits = _digits(body.phone)
    if await db().customers.find_one({"phone_digits": digits}):
        raise HTTPException(status_code=400, detail="A customer with this phone number already exists")
    doc = body.model_dump()
    doc.update({"id": new_id(), "phone_digits": digits, "assigned_to": body.assigned_to or user["id"],
                "created_at": now_iso()})
    await db().customers.insert_one(doc)
    await log_activity("customer", doc["id"], "system", f"Customer created by {user['name']}", user)
    return _clean(doc)


@router.get("/customers/{cid}")
async def get_customer(cid: str, _: dict = Depends(current_user)):
    c = await db().customers.find_one({"id": cid})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    policies = await db().policies.find({"customer_id": cid}).sort("end_date", -1).to_list(500)
    claims = await db().claims.find({"customer_id": cid}).sort("created_at", -1).to_list(500)
    tasks = await db().tasks.find({"customer_id": cid}).sort("due_date", 1).to_list(500)
    ids = [cid] + [p["id"] for p in policies] + [cl["id"] for cl in claims]
    if c.get("lead_id"):
        ids.append(c["lead_id"])
    acts = await db().activities.find({"entity_id": {"$in": ids}}).sort("created_at", -1).to_list(300)
    return {
        "customer": _clean(c),
        "policies": [_with_days(_clean(p)) for p in policies],
        "claims": [_clean(x) for x in claims],
        "tasks": [_clean(t) for t in tasks],
        "activities": [_clean(a) for a in acts],
    }


@router.patch("/customers/{cid}")
async def update_customer(cid: str, body: CustomerPatch, user: dict = Depends(current_user)):
    upd = body.model_dump(exclude_unset=True)
    if "phone" in upd:
        upd["phone_digits"] = _digits(upd["phone"])
        dup = await db().customers.find_one({"phone_digits": upd["phone_digits"], "id": {"$ne": cid}})
        if dup:
            raise HTTPException(status_code=400, detail="Another customer already uses this phone number")
    res = await db().customers.update_one({"id": cid}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _clean(await db().customers.find_one({"id": cid}))


@router.delete("/customers/{cid}")
async def delete_customer(cid: str, _: dict = Depends(admin_user)):
    if await db().policies.count_documents({"customer_id": cid}):
        raise HTTPException(status_code=400, detail="Customer has policies; delete or reassign them first")
    res = await db().customers.delete_one({"id": cid})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db().activities.delete_many({"entity_id": cid})
    await db().tasks.delete_many({"customer_id": cid})
    return {"ok": True}


# ---------------------------------------------------------------- policies
class PolicyIn(BaseModel):
    customer_id: str
    policy_number: str
    insurer: str
    policy_type: str = "Health"
    plan_name: Optional[str] = None
    sum_insured: Optional[float] = None
    premium: float = 0
    payment_mode: Literal["annual", "half-yearly", "quarterly", "monthly", "single"] = "annual"
    start_date: str
    end_date: str
    status: str = "active"
    commission_pct: Optional[float] = None
    vehicle_number: Optional[str] = None
    members: Optional[str] = None
    nominee: Optional[str] = None
    notes: Optional[str] = None


class PolicyPatch(BaseModel):
    policy_number: Optional[str] = None
    insurer: Optional[str] = None
    policy_type: Optional[str] = None
    plan_name: Optional[str] = None
    sum_insured: Optional[float] = None
    premium: Optional[float] = None
    payment_mode: Optional[Literal["annual", "half-yearly", "quarterly", "monthly", "single"]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    commission_pct: Optional[float] = None
    vehicle_number: Optional[str] = None
    members: Optional[str] = None
    nominee: Optional[str] = None
    notes: Optional[str] = None


def _with_days(p: dict) -> dict:
    end = _parse_date(p.get("end_date"))
    p["days_to_expiry"] = (end - today()).days if end else None
    p["commission_amount"] = round(float(p.get("premium") or 0) * float(p.get("commission_pct") or 0) / 100, 2)
    return p


def _validate_policy_dates(start: Optional[str], end: Optional[str]):
    s, e = _parse_date(start), _parse_date(end)
    if start and not s or end and not e:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    if s and e and e < s:
        raise HTTPException(status_code=400, detail="End date must be after start date")


async def _customer_names(ids) -> dict:
    docs = await db().customers.find({"id": {"$in": list(set(ids))}}).to_list(20000)
    return {c["id"]: c for c in docs}


@router.get("/policies")
async def list_policies(status: Optional[str] = None, policy_type: Optional[str] = None,
                        customer_id: Optional[str] = None, q: Optional[str] = None,
                        expiring_within: Optional[int] = Query(None, ge=0, le=365),
                        _: dict = Depends(current_user)):
    filt: dict = {}
    if status:
        filt["status"] = status
    if policy_type:
        filt["policy_type"] = policy_type
    if customer_id:
        filt["customer_id"] = customer_id
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        filt["$or"] = [{"policy_number": rx}, {"insurer": rx}, {"plan_name": rx}, {"vehicle_number": rx}]
    if expiring_within is not None:
        filt["status"] = {"$in": ["active", "expired"]} if not status else status
        filt["end_date"] = {"$lte": (today() + timedelta(days=expiring_within)).isoformat(),
                            "$gte": (today() - timedelta(days=30)).isoformat()}
    docs = await db().policies.find(filt).sort("end_date", 1).to_list(10000)
    custs = await _customer_names([p["customer_id"] for p in docs])
    out = []
    for p in docs:
        p = _with_days(_clean(p))
        c = custs.get(p["customer_id"])
        p["customer_name"] = c["name"] if c else "—"
        p["customer_phone"] = c["phone"] if c else ""
        out.append(p)
    return out


@router.post("/policies")
async def create_policy(body: PolicyIn, user: dict = Depends(current_user)):
    if body.status not in POLICY_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {POLICY_STATUSES}")
    _validate_policy_dates(body.start_date, body.end_date)
    if not await db().customers.find_one({"id": body.customer_id}):
        raise HTTPException(status_code=400, detail="Customer not found")
    if await db().policies.find_one({"policy_number": body.policy_number, "insurer": body.insurer}):
        raise HTTPException(status_code=400, detail="This policy number already exists for this insurer")
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(), "created_by": user["id"]})
    await db().policies.insert_one(doc)
    await log_activity("policy", doc["id"], "system",
                       f"Policy {doc['policy_number']} ({doc['insurer']}, {doc['policy_type']}) added", user)
    return _with_days(_clean(doc))


@router.get("/policies/{pid}")
async def get_policy(pid: str, _: dict = Depends(current_user)):
    p = await db().policies.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    p = _with_days(_clean(p))
    c = await db().customers.find_one({"id": p["customer_id"]})
    p["customer_name"] = c["name"] if c else "—"
    p["customer_phone"] = c["phone"] if c else ""
    return p


@router.patch("/policies/{pid}")
async def update_policy(pid: str, body: PolicyPatch, user: dict = Depends(current_user)):
    old = await db().policies.find_one({"id": pid})
    if not old:
        raise HTTPException(status_code=404, detail="Policy not found")
    upd = body.model_dump(exclude_unset=True)
    if "status" in upd and upd["status"] not in POLICY_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {POLICY_STATUSES}")
    _validate_policy_dates(upd.get("start_date", old.get("start_date")), upd.get("end_date", old.get("end_date")))
    await db().policies.update_one({"id": pid}, {"$set": upd})
    if "status" in upd and upd["status"] != old.get("status"):
        await log_activity("policy", pid, "system", f"Status: {old.get('status')} → {upd['status']}", user)
    return _with_days(_clean(await db().policies.find_one({"id": pid})))


@router.delete("/policies/{pid}")
async def delete_policy(pid: str, _: dict = Depends(admin_user)):
    if await db().claims.count_documents({"policy_id": pid}):
        raise HTTPException(status_code=400, detail="Policy has claims; it cannot be deleted")
    res = await db().policies.delete_one({"id": pid})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"ok": True}


class RenewIn(BaseModel):
    policy_number: Optional[str] = None
    premium: Optional[float] = None
    sum_insured: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    insurer: Optional[str] = None


@router.post("/policies/{pid}/renew")
async def renew_policy(pid: str, body: RenewIn = RenewIn(), user: dict = Depends(current_user)):
    old = await db().policies.find_one({"id": pid})
    if not old:
        raise HTTPException(status_code=404, detail="Policy not found")
    if old.get("status") == "renewed":
        raise HTTPException(status_code=400, detail="Policy already renewed")
    old_start, old_end = _parse_date(old.get("start_date")), _parse_date(old.get("end_date"))
    start = _parse_date(body.start_date) or (old_end + timedelta(days=1) if old_end else today())
    if body.end_date:
        end = _parse_date(body.end_date)
    elif old_start and old_end:
        end = start + (old_end - old_start)
    else:
        end = start + timedelta(days=364)
    _validate_policy_dates(start.isoformat(), end.isoformat() if end else None)
    new = {k: v for k, v in old.items() if k not in ("_id", "id", "created_at", "status", "renewed_to")}
    new.update({
        "id": new_id(), "policy_number": body.policy_number or old["policy_number"],
        "insurer": body.insurer or old["insurer"],
        "premium": body.premium if body.premium is not None else old.get("premium", 0),
        "sum_insured": body.sum_insured if body.sum_insured is not None else old.get("sum_insured"),
        "start_date": start.isoformat(), "end_date": end.isoformat(), "status": "active",
        "renewed_from": pid, "created_at": now_iso(), "created_by": user["id"],
    })
    await db().policies.insert_one(new)
    await db().policies.update_one({"id": pid}, {"$set": {"status": "renewed", "renewed_to": new["id"]}})
    # close open renewal tasks for this policy
    await db().tasks.update_many({"policy_id": pid, "status": "open", "kind": "renewal"},
                                 {"$set": {"status": "done", "completed_at": now_iso()}})
    # queued reminders for the old term are no longer relevant
    await db().reminders.update_many({"policy_id": pid, "status": {"$in": ["pending", "failed"]}},
                                     {"$set": {"status": "skipped", "error": "Policy renewed", "updated_at": now_iso()}})
    await log_activity("policy", pid, "system", f"Renewed → new term {new['start_date']} to {new['end_date']}", user)
    await log_activity("policy", new["id"], "system", f"Created as renewal of {old['policy_number']}", user)
    return _with_days(_clean(new))


@router.post("/renewals/generate-tasks")
async def generate_renewal_tasks(days: int = Query(30, ge=1, le=120), user: dict = Depends(current_user)):
    """Create a follow-up task for each active policy expiring within `days` that has none yet."""
    limit = (today() + timedelta(days=days)).isoformat()
    pols = await db().policies.find({"status": "active", "end_date": {"$lte": limit}}).to_list(5000)
    created = 0
    for p in pols:
        if await db().tasks.find_one({"policy_id": p["id"], "kind": "renewal", "status": "open"}):
            continue
        end = _parse_date(p["end_date"]) or today()
        due = max(today(), end - timedelta(days=7))
        c = await db().customers.find_one({"id": p["customer_id"]})
        await db().tasks.insert_one({
            "id": new_id(), "title": f"Renewal: {c['name'] if c else ''} — {p['policy_type']} {p['policy_number']}",
            "kind": "renewal", "due_date": due.isoformat(), "status": "open", "priority": "high",
            "assigned_to": (c or {}).get("assigned_to") or user["id"], "customer_id": p["customer_id"],
            "policy_id": p["id"], "notes": f"Policy expires on {p['end_date']} ({p['insurer']}).",
            "created_at": now_iso(), "created_by": user["id"],
        })
        created += 1
    return {"created": created}


# ---------------------------------------------------------------- claims
class ClaimIn(BaseModel):
    policy_id: str
    claim_type: Literal["cashless", "reimbursement", "own_damage", "third_party", "death", "other"] = "cashless"
    incident_date: Optional[str] = None
    claimed_amount: Optional[float] = None
    description: Optional[str] = None
    hospital_or_garage: Optional[str] = None
    claim_number: Optional[str] = None
    status: str = "intimated"


class ClaimPatch(BaseModel):
    claim_type: Optional[str] = None
    incident_date: Optional[str] = None
    claimed_amount: Optional[float] = None
    approved_amount: Optional[float] = None
    settled_amount: Optional[float] = None
    description: Optional[str] = None
    hospital_or_garage: Optional[str] = None
    claim_number: Optional[str] = None
    status: Optional[str] = None
    rejection_reason: Optional[str] = None


async def _create_claim(body: ClaimIn, user: Optional[dict], source: str = "crm") -> dict:
    if body.status not in CLAIM_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {CLAIM_STATUSES}")
    p = await db().policies.find_one({"id": body.policy_id})
    if not p:
        raise HTTPException(status_code=400, detail="Policy not found")
    doc = body.model_dump()
    doc.update({"id": new_id(), "customer_id": p["customer_id"], "policy_number": p["policy_number"],
                "insurer": p["insurer"], "policy_type": p["policy_type"], "source": source,
                "created_at": now_iso(), "updated_at": now_iso(),
                "history": [{"status": body.status, "at": now_iso(), "by": user["name"] if user else "Customer"}]})
    await db().claims.insert_one(doc)
    await log_activity("claim", doc["id"], "system",
                       f"Claim intimated on policy {p['policy_number']}" + (" (via customer portal)" if source == "portal" else ""),
                       user)
    return _clean(doc)


@router.get("/claims")
async def list_claims(status: Optional[str] = None, customer_id: Optional[str] = None,
                      _: dict = Depends(current_user)):
    filt: dict = {}
    if status == "open":
        filt["status"] = {"$nin": ["settled", "rejected"]}
    elif status:
        filt["status"] = status
    if customer_id:
        filt["customer_id"] = customer_id
    docs = await db().claims.find(filt).sort("created_at", -1).to_list(5000)
    custs = await _customer_names([c["customer_id"] for c in docs])
    out = []
    for c in docs:
        c = _clean(c)
        cu = custs.get(c["customer_id"])
        c["customer_name"] = cu["name"] if cu else "—"
        c["customer_phone"] = cu["phone"] if cu else ""
        out.append(c)
    return out


@router.post("/claims")
async def create_claim(body: ClaimIn, user: dict = Depends(current_user)):
    return await _create_claim(body, user)


@router.patch("/claims/{claim_id}")
async def update_claim(claim_id: str, body: ClaimPatch, user: dict = Depends(current_user)):
    old = await db().claims.find_one({"id": claim_id})
    if not old:
        raise HTTPException(status_code=404, detail="Claim not found")
    upd = body.model_dump(exclude_unset=True)
    if "status" in upd and upd["status"] not in CLAIM_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {CLAIM_STATUSES}")
    upd["updated_at"] = now_iso()
    ops: dict = {"$set": upd}
    if "status" in upd and upd["status"] != old.get("status"):
        ops["$push"] = {"history": {"status": upd["status"], "at": now_iso(), "by": user["name"]}}
        await log_activity("claim", claim_id, "system",
                           f"Claim {old.get('claim_number') or ''} status: {old.get('status')} → {upd['status']}".replace("  ", " "),
                           user)
    await db().claims.update_one({"id": claim_id}, ops)
    return _clean(await db().claims.find_one({"id": claim_id}))


# ---------------------------------------------------------------- tasks
class TaskIn(BaseModel):
    title: str
    due_date: str
    kind: Literal["follow_up", "renewal", "claim", "payment", "document", "other"] = "follow_up"
    priority: Literal["low", "medium", "high"] = "medium"
    assigned_to: Optional[str] = None
    customer_id: Optional[str] = None
    lead_id: Optional[str] = None
    policy_id: Optional[str] = None
    claim_id: Optional[str] = None
    notes: Optional[str] = None


class TaskPatch(BaseModel):
    title: Optional[str] = None
    due_date: Optional[str] = None
    kind: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    assigned_to: Optional[str] = None
    status: Optional[Literal["open", "done"]] = None
    notes: Optional[str] = None


@router.get("/tasks")
async def list_tasks(status: Optional[str] = "open", mine: bool = False, customer_id: Optional[str] = None,
                     lead_id: Optional[str] = None, user: dict = Depends(current_user)):
    filt: dict = {}
    if status and status != "all":
        filt["status"] = status
    if mine:
        filt["assigned_to"] = user["id"]
    if customer_id:
        filt["customer_id"] = customer_id
    if lead_id:
        filt["lead_id"] = lead_id
    docs = await db().tasks.find(filt).sort("due_date", 1).to_list(5000)
    custs = await _customer_names([t["customer_id"] for t in docs if t.get("customer_id")])
    t0 = today().isoformat()
    out = []
    for t in docs:
        t = _clean(t)
        t["overdue"] = t["status"] == "open" and t.get("due_date", t0) < t0
        cu = custs.get(t.get("customer_id"))
        t["customer_name"] = cu["name"] if cu else None
        t["customer_phone"] = cu["phone"] if cu else None
        out.append(t)
    return out


@router.post("/tasks")
async def create_task(body: TaskIn, user: dict = Depends(current_user)):
    if not _parse_date(body.due_date):
        raise HTTPException(status_code=400, detail="due_date must be YYYY-MM-DD")
    doc = body.model_dump()
    doc.update({"id": new_id(), "status": "open", "assigned_to": body.assigned_to or user["id"],
                "created_at": now_iso(), "created_by": user["id"]})
    await db().tasks.insert_one(doc)
    return _clean(doc)


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskPatch, user: dict = Depends(current_user)):
    upd = body.model_dump(exclude_unset=True)
    if upd.get("status") == "done":
        upd["completed_at"] = now_iso()
    res = await db().tasks.update_one({"id": task_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Task not found")
    t = await db().tasks.find_one({"id": task_id})
    if upd.get("status") == "done":
        ent = ("customer", t["customer_id"]) if t.get("customer_id") else (
            ("lead", t["lead_id"]) if t.get("lead_id") else None)
        if ent:
            await log_activity(ent[0], ent[1], "system", f"Task completed: {t['title']}", user)
    return _clean(t)


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, _: dict = Depends(current_user)):
    res = await db().tasks.delete_one({"id": task_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


# ---------------------------------------------------------------- dashboard
@router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    d = db()
    t = today()
    leads = await d.leads.find({}, {"status": 1, "created_at": 1, "service": 1, "source": 1}).to_list(50000)
    stage_counts = {s: 0 for s in LEAD_STAGES}
    for l in leads:
        stage_counts[l.get("status", "new") if l.get("status") in stage_counts else "new"] += 1
    month_start = t.replace(day=1).isoformat()
    new_leads_month = sum(1 for l in leads if (l.get("created_at") or "") >= month_start)
    closed = stage_counts["won"] + stage_counts["lost"]
    conversion = round(stage_counts["won"] * 100 / closed, 1) if closed else 0.0

    pols = await d.policies.find().to_list(50000)
    active = [p for p in pols if p.get("status") == "active"]
    by_type: dict = {}
    for p in active:
        by_type[p.get("policy_type", "Other")] = by_type.get(p.get("policy_type", "Other"), 0) + float(p.get("premium") or 0)

    # premium written per month (by policy start date), last 6 months
    months = []
    y, m = t.year, t.month
    for _ in range(6):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    months.reverse()
    monthly = {k: {"month": k, "premium": 0.0, "policies": 0, "commission": 0.0} for k in months}
    for p in pols:
        k = (p.get("start_date") or "")[:7]
        if k in monthly and p.get("status") != "cancelled":
            prem = float(p.get("premium") or 0)
            monthly[k]["premium"] += prem
            monthly[k]["policies"] += 1
            monthly[k]["commission"] += prem * float(p.get("commission_pct") or 0) / 100

    in30 = (t + timedelta(days=30)).isoformat()
    renewals = [p for p in active if t.isoformat() <= (p.get("end_date") or "") <= in30]
    overdue_renewals = [p for p in active if (p.get("end_date") or "9999") < t.isoformat()]
    claims = await d.claims.find({}, {"status": 1, "claimed_amount": 1}).to_list(50000)
    open_claims = [c for c in claims if c.get("status") not in ("settled", "rejected")]
    tasks_open = await d.tasks.find({"status": "open"}).to_list(10000)
    my_tasks = [x for x in tasks_open if x.get("assigned_to") == user["id"]]

    upcoming = sorted(renewals + overdue_renewals, key=lambda p: p.get("end_date", ""))[:8]
    custs = await _customer_names([p["customer_id"] for p in upcoming])
    upcoming_out = []
    for p in upcoming:
        p = _with_days(_clean(dict(p)))
        c = custs.get(p["customer_id"])
        p["customer_name"] = c["name"] if c else "—"
        p["customer_phone"] = c["phone"] if c else ""
        upcoming_out.append(p)

    return {
        "leads_total": len(leads),
        "leads_new_this_month": new_leads_month,
        "lead_stages": stage_counts,
        "conversion_rate": conversion,
        "customers_total": await d.customers.count_documents({}),
        "policies_active": len(active),
        "premium_active": round(sum(float(p.get("premium") or 0) for p in active), 2),
        "commission_active": round(sum(float(p.get("premium") or 0) * float(p.get("commission_pct") or 0) / 100
                                       for p in active), 2),
        "premium_by_type": [{"type": k, "premium": round(v, 2)} for k, v in sorted(by_type.items(), key=lambda x: -x[1])],
        "monthly": [dict(v, premium=round(v["premium"], 2), commission=round(v["commission"], 2)) for v in monthly.values()],
        "renewals_due_30": len(renewals),
        "renewals_overdue": len(overdue_renewals),
        "upcoming_renewals": upcoming_out,
        "claims_open": len(open_claims),
        "claims_open_amount": round(sum(float(c.get("claimed_amount") or 0) for c in open_claims), 2),
        "tasks_open": len(tasks_open),
        "tasks_overdue": sum(1 for x in tasks_open if (x.get("due_date") or "9999") < t.isoformat()),
        "reminders_pending": await d.reminders.count_documents({"status": "pending"}),
        "my_tasks_today": sum(1 for x in my_tasks if (x.get("due_date") or "9999") <= t.isoformat()),
    }


# ---------------------------------------------------------------- exports
def _csv(rows: List[dict], cols: List[str], filename: str) -> PlainTextResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for r in rows:
        w.writerow(["" if r.get(c) is None else r.get(c) for c in cols])
    return PlainTextResponse(buf.getvalue(), headers={
        "Content-Disposition": f"attachment; filename={filename}", "Content-Type": "text/csv"})


@router.get("/export/{kind}")
async def export(kind: Literal["leads", "customers", "policies", "claims"], user: dict = Depends(current_user)):
    if kind == "leads":
        rows = [_clean(x) for x in await db().leads.find().sort("created_at", -1).to_list(50000)]
        cols = ["name", "phone", "email", "service", "city", "source", "status", "expected_premium",
                "follow_up_date", "message", "created_at"]
    elif kind == "customers":
        rows = [_clean(x) for x in await db().customers.find().sort("name", 1).to_list(50000)]
        cols = ["name", "phone", "email", "city", "address", "dob", "pan", "created_at"]
    elif kind == "policies":
        rows = await list_policies(status=None, policy_type=None, customer_id=None, q=None, expiring_within=None, _=user)
        cols = ["policy_number", "customer_name", "customer_phone", "insurer", "policy_type", "plan_name",
                "sum_insured", "premium", "commission_pct", "commission_amount", "start_date", "end_date", "status"]
    else:
        rows = await list_claims(status=None, customer_id=None, _=user)
        cols = ["claim_number", "customer_name", "policy_number", "insurer", "claim_type", "incident_date",
                "claimed_amount", "approved_amount", "settled_amount", "status", "created_at"]
    return _csv(rows, cols, f"msquare_{kind}.csv")


@router.get("/meta")
async def meta(_: dict = Depends(current_user)):
    return {"lead_stages": LEAD_STAGES, "policy_types": POLICY_TYPES, "policy_statuses": POLICY_STATUSES,
            "claim_statuses": CLAIM_STATUSES, "activity_kinds": ACTIVITY_KINDS}


# ---------------------------------------------------------------- public customer portal
class PortalLookup(BaseModel):
    phone: str
    policy_number: str


class PortalRequest(PortalLookup):
    kind: Literal["renewal", "claim", "endorsement", "callback"]
    message: Optional[str] = None
    claimed_amount: Optional[float] = None
    incident_date: Optional[str] = None


async def _portal_match(phone: str, policy_number: str):
    digits = _digits(phone)
    if len(digits) < 10 or not policy_number.strip():
        raise HTTPException(status_code=400, detail="Enter your 10-digit mobile number and policy number")
    pols = await db().policies.find({"policy_number": policy_number.strip()}).to_list(20)
    for p in pols:
        c = await db().customers.find_one({"id": p["customer_id"]})
        if c and c.get("phone_digits") == digits:
            return p, c
    # same message for both cases so the portal can't be used to enumerate policy numbers
    raise HTTPException(status_code=404, detail="No policy found for this mobile number and policy number")


def _portal_policy(p: dict) -> dict:
    p = _with_days(dict(p))
    return {k: p.get(k) for k in ("policy_number", "insurer", "policy_type", "plan_name", "sum_insured", "premium",
                                  "start_date", "end_date", "status", "days_to_expiry", "vehicle_number")}


@portal_router.post("/lookup")
async def portal_lookup(body: PortalLookup):
    p, c = await _portal_match(body.phone, body.policy_number)
    others = await db().policies.find({"customer_id": c["id"], "status": {"$in": ["active", "pending"]}}).to_list(50)
    claims = await db().claims.find({"customer_id": c["id"]}).sort("created_at", -1).to_list(50)
    return {
        "customer": {"name": c["name"], "city": c.get("city")},
        "policy": _portal_policy(p),
        "other_policies": [_portal_policy(x) for x in others if x["id"] != p["id"]],
        "claims": [{k: x.get(k) for k in ("claim_number", "policy_number", "claim_type", "claimed_amount",
                                          "approved_amount", "settled_amount", "status", "created_at")}
                   for x in claims],
    }


@portal_router.post("/requests")
async def portal_request(body: PortalRequest):
    p, c = await _portal_match(body.phone, body.policy_number)
    if body.kind == "claim":
        claim = await _create_claim(ClaimIn(policy_id=p["id"], claimed_amount=body.claimed_amount,
                                            incident_date=body.incident_date, description=body.message,
                                            claim_type="other"), None, source="portal")
        ref = claim["id"][:8].upper()
    else:
        ref = new_id()[:8].upper()
    labels = {"renewal": "Renewal request", "claim": "Claim intimation", "endorsement": "Endorsement / correction",
              "callback": "Callback request"}
    await db().tasks.insert_one({
        "id": new_id(), "title": f"{labels[body.kind]} from portal: {c['name']} ({p['policy_number']})",
        "kind": "claim" if body.kind == "claim" else ("renewal" if body.kind == "renewal" else "follow_up"),
        "due_date": today().isoformat(), "status": "open", "priority": "high",
        "assigned_to": c.get("assigned_to"), "customer_id": c["id"], "policy_id": p["id"],
        "notes": body.message, "created_at": now_iso(), "created_by": None, "source": "portal",
    })
    await log_activity("customer", c["id"], "system",
                       f"{labels[body.kind]} submitted via customer portal" + (f": {body.message}" if body.message else ""))
    return {"ok": True, "reference": ref}
