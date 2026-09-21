import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function TenantDashboard() {
  const [profile, setProfile] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/tenants/profile/me/'),
      api.get('/leases/my-contracts/'),
      api.get('/invoices/my-invoices/'),
      api.get('/notifications/'),
    ]).then(([prof, leases, inv, notifs]) => {
      setProfile(prof.data);
      setContracts(leases.data);
      setInvoices(inv.data);
      setNotifications(notifs.data.filter((n) => !n.is_read));
    }).catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Welcome, {profile?.full_name || 'Tenant'}</h2>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><span>Active Contracts</span><p>{contracts.filter((c) => c.status === 'active').length}</p></div>
        <div className="stat-card"><span>Invoices</span><p>{invoices.length}</p></div>
        <div className="stat-card stat-warn"><span>Unread Notifications</span><p>{notifications.length}</p></div>
      </div>
      <div className="card">
        <h3>Quick Actions</h3>
        <div className="actions">
          <Link to="/tenant/contracts" className="btn">View Contracts</Link>
          <Link to="/tenant/invoices" className="btn secondary">View Invoices</Link>
          <Link to="/tenant/notifications" className="btn btn-notify">
            Notifications {notifications.length > 0 && `(${notifications.length})`}
          </Link>
        </div>
      </div>
      {/* Notifications are accessed via the Notifications button above */}
    </>
  );
}
