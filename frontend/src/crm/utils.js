export const inr = (n, compact = false) => {
  const v = Number(n || 0);
  if (compact && Math.abs(v) >= 100000) {
    return `₹${(v / 100000).toFixed(v >= 1000000 ? 1 : 2).replace(/\.0+$/, "")}L`;
  }
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const isoToday = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const addYear = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const waNumber = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export const waTo = (phone, text) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text || "")}`;

export const label = (s) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const LEAD_STAGES = ["new", "contacted", "quoted", "negotiation", "won", "lost"];
export const POLICY_TYPES = ["Health", "Motor", "Term / Life", "General", "Travel", "Home", "Business", "Other"];
export const POLICY_STATUSES = ["active", "pending", "lapsed", "cancelled", "renewed", "expired"];
export const CLAIM_STATUSES = ["intimated", "documents_pending", "submitted", "under_review", "approved", "settled", "rejected"];
export const INSURERS = [
  "Star Health", "Niva Bupa", "Care Health", "HDFC ERGO", "ICICI Lombard", "Bajaj Allianz",
  "Tata AIG", "New India Assurance", "United India", "National Insurance", "Oriental Insurance",
  "LIC", "HDFC Life", "ICICI Prudential Life", "Max Life", "SBI Life", "Digit", "Acko",
];
export const SERVICES = [
  "Health Insurance", "Motor Insurance", "General Insurance", "Term / Life Insurance",
  "Business Solutions", "Loans & Finance", "AI Automations",
];
export const LEAD_SOURCES = ["website", "walk-in", "referral", "whatsapp", "phone", "campaign", "chatbot"];
