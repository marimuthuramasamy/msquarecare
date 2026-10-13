import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Phone, WhatsappLogo, EnvelopeSimple, PencilSimple, Trash, CheckCircle, Circle,
} from "@phosphor-icons/react";
import { crm, errMsg } from "../api";
import { useAuth } from "../AuthContext";
import { ClaimForm, CustomerForm, PolicyForm, RenewForm, TaskForm } from "../forms";
import {
  ActivityComposer, Btn, Card, ExpiryBadge, PageHeader, Pill, StatusBadge, Table, Td, Timeline,
} from "../ui";
import { fmtDate, inr, label, waTo } from "../utils";

export default function CustomerDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(false);
  const [policyForm, setPolicyForm] = useState({ open: params.get("addPolicy") === "1", policy: null });
  const [renew, setRenew] = useState(null);
  const [claimForm, setClaimForm] = useState({ open: false, claim: null, policyId: null });
  const [taskOpen, setTaskOpen] = useState(false);
  const { userName, user } = useAuth();
  const nav = useNavigate();

  const load = useCallback(() => {
    crm.get(`/customers/${id}`).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [id]);
  useEffect(load, [load]);

  if (!data) return <div className="text-slate-400">Loading…</div>;
  const { customer: c, policies, claims, tasks, activities } = data;
  const active = policies.filter((p) => p.status === "active");

  const toggleTask = async (t) => {
    await crm.patch(`/tasks/${t.id}`, { status: t.status === "open" ? "done" : "open" });
    load();
  };
  const remove = async () => {
    if (!window.confirm(`Delete customer ${c.name}?`)) return;
    try {
      await crm.delete(`/customers/${c.id}`);
      toast.success("Customer deleted");
      nav("/crm/customers");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="customer-detail">
      <Link to="/crm/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy mb-3"><ArrowLeft size={14} /> Customers</Link>
      <PageHeader
        title={c.name}
        subtitle={[c.phone, c.email, c.city].filter(Boolean).join(" · ")}
        actions={
          <>
            <a href={`tel:${c.phone}`}><Btn variant="outline"><Phone size={16} /> Call</Btn></a>
            <a href={waTo(c.phone, `Hi ${c.name}, this is MSquare Care Solutions.`)} target="_blank" rel="noreferrer"><Btn variant="outline"><WhatsappLogo size={16} /> WhatsApp</Btn></a>
            {c.email && <a href={`mailto:${c.email}`}><Btn variant="outline"><EnvelopeSimple size={16} /> Email</Btn></a>}
            <Btn variant="outline" onClick={() => setEdit(true)}><PencilSimple size={16} /> Edit</Btn>
            {user?.role === "admin" && <Btn variant="danger" onClick={remove} title="Delete customer"><Trash size={16} /></Btn>}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-slate-500">Active policies</div><div className="font-display text-xl font-bold tabular-nums">{active.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-500">Annual premium</div><div className="font-display text-xl font-bold tabular-nums">{inr(active.reduce((a, p) => a + Number(p.premium || 0), 0))}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-500">Claims</div><div className="font-display text-xl font-bold tabular-nums">{claims.length}</div></Card>
          </div>

          <Card className="p-0">
            <Tabs defaultValue="policies">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
                <TabsList>
                  <TabsTrigger value="policies">Policies ({policies.length})</TabsTrigger>
                  <TabsTrigger value="claims">Claims ({claims.length})</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks ({tasks.filter((t) => t.status === "open").length})</TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={() => setTaskOpen(true)}>+ Task</Btn>
                  <Btn variant="outline" disabled={!policies.length} onClick={() => setClaimForm({ open: true, claim: null, policyId: null })}>+ Claim</Btn>
                  <Btn onClick={() => setPolicyForm({ open: true, policy: null })} data-testid="customer-add-policy">+ Policy</Btn>
                </div>
              </div>

              <TabsContent value="policies" className="m-0">
                <Table head={["Policy", "Type", "Premium", "Term", "Status", ""]} empty="No policies yet.">
                  {policies.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td>
                        <div className="font-medium text-slate-800">{p.policy_number}</div>
                        <div className="text-xs text-slate-500">{p.insurer}{p.plan_name ? ` · ${p.plan_name}` : ""}{p.vehicle_number ? ` · ${p.vehicle_number}` : ""}</div>
                      </Td>
                      <Td>{p.policy_type}</Td>
                      <Td className="tabular-nums">
                        {inr(p.premium)}
                        {p.sum_insured ? <div className="text-xs text-slate-500">SI {inr(p.sum_insured, true)}</div> : null}
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{fmtDate(p.start_date)} →<br />{fmtDate(p.end_date)}</Td>
                      <Td><div className="flex flex-col items-start gap-1"><StatusBadge status={p.status} /><ExpiryBadge days={p.days_to_expiry} status={p.status} /></div></Td>
                      <Td className="text-right whitespace-nowrap">
                        {["active", "expired", "lapsed"].includes(p.status) && (
                          <Btn variant="ghost" className="px-2 py-1" onClick={() => setRenew(p)}>Renew</Btn>
                        )}
                        <Btn variant="ghost" className="px-2 py-1" onClick={() => setPolicyForm({ open: true, policy: p })}>Edit</Btn>
                      </Td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="claims" className="m-0">
                <Table head={["Claim", "Policy", "Claimed", "Approved / settled", "Status"]} empty="No claims.">
                  {claims.map((cl) => (
                    <tr key={cl.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setClaimForm({ open: true, claim: cl })}>
                      <Td><div className="font-medium">{cl.claim_number || "Pending no."}</div><div className="text-xs text-slate-500">{label(cl.claim_type)} · {fmtDate(cl.incident_date)}</div></Td>
                      <Td className="text-xs">{cl.policy_number}<div className="text-slate-500">{cl.insurer}</div></Td>
                      <Td className="tabular-nums">{cl.claimed_amount ? inr(cl.claimed_amount) : "—"}</Td>
                      <Td className="tabular-nums">{cl.approved_amount ? inr(cl.approved_amount) : "—"} / {cl.settled_amount ? inr(cl.settled_amount) : "—"}</Td>
                      <Td><StatusBadge status={cl.status} />{cl.source === "portal" && <Pill tone="violet" className="ml-1">Portal</Pill>}</Td>
                    </tr>
                  ))}
                </Table>
              </TabsContent>

              <TabsContent value="tasks" className="m-0">
                <ul className="divide-y divide-slate-100">
                  {tasks.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No tasks.</li>}
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <button onClick={() => toggleTask(t)} className={t.status === "done" ? "text-brand-green" : "text-slate-400 hover:text-navy"} aria-label="Toggle done">
                        {t.status === "done" ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm ${t.status === "done" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</div>
                        <div className="text-xs text-slate-500">Due {fmtDate(t.due_date)} · {userName(t.assigned_to)}{t.notes ? ` · ${t.notes}` : ""}</div>
                      </div>
                      <StatusBadge status={t.priority} />
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display font-semibold text-navy mb-3">Profile</h3>
            <dl className="space-y-2 text-sm">
              {[["Date of birth", fmtDate(c.dob)], ["PAN", c.pan], ["Address", c.address],
                ["Relationship manager", c.assigned_to ? userName(c.assigned_to) : null], ["Source", c.source],
                ["Customer since", fmtDate(c.created_at)], ["Notes", c.notes]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-slate-500 shrink-0">{k}</dt><dd className="text-right text-slate-800 break-words whitespace-pre-wrap">{v && v !== "—" ? v : "—"}</dd></div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="font-display font-semibold text-navy mb-3">Activity</h3>
            <ActivityComposer entityType="customer" entityId={c.id} onAdded={load} />
            <div className="mt-4"><Timeline items={activities} /></div>
          </Card>
        </div>
      </div>

      <CustomerForm open={edit} onOpenChange={setEdit} customer={c} onSaved={load} />
      <PolicyForm open={policyForm.open} policy={policyForm.policy} customerId={c.id}
        onOpenChange={(o) => { setPolicyForm((s) => ({ ...s, open: o })); if (!o && params.get("addPolicy")) setParams({}); }} onSaved={load} />
      <RenewForm open={!!renew} onOpenChange={(o) => !o && setRenew(null)} policy={renew} onSaved={load} />
      <ClaimForm open={claimForm.open} claim={claimForm.claim} policies={policies.filter((p) => p.status !== "cancelled")}
        onOpenChange={(o) => setClaimForm((s) => ({ ...s, open: o }))} onSaved={load} />
      <TaskForm open={taskOpen} onOpenChange={setTaskOpen} context={{ customer_id: c.id }} onSaved={load} />
    </div>
  );
}
