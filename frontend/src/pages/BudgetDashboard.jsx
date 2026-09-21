import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatMoney } from '../utils/format';

export default function BudgetDashboard() {
  const [data, setData] = useState(null);
  const [reportStats, setReportStats] = useState(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    api.get('/budgets/dashboard/', { params: { year } })
      .then(({ data: d }) => setData(d))
      .catch(() => setData({}));

    // Finance officer also oversees financial reports (asset + lease +
    // revenue + budget). Depreciation policy/schedule management is
    // owned by the Asset Manager; the finance officer only sees
    // depreciation *figures* through the Asset Report.
    api.get('/reports/reports/stats/')
      .then(({ data: d }) => setReportStats(d))
      .catch(() => setReportStats({}));
  }, [year]);

  if (!data) return <p className="muted">Loading finance dashboard…</p>;

  const withinRevenue = data.budget_within_revenue;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Finance Officer Dashboard</h2>
          <p className="muted">Year {data.year || year} — revenue-driven budget planning, depreciation & reports</p>
        </div>
        <div className="actions">
          <Link to="/budgets/plans" className="btn">Budget Plans</Link>
          <Link to="/budgets/lines" className="btn secondary">Budget Lines</Link>
        </div>
      </div>

      {withinRevenue === false && (
        <div className="alert alert-warn">
          Total budget planned exceeds recorded revenue. Adjust budget plans to fit available revenue.
        </div>
      )}

      {/* Revenue & budget row */}
      <div className="stat-grid">
        <div className="stat-card stat-revenue">
          <span>Total Revenue</span>
          <p>{formatMoney(data.total_revenue ?? 0)}</p>
          <Link to="/finance/payments" className="stat-link">View payments →</Link>
        </div>
        <div className="stat-card">
          <span>Budget Planned</span>
          <p>{formatMoney(data.total_budget_planned ?? 0)}</p>
        </div>
        <div className="stat-card stat-opex">
          <span>OPEX Allocated / Spent</span>
          <p>
            {formatMoney(data.opex?.allocated ?? 0)} /{' '}
            {formatMoney(data.opex?.spent ?? 0)}
          </p>
        </div>
        <div className="stat-card stat-capex">
          <span>CAPEX Allocated / Spent</span>
          <p>
            {formatMoney(data.capex?.allocated ?? 0)} /{' '}
            {formatMoney(data.capex?.spent ?? 0)}
          </p>
        </div>
      </div>

      {/* Financial reports row */}
      <div className="stat-grid">
        <div className="stat-card">
          <span>Financial Reports</span>
          <p>{reportStats?.total_reports ?? 0}</p>
          <Link to="/asset-reports" className="stat-link">Open reports →</Link>
        </div>
        <div className="stat-card">
          <span>Reports Generated</span>
          <p>{reportStats?.generated_reports ?? 0}</p>
        </div>
      </div>

      {/* Finance officer quick actions */}
      <div className="card">
        <h3>Finance Officer Tasks</h3>
        <div className="actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link to="/finance/payments" className="btn">Track Revenue & Payments</Link>
          <Link to="/budgets/plans" className="btn">Plan Budget</Link>
          <Link to="/budgets/lines" className="btn">Manage Budget Lines</Link>
          <Link to="/expenses" className="btn">Record Expenses</Link>
          <Link to="/asset-reports/new" className="btn secondary">Generate Financial Report</Link>
          <Link to="/reports" className="btn secondary">Lease / Revenue / Budget / Asset Reports</Link>
        </div>
      </div>

      {data.budgets?.map((b) => (
        <div className="card" key={b.id}>
          <div className="card-header-row">
            <h3>Budget {b.year}</h3>
            <span className="badge">Cap: {formatMoney(b.total_budget)}</span>
          </div>
          <div className="mini-stats">
            <span>Allocated: {formatMoney(b.total_allocated)}</span>
            <span>Spent: {formatMoney(b.total_spent)}</span>
            <span>Remaining: <strong>{formatMoney(b.remaining_budget)}</strong></span>
            <span className="badge opex">OPEX: {formatMoney(b.opex_allocated)}</span>
            <span className="badge capex">CAPEX: {formatMoney(b.capex_allocated)}</span>
          </div>
        </div>
      ))}

      <div className="card">
        <h3>Recent Lease Payments (Revenue)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th className="text-right">Amount</th><th>Method</th><th>Invoice</th></tr>
            </thead>
            <tbody>
              {(!data.recent_payments || data.recent_payments.length === 0) ? (
                <tr><td colSpan={4} className="muted">No payments recorded yet.</td></tr>
              ) : data.recent_payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.payment_date}</td>
                  <td className="text-right">{formatMoney(p.amount_paid)}</td>
                  <td>{p.payment_method}</td>
                  <td>{p.invoice_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
