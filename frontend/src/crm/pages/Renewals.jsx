import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { WhatsappLogo, Phone, ListChecks } from "@phosphor-icons/react";
import { crm, errMsg } from "../api";
import { RenewForm } from "../forms";
import { Btn, Card, ExpiryBadge, PageHeader, StatusBadge, Table, Td } from "../ui";
import { fmtDate, inr, waTo } from "../utils";

const WINDOWS = [
  { d: 15, label: "15 days" }, { d: 30, label: "30 days" }, { d: 60, label: "60 days" }, { d: 90, label: "90 days" },
];

export default function Renewals() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [renew, setRenew] = useState(null);

  const load = useCallback(() => {
    crm.get("/policies", { params: { expiring_within: days } }).then((r) => setRows(r.data)).catch(() => {});
  }, [days]);
  useEffect(load, [load]);

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
      <RenewForm open={!!renew} onOpenChange={(o) => !o && setRenew(null)} policy={renew} onSaved={load} />
    </div>
  );
}
