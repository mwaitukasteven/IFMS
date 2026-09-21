// ReportDetail - view a report, run generate, export PDF/CSV.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getAccessToken } from '../../api/client.js';


function money(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    return api.get(`/reports/reports/${id}/`).then((res) => setReport(res.data));
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(err.response?.data?.detail || 'Failed to load report.')
    );
  }, [id]);

  async function handleGenerate() {
    if (!confirm('Re-generate this report? Existing line items will be replaced.')) return;
    setBusy(true);
    try {
      const res = await api.post(`/reports/reports/${id}/generate/`);
      setReport(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Generate failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this report?')) return;
    await api.delete(`/reports/reports/${id}/`);
    navigate('/reports', { replace: true });
  }

  // For PDF / CSV downloads we hit the endpoint via fetch directly so
  // the browser handles the file blob - axios is awkward for that.
  // We use the same JWT token the axios client uses.
  async function downloadAs(format) {
    const token = getAccessToken();
    const res = await fetch(`/api/reports/reports/${id}/export_${format}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert(`Download failed (${res.status}).`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/ /g, '_')}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        {error}
      </div>
    );
  }
  if (!report) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {report.report_type_display} | {report.status_display}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            {report.title}
          </h1>
          <div className="text-sm text-slate-500 mt-1">
            Period {report.period_start} → {report.period_end}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" disabled={busy} onClick={handleGenerate}>
            {busy ? 'Generating...' : 'Generate'}
          </button>
          <button className="btn-secondary" onClick={() => downloadAs('pdf')}>
            Download PDF
          </button>
          <button className="btn-secondary" onClick={() => downloadAs('csv')}>
            Download CSV
          </button>
          <button className="btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Assets" value={report.total_assets} />
        <Stat label="Total value" value={money(report.total_value)} />
        <Stat
          label="Accumulated depreciation"
          value={money(report.total_accumulated_depreciation)}
        />
        <Stat label="Net book value" value={money(report.total_nbv)} />
      </div>

      {report.notes && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Notes</h2>
          <p className="text-sm text-slate-700 whitespace-pre-line">{report.notes}</p>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Line items ({report.line_items?.length || 0})
        </h2>
        <div className="card p-0 overflow-hidden">
          {!report.line_items || report.line_items.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm">
              No line items. Click "Generate" to populate from current data.
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Depreciation</th>
                  <th className="text-right">Accumulated</th>
                  <th className="text-right">NBV</th>
                </tr>
              </thead>
              <tbody>
                {report.line_items.map((li) => (
                  <tr key={li.id} className="border-t border-slate-100">
                    <td className="font-mono text-xs">{li.asset_code}</td>
                    <td>{li.asset_name}</td>
                    <td>{li.asset_category}</td>
                    <td className="text-right tabular-nums">{money(li.value_at_period)}</td>
                    <td className="text-right tabular-nums">{money(li.depreciation_for_period)}</td>
                    <td className="text-right tabular-nums">{money(li.accumulated_depreciation)}</td>
                    <td className="text-right tabular-nums font-medium">
                      {money(li.net_book_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}


function Stat({ label, value }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
