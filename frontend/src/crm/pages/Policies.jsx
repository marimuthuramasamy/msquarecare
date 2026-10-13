import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { MagnifyingGlass, DownloadSimple } from "@phosphor-icons/react";
import { crm, downloadCsv } from "../api";
import { PolicyForm, RenewForm } from "../forms";
import { Btn, Card, ExpiryBadge, Input, PageHeader, Select, StatusBadge, Table, Td } from "../ui";
import { POLICY_STATUSES, POLICY_TYPES, fmtDate, inr } from "../utils";

export default function Policies() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("active");
  const [form, setForm] = useState({ open: params.get("new") === "1", policy: null });
  const [renew, setRenew] = useState(null);

  const load = useCallback(() => {
    crm.get("/policies", { params: { status: status || undefined, policy_type: type || undefined } })
      .then((r) => setRows(r.data)).catch(() => {});
  }, [status, type]);
  useEffect(load, [load]);

  const ql = q.toLowerCase();
  const filtered = rows.filter((p) => !ql ||
    [p.policy_number, p.insurer, p.plan_name, p.customer_name, p.customer_phone, p.vehicle_number].join(" ").toLowerCase().includes(ql));
  const premium = filtered.reduce((a, p) => a + Number(p.premium || 0), 0);
  const comm = filtered.reduce((a, p) => a + Number(p.commission_amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Policies"
        subtitle={`${filtered.length} shown · premium ${inr(premium)} · commission ${inr(comm)}`}
        actions={
          <>
            <Btn variant="outline" onClick={() => downloadCsv("policies").catch(() => toast.error("Export failed"))}><DownloadSimple size={16} /> CSV</Btn>
            <Btn onClick={() => setForm({ open: true, policy: null })} data-testid="policy-new-btn">+ Add policy</Btn>
          </>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Policy no., customer, insurer, vehicle…" className="pl-9 bg-white" />
        </div>
        <Select value={type} onChange={setType} placeholder="All types" options={POLICY_TYPES.map((t) => ({ value: t, label: t }))} className="w-40" />
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={POLICY_STATUSES} className="w-40" />
      </div>
      <Card>
        <Table head={["Policy", "Customer", "Type", { label: "Premium", className: "text-right" }, { label: "Commission", className: "text-right" }, "Ends", "Status", ""]} empty="No policies match.">
          {filtered.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <Td><div className="font-medium text-slate-800">{p.policy_number}</div><div className="text-xs text-slate-500">{p.insurer}{p.plan_name ? ` · ${p.plan_name}` : ""}</div></Td>
              <Td><Link to={`/crm/customers/${p.customer_id}`} className="text-navy hover:underline">{p.customer_name}</Link><div className="text-xs text-slate-500">{p.customer_phone}</div></Td>
              <Td>{p.policy_type}{p.vehicle_number && <div className="text-xs text-slate-500">{p.vehicle_number}</div>}</Td>
              <Td className="text-right tabular-nums">{inr(p.premium)}</Td>
              <Td className="text-right tabular-nums text-slate-600">{p.commission_amount ? inr(p.commission_amount) : "—"}</Td>
              <Td className="whitespace-nowrap">{fmtDate(p.end_date)}<div><ExpiryBadge days={p.days_to_expiry} status={p.status} /></div></Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td className="text-right whitespace-nowrap">
                {["active", "expired", "lapsed"].includes(p.status) && <Btn variant="ghost" className="px-2 py-1" onClick={() => setRenew(p)}>Renew</Btn>}
                <Btn variant="ghost" className="px-2 py-1" onClick={() => setForm({ open: true, policy: p })}>Edit</Btn>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <PolicyForm open={form.open} policy={form.policy}
        onOpenChange={(o) => { setForm((s) => ({ ...s, open: o })); if (!o && params.get("new")) setParams({}); }} onSaved={load} />
      <RenewForm open={!!renew} onOpenChange={(o) => !o && setRenew(null)} policy={renew} onSaved={load} />
    </div>
  );
}
