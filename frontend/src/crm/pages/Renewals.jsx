import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { WhatsappLogo, Phone, ListChecks } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crm, errMsg } from "../api";
import { RenewForm } from "../forms";
import { Btn, Card, ExpiryBadge, PageHeader, Pill, Select, StatusBadge, Table, Td } from "../ui";
import { fmtDate, fmtDateTime, inr, waTo } from "../utils";

const REM_TONE = { pending: "amber", sent: "green", failed: "red", skipped: "slate", sending: "blue" };
const stageText = (n) => (n > 0 ? `${n}d before` : n === 0 ? "expiry day" : `${-n}d after`);

function ReminderQueue({ onCount }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const load = useCallback(() => {
    crm.get("/reminders/log", { params: { status: status || undefined } }).then((r) => {
      setRows(r.data);
      if (status === "pending") onCount?.(r.data.length);
    }).catch(() => {});
  }, [status, onCount]);
  useEffect(load, [load]);

  const act = async (r, action) => {
    try {
      await crm.post(`/reminders/${r.id}/${action}`);
      toast.success(action === "mark-sent" ? `Marked sent for ${r.customer_name}` : "Reminder dismissed");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <p className="text-xs text-slate-500 max-w-xl">
          {status === "pending"
            ? "Queued by the daily reminder run. Open WhatsApp to send the pre-written message, then mark it sent."
            : "History of renewal reminders."}{" "}
          Configure the schedule in <Link to="/crm/settings" className="text-navy underline">Settings</Link>.
        </p>
        <Select value={status} onChange={setStatus} placeholder="All" className="w-40"
          options={[{ value: "pending", label: "To send" }, { value: "sent", label: "Sent" }, { value: "failed", label: "Failed" }, { value: "skipped", label: "Skipped" }]} />
      </div>
      <Table head={["Customer", "Policy", "Stage", "Message", "Status", ""]} empty={status === "pending" ? "No reminders waiting to be sent." : "No reminders."}>
        {rows.map((r) => (
          <tr key={r.id} className="align-top" data-testid={`reminder-${r.id}`}>
            <Td><Link to={`/crm/customers/${r.customer_id}`} className="font-medium text-navy hover:underline">{r.customer_name}</Link><div className="text-xs text-slate-500">{r.customer_phone}</div></Td>
            <Td className="whitespace-nowrap">{r.policy_number}<div className="text-xs text-slate-500">ends {fmtDate(r.end_date)}</div></Td>
            <Td className="whitespace-nowrap text-xs">{stageText(r.stage)}</Td>
            <Td className="max-w-md"><p className="text-xs text-slate-600 line-clamp-3" title={r.message}>{r.message}</p>{r.error && <p className="text-xs text-red-600 mt-1">{r.error}</p>}</Td>
            <Td className="whitespace-nowrap">
              <Pill tone={REM_TONE[r.status] || "slate"}>{r.status === "pending" ? "To send" : r.status[0].toUpperCase() + r.status.slice(1)}</Pill>
              <div className="text-[11px] text-slate-400 mt-1">{r.mode === "api" ? "Auto" : "Manual"} · {fmtDateTime(r.sent_at || r.updated_at)}</div>
            </Td>
            <Td className="text-right whitespace-nowrap">
              {["pending", "failed"].includes(r.status) && (
                <div className="flex justify-end gap-1.5">
                  <a href={r.wa_link || waTo(r.customer_phone, r.message)} target="_blank" rel="noreferrer">
                    <Btn variant="green" className="px-2.5 py-1.5"><WhatsappLogo size={16} weight="fill" /> Open</Btn>
                  </a>
                  <Btn variant="outline" className="px-2.5 py-1.5" onClick={() => act(r, "mark-sent")} data-testid="reminder-mark-sent">Mark sent</Btn>
                  <Btn variant="ghost" className="px-2 py-1.5" onClick={() => act(r, "dismiss")}>Dismiss</Btn>
                </div>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

const WINDOWS = [
  { d: 15, label: "15 days" }, { d: 30, label: "30 days" }, { d: 60, label: "60 days" }, { d: 90, label: "90 days" },
];

export default function Renewals() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [renew, setRenew] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);

  const load = useCallback(() => {
    crm.get("/policies", { params: { expiring_within: days } }).then((r) => setRows(r.data)).catch(() => {});
  }, [days]);
  useEffect(load, [load]);
  useEffect(() => {
    crm.get("/reminders/log", { params: { status: "pending" } }).then((r) => setPendingCount(r.data.length)).catch(() => {});
  }, []);

  const genTasks = async () => {
    try {
      const r = await crm.post("/renewals/generate-tasks", null, { params: { days } });
      toast.success(r.data.created ? `${r.data.created} renewal follow-up task(s) created` : "All renewals already have follow-up tasks");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const overdue = rows.filter((p) => p.days_to_expiry < 0);
  const premium = rows.reduce((a, p) => a + Number(p.premium || 0), 0);

  return (
    <div>
      <PageHeader
        title="Renewals"
        subtitle={`${rows.length} policies due within ${days} days (incl. ${overdue.length} expired in the last 30 days) · ${inr(premium)} premium at stake`}
        actions={<Btn onClick={genTasks} data-testid="renewals-gen-tasks"><ListChecks size={16} /> Create follow-up tasks</Btn>}
      />
      <Tabs defaultValue="due">
      <TabsList className="mb-4">
        <TabsTrigger value="due">Due for renewal</TabsTrigger>
        <TabsTrigger value="reminders" data-testid="tab-reminders">
          WhatsApp reminders{pendingCount ? <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pendingCount}</span> : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="due" className="m-0">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 mb-4">
        {WINDOWS.map((w) => (
          <button key={w.d} onClick={() => setDays(w.d)}
            className={`px-3 py-1.5 rounded-md text-sm ${days === w.d ? "bg-navy text-white" : "text-slate-600 hover:text-navy"}`}>{w.label}</button>
        ))}
      </div>
      <Card>
        <Table head={["Customer", "Policy", { label: "Premium", className: "text-right" }, "Expires", "Status", "Remind", ""]} empty="No renewals due in this window.">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <Td><Link to={`/crm/customers/${p.customer_id}`} className="font-medium text-navy hover:underline">{p.customer_name}</Link><div className="text-xs text-slate-500">{p.customer_phone}</div></Td>
              <Td>{p.policy_type} · {p.policy_number}<div className="text-xs text-slate-500">{p.insurer}</div></Td>
              <Td className="text-right tabular-nums">{inr(p.premium)}</Td>
              <Td className="whitespace-nowrap">{fmtDate(p.end_date)}<div><ExpiryBadge days={p.days_to_expiry} status={p.status} /></div></Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>
                <div className="flex items-center gap-3">
                  <a href={waTo(p.customer_phone, `Hi ${p.customer_name}, this is MSquare Care Solutions. Your ${p.policy_type} policy ${p.policy_number} (${p.insurer}) ${p.days_to_expiry < 0 ? "expired" : "is due for renewal"} on ${fmtDate(p.end_date)}. Renewal premium is approx. ${inr(p.premium)}. Shall we go ahead and renew it?`)}
                    target="_blank" rel="noreferrer" title="WhatsApp reminder" className="text-brand-green hover:text-brand-greenDark"><WhatsappLogo size={22} weight="fill" /></a>
                  <a href={`tel:${p.customer_phone}`} title="Call" className="text-navy"><Phone size={20} /></a>
                </div>
              </Td>
              <Td className="text-right"><Btn variant="green" className="px-3 py-1.5" onClick={() => setRenew(p)}>Renew</Btn></Td>
            </tr>
          ))}
        </Table>
      </Card>
      </TabsContent>
      <TabsContent value="reminders" className="m-0">
        <Card><ReminderQueue onCount={setPendingCount} /></Card>
      </TabsContent>
      </Tabs>
      <RenewForm open={!!renew} onOpenChange={(o) => !o && setRenew(null)} policy={renew} onSaved={load} />
    </div>
  );
}
