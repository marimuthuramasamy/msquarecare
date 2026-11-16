import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { GoogleLogo, CheckCircle, LinkSimpleBreak, ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react";
import { API } from "@/lib/config";
import { crm, errMsg, downloadCsv, getToken } from "../api";
import { useAuth } from "../AuthContext";
import ReminderSettings from "../ReminderSettings";
import { Btn, Card, Field, Input, Modal, PageHeader, Pill, Select, Table, Td } from "../ui";

function TeamCard() {
  const { users, loadUsers, user: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "agent", password: "" });
  const [reset, setReset] = useState(null);
  const [pw, setPw] = useState("");

  const create = async (e) => {
    e.preventDefault();
    try {
      await crm.post("/users", f);
      toast.success(`${f.name} can now sign in`);
      setOpen(false);
      setF({ name: "", email: "", phone: "", role: "agent", password: "" });
      loadUsers();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const patch = async (u, body, msg) => {
    try {
      await crm.patch(`/users/${u.id}`, body);
      if (msg) toast.success(msg);
      loadUsers();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="font-display font-semibold text-navy">Team</h2>
          <p className="text-xs text-slate-500">Admins manage users and can delete records; agents handle day-to-day work.</p>
        </div>
        <Btn onClick={() => setOpen(true)} data-testid="user-new-btn">+ Add user</Btn>
      </div>
      <Table head={["Name", "Email", "Role", "Status", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td className="font-medium">{u.name}{u.id === me.id && <span className="text-xs text-slate-400"> (you)</span>}</Td>
            <Td>{u.email}</Td>
            <Td>
              <Select value={u.role} disabled={u.id === me.id} onChange={(role) => patch(u, { role }, "Role updated")}
                options={[{ value: "admin", label: "Admin" }, { value: "agent", label: "Agent" }]} className="w-28" />
            </Td>
            <Td>{u.active ? <Pill tone="green">Active</Pill> : <Pill tone="slate">Disabled</Pill>}</Td>
            <Td className="text-right whitespace-nowrap">
              <Btn variant="ghost" className="px-2 py-1" onClick={() => { setReset(u); setPw(""); }}>Reset password</Btn>
              {u.id !== me.id && (
                <Btn variant="ghost" className="px-2 py-1" onClick={() => patch(u, { active: !u.active }, u.active ? "User disabled" : "User enabled")}>
                  {u.active ? "Disable" : "Enable"}
                </Btn>
              )}
            </Td>
          </tr>
        ))}
      </Table>

      <Modal open={open} onOpenChange={setOpen} title="Add team member">
        <form onSubmit={create} className="grid grid-cols-2 gap-3">
          <Field label="Name *" className="col-span-2"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email *"><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Role"><Select value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ value: "agent", label: "Agent" }, { value: "admin", label: "Admin" }]} /></Field>
          <Field label="Temporary password *" hint="At least 6 characters"><Input required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <div className="col-span-2 flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn type="submit">Create user</Btn></div>
        </form>
      </Modal>
      <Modal open={!!reset} onOpenChange={(o) => !o && setReset(null)} title={`Reset password — ${reset?.name}`}>
        <form onSubmit={async (e) => { e.preventDefault(); await patch(reset, { password: pw }, "Password reset"); setReset(null); }} className="space-y-3">
          <Field label="New password" hint="At least 6 characters"><Input required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setReset(null)}>Cancel</Btn><Btn type="submit">Save</Btn></div>
        </form>
      </Modal>
    </Card>
  );
}

function PasswordCard() {
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await crm.post("/auth/password", f);
      toast.success("Password changed");
      setF({ current_password: "", new_password: "" });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-navy mb-3">Change my password</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Current password"><Input type="password" required value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></Field>
        <Field label="New password"><Input type="password" required minLength={6} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
        <Btn type="submit">Update password</Btn>
      </form>
    </Card>
  );
}

const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

function GoogleCard() {
  const [integ, setInteg] = useState(null);
  const load = useCallback(() => {
    axios.get(`${API}/integrations/status`, { headers: authHeader() }).then((r) => setInteg(r.data)).catch(() => setInteg({ error: true }));
  }, []);
  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search).get("google");
    if (p === "connected") toast.success("Google connected! New leads now sync to your Sheet with email alerts.");
    if (p === "error") toast.error("Google connection failed. Please try again.");
    if (p) window.history.replaceState({}, "", "/crm/settings");
  }, [load]);
  const disconnect = async () => {
    await axios.post(`${API}/integrations/disconnect`, {}, { headers: authHeader() });
    toast.success("Google disconnected");
    load();
  };
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-lg bg-navy/5 flex items-center justify-center shrink-0"><GoogleLogo size={20} weight="bold" className="text-navy" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold text-navy">Google Sheets sync & email alerts</h2>
          {!integ && <p className="text-sm text-slate-400">Checking…</p>}
          {integ?.error && <p className="text-sm text-slate-500">Only admins can manage integrations.</p>}
          {integ && !integ.error && !integ.configured && <p className="text-sm text-slate-500">Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server to enable.</p>}
          {integ?.configured && !integ.connected && <p className="text-sm text-slate-500">Connect the business Google account to copy each website lead into a Sheet and get an email alert.</p>}
          {integ?.connected && <p className="text-sm text-brand-greenDark flex items-center gap-1"><CheckCircle size={16} weight="fill" /> Connected {integ.email ? `as ${integ.email}` : ""}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {integ?.configured && !integ.connected && (
              <a href={`${API}/oauth/sheets/login?token=${encodeURIComponent(getToken() || "")}`}><Btn><GoogleLogo size={16} /> Connect Google</Btn></a>
            )}
            {integ?.sheet_url && <a href={integ.sheet_url} target="_blank" rel="noreferrer"><Btn variant="outline"><ArrowSquareOut size={16} /> Open Sheet</Btn></a>}
            {integ?.connected && <Btn variant="danger" onClick={disconnect}><LinkSimpleBreak size={16} /> Disconnect</Btn>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Settings" subtitle={`Signed in as ${user.email}`} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {user.role === "admin" && <TeamCard />}
          {user.role === "admin" && <ReminderSettings />}
          {user.role === "admin" && <GoogleCard />}
          <Card className="p-5">
            <h2 className="font-display font-semibold text-navy mb-1">Data export</h2>
            <p className="text-xs text-slate-500 mb-3">Download CSV files (open in Excel or Google Sheets).</p>
            <div className="flex flex-wrap gap-2">
              {["leads", "customers", "policies", "claims"].map((k) => (
                <Btn key={k} variant="outline" className="capitalize" onClick={() => downloadCsv(k).catch(() => toast.error("Export failed"))}><DownloadSimple size={16} /> {k}</Btn>
              ))}
            </div>
          </Card>
        </div>
        <PasswordCard />
      </div>
    </div>
  );
}
