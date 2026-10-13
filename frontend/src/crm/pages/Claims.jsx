import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { DownloadSimple } from "@phosphor-icons/react";
import { crm, downloadCsv } from "../api";
import { ClaimForm } from "../forms";
import { Btn, Card, PageHeader, Pill, Select, StatusBadge, Table, Td } from "../ui";
import { CLAIM_STATUSES, fmtDate, inr, label } from "../utils";

export default function Claims() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("open");
  const [form, setForm] = useState({ open: false, claim: null });
  const [policies, setPolicies] = useState([]);

  const load = useCallback(() => {
    crm.get("/claims", { params: { status: status || undefined } }).then((r) => setRows(r.data)).catch(() => {});
  }, [status]);
  useEffect(load, [load]);

  const openNew = async () => {
    const r = await crm.get("/policies", { params: { status: "active" } });
    setPolicies(r.data);
    setForm({ open: true, claim: null });
  };

  const claimed = rows.reduce((a, c) => a + Number(c.claimed_amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Claims"
        subtitle={`${rows.length} claims · ${inr(claimed)} claimed`}
        actions={
          <>
            <Btn variant="outline" onClick={() => downloadCsv("claims").catch(() => toast.error("Export failed"))}><DownloadSimple size={16} /> CSV</Btn>
            <Btn onClick={openNew} data-testid="claim-new-btn">+ Register claim</Btn>
          </>
        }
      />
      <Select value={status} onChange={setStatus} placeholder="All claims"
        options={[{ value: "open", label: "Open (in progress)" }, ...CLAIM_STATUSES.map((s) => ({ value: s, label: label(s) }))]}
        className="w-56 mb-4" />
      <Card>
        <Table head={["Customer", "Claim", "Policy", { label: "Claimed", className: "text-right" }, { label: "Approved", className: "text-right" }, "Status", "Updated"]} empty="No claims.">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setForm({ open: true, claim: c })}>
              <Td><Link to={`/crm/customers/${c.customer_id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-navy hover:underline">{c.customer_name}</Link><div className="text-xs text-slate-500">{c.customer_phone}</div></Td>
              <Td>{c.claim_number || <span className="text-slate-400">No. pending</span>}<div className="text-xs text-slate-500">{label(c.claim_type)}{c.hospital_or_garage ? ` · ${c.hospital_or_garage}` : ""}</div></Td>
              <Td className="text-xs">{c.policy_number}<div className="text-slate-500">{c.insurer} · {c.policy_type}</div></Td>
              <Td className="text-right tabular-nums">{c.claimed_amount ? inr(c.claimed_amount) : "—"}</Td>
              <Td className="text-right tabular-nums">{c.approved_amount ? inr(c.approved_amount) : "—"}</Td>
              <Td><div className="flex flex-wrap gap-1"><StatusBadge status={c.status} />{c.source === "portal" && <Pill tone="violet">Portal</Pill>}</div></Td>
              <Td className="whitespace-nowrap text-slate-500">{fmtDate(c.updated_at)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <ClaimForm open={form.open} claim={form.claim} policies={policies}
        onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))} onSaved={load} />
    </div>
  );
}
