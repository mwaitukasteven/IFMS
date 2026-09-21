// DepreciationList - paginated list of every depreciation policy.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';


function money(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


export default function DepreciationList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/depreciation/policies/', {
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
          <h1 className="text-2xl font-semibold text-slate-900">Depreciation policies</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.count} total | page {page} of {totalPages}
          </p>
        </div>
        <Link to="/depreciation/new" className="btn-primary">
          + New policy
        </Link>
      </div>

      <input
        type="search"
        className="input max-w-md"
        placeholder="Search by asset code, name, method"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading</div>
        ) : data.results.length === 0 ? (
          <div className="p-6 text-slate-500">No policies yet.</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Method</th>
                <th>Standard</th>
                <th>Life</th>
                <th className="text-right">Residual</th>
                <th>Start</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td>
                    <div className="font-medium text-slate-900">{p.asset_name}</div>
                    <div className="font-mono text-xs text-slate-500">{p.asset_code}</div>
                  </td>
                  <td>{p.method_display}</td>
                  <td>{p.standard_display}</td>
                  <td>{p.useful_life_years} yrs</td>
                  <td className="text-right tabular-nums">{money(p.residual_value)}</td>
                  <td>{p.start_date}</td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700">
                      {p.status_display}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link
                      to={`/depreciation/${p.id}`}
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
           Prev
        </button>
        <span className="text-sm text-slate-600 px-2">
          Page {page} / {totalPages}
        </span>
        <button
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next 
        </button>
      </div>
    </div>
  );
}
