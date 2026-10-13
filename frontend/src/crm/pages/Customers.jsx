import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { MagnifyingGlass, DownloadSimple } from "@phosphor-icons/react";
import { crm, downloadCsv } from "../api";
import { useAuth } from "../AuthContext";
import { CustomerForm } from "../forms";
import { Btn, Card, Input, PageHeader, Table, Td } from "../ui";
import { inr } from "../utils";

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(params.get("new") === "1");
  const { userName } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    crm.get("/customers").then((r) => setRows(r.data)).catch(() => {});
  }, []);

  const ql = q.toLowerCase();
  const filtered = rows.filter((c) => !ql || [c.name, c.phone, c.email, c.city].join(" ").toLowerCase().includes(ql));

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} customers · ${inr(rows.reduce((a, c) => a + c.total_premium, 0), true)} active premium`}
        actions={
          <>
            <Btn variant="outline" onClick={() => downloadCsv("customers").catch(() => toast.error("Export failed"))}><DownloadSimple size={16} /> CSV</Btn>
            <Btn onClick={() => setOpen(true)} data-testid="customer-new-btn">+ New customer</Btn>
          </>
        }
      />
      <div className="relative w-full sm:w-80 mb-4">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email, city…" className="pl-9 bg-white" />
      </div>
      <Card>
        <Table head={["Name", "Mobile", "City", "Active policies", { label: "Active premium", className: "text-right" }, "Relationship manager"]} empty="No customers yet — convert a lead or add one.">
          {filtered.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => nav(`/crm/customers/${c.id}`)}>
              <Td><Link to={`/crm/customers/${c.id}`} className="font-medium text-navy hover:underline">{c.name}</Link>{c.email && <div className="text-xs text-slate-500">{c.email}</div>}</Td>
              <Td className="whitespace-nowrap">{c.phone}</Td>
              <Td>{c.city || "—"}</Td>
              <Td className="tabular-nums">{c.policy_count}</Td>
              <Td className="text-right tabular-nums font-medium">{inr(c.total_premium)}</Td>
              <Td>{c.assigned_to ? userName(c.assigned_to) : "—"}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <CustomerForm open={open} onOpenChange={(o) => { setOpen(o); if (!o && params.get("new")) setParams({}); }}
        onSaved={(c) => nav(`/crm/customers/${c.id}`)} />
    </div>
  );
}
