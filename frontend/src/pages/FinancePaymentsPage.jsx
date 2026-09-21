import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatMoney } from '../utils/format';

export default function FinancePaymentsPage() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get('/budgets/revenue/', { params: { year } }).then(({ data: d }) => setData(d));
  }, [year]);

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-header">
        <h2>Revenue & Payments</h2>
        <label className="year-picker">Year<input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></label>
      </div>
      <div className="stat-grid">
        <div className="stat-card stat-revenue">
          <span>Total Revenue ({year})</span>
          <p>{formatMoney(data.total_revenue)}</p>
        </div>
        <div className="stat-card">
          <span>Payment Count</span>
          <p>{data.payment_count}</p>
        </div>
      </div>
      <div className="card">
        <h3>All Recorded Payments</h3>
        <p className="muted">Payments recorded by the Lease Officer appear here for budget planning.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th className="text-right">Amount</th><th>Method</th><th>Invoice Number</th></tr></thead>
            <tbody>
              {data.recent_payments?.map((p) => (
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
