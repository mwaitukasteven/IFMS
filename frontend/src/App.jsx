import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, roleHome } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Public / auth pages (from ASSET)
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';

// Admin
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';

// Lease officer
import LeaseDashboard from './pages/LeaseDashboard';
import TenantsPage from './pages/TenantsPage';
import LeasesPage from './pages/LeasesPage';
import PropertiesPage from './pages/PropertiesPage';
import InvoicesPage from './pages/InvoicesPage';
import PaymentConfirmationsPage from './pages/PaymentConfirmationsPage';

// Finance officer
import BudgetDashboard from './pages/BudgetDashboard';
import BudgetPlansPage from './pages/BudgetPlansPage';
import BudgetLinesPage from './pages/BudgetLinesPage';
import ExpensesPage from './pages/ExpensesPage';
import FinancePaymentsPage from './pages/FinancePaymentsPage';
import FinancialReportsPage from './pages/FinancialReportsPage';

// Tenant
import TenantDashboard from './pages/TenantDashboard';
import TenantContractsPage from './pages/TenantContractsPage';
import TenantInvoicesPage from './pages/TenantInvoicesPage';
import TenantNotificationsPage from './pages/TenantNotificationsPage';

// Asset-module (Patrick's original pages, moved under pages/asset-module)
import AssetManagerDashboard from './pages/asset-module/Dashboard';
import AssetsList from './pages/asset-module/AssetsList';
import AssetDetail from './pages/asset-module/AssetDetail';
import AssetForm from './pages/asset-module/AssetForm';
import DepreciationList from './pages/asset-module/DepreciationList';
import DepreciationDetail from './pages/asset-module/DepreciationDetail';
import DepreciationForm from './pages/asset-module/DepreciationForm';
import PatrickReportsList from './pages/asset-module/ReportsList';
import PatrickReportDetail from './pages/asset-module/ReportDetail';
import PatrickReportForm from './pages/asset-module/ReportForm';
import IntegrationClients from './pages/asset-module/IntegrationClients';
import IntegrationLogs from './pages/asset-module/IntegrationLogs';

function DashboardRedirect() {
  const { role } = useAuth();
  return <Navigate to={roleHome(role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/change-password"
        element={<ProtectedRoute skipPasswordCheck><ChangePassword /></ProtectedRoute>}
      />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardRedirect />} />

        {/* Admin */}
        <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />

        {/* Asset Manager */}
        <Route path="assets" element={<ProtectedRoute roles={['admin', 'asset_manager']}><AssetsList /></ProtectedRoute>} />
        <Route path="assets/new" element={<ProtectedRoute roles={['admin', 'asset_manager']}><AssetForm /></ProtectedRoute>} />
        <Route path="assets/:id" element={<ProtectedRoute roles={['admin', 'asset_manager', 'lease_officer', 'finance_officer']}><AssetDetail /></ProtectedRoute>} />
        <Route path="assets/:id/edit" element={<ProtectedRoute roles={['admin', 'asset_manager']}><AssetForm /></ProtectedRoute>} />

        {/* Depreciation is owned by the asset manager. Finance officer
            SEES depreciation figures only through reports, not by
            editing policies/schedules directly. */}
        <Route path="depreciation" element={<ProtectedRoute roles={['admin', 'asset_manager']}><DepreciationList /></ProtectedRoute>} />
        <Route path="depreciation/new" element={<ProtectedRoute roles={['admin', 'asset_manager']}><DepreciationForm /></ProtectedRoute>} />
        <Route path="depreciation/:id" element={<ProtectedRoute roles={['admin', 'asset_manager']}><DepreciationDetail /></ProtectedRoute>} />
        <Route path="depreciation/:id/edit" element={<ProtectedRoute roles={['admin', 'asset_manager']}><DepreciationForm /></ProtectedRoute>} />

        {/* Asset manager landing dashboard */}
        <Route path="asset-manager" element={<ProtectedRoute roles={['admin', 'asset_manager']}><AssetManagerDashboard /></ProtectedRoute>} />

        {/* Lease Officer */}
        <Route path="lease" element={<ProtectedRoute roles={['lease_officer']}><LeaseDashboard /></ProtectedRoute>} />
        <Route path="tenants" element={<ProtectedRoute roles={['admin', 'lease_officer']}><TenantsPage /></ProtectedRoute>} />
        <Route path="leases" element={<ProtectedRoute roles={['admin', 'lease_officer']}><LeasesPage /></ProtectedRoute>} />
        <Route path="properties" element={<ProtectedRoute roles={['admin', 'lease_officer']}><PropertiesPage /></ProtectedRoute>} />
        <Route path="invoices" element={<ProtectedRoute roles={['admin', 'lease_officer']}><InvoicesPage /></ProtectedRoute>} />
        <Route path="payment-confirmations" element={<ProtectedRoute roles={['admin', 'lease_officer']}><PaymentConfirmationsPage /></ProtectedRoute>} />

        {/* Finance Officer */}
        <Route path="budgets" element={<ProtectedRoute roles={['admin', 'finance_officer']}><BudgetDashboard /></ProtectedRoute>} />
        <Route path="budgets/plans" element={<ProtectedRoute roles={['admin', 'finance_officer']}><BudgetPlansPage /></ProtectedRoute>} />
        <Route path="budgets/lines" element={<ProtectedRoute roles={['admin', 'finance_officer']}><BudgetLinesPage /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute roles={['admin', 'finance_officer']}><ExpensesPage /></ProtectedRoute>} />
        <Route path="finance/payments" element={<ProtectedRoute roles={['admin', 'finance_officer']}><FinancePaymentsPage /></ProtectedRoute>} />

        {/* Reports — cross-module (lease/revenue/budget/asset) */}
        <Route path="reports" element={<ProtectedRoute roles={['admin', 'lease_officer', 'finance_officer']}><FinancialReportsPage /></ProtectedRoute>} />

        {/* Reports are owned by finance officer + admin. Asset
            manager registers assets/policies but does NOT generate
            reports. */}
        <Route path="asset-reports" element={<ProtectedRoute roles={['admin', 'finance_officer']}><PatrickReportsList /></ProtectedRoute>} />
        <Route path="asset-reports/new" element={<ProtectedRoute roles={['admin', 'finance_officer']}><PatrickReportForm /></ProtectedRoute>} />
        <Route path="asset-reports/:id" element={<ProtectedRoute roles={['admin', 'finance_officer']}><PatrickReportDetail /></ProtectedRoute>} />

        {/* Integration (external API keys) — admin only */}
        <Route path="integration" element={<ProtectedRoute roles={['admin']}><IntegrationClients /></ProtectedRoute>} />
        <Route path="integration/logs" element={<ProtectedRoute roles={['admin']}><IntegrationLogs /></ProtectedRoute>} />

        {/* Tenant */}
        <Route path="tenant" element={<ProtectedRoute roles={['tenant']}><TenantDashboard /></ProtectedRoute>} />
        <Route path="tenant/contracts" element={<ProtectedRoute roles={['tenant']}><TenantContractsPage /></ProtectedRoute>} />
        <Route path="tenant/invoices" element={<ProtectedRoute roles={['tenant']}><TenantInvoicesPage /></ProtectedRoute>} />
        <Route path="tenant/notifications" element={<ProtectedRoute roles={['tenant']}><TenantNotificationsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
