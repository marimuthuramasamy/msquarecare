import React, { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  SquaresFour, Funnel, AddressBook, ShieldCheck, ArrowsClockwise, FirstAid, CheckSquare, Gear, SignOut, List, X, Globe,
} from "@phosphor-icons/react";
import { useAuth } from "./AuthContext";

const NAV = [
  { to: "/crm", label: "Dashboard", icon: SquaresFour, end: true },
  { to: "/crm/leads", label: "Leads", icon: Funnel },
  { to: "/crm/customers", label: "Customers", icon: AddressBook },
  { to: "/crm/policies", label: "Policies", icon: ShieldCheck },
  { to: "/crm/renewals", label: "Renewals", icon: ArrowsClockwise },
  { to: "/crm/claims", label: "Claims", icon: FirstAid },
  { to: "/crm/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/crm/settings", label: "Settings", icon: Gear },
];

function SideNav({ onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <Link to="/crm" className="flex items-center gap-2.5 px-5 h-16 shrink-0" onClick={onNavigate}>
        <img src={`${process.env.PUBLIC_URL || ""}/logo_icon.png`} alt="" className="h-8 w-auto rounded bg-white p-0.5" />
        <div className="leading-tight">
          <div className="font-display font-bold text-[17px]">MSquare<span className="text-brand-green">Care</span></div>
          <div className="text-[10px] tracking-[0.25em] text-white/60">INSURANCE CRM</div>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            data-testid={`crm-nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon size={19} weight="duotone" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-1">
        <a href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <Globe size={19} weight="duotone" /> View website
        </a>
        <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user?.name}</div>
            <div className="truncate text-[11px] text-white/60"><span className="capitalize">{user?.role}</span> · {user?.email}</div>
          </div>
          <button onClick={logout} title="Sign out" className="text-white/70 hover:text-white" data-testid="crm-logout">
            <SignOut size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CrmLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-30">
        <SideNav />
      </aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <SideNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="lg:hidden sticky top-0 z-20 flex h-14 items-center justify-between bg-white border-b border-slate-200 px-4">
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className="text-navy" data-testid="crm-menu-toggle">
            {open ? <X size={24} /> : <List size={24} />}
          </button>
          <div className="font-display font-bold text-navy">MSquare<span className="text-brand-green">Care</span> CRM</div>
          <span className="w-6" />
        </header>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
