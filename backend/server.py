from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse, PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import base64
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator, EmailStr
from typing import List, Optional, Annotated, Any
from bson import ObjectId
import uuid
from datetime import datetime, timezone
from PIL import Image

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
ADMIN_PASSCODE = os.environ['ADMIN_PASSCODE']
WHATSAPP_NUMBER = os.environ['WHATSAPP_NUMBER']
GEMINI_MODEL = "gemini-3.1-pro-preview"

app = FastAPI(title="MSquare Care Solutions API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Mongo base model ----------
def _validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data

    @classmethod
    def from_mongo(cls, doc: dict):
        if not doc:
            return None
        return cls(**doc)


# ---------- Models ----------
SERVICE_OPTIONS = [
    "Health Insurance", "Motor Insurance", "General Insurance",
    "Term / Life Insurance", "Business Solutions", "Loans & Finance", "AI Automations",
]


class LeadCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    service: str
    city: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "website"


class Lead(BaseDocument):
    lead_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    service: str
    city: Optional[str] = None
    message: Optional[str] = None
    source: str = "website"
    status: str = "new"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChatRequest(BaseModel):
    session_id: str
    message: str


# ---------- Auth dependency ----------
def require_admin(x_admin_passcode: Optional[str] = Header(None)):
    if x_admin_passcode != ADMIN_PASSCODE:
        raise HTTPException(status_code=401, detail="Invalid admin passcode")
    return True


SYSTEM_PROMPT = (
    "You are 'MSquare Assist', the friendly AI advisor for MSquare Care Solutions, "
    "a trusted insurance and business consultancy based in Trichy, Tamil Nadu, India. "
    "Founder/consultant: Marimuthu R. We help with Health Insurance, Motor Insurance, "
    "General Insurance, Term/Life Insurance, Business Solutions, Loans & Finance and AI Automations. "
    "Answer clearly and concisely in simple language (English or Tamil if asked). "
    "Guide users to get a free quote and, for detailed needs, suggest they contact us on "
    "WhatsApp 8072571879 or email msquarecare@gmail.com. Never give binding legal/financial guarantees; "
    "recommend confirming policy details with our consultant."
)


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "MSquare Care Solutions API running"}


@api_router.get("/config")
async def get_config():
    return {"whatsapp_number": WHATSAPP_NUMBER, "services": SERVICE_OPTIONS}


@api_router.post("/leads", response_model=Lead)
async def create_lead(payload: LeadCreate):
    lead = Lead(**payload.model_dump())
    await db.leads.insert_one(lead.to_mongo())
    logger.info(f"New lead captured: {lead.name} / {lead.service}")
    return lead


@api_router.get("/admin/leads", response_model=List[Lead])
async def list_leads(_: bool = Depends(require_admin)):
    docs = await db.leads.find().sort("created_at", -1).to_list(2000)
    return [Lead.from_mongo(d) for d in docs]


@api_router.get("/admin/leads/export")
async def export_leads(passcode: str):
    if passcode != ADMIN_PASSCODE:
        raise HTTPException(status_code=401, detail="Invalid admin passcode")
    docs = await db.leads.find().sort("created_at", -1).to_list(5000)
    lines = ["Name,Phone,Email,Service,City,Message,Source,Status,Created At"]
    for d in docs:
        row = [
            d.get("name", ""), d.get("phone", ""), d.get("email", "") or "",
            d.get("service", ""), d.get("city", "") or "",
            (d.get("message", "") or "").replace("\n", " ").replace(",", ";"),
            d.get("source", ""), d.get("status", ""), d.get("created_at", ""),
        ]
        lines.append(",".join('"' + str(x).replace('"', "'") + '"' for x in row))
    csv_data = "\n".join(lines)
    return PlainTextResponse(csv_data, headers={
        "Content-Disposition": "attachment; filename=msquare_leads.csv",
        "Content-Type": "text/csv",
    })


@api_router.patch("/admin/leads/{lead_id}")
async def update_lead_status(lead_id: str, status: str = Form(...), _: bool = Depends(require_admin)):
    await db.leads.update_one({"lead_id": lead_id}, {"$set": {"status": status}})
    return {"ok": True}


def _prep_image_b64(raw: bytes) -> str:
    img = Image.open(io.BytesIO(raw))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    img.thumbnail((1280, 1280))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@api_router.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...), context: str = Form("")):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        image_b64 = _prep_image_b64(raw)
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        raise HTTPException(status_code=400, detail="Unsupported or corrupt image. Upload a JPG/PNG image.")

    focus = context.strip() or "auto-detect the document type"
    prompt = (
        "You are an insurance & finance document expert for MSquare Care Solutions. "
        f"The user wants you to analyse this uploaded image (focus: {focus}). "
        "Identify what the document/image is (e.g. health policy, motor policy, RC book, medical report, "
        "vehicle damage photo, bank/loan statement, ID proof). Then respond in this exact structure using markdown:\n"
        "## What this is\n(one line)\n"
        "## Key details\n(bullet points of the most important extracted info)\n"
        "## What it means for you\n(plain-language explanation)\n"
        "## Recommended next step\n(1-2 actionable suggestions, mention contacting MSquare Care on WhatsApp 8072571879 if relevant)\n"
        "If the image is unclear or not a document, say so politely and ask for a clearer photo."
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"analyze-{uuid.uuid4()}",
                   system_message=SYSTEM_PROMPT).with_model("gemini", GEMINI_MODEL)
    try:
        result = await chat.send_message(UserMessage(
            text=prompt, file_contents=[ImageContent(image_base64=image_b64)]))
    except Exception as e:
        logger.error(f"LLM analyze failed: {e}")
        raise HTTPException(status_code=502, detail="AI analysis service unavailable. Please try again.")

    analysis = result if isinstance(result, str) else str(result)
    await db.analyses.insert_one({
        "id": str(uuid.uuid4()),
        "filename": file.filename,
        "context": context,
        "analysis": analysis,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"analysis": analysis}


@api_router.post("/chat")
async def chat_stream(req: ChatRequest):
    history = await db.chat_messages.find(
        {"session_id": req.session_id}).sort("ts", 1).to_list(50)

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=req.session_id,
                   system_message=SYSTEM_PROMPT).with_model("gemini", GEMINI_MODEL)

    # Rebuild context by prepending prior turns into the message thread
    context_lines = []
    for m in history[-10:]:
        role = "User" if m["role"] == "user" else "Assistant"
        context_lines.append(f"{role}: {m['content']}")
    convo_prefix = ("\n".join(context_lines) + "\n\n") if context_lines else ""
    user_text = f"{convo_prefix}User: {req.message}\nAssistant:"

    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": req.session_id, "role": "user",
        "content": req.message, "ts": datetime.now(timezone.utc).isoformat(),
    })

    async def event_gen():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=user_text)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield "\n\nSorry, I'm having trouble right now. Please reach us on WhatsApp 8072571879."
        finally:
            if full:
                await db.chat_messages.insert_one({
                    "id": str(uuid.uuid4()), "session_id": req.session_id, "role": "assistant",
                    "content": full, "ts": datetime.now(timezone.utc).isoformat(),
                })

    return StreamingResponse(event_gen(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
