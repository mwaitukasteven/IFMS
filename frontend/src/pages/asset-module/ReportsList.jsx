// ReportsList - list of all generated financial reports.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';


export default function ReportsList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/reports/reports/', {
        params: { page, search: search || undefined },
      })
      .then((res) => { const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []); const count = res.data?.count ?? rows.length; setData({ results: rows, count }); })
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil((data.count || 0) / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Financial reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.count} total | page {page} of {totalPages}
          </p>
        </div>
        <Link to="/reports/new" className="btn-primary">
          + New report
        </Link>
      </div>

      <input
        type="search"
        className="input max-w-md"
        placeholder="Search by title or type..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading...</div>
        ) : data.results.length === 0 ? (
          <div className="p-6 text-slate-500">No reports yet.</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Period</th>
                <th>Status</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="font-medium text-slate-900">{r.title}</td>
                  <td>{r.report_type_display}</td>
                  <td className="text-slate-600">
                    {r.period_start} → {r.period_end}
                  </td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700">
                      {r.status_display}
                    </span>
                  </td>
                  <td className="text-slate-600">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="text-right">
                    <Link
                      to={`/reports/${r.id}`}
                      className="text-brand hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Prev
        </button>
        <span className="text-sm text-slate-600 px-2">
          Page {page} / {totalPages}
        </span>
        <button
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
