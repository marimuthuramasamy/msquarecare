import React, { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { crm, errMsg } from "./api";
import { useAuth } from "./AuthContext";
import { Btn, Field, Input, Modal, Select, Textarea } from "./ui";
import {
  CLAIM_STATUSES, INSURERS, LEAD_SOURCES, LEAD_STAGES, POLICY_STATUSES, POLICY_TYPES, SERVICES, addYear, isoToday,
} from "./utils";

// Small helper: form state + submit with toast feedback.
function useForm(initial, open) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(initial);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) toast.success(okMsg);
      return r;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { f, set, busy, run, setF };
}

// Drop empty strings, convert numeric fields.
const clean = (obj, numeric = []) => {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === "" || v === undefined) {
      out[k] = null;
      return;
    }
    out[k] = numeric.includes(k) ? Number(v) : v;
  });
  return out;
};

const Actions = ({ busy, onCancel, submitLabel = "Save" }) => (
  <div className="flex justify-end gap-2 pt-2">
    <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
    <Btn type="submit" disabled={busy} data-testid="form-submit">{busy ? "Saving…" : submitLabel}</Btn>
  </div>
);

const UserSelect = ({ value, onChange }) => {
  const { users } = useAuth();
  return (
    <Select value={value} onChange={onChange} placeholder="Unassigned"
      options={users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }))} />
  );
};

/* ---------------- Lead ---------------- */
export function LeadForm({ open, onOpenChange, lead, onSaved }) {
  const { user } = useAuth();
  const init = lead || { name: "", phone: "", email: "", service: SERVICES[0], city: "", source: "walk-in",
    status: "new", assigned_to: user?.id || "", expected_premium: "", follow_up_date: "", message: "" };
  const { f, set, busy, run } = useForm(init, open);
  const submit = async (e) => {
    e.preventDefault();
    const body = clean({
      name: f.name, phone: f.phone, email: f.email, service: f.service, city: f.city, source: f.source,
      status: f.status, assigned_to: f.assigned_to, expected_premium: f.expected_premium,
      follow_up_date: f.follow_up_date, message: f.message,
    }, ["expected_premium"]);
    const r = await run(() => (lead ? crm.patch(`/leads/${lead.lead_id}`, body) : crm.post("/leads", body)),
      lead ? "Lead updated" : "Lead added");
    if (r) { onSaved?.(r.data); onOpenChange(false); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={lead ? "Edit lead" : "New lead"} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="lead-form">
        <Field label="Name *"><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Mobile *"><Input required value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Email"><Input type="email" value={f.email || ""} onChange={set("email")} /></Field>
        <Field label="City"><Input value={f.city || ""} onChange={set("city")} /></Field>
        <Field label="Interested in"><Select value={f.service} onChange={set("service")} options={SERVICES} /></Field>
        <Field label="Source"><Select value={f.source} onChange={set("source")} options={LEAD_SOURCES} /></Field>
        <Field label="Stage"><Select value={f.status} onChange={set("status")} options={LEAD_STAGES} /></Field>
        <Field label="Assigned to"><UserSelect value={f.assigned_to} onChange={set("assigned_to")} /></Field>
        <Field label="Expected premium (₹)"><Input type="number" min="0" value={f.expected_premium ?? ""} onChange={set("expected_premium")} /></Field>
        <Field label="Next follow-up"><Input type="date" value={f.follow_up_date || ""} onChange={set("follow_up_date")} /></Field>
        <Field label="Requirement / notes" className="sm:col-span-2"><Textarea value={f.message || ""} onChange={set("message")} /></Field>
        <div className="sm:col-span-2"><Actions busy={busy} onCancel={() => onOpenChange(false)} /></div>
      </form>
    </Modal>
  );
}

/* ---------------- Customer ---------------- */
export function CustomerForm({ open, onOpenChange, customer, onSaved }) {
  const { user } = useAuth();
  const init = customer || { name: "", phone: "", email: "", city: "", address: "", dob: "", pan: "", notes: "", assigned_to: user?.id || "" };
  const { f, set, busy, run } = useForm(init, open);
  const submit = async (e) => {
    e.preventDefault();
    const body = clean({ name: f.name, phone: f.phone, email: f.email, city: f.city, address: f.address,
      dob: f.dob, pan: f.pan, notes: f.notes, assigned_to: f.assigned_to });
    const r = await run(() => (customer ? crm.patch(`/customers/${customer.id}`, body) : crm.post("/customers", body)),
      customer ? "Customer updated" : "Customer added");
    if (r) { onSaved?.(r.data); onOpenChange(false); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={customer ? "Edit customer" : "New customer"} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="customer-form">
        <Field label="Full name *"><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Mobile *"><Input required value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Email"><Input type="email" value={f.email || ""} onChange={set("email")} /></Field>
        <Field label="City"><Input value={f.city || ""} onChange={set("city")} /></Field>
        <Field label="Date of birth"><Input type="date" value={f.dob || ""} onChange={set("dob")} /></Field>
        <Field label="PAN"><Input value={f.pan || ""} onChange={set("pan")} className="uppercase" maxLength={10} /></Field>
        <Field label="Address" className="sm:col-span-2"><Textarea value={f.address || ""} onChange={set("address")} className="min-h-[60px]" /></Field>
        <Field label="Relationship manager"><UserSelect value={f.assigned_to} onChange={set("assigned_to")} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes || ""} onChange={set("notes")} className="min-h-[60px]" /></Field>
        <div className="sm:col-span-2"><Actions busy={busy} onCancel={() => onOpenChange(false)} /></div>
      </form>
    </Modal>
  );
}

/* ---------------- Policy ---------------- */
export function PolicyForm({ open, onOpenChange, policy, customerId, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const start = isoToday();
  const init = policy || { customer_id: customerId || "", policy_number: "", insurer: "", policy_type: "Health", plan_name: "",
    sum_insured: "", premium: "", payment_mode: "annual", start_date: start, end_date: addYear(start), status: "active",
    commission_pct: "", vehicle_number: "", members: "", nominee: "", notes: "" };
  const { f, set, busy, run, setF } = useForm(init, open);
  useEffect(() => {
    if (open && !customerId && !policy) crm.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  }, [open, customerId, policy]);
  const submit = async (e) => {
    e.preventDefault();
    const nums = ["sum_insured", "premium", "commission_pct"];
    const fields = ["policy_number", "insurer", "policy_type", "plan_name", "sum_insured", "premium", "payment_mode",
      "start_date", "end_date", "status", "commission_pct", "vehicle_number", "members", "nominee", "notes"];
    const body = clean(Object.fromEntries(fields.map((k) => [k, f[k]])), nums);
    if (!policy) body.customer_id = f.customer_id;
    const r = await run(() => (policy ? crm.patch(`/policies/${policy.id}`, body) : crm.post("/policies", body)),
      policy ? "Policy updated" : "Policy added");
    if (r) { onSaved?.(r.data); onOpenChange(false); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={policy ? `Edit policy ${policy.policy_number}` : "Add policy"} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="policy-form">
        {!policy && !customerId && (
          <Field label="Customer *" className="sm:col-span-2">
            <Select required value={f.customer_id} onChange={set("customer_id")} placeholder="Select customer…"
              options={customers.map((c) => ({ value: c.id, label: `${c.name} — ${c.phone}` }))} />
          </Field>
        )}
        <Field label="Policy number *"><Input required value={f.policy_number} onChange={set("policy_number")} /></Field>
        <Field label="Insurer *">
          <Input required list="insurers" value={f.insurer} onChange={set("insurer")} />
          <datalist id="insurers">{INSURERS.map((i) => <option key={i} value={i} />)}</datalist>
        </Field>
        <Field label="Type"><Select value={f.policy_type} onChange={set("policy_type")} options={POLICY_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
        <Field label="Plan name"><Input value={f.plan_name || ""} onChange={set("plan_name")} /></Field>
        <Field label="Sum insured (₹)"><Input type="number" min="0" value={f.sum_insured ?? ""} onChange={set("sum_insured")} /></Field>
        <Field label="Premium (₹) *"><Input required type="number" min="0" value={f.premium ?? ""} onChange={set("premium")} /></Field>
        <Field label="Payment mode"><Select value={f.payment_mode} onChange={set("payment_mode")} options={["annual", "half-yearly", "quarterly", "monthly", "single"]} /></Field>
        <Field label="Commission %"><Input type="number" min="0" max="100" step="0.1" value={f.commission_pct ?? ""} onChange={set("commission_pct")} /></Field>
        <Field label="Start date *">
          <Input required type="date" value={f.start_date} onChange={(e) => setF((o) => ({ ...o, start_date: e.target.value, end_date: policy ? o.end_date : addYear(e.target.value) }))} />
        </Field>
        <Field label="End / renewal date *"><Input required type="date" value={f.end_date} onChange={set("end_date")} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set("status")} options={POLICY_STATUSES} /></Field>
        {f.policy_type === "Motor" ? (
          <Field label="Vehicle number"><Input value={f.vehicle_number || ""} onChange={set("vehicle_number")} className="uppercase" /></Field>
        ) : (
          <Field label="Insured members"><Input value={f.members || ""} onChange={set("members")} placeholder="Self, spouse, 2 kids" /></Field>
        )}
        <Field label="Nominee"><Input value={f.nominee || ""} onChange={set("nominee")} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes || ""} onChange={set("notes")} className="min-h-[60px]" /></Field>
        <div className="sm:col-span-2"><Actions busy={busy} onCancel={() => onOpenChange(false)} /></div>
      </form>
    </Modal>
  );
}

/* ---------------- Renew ---------------- */
export function RenewForm({ open, onOpenChange, policy, onSaved }) {
  const nextStart = policy?.end_date ? (() => {
    const d = new Date(`${policy.end_date}T00:00:00`); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })() : isoToday();
  const init = { policy_number: policy?.policy_number || "", insurer: policy?.insurer || "", premium: policy?.premium ?? "",
    sum_insured: policy?.sum_insured ?? "", start_date: nextStart, end_date: addYear(nextStart) };
  const { f, set, busy, run, setF } = useForm(init, open);
  const submit = async (e) => {
    e.preventDefault();
    const r = await run(() => crm.post(`/policies/${policy.id}/renew`, clean(f, ["premium", "sum_insured"])), "Policy renewed");
    if (r) { onSaved?.(r.data); onOpenChange(false); }
  };
  if (!policy) return null;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Renew policy"
      description={`Creates the next term for ${policy.policy_number} and marks the current one as renewed.`}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3" data-testid="renew-form">
        <Field label="New policy number"><Input value={f.policy_number} onChange={set("policy_number")} /></Field>
        <Field label="Insurer"><Input list="insurers" value={f.insurer} onChange={set("insurer")} /></Field>
        <Field label="Premium (₹)"><Input type="number" min="0" value={f.premium} onChange={set("premium")} /></Field>
        <Field label="Sum insured (₹)"><Input type="number" min="0" value={f.sum_insured} onChange={set("sum_insured")} /></Field>
        <Field label="Start date"><Input type="date" value={f.start_date} onChange={(e) => setF((o) => ({ ...o, start_date: e.target.value, end_date: addYear(e.target.value) }))} /></Field>
        <Field label="End date"><Input type="date" value={f.end_date} onChange={set("end_date")} /></Field>
        <div className="col-span-2"><Actions busy={busy} onCancel={() => onOpenChange(false)} submitLabel="Renew" /></div>
      </form>
    </Modal>
  );
}

/* ---------------- Claim ---------------- */
export function ClaimForm({ open, onOpenChange, claim, policies, defaultPolicyId, onSaved }) {
  const init = claim || { policy_id: defaultPolicyId || policies?.[0]?.id || "", claim_type: "cashless", claim_number: "",
    incident_date: isoToday(), claimed_amount: "", hospital_or_garage: "", description: "", status: "intimated" };
  const { f, set, busy, run } = useForm(init, open);
  const submit = async (e) => {
    e.preventDefault();
    const nums = ["claimed_amount", "approved_amount", "settled_amount"];
    let r;
    if (claim) {
      const fields = ["claim_type", "claim_number", "incident_date", "claimed_amount", "approved_amount", "settled_amount",
        "hospital_or_garage", "description", "status", "rejection_reason"];
      r = await run(() => crm.patch(`/claims/${claim.id}`, clean(Object.fromEntries(fields.map((k) => [k, f[k]])), nums)), "Claim updated");
    } else {
      const fields = ["policy_id", "claim_type", "claim_number", "incident_date", "claimed_amount", "hospital_or_garage", "description", "status"];
      r = await run(() => crm.post("/claims", clean(Object.fromEntries(fields.map((k) => [k, f[k]])), nums)), "Claim registered");
    }
    if (r) { onSaved?.(r.data); onOpenChange(false); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={claim ? `Claim ${claim.claim_number || ""}` : "Register claim"} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="claim-form">
        {!claim && (
          <Field label="Policy *" className="sm:col-span-2">
            <Select required value={f.policy_id} onChange={set("policy_id")} placeholder="Select policy…"
              options={(policies || []).map((p) => ({ value: p.id, label: `${p.policy_number} — ${p.insurer} (${p.policy_type})${p.customer_name ? ` · ${p.customer_name}` : ""}` }))} />
          </Field>
        )}
        <Field label="Claim type"><Select value={f.claim_type} onChange={set("claim_type")} options={["cashless", "reimbursement", "own_damage", "third_party", "death", "other"]} /></Field>
        <Field label="Insurer claim no."><Input value={f.claim_number || ""} onChange={set("claim_number")} /></Field>
        <Field label="Incident / admission date"><Input type="date" value={f.incident_date || ""} onChange={set("incident_date")} /></Field>
        <Field label="Hospital / garage"><Input value={f.hospital_or_garage || ""} onChange={set("hospital_or_garage")} /></Field>
        <Field label="Claimed amount (₹)"><Input type="number" min="0" value={f.claimed_amount ?? ""} onChange={set("claimed_amount")} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set("status")} options={CLAIM_STATUSES} /></Field>
        {claim && (
          <>
            <Field label="Approved amount (₹)"><Input type="number" min="0" value={f.approved_amount ?? ""} onChange={set("approved_amount")} /></Field>
            <Field label="Settled amount (₹)"><Input type="number" min="0" value={f.settled_amount ?? ""} onChange={set("settled_amount")} /></Field>
            {f.status === "rejected" && (
              <Field label="Rejection reason" className="sm:col-span-2"><Input value={f.rejection_reason || ""} onChange={set("rejection_reason")} /></Field>
            )}
          </>
        )}
        <Field label="Description" className="sm:col-span-2"><Textarea value={f.description || ""} onChange={set("description")} className="min-h-[60px]" /></Field>
        <div className="sm:col-span-2"><Actions busy={busy} onCancel={() => onOpenChange(false)} /></div>
      </form>
    </Modal>
  );
}

/* ---------------- Task ---------------- */
export function TaskForm({ open, onOpenChange, task, context = {}, onSaved }) {
  const { user } = useAuth();
  const init = task || { title: "", due_date: isoToday(1), kind: "follow_up", priority: "medium", assigned_to: user?.id || "", notes: "" };
  const { f, set, busy, run } = useForm(init, open);
  const submit = async (e) => {
    e.preventDefault();
    const base = clean({ title: f.title, due_date: f.due_date, kind: f.kind, priority: f.priority, assigned_to: f.assigned_to, notes: f.notes });
    const r = await run(() => (task ? crm.patch(`/tasks/${task.id}`, base) : crm.post("/tasks", { ...base, ...context })),
      task ? "Task updated" : "Task created");
    if (r) { onSaved?.(r.data); onOpenChange(false); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={task ? "Edit task" : "New task"}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3" data-testid="task-form">
        <Field label="What needs doing? *" className="col-span-2"><Input required value={f.title} onChange={set("title")} /></Field>
        <Field label="Due date *"><Input required type="date" value={f.due_date} onChange={set("due_date")} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={set("priority")} options={["low", "medium", "high"]} /></Field>
        <Field label="Type"><Select value={f.kind} onChange={set("kind")} options={["follow_up", "renewal", "claim", "payment", "document", "other"]} /></Field>
        <Field label="Assigned to"><UserSelect value={f.assigned_to} onChange={set("assigned_to")} /></Field>
        <Field label="Notes" className="col-span-2"><Textarea value={f.notes || ""} onChange={set("notes")} className="min-h-[60px]" /></Field>
        <div className="col-span-2"><Actions busy={busy} onCancel={() => onOpenChange(false)} /></div>
      </form>
    </Modal>
  );
}
