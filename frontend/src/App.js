import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LandingPage from "@/pages/LandingPage";
import PortalPage from "@/pages/PortalPage";
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
import Settings from "@/crm/pages/Settings";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/my-policy" element={<PortalPage />} />
          <Route path="/admin" element={<Navigate to="/crm" replace />} />
          <Route path="/crm/*" element={<AuthProvider><CrmRoutes /></AuthProvider>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

function CrmRoutes() {
  return (
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
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
