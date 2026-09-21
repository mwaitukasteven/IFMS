import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatMoney } from '../utils/format';

const DAYS_SOON = 30;

function daysBetween(a, b) {
  const one = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / one);
}

export default function LeaseDashboard() {
  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/tenants/tenants/').catch(() => ({ data: [] })),
      api.get('/leases/leases/').catch(() => ({ data: [] })),
      api.get('/invoices/invoices/').catch(() => ({ data: [] })),
      api.get('/properties/properties/?available_for_lease=true').catch(() => ({ data: [] })),
      api.get('/payments/payment-confirmations/').catch(() => ({ data: [] })),
    ]).then(([t, l, i, p, pc]) => {
      if (cancelled) return;
      setTenants(t.data || []);
      setLeases(l.data || []);
      setInvoices(i.data || []);
      setProperties(p.data || []);
      setPendingConfirmations((pc.data || []).filter((c) => c.status === 'pending'));
    }).catch(() => setErrored(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const kpis = useMemo(() => {
    const active = leases.filter((l) => l.status === 'active');
    const monthly = active.reduce((s, l) => s + Number(l.monthly_rent || 0), 0);
    const pendingInv = invoices.filter((i) => i.status === 'pending').length;
    const overdueInv = invoices.filter((i) => i.status === 'overdue').length;
    return {
      tenants: tenants.length,
      leases: leases.length,
      activeLeases: active.length,
      properties: properties.length,
      invoices: invoices.length,
      pendingInv,
      overdueInv,
      monthlyRent: monthly,
    };
  }, [tenants, leases, invoices, properties]);

  const expiringSoon = useMemo(() => {
    const today = new Date();
    return leases
      .filter((l) => l.status === 'active' && l.end_date)
      .map((l) => ({ ...l, daysLeft: daysBetween(today, new Date(l.end_date)) }))
      .filter((l) => l.daysLeft >= 0 && l.daysLeft <= DAYS_SOON)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [leases]);

  const recentLeases = useMemo(() => {
    return [...leases]
      .sort((a, b) => String(b.created_at || b.start_date).localeCompare(String(a.created_at || a.start_date)))
      .slice(0, 6);
  }, [leases]);

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h2>Lease Officer Dashboard</h2>
          <p className="page-subtitle">Loading overview…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Lease Officer Dashboard</h2>
          <p className="page-subtitle">Tenants, leases, invoices and payment confirmations at a glance.</p>
        </div>
      </div>

      {errored && (
        <div className="alert alert-warn">Some data failed to load. Some numbers may be incomplete.</div>
      )}

      {pendingConfirmations.length > 0 && (
        <div className="alert alert-info dashboard-alert">
          <div>
            <strong>{pendingConfirmations.length} payment confirmation{pendingConfirmations.length === 1 ? '' : 's'} awaiting your review.</strong>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>Tenants have submitted payments that still need to be verified.</p>
          </div>
          <Link to="/payment-confirmations" className="btn btn-sm">Review now →</Link>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="alert alert-warn dashboard-alert">
          <div>
            <strong>{expiringSoon.length} lease{expiringSoon.length === 1 ? '' : 's'} expiring within {DAYS_SOON} days.</strong>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>Contact these tenants to arrange renewal or move-out.</p>
          </div>
          <Link to="/leases" className="btn btn-sm secondary">Open Leases →</Link>
        </div>
      )}

      {/* Primary KPI row */}
      <div className="stat-grid">
        <div className="stat-card stat-revenue">
          <span>Active Leases</span>
          <p>{kpis.activeLeases}</p>
          <Link to="/leases" className="stat-link">Manage leases →</Link>
        </div>
        <div className="stat-card stat-capex">
          <span>Monthly Rent (Active)</span>
          <p>{formatMoney(kpis.monthlyRent.toFixed(2))}</p>
          <span className="stat-sub muted">Rent billed per month across active leases</span>
        </div>
        <div className="stat-card">
          <span>Registered Tenants</span>
          <p>{kpis.tenants}</p>
          <Link to="/tenants" className="stat-link">Manage tenants →</Link>
        </div>
        <div className="stat-card">
          <span>Leasable Assets</span>
          <p>{kpis.properties}</p>
          <Link to="/properties" className="stat-link">Open registry →</Link>
        </div>
      </div>

      {/* Secondary KPIs — invoices */}
      <div className="stat-grid">
        <div className="stat-card">
          <span>Invoices Generated</span>
          <p>{kpis.invoices}</p>
          <Link to="/invoices" className="stat-link">Open invoices →</Link>
        </div>
        <div className="stat-card stat-opex">
          <span>Pending Invoices</span>
          <p>{kpis.pendingInv}</p>
        </div>
        <div className="stat-card stat-warn">
          <span>Overdue Invoices</span>
          <p>{kpis.overdueInv}</p>
        </div>
        <div className="stat-card">
          <span>Total Leases</span>
          <p>{kpis.leases}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-header-row">
          <div className="card-title-block">
            <h3>Quick Actions</h3>
            <span className="card-subtitle">Common tasks for lease management.</span>
          </div>
        </div>
        <div className="actions" style={{ gap: '0.6rem' }}>
          <Link to="/leases" className="btn">Create Lease</Link>
          <Link to="/tenants" className="btn secondary">Register Tenant</Link>
          <Link to="/invoices" className="btn secondary">View Invoices</Link>
          <Link to="/payment-confirmations" className="btn secondary">
            Review Payments{pendingConfirmations.length > 0 ? ` (${pendingConfirmations.length})` : ''}
          </Link>
          <Link to="/properties" className="btn secondary">Asset Registry</Link>
        </div>
      </div>

      {/* Two-column info row: recent leases + expiring leases */}
      <div className="dashboard-two-col">
        <div className="card">
          <div className="card-header-row">
            <div className="card-title-block">
              <h3>Recent Leases</h3>
              <span className="card-subtitle">Latest lease agreements you have issued.</span>
            </div>
            <Link to="/leases" className="btn btn-sm secondary">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lease #</th>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th className="text-right">Monthly Rent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLeases.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No leases yet. Create your first lease.</td></tr>
                ) : recentLeases.map((l) => (
                  <tr key={l.id}>
                    <td className="text-mono">{l.lease_number || `LSA-${l.id}`}</td>
                    <td>{l.tenant_name}</td>
                    <td>{l.property_name}</td>
                    <td className="text-right">{formatMoney(l.monthly_rent)}</td>
                    <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-row">
            <div className="card-title-block">
              <h3>Expiring Soon</h3>
              <span className="card-subtitle">Active leases ending in the next {DAYS_SOON} days.</span>
            </div>
          </div>
          {expiringSoon.length === 0 ? (
            <p className="muted">No leases expiring in the next {DAYS_SOON} days.</p>
          ) : (
            <ul className="expiry-list">
              {expiringSoon.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <div>
                    <div className="expiry-primary">{l.tenant_name} — {l.lease_number || `LSA-${l.id}`}</div>
                    <div className="expiry-secondary">{l.property_name} · ends {l.end_date}</div>
                  </div>
                  <span className={`badge ${l.daysLeft <= 7 ? 'overdue' : 'pending'}`}>
                    {l.daysLeft === 0 ? 'today' : `${l.daysLeft}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
