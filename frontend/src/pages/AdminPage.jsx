import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { LockKey, DownloadSimple, ArrowLeft, MagnifyingGlass, Users, GoogleLogo, CheckCircle, LinkSimpleBreak, ArrowSquareOut } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { API } from "@/lib/config";
import { LogoWordmark } from "@/components/Logo";

const statusColor = {
  new: "bg-brand-green/15 text-brand-greenDark",
  contacted: "bg-navy/10 text-navy",
  closed: "bg-slate-200 text-slate-600",
};

export default function AdminPage() {
  const [passcode, setPasscode] = useState(sessionStorage.getItem("msq_admin") || "");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [leads, setLeads] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [integ, setInteg] = useState(null);

  const loadInteg = useCallback(async (code) => {
    try {
      const res = await axios.get(`${API}/integrations/status`, { headers: { "X-Admin-Passcode": code } });
      setInteg(res.data);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const load = useCallback(async (code) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/leads`, { headers: { "X-Admin-Passcode": code } });
      setLeads(res.data);
      setAuthed(true);
      sessionStorage.setItem("msq_admin", code);
      setPasscode(code);
      loadInteg(code);
    } catch (e) {
      toast.error("Invalid passcode.");
      setAuthed(false);
      sessionStorage.removeItem("msq_admin");
    } finally {
      setLoading(false);
    }
  }, [loadInteg]);

  useEffect(() => {
    if (passcode) load(passcode);
    const p = new URLSearchParams(window.location.search).get("google");
    if (p === "connected") {
      toast.success("Google connected! Leads now sync to your Sheet with email alerts.");
      window.history.replaceState({}, "", "/admin");
    } else if (p === "error") {
      toast.error("Google connection failed. Please try again.");
      window.history.replaceState({}, "", "/admin");
    }
  }, []); // eslint-disable-line

  const disconnectGoogle = async () => {
    try {
      await axios.post(`${API}/integrations/disconnect`, {}, { headers: { "X-Admin-Passcode": passcode } });
      toast.success("Google disconnected.");
      loadInteg(passcode);
    } catch (e) {
      toast.error("Could not disconnect.");
    }
  };

  const filtered = leads.filter((l) =>
    [l.name, l.phone, l.email, l.service, l.city].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-2xl bg-white border border-navy/10 shadow-md p-8" data-testid="admin-login">
          <div className="flex justify-center mb-6"><LogoWordmark /></div>
          <div className="flex items-center gap-2 text-navy font-display font-semibold">
            <LockKey size={20} weight="fill" /> Admin access
          </div>
          <p className="text-sm text-slate-500 mt-1">Enter the passcode to view captured leads.</p>
          <Input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(input)}
            placeholder="Passcode"
            className="mt-5"
            data-testid="admin-passcode-input"
          />
          <button
            onClick={() => load(input)}
            disabled={loading}
            data-testid="admin-login-btn"
            className="mt-4 w-full rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? "Checking…" : "Enter dashboard"}
          </button>
          <Link to="/" className="mt-4 flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-navy" data-testid="admin-back-home">
            <ArrowLeft size={16} /> Back to website
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white border-b border-navy/10 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center justify-between">
          <LogoWordmark />
          <Link to="/" className="text-sm text-slate-500 hover:text-navy flex items-center gap-1" data-testid="admin-view-site">
            <ArrowLeft size={16} /> View site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 lg:px-8 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-navy">Leads Dashboard</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <Users size={18} weight="fill" className="text-brand-green" />
              {leads.length} total enquir{leads.length === 1 ? "y" : "ies"} captured
            </p>
          </div>
          <a
            href={`${API}/admin/leads/export?passcode=${encodeURIComponent(passcode)}`}
            data-testid="admin-export-btn"
            className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 font-semibold text-white hover:bg-brand-greenDark transition-colors duration-200"
          >
            <DownloadSimple size={18} weight="fill" /> Export CSV
          </a>
        </div>

        {/* Google Sheets + alerts integration */}
        <div className="mt-6 rounded-xl bg-white border border-navy/10 shadow-sm p-5" data-testid="admin-integrations">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 rounded-lg bg-navy/5 flex items-center justify-center">
                <GoogleLogo size={22} weight="bold" className="text-navy" />
              </span>
              <div>
                <div className="font-display font-semibold text-navy">Google Sheets sync & email alerts</div>
                {!integ && <div className="text-sm text-slate-400">Checking status…</div>}
                {integ && !integ.configured && (
                  <div className="text-sm text-slate-500">
                    Add <code className="bg-slate-100 px-1 rounded">GOOGLE_CLIENT_ID</code> &{" "}
                    <code className="bg-slate-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> to enable.
                  </div>
                )}
                {integ && integ.configured && !integ.connected && (
                  <div className="text-sm text-slate-500">Connect your Google account to auto-sync leads & get instant email alerts.</div>
                )}
                {integ && integ.connected && (
                  <div className="text-sm text-brand-greenDark flex items-center gap-1.5">
                    <CheckCircle size={16} weight="fill" /> Connected {integ.email ? `as ${integ.email}` : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {integ && integ.connected && integ.sheet_url && (
                <a
                  href={integ.sheet_url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="integ-open-sheet"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"
                >
                  <ArrowSquareOut size={16} weight="bold" /> Open Sheet
                </a>
              )}
              {integ && integ.configured && !integ.connected && (
                <a
                  href={`${API}/oauth/sheets/login?passcode=${encodeURIComponent(passcode)}`}
                  data-testid="integ-connect-btn"
                  className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark transition-colors duration-200"
                >
                  <GoogleLogo size={18} weight="bold" /> Connect Google
                </a>
              )}
              {integ && integ.connected && (
                <button
                  onClick={disconnectGoogle}
                  data-testid="integ-disconnect-btn"
                  className="inline-flex items-center gap-2 rounded-full border border-navy/20 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors duration-200"
                >
                  <LinkSimpleBreak size={16} weight="bold" /> Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 relative max-w-md">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, service…"
            className="pl-9"
            data-testid="admin-search"
          />
        </div>

        <div className="mt-6 rounded-xl bg-white border border-navy/10 shadow-sm overflow-hidden" data-testid="admin-leads-table">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy/5">
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-10">
                    No leads found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.lead_id} data-testid={`lead-row-${l.lead_id}`}>
                    <TableCell className="font-medium text-navy">{l.name}</TableCell>
                    <TableCell>{l.phone}</TableCell>
                    <TableCell>{l.service}</TableCell>
                    <TableCell>{l.city || "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-slate-500">{l.message || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColor[l.status] || statusColor.new} border-0 font-medium`}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(l.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
