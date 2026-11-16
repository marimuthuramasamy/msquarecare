import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireAuth } from "@/crm/AuthContext";
import CrmLayout from "@/crm/CrmLayout";
import Login from "@/crm/pages/Login";
import Dashboard from "@/crm/pages/Dashboard";
import Leads from "@/crm/pages/Leads";
import Customers from "@/crm/pages/Customers";
import CustomerDetail from "@/crm/pages/CustomerDetail";
import Policies from "@/crm/pages/Policies";
import Renewals from "@/crm/pages/Renewals";
import Claims from "@/crm/pages/Claims";
import Tasks from "@/crm/pages/Tasks";
import Diary from "@/crm/pages/Diary";
import Settings from "@/crm/pages/Settings";

export default function CrmApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<RequireAuth><CrmLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="policies" element={<Policies />} />
          <Route path="renewals" element={<Renewals />} />
          <Route path="claims" element={<Claims />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="diary" element={<Diary />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/crm" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
