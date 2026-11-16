import React, { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { WhatsappLogo, Play, CheckCircle, Warning } from "@phosphor-icons/react";
import { crm, errMsg } from "./api";
import { Btn, Card, Field, Input, Modal, Select, Textarea } from "./ui";

const dayLabel = (n) => (n > 0 ? `${n} day${n === 1 ? "" : "s"} before` : n === 0 ? "On expiry day" : `${-n} day${n === -1 ? "" : "s"} after`);

export default function ReminderSettings() {
  const [s, setS] = useState(null);
  const [dayInput, setDayInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    crm.get("/reminders/settings").then((r) => setS(r.data)).catch(() => {});
  }, []);

  if (!s) return null;
  const set = (k) => (v) => setS((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));

  const save = async (patch = {}) => {
    setBusy(true);
    try {
      const body = { ...s, ...patch };
      const r = await crm.put("/reminders/settings", {
        enabled: body.enabled, mode: body.mode, schedule: body.schedule, send_hour: Number(body.send_hour),
        template_before: body.template_before, template_after: body.template_after,
        api_template_name: body.api_template_name, api_template_lang: body.api_template_lang,
      });
      setS(r.data);
      toast.success("Reminder settings saved");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const addDay = () => {
    const n = parseInt(dayInput, 10);
    if (Number.isNaN(n)) return;
    setS((o) => ({ ...o, schedule: [...new Set([...o.schedule, n])].sort((a, b) => b - a) }));
    setDayInput("");
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const r = await crm.post("/reminders/run");
      const { sent, queued, failed, skipped } = r.data;
      toast.success(`Done — ${sent} sent, ${queued} queued for manual send, ${failed} failed, ${skipped} skipped`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async () => {
    const r = await crm.get("/reminders/preview");
    setPreview(r.data);
  };

  return (
    <Card className="p-5" data-testid="reminder-settings">
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-lg bg-brand-green/10 flex items-center justify-center shrink-0">
          <WhatsappLogo size={22} weight="fill" className="text-brand-green" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-navy">Automatic WhatsApp renewal reminders</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Switch checked={s.enabled} onCheckedChange={(v) => save({ enabled: v })} disabled={busy} data-testid="reminder-enabled" />
              {s.enabled ? "On" : "Off"}
            </label>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Every day after {String(s.send_hour).padStart(2, "0")}:00 IST, customers whose policy reaches a reminder day get a WhatsApp message.
            Each reminder is sent once; renewed policies stop automatically.
          </p>

          <div className={`mt-3 rounded-lg px-3 py-2 text-sm flex items-start gap-2 ${s.api_configured ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            {s.api_configured ? <CheckCircle size={18} weight="fill" className="shrink-0 mt-0.5" /> : <Warning size={18} weight="fill" className="shrink-0 mt-0.5" />}
            <span>
              {s.api_configured
                ? <>WhatsApp Business API connected (number ID {s.phone_number_id}). Choose “Send automatically” to deliver without staff action.</>
                : <>WhatsApp Business API not connected — reminders are queued on the <b>Renewals</b> page for one-click sending. To send fully automatically, set <code>WHATSAPP_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code> on the server (see README).</>}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Delivery">
              <Select value={s.mode} onChange={set("mode")} options={[
                { value: "manual", label: "Queue for one-click sending" },
                ...(s.api_configured ? [{ value: "api", label: "Send automatically (API)" }] : []),
              ]} />
            </Field>
            <Field label="Send after (IST)">
              <Select value={String(s.send_hour)} onChange={set("send_hour")}
                options={Array.from({ length: 15 }, (_, i) => i + 7).map((h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))} />
            </Field>
          </div>

          <Field label="Remind customers" className="mt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {s.schedule.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 rounded-full bg-navy/10 text-navy px-2.5 py-1 text-xs font-medium">
                  {dayLabel(n)}
                  <button type="button" aria-label="Remove" className="text-navy/60 hover:text-red-600"
                    onClick={() => setS((o) => ({ ...o, schedule: o.schedule.filter((x) => x !== n) }))}>×</button>
                </span>
              ))}
              <Input value={dayInput} onChange={(e) => setDayInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDay())}
                type="number" placeholder="days" className="h-8 w-20" aria-label="Days before expiry (negative = after)" />
              <Btn variant="outline" className="py-1" onClick={addDay}>Add</Btn>
            </div>
            <span className="block text-[11px] text-slate-400 mt-1">Days before expiry; use a negative number for days after expiry (e.g. -3).</span>
          </Field>

          {s.mode === "manual" || !s.api_configured ? (
            <>
              <Field label="Message before expiry" className="mt-3"><Textarea value={s.template_before} onChange={set("template_before")} className="min-h-[90px]" /></Field>
              <Field label="Message after expiry" className="mt-3"><Textarea value={s.template_after} onChange={set("template_after")} className="min-h-[70px]" /></Field>
              <p className="text-[11px] text-slate-400 mt-1">
                Placeholders: {s.placeholders.map((p) => <code key={p} className="mr-1">{`{${p}}`}</code>)}
              </p>
            </>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Approved Meta template name" hint="Body uses {{1}} name, {{2}} policy, {{3}} insurer, {{4}} expiry date, {{5}} premium">
                <Input value={s.api_template_name} onChange={set("api_template_name")} />
              </Field>
              <Field label="Template language code"><Input value={s.api_template_lang} onChange={set("api_template_lang")} /></Field>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Btn onClick={() => save()} disabled={busy} data-testid="reminder-save">Save settings</Btn>
            <Btn variant="outline" onClick={showPreview}>Preview who's due</Btn>
            <Btn variant="outline" onClick={runNow} disabled={busy} data-testid="reminder-run"><Play size={16} /> Run now</Btn>
          </div>
        </div>
      </div>

      <Modal open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="Reminders due on the next run" wide
        description="Based on the saved settings. Already-sent reminders are not repeated.">
        {preview && preview.length === 0 && <p className="text-sm text-slate-500">Nobody is due a reminder right now.</p>}
        <ul className="divide-y divide-slate-100">
          {preview?.map((p) => (
            <li key={`${p.policy_id}:${p.stage}`} className="py-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800">{p.customer_name} · {p.policy_number}</span>
                <span className="text-slate-500">{dayLabel(p.stage)} stage{p.opted_out ? " · opted out (won't send)" : ""}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 bg-slate-50 rounded p-2 whitespace-pre-wrap">{p.message}</p>
            </li>
          ))}
        </ul>
      </Modal>
    </Card>
  );
}
