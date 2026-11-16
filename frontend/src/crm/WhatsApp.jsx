import React, { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { WhatsappLogo } from "@phosphor-icons/react";
import { crm } from "./api";
import { useAuth } from "./AuthContext";
import { Btn, Field, Modal, Select, Textarea } from "./ui";
import { fmtDate, hasWhatsApp, inr, isMobile, label, openWhatsApp, waNumber } from "./utils";

/*
 * Ready-made WhatsApp messages for customers and leads, in English and Tamil.
 * Wording follows MSquare Care's rules: polite, no pressure, never promises a
 * claim outcome. Every message opens in WhatsApp for the user to review and
 * send themselves — nothing is sent automatically.
 */

const SIGNATURE = {
  en: (sender) => `\n\n— ${sender ? `${sender}, ` : ""}MSquare Care Solutions, Trichy\n📞 8072571879 | msquarecare.in\nIRDAI-registered agent: Care Health Insurance (Code 20978740) & SBI Life`,
  ta: (sender) => `\n\n— ${sender ? `${sender}, ` : ""}MSquare Care Solutions, திருச்சி\n📞 8072571879 | msquarecare.in\nIRDAI பதிவு பெற்ற முகவர்: Care Health Insurance (குறியீடு 20978740) & SBI Life`,
};

// needs: "policy" | "claim" | null — which record the message is about.
const TEMPLATES = [
  {
    id: "general", label: "Message", for: ["customer", "lead"], needs: null,
    en: (v) => `Hello ${v.name}, greetings from MSquare Care Solutions. `,
    ta: (v) => `வணக்கம் ${v.name}, MSquare Care Solutions-இலிருந்து வாழ்த்துகள். `,
  },
  {
    id: "renewal", label: "Renewal reminder", for: ["customer"], needs: "policy",
    en: (v) => `Hello ${v.name}, a gentle reminder that your ${v.policy_type} policy ${v.policy_number} with ${v.insurer} is due for renewal on ${v.end_date}. Renewing on time keeps your cover continuous. Shall I share the renewal details? Happy to help with any questions.`,
    ta: (v) => `வணக்கம் ${v.name}, ${v.insurer} நிறுவனத்தின் உங்கள் ${v.policy_type} பாலிசி (${v.policy_number}) ${v.end_date} அன்று புதுப்பிக்க வேண்டியுள்ளது என்பதை அன்புடன் நினைவூட்டுகிறோம். குறித்த நேரத்தில் புதுப்பித்தால் உங்கள் காப்பீடு தொடர்ந்து இருக்கும். புதுப்பிப்பு விவரங்களை அனுப்பட்டுமா? ஏதேனும் சந்தேகம் இருந்தால் கேளுங்கள்.`,
  },
  {
    id: "expired", label: "Policy expired", for: ["customer"], needs: "policy",
    en: (v) => `Hello ${v.name}, your ${v.policy_type} policy ${v.policy_number} with ${v.insurer} expired on ${v.end_date}. To avoid a gap in your cover, I can help you renew it at the earliest. Please let me know a convenient time to talk.`,
    ta: (v) => `வணக்கம் ${v.name}, ${v.insurer} நிறுவனத்தின் உங்கள் ${v.policy_type} பாலிசி (${v.policy_number}) ${v.end_date} அன்று காலாவதியாகிவிட்டது. காப்பீட்டில் இடைவெளி ஏற்படாமல் இருக்க, விரைவில் புதுப்பிக்க உதவுகிறேன். பேச உங்களுக்கு வசதியான நேரத்தைத் தெரிவியுங்கள்.`,
  },
  {
    id: "issued", label: "Policy issued", for: ["customer"], needs: "policy",
    en: (v) => `Hello ${v.name}, your ${v.policy_type} policy ${v.policy_number} with ${v.insurer} is active from ${v.start_date}. I will share the policy copy shortly. Please save this number for any service needs.`,
    ta: (v) => `வணக்கம் ${v.name}, ${v.insurer} நிறுவனத்தின் உங்கள் ${v.policy_type} பாலிசி (${v.policy_number}) ${v.start_date} முதல் நடைமுறைக்கு வந்துள்ளது. பாலிசி நகலை விரைவில் அனுப்புகிறேன். எந்தச் சேவைக்கும் இந்த எண்ணைச் சேமித்து வையுங்கள்.`,
  },
  {
    id: "claim", label: "Claim update", for: ["customer"], needs: "claim",
    en: (v) => `Hello ${v.name}, an update on your claim${v.claim_number ? ` ${v.claim_number}` : ""} for policy ${v.policy_number}: the current status is "${v.claim_status}". I am following up with the insurer and will keep you informed.`,
    ta: (v) => `வணக்கம் ${v.name}, பாலிசி ${v.policy_number}-க்கான உங்கள் கிளைம்${v.claim_number ? ` ${v.claim_number}` : ""} குறித்த தகவல்: தற்போதைய நிலை – "${v.claim_status}". காப்பீட்டு நிறுவனத்துடன் தொடர்ந்து பின்தொடர்ந்து, உங்களுக்குத் தகவல் தெரிவிக்கிறேன்.`,
  },
  {
    id: "documents", label: "Documents needed", for: ["customer", "lead"], needs: null,
    en: (v) => `Hello ${v.name}, to proceed with your ${v.topic}, please share the following documents:\n• \n• \nClear photos sent here on WhatsApp are fine. Thank you.`,
    ta: (v) => `வணக்கம் ${v.name}, உங்கள் ${v.topic_ta} தொடர்பாகத் தொடர, பின்வரும் ஆவணங்களை அனுப்புங்கள்:\n• \n• \nதெளிவான புகைப்படங்களை இங்கே WhatsApp-இல் அனுப்பலாம். நன்றி.`,
  },
  {
    id: "birthday", label: "Birthday wishes", for: ["customer"], needs: null, signature: false,
    en: (v) => `Wishing you a very happy birthday, ${v.name}! Warm wishes to you and your family from all of us at MSquare Care Solutions.`,
    ta: (v) => `இனிய பிறந்தநாள் வாழ்த்துகள், ${v.name}! MSquare Care Solutions சார்பாக உங்களுக்கும் உங்கள் குடும்பத்தினருக்கும் அன்பான வாழ்த்துகள்.`,
  },
  {
    id: "review", label: "Free policy review", for: ["lead", "customer"], needs: null,
    en: (v) => `Hello ${v.name}, thank you for your interest in ${v.service}. I offer a free policy review to help you understand your current cover and your options. When would be a good time for a short call?`,
    ta: (v) => `வணக்கம் ${v.name}, ${v.service} குறித்து ஆர்வம் காட்டியதற்கு நன்றி. உங்கள் தற்போதைய காப்பீட்டையும் விருப்பங்களையும் புரிந்துகொள்ள இலவச பாலிசி மதிப்பாய்வு செய்து தருகிறேன். ஒரு சிறிய அழைப்புக்கு எந்த நேரம் வசதியாக இருக்கும்?`,
  },
  {
    id: "followup", label: "Follow-up", for: ["lead"], needs: null,
    en: (v) => `Hello ${v.name}, following up on our conversation about ${v.service}. Please let me know if you have any questions or would like to go ahead.`,
    ta: (v) => `வணக்கம் ${v.name}, ${v.service} குறித்த நமது உரையாடலைத் தொடர்ந்து தொடர்புகொள்கிறேன். ஏதேனும் கேள்விகள் இருந்தால் அல்லது தொடர விரும்பினால் தெரிவியுங்கள்.`,
  },
];

const LANG_KEY = "msq_wa_lang";
const readLang = () => {
  try { return localStorage.getItem(LANG_KEY) === "ta" ? "ta" : "en"; } catch { return "en"; }
};

/**
 * WhatsApp button + composer.
 *  person:   { type: "customer" | "lead", id, name, phone, service? }
 *  policies: the customer's policies (for renewal / expiry / issued messages)
 *  claims:   the customer's claims (for claim updates)
 *  template / policyId: what to preselect, e.g. "renewal" from the Renewals page
 *  variant:  "button" (labelled) or "icon" (green symbol only)
 */
export function WhatsAppButton({ person, policies = [], claims = [], template, policyId, variant = "button", className = "", onSent }) {
  const [open, setOpen] = useState(false);
  const ok = hasWhatsApp(person.phone);
  const title = ok ? `WhatsApp ${person.name}` : "No valid mobile number";
  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={() => setOpen(true)} disabled={!ok} title={title} aria-label={title}
          className={`text-brand-green hover:text-brand-greenDark disabled:text-slate-300 ${className}`} data-testid="wa-icon">
          <WhatsappLogo size={22} weight="fill" />
        </button>
      ) : (
        <Btn variant="outline" onClick={() => setOpen(true)} disabled={!ok} title={title} className={className} data-testid="wa-button">
          <WhatsappLogo size={17} weight="fill" className="text-brand-green" /> WhatsApp
        </Btn>
      )}
      {open && (
        <Composer person={person} policies={policies} claims={claims} template={template} policyId={policyId}
          onClose={() => setOpen(false)} onSent={onSent} />
      )}
    </>
  );
}

function Composer({ person, policies, claims, template, policyId, onClose, onSent }) {
  const { user } = useAuth();
  const sender = user?.name && user.name !== "Administrator" ? user.name : "";
  const available = TEMPLATES.filter((t) => t.for.includes(person.type)
    && (t.needs !== "policy" || policies.length) && (t.needs !== "claim" || claims.length));
  const [tplId, setTplId] = useState(available.some((t) => t.id === template) ? template : "general");
  const [lang, setLang] = useState(readLang);
  const [polId, setPolId] = useState(policyId || policies.find((p) => p.status === "active")?.id || policies[0]?.id || "");
  const [claimId, setClaimId] = useState(claims[0]?.id || "");
  const [withSig, setWithSig] = useState(true);
  const [text, setText] = useState("");

  const tpl = TEMPLATES.find((t) => t.id === tplId) || TEMPLATES[0];
  const policy = policies.find((p) => p.id === polId);
  const claim = claims.find((c) => c.id === claimId);

  const draft = useMemo(() => {
    const p = tpl.needs === "claim" ? policies.find((x) => x.id === claim?.policy_id) || claim || {} : policy || {};
    const v = {
      name: (person.name || "").split(" ")[0] || person.name,
      policy_type: p.policy_type || "", policy_number: p.policy_number || claim?.policy_number || "",
      insurer: p.insurer || claim?.insurer || "", end_date: fmtDate(p.end_date), start_date: fmtDate(p.start_date),
      premium: inr(p.premium), claim_number: claim?.claim_number || "", claim_status: label(claim?.status || ""),
      service: person.service || "insurance", topic: person.type === "lead" ? "application" : "policy request",
      topic_ta: person.type === "lead" ? "விண்ணப்பம்" : "பாலிசி கோரிக்கை",
    };
    const body = tpl[lang](v);
    return withSig && tpl.signature !== false ? body + SIGNATURE[lang](sender) : body;
  }, [tpl, lang, policy, claim, policies, person, withSig, sender]);

  // Rebuild the message whenever the choice changes; the user can still edit it freely afterwards.
  useEffect(() => setText(draft), [draft]);
  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const send = () => {
    if (!openWhatsApp(person.phone, text)) {
      toast.error("Your browser blocked the WhatsApp window. Allow pop-ups for this site and try again.");
      return;
    }
    // Record that a message was prepared; the user still presses send in WhatsApp.
    crm.post("/activities", {
      entity_type: person.type, entity_id: person.id, kind: "whatsapp",
      text: `WhatsApp (${tpl.label}) opened to send:\n${text.slice(0, 500)}`,
    }).then(() => onSent?.()).catch(() => {});
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} wide
      title={<span className="flex items-center gap-2"><WhatsappLogo size={22} weight="fill" className="text-brand-green" /> WhatsApp {person.name}</span>}
      description={`+${waNumber(person.phone)} · choose a message, review it, then send it from WhatsApp.`}>
      <div className="space-y-3" data-testid="wa-composer">
        <div className="flex flex-wrap gap-1.5">
          {available.map((t) => (
            <button key={t.id} type="button" onClick={() => setTplId(t.id)} data-testid={`wa-tpl-${t.id}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                tplId === t.id ? "bg-brand-green text-white border-brand-green" : "border-slate-200 text-slate-600 hover:border-brand-green/50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tpl.needs === "policy" && (
            <Field label="Policy">
              <Select value={polId} onChange={setPolId}
                options={policies.map((p) => ({ value: p.id, label: `${p.policy_type} · ${p.policy_number} · ${p.insurer} (${label(p.status)})` }))} />
            </Field>
          )}
          {tpl.needs === "claim" && (
            <Field label="Claim">
              <Select value={claimId} onChange={setClaimId}
                options={claims.map((c) => ({ value: c.id, label: `${c.claim_number || "Claim"} · ${c.policy_number} (${label(c.status)})` }))} />
            </Field>
          )}
          <Field label="Language">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {[["en", "English"], ["ta", "தமிழ்"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setLang(k)} data-testid={`wa-lang-${k}`}
                  className={`px-3 py-1 rounded-md text-sm ${lang === k ? "bg-navy text-white" : "text-slate-600"}`}>{l}</button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Message (you can edit it)">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[190px] text-sm leading-6" data-testid="wa-text" />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="accent-navy" checked={withSig} onChange={(e) => setWithSig(e.target.checked)} disabled={tpl.signature === false} />
            Add signature with IRDAI details
          </label>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn variant="green" onClick={send} disabled={!text.trim()} data-testid="wa-send">
              <WhatsappLogo size={17} weight="fill" /> {isMobile() ? "Open WhatsApp" : "Open WhatsApp Web"}
            </Btn>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Opens the chat with this message typed in. Nothing is sent until you press send in WhatsApp.
          {!isMobile() && " First time? Scan the QR code on WhatsApp Web with your phone to link it."}
        </p>
      </div>
    </Modal>
  );
}
