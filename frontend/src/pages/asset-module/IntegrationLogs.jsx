// IntegrationLogs - read-only audit trail of every call made against
// the integration endpoints by external systems.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';


function statusClass(code) {
  if (code < 300) return 'bg-emerald-100 text-emerald-800';
  if (code < 400) return 'bg-sky-100 text-sky-800';
  if (code < 500) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}


export default function IntegrationLogs() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/integration/logs/', {
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
          <h1 className="text-2xl font-semibold text-slate-900">
            Integration logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.count} total | page {page} of {totalPages}
          </p>
        </div>
        <Link to="/integration" className="btn-secondary">
          ← Back to clients
        </Link>
      </div>

      <input
        type="search"
        className="input max-w-md"
        placeholder="Search by endpoint, client, message..."
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
          <div className="p-6 text-slate-500">No log entries.</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Client</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>IP</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="text-xs text-slate-600 whitespace-nowrap">
                    {new Date(row.called_at).toLocaleString()}
                  </td>
                  <td>{row.client_name || 'unknown'}</td>
                  <td className="font-mono text-xs">{row.method}</td>
                  <td className="font-mono text-xs text-slate-700">
                    {row.endpoint}
                  </td>
                  <td>
                    <span className={`badge ${statusClass(row.status_code)}`}>
                      {row.status_code}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{row.ip_address || '-'}</td>
                  <td className="text-xs text-slate-600">{row.message || ''}</td>
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
