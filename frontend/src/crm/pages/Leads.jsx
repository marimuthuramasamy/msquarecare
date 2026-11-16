import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  MagnifyingGlass, Kanban, Rows, Phone, WhatsappLogo, UserPlus, PencilSimple, Trash, DownloadSimple, CalendarBlank,
} from "@phosphor-icons/react";
import { crm, errMsg, downloadCsv } from "../api";
import { useAuth } from "../AuthContext";
import { LeadForm, TaskForm } from "../forms";
import { ActivityComposer, Btn, Card, Input, PageHeader, Select, StatusBadge, Table, Td, Timeline } from "../ui";
import { LEAD_STAGES, fmtDate, inr, isoToday, label, waTo } from "../utils";

function LeadPanel({ lead, onClose, onChanged }) {
  const { userName, user } = useAuth();
  const [acts, setActs] = useState([]);
  const [edit, setEdit] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const nav = useNavigate();

  const loadActs = useCallback(() => {
    if (lead) crm.get("/activities", { params: { entity_id: lead.lead_id } }).then((r) => setActs(r.data));
  }, [lead]);
  useEffect(loadActs, [loadActs]);

  if (!lead) return null;

  const setStage = async (status) => {
    try {
      const r = await crm.patch(`/leads/${lead.lead_id}`, { status });
      onChanged(r.data);
      loadActs();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const convert = async () => {
    try {
      const r = await crm.post(`/leads/${lead.lead_id}/convert`, {});
      toast.success(`${r.data.name} is now a customer`);
      nav(`/crm/customers/${r.data.id}?addPolicy=1`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete lead ${lead.name}? This cannot be undone.`)) return;
    try {
      await crm.delete(`/leads/${lead.lead_id}`);
      toast.success("Lead deleted");
      onChanged(null, lead.lead_id);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="lead-panel">
        <SheetHeader>
          <SheetTitle className="font-display text-navy text-xl">{lead.name}</SheetTitle>
          <SheetDescription>{lead.service} · via {lead.source || "website"} · {fmtDate(lead.created_at)}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`tel:${lead.phone}`}><Btn variant="outline"><Phone size={16} /> Call</Btn></a>
          <a href={waTo(lead.phone, `Hi ${lead.name}, this is MSquare Care Solutions regarding your ${lead.service} enquiry.`)} target="_blank" rel="noreferrer">
            <Btn variant="outline"><WhatsappLogo size={16} /> WhatsApp</Btn>
          </a>
          <Btn variant="outline" onClick={() => setEdit(true)}><PencilSimple size={16} /> Edit</Btn>
          <Btn variant="outline" onClick={() => setTaskOpen(true)}><CalendarBlank size={16} /> Follow-up</Btn>
          {lead.customer_id ? (
            <Btn variant="green" onClick={() => nav(`/crm/customers/${lead.customer_id}`)}>Open customer</Btn>
          ) : (
            <Btn variant="green" onClick={convert} data-testid="lead-convert-btn"><UserPlus size={16} /> Convert to customer</Btn>
          )}
          {user?.role === "admin" && <Btn variant="danger" onClick={remove}><Trash size={16} /></Btn>}
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold text-slate-500 mb-1.5">Stage</div>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STAGES.map((s) => (
              <button key={s} onClick={() => setStage(s)} data-testid={`lead-stage-${s}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  lead.status === s ? "bg-navy text-white border-navy" : "border-slate-200 text-slate-600 hover:border-navy/40"}`}>
                {label(s)}
              </button>
            ))}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {[
            ["Mobile", lead.phone], ["Email", lead.email], ["City", lead.city],
            ["Assigned to", lead.assigned_to ? userName(lead.assigned_to) : "Unassigned"],
            ["Expected premium", lead.expected_premium ? inr(lead.expected_premium) : null],
            ["Next follow-up", lead.follow_up_date ? fmtDate(lead.follow_up_date) : null],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-800 break-words">{v || "—"}</dd></div>
          ))}
          {lead.message && (
            <div className="col-span-2"><dt className="text-xs text-slate-500">Requirement</dt><dd className="text-slate-800 whitespace-pre-wrap">{lead.message}</dd></div>
          )}
        </dl>

        <h3 className="mt-6 mb-2 font-display font-semibold text-navy">Activity</h3>
        <ActivityComposer entityType="lead" entityId={lead.lead_id} onAdded={loadActs} />
        <div className="mt-4"><Timeline items={acts} /></div>

        <LeadForm open={edit} onOpenChange={setEdit} lead={lead} onSaved={(l) => { onChanged(l); loadActs(); }} />
        <TaskForm open={taskOpen} onOpenChange={setTaskOpen} context={{ lead_id: lead.lead_id }}
          task={null} onSaved={() => toast.success("Follow-up scheduled")} />
      </SheetContent>
    </Sheet>
  );
}

function LeadCard({ l, onOpen, onMove }) {
  const { userName } = useAuth();
  const overdue = l.follow_up_date && l.follow_up_date < isoToday() && !["won", "lost"].includes(l.status);
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm hover:border-navy/30 cursor-pointer transition-colors"
      onClick={() => onOpen(l)} data-testid={`lead-card-${l.lead_id}`}>
      <div className="font-medium text-slate-800 text-sm truncate">{l.name}</div>
      <div className="text-xs text-slate-500 truncate">{l.service}{l.city ? ` · ${l.city}` : ""}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 truncate">{l.assigned_to ? userName(l.assigned_to) : "Unassigned"}</span>
        {l.expected_premium ? <span className="font-semibold text-slate-700 tabular-nums">{inr(l.expected_premium, true)}</span> : null}
      </div>
      {l.follow_up_date && !["won", "lost"].includes(l.status) && (
        <div className={`mt-1 text-[11px] ${overdue ? "text-red-600 font-semibold" : "text-slate-400"}`}>Follow-up {fmtDate(l.follow_up_date)}</div>
      )}
      <select
        value={l.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onMove(l, e.target.value)}
        className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-600"
        aria-label="Move to stage"
      >
        {LEAD_STAGES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </select>
    </div>
  );
}

export default function Leads() {
  const [params, setParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("msq_leads_view") || "board"; } catch { return "board"; }
  });
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");
  const status = params.get("status") || "";
  const { user, userName } = useAuth();

  const load = useCallback(() => {
    crm.get("/leads").then((r) => setLeads(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    try { localStorage.setItem("msq_leads_view", view); } catch { /* ignore */ }
  }, [view]);

  const onChanged = (l, removedId) => {
    if (removedId) setLeads((ls) => ls.filter((x) => x.lead_id !== removedId));
    else if (l) {
      setLeads((ls) => (ls.some((x) => x.lead_id === l.lead_id) ? ls.map((x) => (x.lead_id === l.lead_id ? l : x)) : [l, ...ls]));
      setSelected((s) => (s && s.lead_id === l.lead_id ? l : s));
    }
  };
  const move = async (l, s) => {
    try {
      const r = await crm.patch(`/leads/${l.lead_id}`, { status: s });
      onChanged(r.data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const ql = q.toLowerCase();
  const filtered = leads.filter((l) =>
    (!ql || [l.name, l.phone, l.email, l.city, l.service].join(" ").toLowerCase().includes(ql)) &&
    (!mineOnly || l.assigned_to === user?.id) &&
    (view === "board" || !status || l.status === status));

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} total · ${leads.filter((l) => l.status === "new").length} new — website enquiries arrive here automatically`}
        actions={
          <>
            <Btn variant="outline" onClick={() => downloadCsv("leads").catch(() => toast.error("Export failed"))}><DownloadSimple size={16} /> CSV</Btn>
            <Btn onClick={() => setNewOpen(true)} data-testid="lead-new-btn">+ New lead</Btn>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, city…" className="pl-9 bg-white" data-testid="lead-search" />
        </div>
        {view === "list" && (
          <Select value={status} onChange={(v) => setParams(v ? { status: v } : {})} placeholder="All stages" options={LEAD_STAGES} className="w-40" />
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600 px-2">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-navy" /> My leads
        </label>
        <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button onClick={() => setView("board")} className={`px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1 ${view === "board" ? "bg-navy text-white" : "text-slate-600"}`}><Kanban size={16} /> Board</button>
          <button onClick={() => setView("list")} className={`px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1 ${view === "list" ? "bg-navy text-white" : "text-slate-600"}`}><Rows size={16} /> List</button>
        </div>
      </div>

      {view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0" data-testid="lead-board">
          {LEAD_STAGES.map((s) => {
            const col = filtered.filter((l) => (l.status || "new") === s);
            const total = col.reduce((a, l) => a + Number(l.expected_premium || 0), 0);
            return (
              <div key={s} className="w-64 shrink-0 rounded-xl bg-slate-100/80 p-2">
                <div className="flex items-center justify-between px-1.5 py-1 mb-1">
                  <div className="flex items-center gap-2"><StatusBadge status={s} /><span className="text-xs text-slate-500 tabular-nums">{col.length}</span></div>
                  {total > 0 && <span className="text-[11px] text-slate-500 tabular-nums">{inr(total, true)}</span>}
                </div>
                <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-0.5">
                  {col.map((l) => <LeadCard key={l.lead_id} l={l} onOpen={setSelected} onMove={move} />)}
                  {col.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table head={["Name", "Mobile", "Interested in", "Source", "Stage", "Owner", "Follow-up", "Created"]} empty="No leads match.">
            {filtered.map((l) => (
              <tr key={l.lead_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(l)}>
                <Td className="font-medium text-navy">{l.name}</Td>
                <Td className="whitespace-nowrap">{l.phone}</Td>
                <Td>{l.service}</Td>
                <Td className="capitalize">{l.source}</Td>
                <Td><StatusBadge status={l.status} /></Td>
                <Td>{l.assigned_to ? userName(l.assigned_to) : "—"}</Td>
                <Td className="whitespace-nowrap">{fmtDate(l.follow_up_date)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{fmtDate(l.created_at)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <LeadPanel lead={selected} onClose={() => setSelected(null)} onChanged={onChanged} />
      <LeadForm open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o && params.get("new")) setParams({}); }} onSaved={onChanged} />
    </div>
  );
}
