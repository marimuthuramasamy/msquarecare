import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Funnel, AddressBook, ShieldCheck, ArrowsClockwise, FirstAid, CheckSquare, CurrencyInr, WhatsappLogo,
} from "@phosphor-icons/react";
import { crm } from "../api";
import { useAuth } from "../AuthContext";
import { Card, ExpiryBadge, PageHeader, Stat, Btn, Empty } from "../ui";
import { inr, fmtDate, label, waTo } from "../utils";

const STAGE_COLOR = "#1a2f6b";

function MonthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-800">{monthLabel(p.month, true)}</div>
      <div className="text-slate-600 tabular-nums">Premium: {inr(p.premium)}</div>
      <div className="text-slate-600 tabular-nums">Policies: {p.policies}</div>
      <div className="text-slate-600 tabular-nums">Commission: {inr(p.commission)}</div>
    </div>
  );
}

const monthLabel = (ym, long) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", ...(long ? { year: "numeric" } : {}) });

export default function Dashboard() {
  const [d, setD] = useState(null);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    crm.get("/dashboard").then((r) => setD(r.data)).catch(() => {});
  }, []);

  if (!d) return <div className="text-slate-400">Loading dashboard…</div>;

  const maxStage = Math.max(1, ...Object.values(d.lead_stages));
  const maxType = Math.max(1, ...d.premium_by_type.map((x) => x.premium));
  const hour = new Date().getHours();

  return (
    <div data-testid="crm-dashboard">
      <PageHeader
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${user?.name?.split(" ")[0] || ""}`}
        subtitle={`${d.my_tasks_today} task${d.my_tasks_today === 1 ? "" : "s"} due today for you · ${d.renewals_due_30} renewals in the next 30 days`}
        actions={
          <>
            <Btn variant="outline" onClick={() => nav("/crm/leads?new=1")}>+ Lead</Btn>
            <Btn variant="outline" onClick={() => nav("/crm/customers?new=1")}>+ Customer</Btn>
            <Btn onClick={() => nav("/crm/policies?new=1")}>+ Policy</Btn>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active premium" value={inr(d.premium_active, true)} sub={`${d.policies_active} active policies`} icon={CurrencyInr} tone="green" onClick={() => nav("/crm/policies")} />
        <Stat label="Commission (active book)" value={inr(d.commission_active, true)} sub="Estimated on active policies" icon={ShieldCheck} />
        <Stat label="Leads this month" value={d.leads_new_this_month} sub={`${d.leads_total} total · ${d.conversion_rate}% won`} icon={Funnel} onClick={() => nav("/crm/leads")} />
        <Stat label="Customers" value={d.customers_total} icon={AddressBook} onClick={() => nav("/crm/customers")} />
        <Stat label="Renewals due (30d)" value={d.renewals_due_30} sub={d.renewals_overdue ? `${d.renewals_overdue} overdue` : "None overdue"} icon={ArrowsClockwise} tone={d.renewals_overdue ? "red" : "navy"} onClick={() => nav("/crm/renewals")} />
        <Stat label="Open claims" value={d.claims_open} sub={`${inr(d.claims_open_amount, true)} claimed`} icon={FirstAid} onClick={() => nav("/crm/claims")} />
        <Stat label="Open tasks" value={d.tasks_open} sub={d.tasks_overdue ? `${d.tasks_overdue} overdue` : "All on track"} icon={CheckSquare} tone={d.tasks_overdue ? "red" : "navy"} onClick={() => nav("/crm/tasks")} />
        <Stat label="Lead conversion" value={`${d.conversion_rate}%`} sub="Won ÷ (won + lost)" icon={Funnel} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-navy">Premium written — last 6 months</h2>
          <p className="text-xs text-slate-500">By policy start date, excluding cancelled policies</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => inr(v, true)} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={64} />
                <Tooltip content={<MonthTooltip />} cursor={{ fill: "rgba(26,47,107,0.06)" }} />
                <Bar dataKey="premium" fill={STAGE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold text-navy">Lead pipeline</h2>
          <p className="text-xs text-slate-500">Leads in each stage</p>
          <div className="mt-4 space-y-2.5">
            {Object.entries(d.lead_stages).map(([stage, n]) => (
              <Link to={`/crm/leads?status=${stage}`} key={stage} className="block group" title={`${label(stage)}: ${n}`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 group-hover:text-navy">{label(stage)}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{n}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-navy" style={{ width: `${(n / maxStage) * 100}%`, opacity: stage === "lost" ? 0.35 : 1 }} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-navy">Upcoming & overdue renewals</h2>
            <Link to="/crm/renewals" className="text-sm font-semibold text-brand-greenDark hover:underline">View all</Link>
          </div>
          {d.upcoming_renewals.length === 0 ? (
            <Empty>No renewals due in the next 30 days.</Empty>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {d.upcoming_renewals.map((p) => (
                <li key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/crm/customers/${p.customer_id}`} className="font-medium text-slate-800 hover:text-navy">{p.customer_name}</Link>
                    <div className="text-xs text-slate-500">{p.policy_type} · {p.insurer} · {p.policy_number} · ends {fmtDate(p.end_date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{inr(p.premium)}</span>
                    <ExpiryBadge days={p.days_to_expiry} status={p.status} />
                    <a
                      href={waTo(p.customer_phone, `Hi ${p.customer_name}, this is MSquare Care. Your ${p.policy_type} policy ${p.policy_number} with ${p.insurer} is due for renewal on ${fmtDate(p.end_date)}. Shall we renew it for you?`)}
                      target="_blank" rel="noreferrer" title="Send WhatsApp reminder"
                      className="text-brand-green hover:text-brand-greenDark"
                    >
                      <WhatsappLogo size={22} weight="fill" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold text-navy">Active premium by type</h2>
          {d.premium_by_type.length === 0 ? (
            <Empty>No active policies yet.</Empty>
          ) : (
            <div className="mt-4 space-y-2.5">
              {d.premium_by_type.map((x) => (
                <div key={x.type} title={`${x.type}: ${inr(x.premium)}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{x.type}</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{inr(x.premium, true)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-brand-green" style={{ width: `${(x.premium / maxType) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
