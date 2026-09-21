import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const ROLES = ['admin', 'asset_manager', 'lease_officer', 'finance_officer', 'tenant'];

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, byRole: {} });

  useEffect(() => {
    api.get('/users/').then(({ data }) => {
      const list = Array.isArray(data) ? data : (data?.results ?? []);
      const byRole = {};
      ROLES.forEach((r) => { byRole[r] = 0; });
      list.forEach((u) => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
      setStats({ total: data?.count ?? list.length, byRole });
    }).catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="muted">Manage system users, roles, and access</p>
        </div>
        <Link to="/admin/users" className="btn">Manage Users</Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Total Users</span>
          <p>{stats.total}</p>
        </div>
        <div className="stat-card">
          <span>Asset Managers</span>
          <p>{stats.byRole.asset_manager || 0}</p>
        </div>
        <div className="stat-card stat-opex">
          <span>Lease Managers</span>
          <p>{stats.byRole.lease_officer || 0}</p>
        </div>
        <div className="stat-card stat-capex">
          <span>Finance Managers</span>
          <p>{stats.byRole.finance_officer || 0}</p>
        </div>
        <div className="stat-card stat-revenue">
          <span>Tenants</span>
          <p>{stats.byRole.tenant || 0}</p>
        </div>
      </div>

      <div className="card">
        <h3>Quick Actions</h3>
        <div className="actions">
          <Link to="/admin/users" className="btn">Add Asset / Lease / Finance Manager</Link>
          <Link to="/admin/users" className="btn secondary">View & Edit Profiles</Link>
        </div>
      </div>

      {/* <div className="card">
        <h3>Admin Responsibilities</h3>
        <ul className="feature-list">
          <li>Create users for Lease Manager and Finance Manager roles</li>
          <li>View and edit user profiles</li>
          <li>Reset passwords when staff forget credentials</li>
          <li>Search and filter users by role</li>
        </ul>
      </div> */}
    </>
  );
}
