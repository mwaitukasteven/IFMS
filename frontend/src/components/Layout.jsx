import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { role, username, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const adminLinks = [
    { to: '/admin', label: 'Admin Dashboard' },
    { to: '/admin/users', label: 'Manage Users' },
    // { to: '/assets', label: 'Assets' },
    // { to: '/depreciation', label: 'Depreciation' },
    // { to: '/asset-reports', label: 'Asset Reports' },
    // { to: '/integration', label: 'Integration Keys' },
  ];

  const assetManagerLinks = [
    { to: '/asset-manager', label: 'Asset Dashboard' },
    { to: '/assets', label: 'Assets' },
    { to: '/depreciation', label: 'Depreciation Policies' },
  ];

  const leaseLinks = [
    { to: '/lease', label: 'Lease Dashboard' },
    { to: '/tenants', label: 'Tenants' },
    { to: '/leases', label: 'Leases' },
    { to: '/properties', label: 'Assets' },
    { to: '/invoices', label: 'Invoices' },
    { to: '/payment-confirmations', label: 'Payment Confirmations' },
  ];

  const budgetLinks = [
    { to: '/budgets', label: 'Finance Dashboard' },
    { to: '/finance/payments', label: 'Revenue & Payments' },
    { to: '/budgets/plans', label: 'Budget Plans' },
    { to: '/budgets/lines', label: 'Budget Lines' },
    { to: '/expenses', label: 'Record Expenses' },
    { to: '/reports', label: 'Financial Reports' },
  ];

  const tenantLinks = [
    { to: '/tenant', label: 'My Dashboard' },
    { to: '/tenant/contracts', label: 'My Contracts' },
    { to: '/tenant/invoices', label: 'My Invoices' },
    { to: '/tenant/notifications', label: 'Notifications' },
  ];

  let links = leaseLinks;
  if (role === 'admin') links = adminLinks;
  else if (role === 'asset_manager') links = assetManagerLinks;
  else if (role === 'finance_officer') links = budgetLinks;
  else if (role === 'tenant') links = tenantLinks;

  return (
    <div className="app-shell">
      <button type="button" className="menu-toggle" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>☰</button>
      {menuOpen && <button type="button" className="sidebar-overlay" aria-label="Close" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-dot">◈</span>
          <div>
            <h1>FMS</h1>
            <small>Financial Management</small>
          </div>
        </div>
        <p className="sidebar-user">{username} · {role?.replace(/_/g, ' ')}</p>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn secondary logout-btn" type="button" onClick={logout}>Logout</button>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
