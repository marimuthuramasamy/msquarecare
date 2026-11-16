import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft, WhatsappLogo, CheckCircle } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API, PHONE, waLink } from "@/lib/config";
import { BrandHeader } from "@/components/Logo";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (s) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const pretty = (s) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const REQUESTS = [
  { kind: "renewal", label: "Renew my policy" },
  { kind: "claim", label: "Report a claim" },
  { kind: "endorsement", label: "Change / correction" },
  { kind: "callback", label: "Request a callback" },
];

function PolicyCard({ p, primary }) {
  const due = p.status === "active" && p.days_to_expiry !== null && p.days_to_expiry <= 45;
  return (
    <div className={`rounded-xl border p-4 ${primary ? "border-navy/20 bg-navy/[0.03]" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display font-semibold text-navy">{p.policy_type} · {p.insurer}</div>
          <div className="text-xs text-slate-500">Policy {p.policy_number}{p.plan_name ? ` · ${p.plan_name}` : ""}{p.vehicle_number ? ` · ${p.vehicle_number}` : ""}</div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{pretty(p.status)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><dt className="text-xs text-slate-500">Premium</dt><dd className="font-semibold tabular-nums">{inr(p.premium)}</dd></div>
        <div><dt className="text-xs text-slate-500">Sum insured</dt><dd className="font-semibold tabular-nums">{p.sum_insured ? inr(p.sum_insured) : "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Start</dt><dd>{fmtDate(p.start_date)}</dd></div>
        <div><dt className="text-xs text-slate-500">Renewal due</dt><dd className={due ? "text-red-600 font-semibold" : ""}>{fmtDate(p.end_date)}</dd></div>
      </dl>
      {due && (
        <p className="mt-3 text-sm text-red-600">
          {p.days_to_expiry < 0 ? `Expired ${-p.days_to_expiry} days ago — renew now to stay covered.` : `Renews in ${p.days_to_expiry} days.`}
        </p>
      )}
    </div>
  );
}

export default function PortalPage() {
  const [creds, setCreds] = useState({ phone: "", policy_number: "" });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState({ kind: "renewal", message: "", claimed_amount: "", incident_date: "" });
  const [done, setDone] = useState(null);

  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await axios.post(`${API}/portal/lookup`, creds);
      setData(r.data);
      setDone(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not find your policy.");
    } finally {
      setBusy(false);
    }
  };

  const submitReq = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...creds, kind: req.kind, message: req.message || null };
      if (req.kind === "claim") {
        body.claimed_amount = req.claimed_amount ? Number(req.claimed_amount) : null;
        body.incident_date = req.incident_date || null;
      }
      const r = await axios.post(`${API}/portal/requests`, body);
      setDone(r.data.reference);
      setReq({ kind: "renewal", message: "", claimed_amount: "", incident_date: "" });
      const fresh = await axios.post(`${API}/portal/lookup`, creds);
      setData(fresh.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-4xl px-4 h-16 flex items-center justify-between">
          <Link to="/"><BrandHeader /></Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-navy flex items-center gap-1"><ArrowLeft size={16} /> Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10" data-testid="portal-page">
        <div className="flex items-center gap-2 text-brand-greenDark text-sm font-semibold"><ShieldCheck size={18} weight="fill" /> Customer self-service</div>
        <h1 className="font-display text-3xl font-bold text-navy mt-1">My Policy</h1>
        <p className="text-slate-500 mt-1">Check your policy status and renewal date, track claims, or send us a request.</p>

        {!data ? (
          <form onSubmit={lookup} className="mt-6 max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-3" data-testid="portal-lookup">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">Registered mobile number</span>
              <Input required inputMode="tel" value={creds.phone} onChange={(e) => setCreds({ ...creds, phone: e.target.value })} placeholder="10-digit mobile" data-testid="portal-phone" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">Policy number</span>
              <Input required value={creds.policy_number} onChange={(e) => setCreds({ ...creds, policy_number: e.target.value })} placeholder="As printed on your policy" data-testid="portal-policy" />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-dark disabled:opacity-50" data-testid="portal-lookup-btn">
              {busy ? "Checking…" : "View my policy"}
            </button>
            <p className="text-xs text-slate-500 text-center">
              Can't find it? <a className="text-brand-greenDark font-semibold" href={waLink("Hi MSquare Care, I need help finding my policy details.")} target="_blank" rel="noreferrer">WhatsApp us</a> or call {PHONE}.
            </p>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-slate-800">Welcome, {data.customer.name}</h2>
              <button onClick={() => { setData(null); setCreds({ phone: "", policy_number: "" }); }} className="text-sm text-slate-500 hover:text-navy">Sign out</button>
            </div>
            <PolicyCard p={data.policy} primary />
            {data.other_policies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Your other active policies</h3>
                <div className="space-y-3">{data.other_policies.map((p) => <PolicyCard key={p.policy_number} p={p} />)}</div>
              </div>
            )}

            {data.claims.length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <h3 className="font-display font-semibold text-navy mb-2">Your claims</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.claims.map((c, i) => (
                    <li key={i} className="py-2 flex flex-wrap justify-between gap-2">
                      <span>{c.claim_number || "Claim"} · Policy {c.policy_number} · {fmtDate(c.created_at)}</span>
                      <span className="flex items-center gap-3">
                        {c.claimed_amount ? <span className="tabular-nums text-slate-600">{inr(c.claimed_amount)}</span> : null}
                        <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">{pretty(c.status)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="font-display font-semibold text-navy">Need something?</h3>
              {done ? (
                <div className="mt-3 flex items-start gap-2 text-brand-greenDark" data-testid="portal-request-done">
                  <CheckCircle size={22} weight="fill" className="shrink-0" />
                  <div>
                    <div className="font-semibold">Request received — reference {done}</div>
                    <div className="text-sm text-slate-600">Our advisor will contact you shortly. <button className="underline" onClick={() => setDone(null)}>Send another</button></div>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitReq} className="mt-3 space-y-3" data-testid="portal-request">
                  <div className="flex flex-wrap gap-2">
                    {REQUESTS.map((r) => (
                      <button type="button" key={r.kind} onClick={() => setReq({ ...req, kind: r.kind })}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold border ${req.kind === r.kind ? "bg-navy text-white border-navy" : "border-slate-200 text-slate-600 hover:border-navy/40"}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {req.kind === "claim" && (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1">Date of incident / admission</span>
                        <Input type="date" value={req.incident_date} onChange={(e) => setReq({ ...req, incident_date: e.target.value })} /></label>
                      <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1">Estimated amount (₹)</span>
                        <Input type="number" min="0" value={req.claimed_amount} onChange={(e) => setReq({ ...req, claimed_amount: e.target.value })} /></label>
                    </div>
                  )}
                  <Textarea value={req.message} onChange={(e) => setReq({ ...req, message: e.target.value })}
                    placeholder={req.kind === "claim" ? "What happened? Hospital / garage name…" : "Tell us briefly what you need"} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={busy} className="rounded-full bg-brand-green px-6 py-2.5 font-semibold text-white hover:bg-brand-greenDark disabled:opacity-50" data-testid="portal-request-btn">
                      {busy ? "Sending…" : "Send request"}
                    </button>
                    <a href={waLink(`Hi MSquare Care, I need help with policy ${data.policy.policy_number}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-greenDark">
                      <WhatsappLogo size={18} weight="fill" /> Or chat on WhatsApp
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
