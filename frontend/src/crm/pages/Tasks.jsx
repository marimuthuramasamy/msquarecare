import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { CheckCircle, Circle, Trash, WhatsappLogo, PencilSimple } from "@phosphor-icons/react";
import { crm, errMsg } from "../api";
import { useAuth } from "../AuthContext";
import { TaskForm } from "../forms";
import { Btn, Card, Empty, PageHeader, Pill, StatusBadge } from "../ui";
import { fmtDate, isoToday, label, waTo } from "../utils";

export default function Tasks() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("open");
  const [mine, setMine] = useState(true);
  const [form, setForm] = useState({ open: false, task: null });
  const { userName } = useAuth();

  const load = useCallback(() => {
    crm.get("/tasks", { params: { status, mine } }).then((r) => setRows(r.data)).catch(() => {});
  }, [status, mine]);
  useEffect(load, [load]);

  const toggle = async (t) => {
    try {
      await crm.patch(`/tasks/${t.id}`, { status: t.status === "open" ? "done" : "open" });
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const remove = async (t) => {
    if (!window.confirm("Delete this task?")) return;
    await crm.delete(`/tasks/${t.id}`);
    load();
  };

  const today = isoToday();
  const groups = status === "open"
    ? [
        ["Overdue", rows.filter((t) => t.due_date < today)],
        ["Today", rows.filter((t) => t.due_date === today)],
        ["Upcoming", rows.filter((t) => t.due_date > today)],
      ]
    : [["Tasks", rows]];

  return (
    <div>
      <PageHeader title="Tasks & follow-ups" subtitle="Calls, renewals, claim paperwork and payments to chase"
        actions={<Btn onClick={() => setForm({ open: true, task: null })} data-testid="task-new-btn">+ New task</Btn>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {["open", "done", "all"].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-md text-sm capitalize ${status === s ? "bg-navy text-white" : "text-slate-600"}`}>{s}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 px-2">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-navy" /> Assigned to me
        </label>
      </div>

      <div className="space-y-4">
        {groups.map(([title, list]) => (
          <Card key={title}>
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <h2 className={`font-display font-semibold ${title === "Overdue" ? "text-red-600" : "text-navy"}`}>{title}</h2>
              <span className="text-xs text-slate-500 tabular-nums">{list.length}</span>
            </div>
            {list.length === 0 ? <Empty>Nothing here.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {list.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3" data-testid={`task-${t.id}`}>
                    <button onClick={() => toggle(t)} className={t.status === "done" ? "text-brand-green mt-0.5" : "text-slate-400 hover:text-navy mt-0.5"} aria-label="Toggle done">
                      {t.status === "done" ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium ${t.status === "done" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span className={t.overdue ? "text-red-600 font-semibold" : ""}>Due {fmtDate(t.due_date)}</span>
                        <span>· {label(t.kind)}</span>
                        <span>· {userName(t.assigned_to)}</span>
                        {t.customer_name && <span>· <Link to={`/crm/customers/${t.customer_id}`} className="text-navy hover:underline">{t.customer_name}</Link></span>}
                        {t.source === "portal" && <Pill tone="violet">Portal request</Pill>}
                      </div>
                      {t.notes && <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{t.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={t.priority} />
                      {t.customer_phone && (
                        <a href={waTo(t.customer_phone, `Hi ${t.customer_name}, this is MSquare Care Solutions.`)} target="_blank" rel="noreferrer" className="text-brand-green" title="WhatsApp"><WhatsappLogo size={20} weight="fill" /></a>
                      )}
                      <button onClick={() => setForm({ open: true, task: t })} className="text-slate-400 hover:text-navy" title="Edit"><PencilSimple size={18} /></button>
                      <button onClick={() => remove(t)} className="text-slate-400 hover:text-red-600" title="Delete"><Trash size={18} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
      <TaskForm open={form.open} task={form.task} onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))} onSaved={load} />
    </div>
  );
}
