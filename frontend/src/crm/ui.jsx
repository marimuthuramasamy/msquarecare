import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  ChatCircleText, Phone, WhatsappLogo, EnvelopeSimple, UsersThree, Gear,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { crm, errMsg } from "./api";
import { fmtDateTime, label } from "./utils";

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy">{title}</h1>
      {subtitle && <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Btn = ({ variant = "primary", className = "", children, ...props }) => {
  const styles = {
    primary: "bg-navy text-white hover:bg-navy-dark",
    green: "bg-brand-green text-white hover:bg-brand-greenDark",
    outline: "border border-navy/20 text-navy bg-white hover:bg-navy/5",
    ghost: "text-navy hover:bg-navy/5",
    danger: "border border-red-200 text-red-600 bg-white hover:bg-red-50",
  };
  return (
    <button
      type="button"
      className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none", styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ className = "", children, ...p }) => (
  <div className={`rounded-xl bg-white border border-slate-200 shadow-sm ${className}`} {...p}>{children}</div>
);

export const Field = ({ label: l, children, className = "", hint }) => (
  <label className={`block ${className}`}>
    <span className="block text-xs font-semibold text-slate-600 mb-1">{l}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
  </label>
);

export const Select = ({ value, onChange, options, placeholder, className = "", ...props }) => (
  <select
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className={cn("h-9 w-full rounded-md border border-input bg-white px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring", className)}
    {...props}
  >
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) =>
      typeof o === "string" ? (
        <option key={o} value={o}>{label(o)}</option>
      ) : (
        <option key={o.value} value={o.value}>{o.label}</option>
      )
    )}
  </select>
);

export { Input, Textarea };

const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  navy: "bg-navy/10 text-navy ring-navy/20",
};

const STATUS_TONE = {
  new: "blue", contacted: "navy", quoted: "violet", negotiation: "amber", won: "green", lost: "slate",
  active: "green", pending: "amber", lapsed: "red", cancelled: "slate", renewed: "navy", expired: "red",
  intimated: "blue", documents_pending: "amber", submitted: "navy", under_review: "violet",
  approved: "green", settled: "green", rejected: "red", open: "blue", done: "green",
  high: "red", medium: "amber", low: "slate",
};

export const Pill = ({ tone = "slate", children, className = "" }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone]} ${className}`}>
    {children}
  </span>
);

export const StatusBadge = ({ status }) => <Pill tone={STATUS_TONE[status] || "slate"}>{label(status)}</Pill>;

export const ExpiryBadge = ({ days, status }) => {
  if (days === null || days === undefined || !["active", "expired"].includes(status)) return null;
  if (days < 0) return <Pill tone="red">Expired {-days}d ago</Pill>;
  if (days <= 15) return <Pill tone="red">{days}d left</Pill>;
  if (days <= 45) return <Pill tone="amber">{days}d left</Pill>;
  return null;
};

export const Empty = ({ children }) => (
  <div className="py-12 text-center text-sm text-slate-400">{children}</div>
);

export function Modal({ open, onOpenChange, title, description, children, wide }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-display text-navy">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export const Stat = ({ label: l, value, sub, icon: Icon, tone = "navy", onClick }) => (
  <Card className={`p-4 ${onClick ? "cursor-pointer hover:border-navy/30 transition-colors" : ""}`} onClick={onClick}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{l}</div>
      {Icon && <Icon size={20} weight="duotone" className={tone === "green" ? "text-brand-green" : tone === "red" ? "text-red-500" : "text-navy"} />}
    </div>
    <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
  </Card>
);

const KIND_ICON = { note: ChatCircleText, call: Phone, whatsapp: WhatsappLogo, email: EnvelopeSimple, meeting: UsersThree, system: Gear };

export function Timeline({ items }) {
  if (!items?.length) return <Empty>No activity yet.</Empty>;
  return (
    <ol className="relative space-y-4 before:absolute before:left-[13px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
      {items.map((a) => {
        const Icon = KIND_ICON[a.kind] || Gear;
        return (
          <li key={a.id} className="relative flex gap-3">
            <span className={`relative z-[1] mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center ring-4 ring-white ${a.kind === "system" ? "bg-slate-100 text-slate-500" : "bg-navy/10 text-navy"}`}>
              <Icon size={14} weight="bold" />
            </span>
            <div className="min-w-0">
              <div className={`text-sm whitespace-pre-wrap break-words ${a.kind === "system" ? "text-slate-500" : "text-slate-800"}`}>{a.text}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {label(a.kind)} · {a.user_name || "System"} · {fmtDateTime(a.created_at)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityComposer({ entityType, entityId, onAdded }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("note");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await crm.post("/activities", { entity_type: entityType, entity_id: entityId, kind, text });
      setText("");
      onAdded?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Log a call, note or meeting outcome…"
        className="bg-white min-h-[70px]"
        data-testid="activity-input"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Select value={kind} onChange={setKind} options={["note", "call", "whatsapp", "email", "meeting"]} className="w-36" />
        <Btn onClick={submit} disabled={busy || !text.trim()} data-testid="activity-add-btn">Add to timeline</Btn>
      </div>
    </div>
  );
}

export const Table = ({ head, children, empty, colSpan }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          {head.map((h, i) => (
            <th key={i} className={`px-4 py-2.5 whitespace-nowrap ${typeof h === "object" ? h.className : ""}`}>
              {typeof h === "object" ? h.label : h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {React.Children.count(children) ? children : (
          <tr><td colSpan={colSpan || head.length}><Empty>{empty || "Nothing here yet."}</Empty></td></tr>
        )}
      </tbody>
    </table>
  </div>
);

export const Td = ({ className = "", children, ...p }) => (
  <td className={`px-4 py-3 align-middle ${className}`} {...p}>{children}</td>
);
