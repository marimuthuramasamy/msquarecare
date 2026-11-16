import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKey, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { LogoWordmark } from "@/components/Logo";
import { useAuth } from "../AuthContext";
import { errMsg } from "../api";
import { Btn, Field, Input } from "../ui";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  if (user) return <Navigate to={loc.state?.from || "/crm"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      nav(loc.state?.from || "/crm", { replace: true });
    } catch (err) {
      toast.error(errMsg(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-md p-8" data-testid="crm-login">
        <div className="flex justify-center mb-6"><LogoWordmark /></div>
        <div className="flex items-center gap-2 text-navy font-display font-semibold text-lg">
          <LockKey size={20} weight="fill" /> Staff sign in
        </div>
        <p className="text-sm text-slate-500 mt-1 mb-5">Insurance CRM for the MSquare Care team.</p>
        <div className="space-y-3">
          <Field label="Email">
            <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} data-testid="crm-login-email" />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="crm-login-password" />
          </Field>
        </div>
        <Btn type="submit" disabled={busy} className="mt-5 w-full py-2.5" data-testid="crm-login-btn">
          {busy ? "Signing in…" : "Sign in"}
        </Btn>
        <Link to="/" className="mt-4 flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-navy">
          <ArrowLeft size={16} /> Back to website
        </Link>
      </form>
    </div>
  );
}
