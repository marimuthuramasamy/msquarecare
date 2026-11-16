import React, { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  CaretLeft, CaretRight, Star, MagnifyingGlass, Clock, X, UserPlus, CheckCircle, CircleNotch,
} from "@phosphor-icons/react";
import { crm, errMsg } from "../api";
import { Btn, Card, Empty, Input, PageHeader } from "../ui";
import { isoToday } from "../utils";

const SAVE_DELAY_MS = 800;

const shiftDay = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const longDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

const nowStamp = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// Pick a customer or lead to link to the day's page.
function LinkPicker({ people, existing, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ql = q.trim().toLowerCase();
  const matches = ql
    ? people.filter((p) => !existing.some((e) => e.id === p.id) && `${p.name} ${p.phone}`.toLowerCase().includes(ql)).slice(0, 8)
    : [];
  return (
    <div className="relative">
      {open ? (
        <div className="flex items-center gap-1">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer or lead name / phone"
            className="h-8 w-56 text-sm" onKeyDown={(e) => e.key === "Escape" && setOpen(false)} data-testid="diary-link-search" />
          <button onClick={() => { setOpen(false); setQ(""); }} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X size={16} /></button>
        </div>
      ) : (
        <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setOpen(true)} data-testid="diary-link-btn">
          <UserPlus size={15} /> Link customer / lead
        </Btn>
      )}
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {matches.map((p) => (
            <li key={`${p.type}:${p.id}`}>
              <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex justify-between gap-2"
                onClick={() => { onPick(p); setQ(""); setOpen(false); }}>
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{p.type === "lead" ? "Lead" : "Customer"} · {p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Diary() {
  const [day, setDay] = useState(isoToday());
  const [page, setPage] = useState({ text: "", starred: false, links: [] });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | dirty | saving | saved
  const [days, setDays] = useState([]);
  const [q, setQ] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [people, setPeople] = useState([]);
  const timer = useRef(null);
  const pending = useRef(null); // { day, body } not yet sent
  const textRef = useRef(null);

  const loadDays = useCallback(() => {
    crm.get("/diary", { params: { q: q || undefined, starred: starredOnly || undefined } })
      .then((r) => setDays(r.data)).catch(() => {});
  }, [q, starredOnly]);
  useEffect(() => {
    const t = setTimeout(loadDays, 250);
    return () => clearTimeout(t);
  }, [loadDays]);

  useEffect(() => {
    Promise.all([crm.get("/customers"), crm.get("/leads")]).then(([c, l]) => {
      setPeople([
        ...c.data.map((x) => ({ type: "customer", id: x.id, name: x.name, phone: x.phone })),
        ...l.data.filter((x) => !x.customer_id).map((x) => ({ type: "lead", id: x.lead_id, name: x.name, phone: x.phone })),
      ]);
    }).catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    setStatus("saving");
    try {
      await crm.put(`/diary/${job.day}`, job.body);
      setStatus(pending.current ? "dirty" : "saved");
      loadDays();
    } catch (e) {
      pending.current = pending.current || job; // keep it so the next edit or day switch retries
      setStatus("dirty");
      toast.error(errMsg(e, "Could not save the diary page"));
    }
  }, [loadDays]);

  // Save before leaving the page or closing the tab.
  useEffect(() => {
    const onUnload = (e) => {
      if (pending.current) {
        flush();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    crm.get(`/diary/${day}`).then((r) => {
      if (!alive) return;
      setPage({ text: r.data.text || "", starred: !!r.data.starred, links: r.data.links || [] });
      setStatus(r.data.updated_at ? "saved" : "idle");
      setLoaded(true);
    }).catch((e) => toast.error(errMsg(e)));
    return () => { alive = false; };
  }, [day]);

  const update = (patch) => {
    setPage((old) => {
      const next = { ...old, ...patch };
      pending.current = { day, body: next };
      return next;
    });
    setStatus("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const goTo = async (d) => {
    if (d === day) return;
    await flush();
    setDay(d);
  };

  const insertTime = () => {
    const el = textRef.current;
    const stamp = `${nowStamp()} — `;
    const t = page.text;
    const pos = el ? el.selectionStart : t.length;
    const before = t.slice(0, pos);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const next = before + prefix + stamp + t.slice(pos);
    // commit synchronously so keys typed right after the click land after the stamp
    flushSync(() => update({ text: next }));
    if (el) {
      const caret = (before + prefix + stamp).length;
      el.focus();
      el.setSelectionRange(caret, caret);
    }
  };

  const isToday = day === isoToday();

  return (
    <div data-testid="diary-page">
      <PageHeader title="Daily diary" subtitle="Your private notebook — jot down how today's customer and lead conversations went. Only you can see your pages." />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-1">
              <button onClick={() => goTo(shiftDay(day, -1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" aria-label="Previous day" data-testid="diary-prev"><CaretLeft size={18} /></button>
              <div className="px-1">
                <div className="font-display font-semibold text-navy leading-tight" data-testid="diary-date">{longDate(day)}</div>
                <div className="text-[11px] text-slate-400">{isToday ? "Today" : ""}</div>
              </div>
              <button onClick={() => goTo(shiftDay(day, 1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" aria-label="Next day" data-testid="diary-next"><CaretRight size={18} /></button>
            </div>
            <div className="flex items-center gap-2">
              {!isToday && <Btn variant="outline" className="px-2.5 py-1 text-xs" onClick={() => goTo(isoToday())}>Today</Btn>}
              <input type="date" value={day} onChange={(e) => e.target.value && goTo(e.target.value)}
                className="h-8 rounded-md border border-input bg-white px-2 text-sm" aria-label="Pick a date" />
              <button onClick={() => update({ starred: !page.starred })} aria-pressed={page.starred}
                title={page.starred ? "Unmark this day" : "Mark this day as important"} data-testid="diary-star"
                className={`p-1.5 rounded hover:bg-amber-50 ${page.starred ? "text-amber-500" : "text-slate-400"}`}>
                <Star size={20} weight={page.starred ? "fill" : "regular"} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/60 min-h-[44px]">
            {page.links.map((l) => (
              <span key={`${l.type}:${l.id}`} className="inline-flex items-center gap-1 rounded-full bg-navy/10 text-navy pl-2.5 pr-1 py-0.5 text-xs font-medium">
                {l.type === "customer"
                  ? <Link to={`/crm/customers/${l.id}`} className="hover:underline">{l.name}</Link>
                  : <Link to="/crm/leads" className="hover:underline">{l.name}</Link>}
                <span className="text-navy/50">{l.type === "lead" ? "lead" : ""}</span>
                <button onClick={() => update({ links: page.links.filter((x) => x.id !== l.id) })} className="p-0.5 text-navy/60 hover:text-red-600" aria-label={`Unlink ${l.name}`}><X size={12} /></button>
              </span>
            ))}
            <LinkPicker people={people} existing={page.links} onPick={(p) => update({ links: [...page.links, { type: p.type, id: p.id, name: p.name }] })} />
            <Btn variant="ghost" className="px-2 py-1 text-xs ml-auto" onClick={insertTime} data-testid="diary-time"><Clock size={15} /> + time</Btn>
          </div>

          <textarea
            ref={textRef}
            value={page.text}
            disabled={!loaded}
            onChange={(e) => update({ text: e.target.value })}
            onBlur={flush}
            placeholder={"Write freely…\n\ne.g. 11:20 — Kumar called about family floater; wants Star vs Niva comparison by Friday.\n4:05 — Meena happy with claim settlement, asked about motor renewal for her son."}
            className="block w-full min-h-[55vh] resize-y border-0 px-5 py-3 text-[15px] leading-7 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 bg-[linear-gradient(transparent_27px,#e2e8f0_28px)] bg-[length:100%_28px] bg-local"
            style={{ backgroundPositionY: "11px" }}
            data-testid="diary-text"
          />

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            <span>{page.text.length.toLocaleString("en-IN")} / 20,000 characters</span>
            <span className="flex items-center gap-1" data-testid="diary-status" aria-live="polite">
              {status === "saving" && <><CircleNotch size={13} className="animate-spin" /> Saving…</>}
              {status === "saved" && <><CheckCircle size={13} weight="fill" className="text-brand-green" /> Saved</>}
              {status === "dirty" && "Unsaved changes"}
            </span>
          </div>
        </Card>

        <Card className="p-0 self-start">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes or names" className="pl-8 h-8 text-sm" data-testid="diary-search" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="accent-navy" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} /> Starred days only
            </label>
          </div>
          {days.length === 0 ? (
            <Empty>{q || starredOnly ? "No matching days." : "Your past pages will appear here."}</Empty>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100" data-testid="diary-days">
              {days.map((x) => (
                <li key={x.date}>
                  <button onClick={() => goTo(x.date)} className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 ${x.date === day ? "bg-navy/5" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">{shortDate(x.date)}</span>
                      {x.starred && <Star size={14} weight="fill" className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{x.snippet || "—"}</p>
                    {x.links?.length > 0 && <p className="text-[11px] text-navy/70 mt-0.5 truncate">{x.links.map((l) => l.name).join(", ")}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
