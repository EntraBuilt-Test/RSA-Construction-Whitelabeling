import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import DeliveryNoteList from './components/DeliveryNote/DeliveryNoteList.jsx';
import DeliveryNoteForm from './components/DeliveryNote/DeliveryNoteForm.jsx';
import DeliveryNotePrint from './components/DeliveryNote/DeliveryNotePrint.jsx';
import MaterialLedger from './components/MaterialLedger/MaterialLedger.jsx';
import LabourPage from './components/Labour/LabourPage.jsx';
import VoucherPage from './components/Voucher/VoucherPage.jsx';
import VoucherPrint from './components/Voucher/VoucherPrint.jsx';
import StockView from './components/MaterialLedger/StockView.jsx';
import Reports from './components/Reports/Reports.jsx';
import SuperadminPanel from './components/Superadmin/SuperadminPanel.jsx';
import CustomModulePage from './components/CustomModule/CustomModulePage.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Superadmin is a hidden layer on top of PrivateRoute - reached only via the
// 5-click logo gesture in the sidebar, and only functional for the one flag
// (isSuperAdmin) set directly in the database. Anyone else hitting this URL
// directly gets bounced back to the dashboard with no error message, so the
// feature's existence isn't advertised.
function SuperadminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Print views render standalone (no nav chrome) so window.print()/Save-as-PDF is clean */}
      <Route
        path="/billing/:id/print"
        element={
          <PrivateRoute>
            <DeliveryNotePrint />
          </PrivateRoute>
        }
      />

      <Route
        path="/voucher/:id/print"
        element={
          <PrivateRoute>
            <VoucherPrint />
          </PrivateRoute>
        }
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="billing" element={<DeliveryNoteList />} />
        <Route path="billing/new" element={<DeliveryNoteForm />} />
        <Route path="billing/:id/edit" element={<DeliveryNoteForm />} />
        <Route path="materials" element={<MaterialLedger />} />
        <Route path="voucher" element={<VoucherPage />} />
        <Route path="labour" element={<LabourPage />} />
        <Route path="stock" element={<StockView />} />
        <Route path="reports" element={<Reports />} />
        {/* Any tab created in the Superadmin Portal's Module Builder that isn't
            one of the built-in screens above renders here, driven entirely by
            that module's field definitions - no code change needed per tab. */}
        <Route path="m/:moduleKey" element={<CustomModulePage />} />
        <Route
          path="superadmin"
          element={
            <SuperadminRoute>
              <SuperadminPanel />
            </SuperadminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
