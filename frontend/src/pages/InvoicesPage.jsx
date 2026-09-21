import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { formatMoney } from '../utils/format';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    api.get('/invoices/invoices/').then(({ data }) => setInvoices(data));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!query) return true;
      return [inv.invoice_number, inv.tenant_name, inv.property_name, inv.bank_name]
        .some((v) => String(v || '').toLowerCase().includes(query));
    });
  }, [invoices, q, statusFilter]);

  const kpis = useMemo(() => {
    const total = invoices.reduce((s, i) => s + Number(i.total_rent ?? i.amount ?? 0), 0);
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total_rent ?? i.amount ?? 0), 0);
    const overdue = invoices.filter((i) => i.status === 'overdue').length;
    return { total, paid, overdue, count: invoices.length };
  }, [invoices]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Invoices</h2>
          <p className="page-subtitle">Invoices are auto-generated when a lease is created. Tenants receive them by email.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><span>Total Invoices</span><p>{kpis.count}</p></div>
        <div className="stat-card stat-revenue"><span>Total Billed</span><p>{formatMoney(kpis.total.toFixed(2))}</p></div>
        <div className="stat-card stat-capex"><span>Total Paid</span><p>{formatMoney(kpis.paid.toFixed(2))}</p></div>
        <div className="stat-card stat-warn"><span>Overdue</span><p>{kpis.overdue}</p></div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div className="card-title-block">
            <h3>All Invoices</h3>
            <span className="card-subtitle">{filtered.length} of {invoices.length} shown</span>
          </div>
          <div className="actions">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', borderRadius: 10, border: '1px solid var(--border)' }}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <input
              placeholder="Search invoices…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 240, padding: '0.55rem 0.85rem', borderRadius: 10, border: '1px solid var(--border)' }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Tenant</th>
                <th>Property</th>
                <th className="text-right">Total Rent</th>
                <th>Bank</th>
                <th>Account</th>
                <th>Issue</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No invoices found.</td></tr>
              ) : filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="text-mono">{inv.invoice_number}</td>
                  <td>{inv.tenant_name}</td>
                  <td>{inv.property_name}</td>
                  <td className="text-right"><strong>{formatMoney(inv.total_rent ?? inv.amount)}</strong></td>
                  <td>{inv.bank_name || '—'}</td>
                  <td className="text-mono">{inv.bank_account_number || '—'}</td>
                  <td className="text-mono">{inv.issue_date}</td>
                  <td className="text-mono">{inv.due_date}</td>
                  <td><span className={`badge ${inv.status}`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
