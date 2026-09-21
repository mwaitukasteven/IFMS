import { useEffect, useState } from 'react';
import api from '../api/client';

const TABS = [
  { id: 'overall', label: 'Overall Report', endpoint: '/reports/overall-report/' },
  { id: 'lease', label: 'Lease Report', endpoint: '/reports/lease-report/' },
  { id: 'revenue', label: 'Revenue Report', endpoint: '/reports/revenue-report/' },
  { id: 'budget', label: 'Budget Report', endpoint: '/reports/budget-report/' },
  { id: 'asset', label: 'Asset Report', endpoint: '/reports/asset-report/' },
];

function money(v) {
  if (v === null || v === undefined || v === '') return '0';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function downloadReport(endpoint, year, format, filename) {
  const token = localStorage.getItem('access_token');
  const url = `/api${endpoint}?export=${format}${year ? `&year=${year}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = `Download failed (HTTP ${res.status}).`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch {
      // response wasn't JSON; keep the generic message
    }
    alert(msg);
    return;
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default function FinancialReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState('overall');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const active = TABS.find((t) => t.id === tab);
    if (!active) return;
    setLoading(true);
    setError('');
    api.get(active.endpoint, { params: tab === 'asset' ? {} : { year } })
      .then(({ data }) => setReport({ type: tab, data }))
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load report.');
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [year, tab]);

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <>
      <div className="page-header">
        <h2>Financial Reports Hub</h2>
        <div className="actions" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          {tab !== 'asset' && (
            <label className="year-picker">
              Year
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => downloadReport(
              activeTab.endpoint,
              tab === 'asset' ? '' : year,
              'pdf',
              `${activeTab.id}_report_${tab === 'asset' ? 'all' : year}.pdf`
            )}
          >
            Download PDF
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => downloadReport(
              activeTab.endpoint,
              tab === 'asset' ? '' : year,
              'csv',
              `${activeTab.id}_report_${tab === 'asset' ? 'all' : year}.csv`
            )}
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading report…</p>}
      {error && <p className="error">{error}</p>}

      {tab === 'overall' && report?.data?.summary && (
        <div className="stat-grid">
          <div className="stat-card stat-revenue">
            <span>Total Revenue</span>
            <p>{money(report.data.summary.total_revenue)}</p>
          </div>
          <div className="stat-card">
            <span>Total Assets</span>
            <p>{report.data.summary.total_assets ?? 0}</p>
          </div>
          <div className="stat-card">
            <span>Building Assets</span>
            <p>{report.data.summary.building_assets ?? 0}</p>
          </div>
          <div className="stat-card">
            <span>Active Leases</span>
            <p>{report.data.summary.active_leases ?? 0}</p>
          </div>
          <div className="stat-card stat-opex">
            <span>OPEX Spent</span>
            <p>{money(report.data.summary.opex_spent)}</p>
          </div>
          <div className="stat-card stat-capex">
            <span>CAPEX Spent</span>
            <p>{money(report.data.summary.capex_spent)}</p>
          </div>
          <div className="stat-card">
            <span>Total Budget</span>
            <p>{money(report.data.summary.total_budget)}</p>
          </div>
          <div className="stat-card">
            <span>Total Allocated</span>
            <p>{money(report.data.summary.total_allocated)}</p>
          </div>
        </div>
      )}

      {tab === 'lease' && report?.data && (
        <div className="card">
          <h3>Lease Report — Year {report.data.year || year}</h3>
          <div className="mini-stats">
            <span>Total leases: {report.data.total_leases}</span>
            <span>Active: {report.data.active_leases}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contract</th><th>Tenant</th><th>Property</th><th>Unit</th>
                  <th>Period</th>
                  <th className="text-right">Monthly Rent</th>
                  <th className="text-right">Total Rent (Period)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(report.data.leases || []).map((l) => (
                  <tr key={l.id}>
                    <td>{l.lease_number}</td>
                    <td>{l.tenant_name}</td>
                    <td>{l.property_name} ({l.property_code})</td>
                    <td>{l.unit}</td>
                    <td>{l.start_date} → {l.end_date}</td>
                    <td className="text-right">{money(l.monthly_rent)}</td>
                    <td className="text-right"><strong>{money(l.total_rent)}</strong></td>
                    <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'revenue' && report?.data && (
        <>
          <div className="stat-grid">
            <div className="stat-card stat-revenue">
              <span>Total Revenue ({year})</span>
              <p>{money(report.data.total_revenue)}</p>
            </div>
            <div className="stat-card">
              <span>Payment Count</span>
              <p>{report.data.payment_count ?? 0}</p>
            </div>
          </div>
          <div className="card">
            <h3>Payments</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Invoice</th></tr>
                </thead>
                <tbody>
                  {(report.data.payments || []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.payment_date}</td>
                      <td>{money(p.amount_paid)}</td>
                      <td>{p.payment_method}</td>
                      <td>{p.reference_number}</td>
                      <td>{p.invoice_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'budget' && report?.data && (
        <>
          <div className="stat-grid">
            <div className="stat-card stat-revenue">
              <span>Total Revenue</span>
              <p>{money(report.data.total_revenue)}</p>
            </div>
            <div className="stat-card">
              <span>Total Allocated</span>
              <p>{money(report.data.total_allocated)}</p>
            </div>
            <div className="stat-card">
              <span>Total Spent</span>
              <p>{money(report.data.total_spent)}</p>
            </div>
            <div className="stat-card stat-opex">
              <span>OPEX Spent</span>
              <p>{money(report.data.opex_spent)}</p>
            </div>
            <div className="stat-card stat-capex">
              <span>CAPEX Spent</span>
              <p>{money(report.data.capex_spent)}</p>
            </div>
          </div>
          <div className="card">
            <h3>Budgets</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th><th>Total</th><th>Allocated</th><th>Spent</th><th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.data.budgets || []).map((b) => (
                    <tr key={b.id}>
                      <td>{b.year}</td>
                      <td>{money(b.total_budget)}</td>
                      <td>{money(b.total_allocated)}</td>
                      <td>{money(b.total_spent)}</td>
                      <td>{money(b.remaining_budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'asset' && report?.data && (
        <div className="card">
          <h3>Asset Report — Valuation, Depreciation & Lifecycle</h3>
          <p className="muted">Snapshot of every registered asset with its latest valuation, depreciation summary, and most recent lifecycle event.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Category</th><th>Status</th>
                  <th>Acquired</th>
                  <th className="text-right">Cost</th>
                  <th>Latest Valuation</th>
                  <th className="text-right">Market Value</th>
                  <th>Depr. Method</th>
                  <th className="text-right">Accum. Depr.</th>
                  <th className="text-right">NBV</th>
                  <th>Last Event</th>
                  <th>Event Date</th>
                </tr>
              </thead>
              <tbody>
                {(report.data.assets || []).map((a) => (
                  <tr key={a.id}>
                    <td>{a.asset_code}</td>
                    <td>{a.name}</td>
                    <td>{a.category}</td>
                    <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                    <td>{a.acquisition_date}</td>
                    <td className="text-right">{money(a.acquisition_cost)}</td>
                    <td>{a.latest_valuation_date}</td>
                    <td className="text-right">{a.latest_market_value === '—' ? '—' : money(a.latest_market_value)}</td>
                    <td>{a.depreciation_method}</td>
                    <td className="text-right">{money(a.accumulated_depreciation)}</td>
                    <td className="text-right"><strong>{money(a.net_book_value)}</strong></td>
                    <td>{a.latest_event_type}</td>
                    <td>{a.latest_event_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
