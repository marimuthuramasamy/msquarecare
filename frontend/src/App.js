import { lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LandingPage from "@/pages/LandingPage";

// Portal and CRM are code-split so the public landing page stays light.
const PortalPage = lazy(() => import("@/pages/PortalPage"));
const CrmApp = lazy(() => import("@/crm/CrmApp"));

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/my-policy" element={<PortalPage />} />
            <Route path="/admin" element={<Navigate to="/crm" replace />} />
            <Route path="/crm/*" element={<CrmApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
