// AssetsList - paginated, searchable table of every asset.
//
// Uses DRF's built-in PageNumberPagination (page=N) and SearchFilter
// (search=text). We re-fetch whenever either changes.
//
// The "+ New asset" button is hidden from anyone other than an Asset
// Manager (or Administrator). Finance Officers can still browse the
// asset register read-only, but they can't register new assets -
// the route is also guarded on the App.jsx side, so a finance
// officer who tries to navigate to /assets/new directly is bounced
// back to the dashboard.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';


function money(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


// Colour each status badge differently so the table is scannable
function statusClass(s) {
  return {
    active: 'bg-emerald-100 text-emerald-800',
    under_maintenance: 'bg-amber-100 text-amber-800',
    disposed: 'bg-slate-200 text-slate-700',
    transferred: 'bg-sky-100 text-sky-800',
    impaired: 'bg-red-100 text-red-800',
  }[s] || 'bg-slate-100 text-slate-700';
}


export default function AssetsList() {
  const { role } = useAuth();
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Only asset managers and administrators may create assets.
  // Finance officers are viewers here.
  const canCreateAsset = role === 'asset_manager' || role === 'admin';

  useEffect(() => {
    setLoading(true);
    api
      .get('/assets/', { params: { page, search: search || undefined } })
      .then((res) => {
        // Normalise both paginated { results, count } and plain-array shapes.
        const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        const count = res.data?.count ?? rows.length;
        setData({ results: rows, count });
      })
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load assets.')
      )
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil((data.count || 0) / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assets</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.count} total  page {page} of {totalPages}
          </p>
        </div>
        {canCreateAsset && (
          <Link to="/assets/new" className="btn-primary">
            + New asset
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="search"
          className="input max-w-md"
          placeholder="Search by code, name, location"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // searching resets pagination
          }}
        />
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading</div>
        ) : data.results.length === 0 ? (
          <div className="p-6 text-slate-500">No assets found.</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Acquired</th>
                <th className="text-right">Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="font-mono text-xs text-slate-700">{a.asset_code}</td>
                  <td className="font-medium text-slate-900">{a.name}</td>
                  <td>{a.category_display}</td>
                  <td>
                    <span className={`badge ${statusClass(a.status)}`}>
                      {a.status_display}
                    </span>
                  </td>
                  <td className="text-slate-600">{a.acquisition_date}</td>
                  <td className="text-right tabular-nums">{money(a.acquisition_cost)}</td>
                  <td className="text-right">
                    <Link
                      to={`/assets/${a.id}`}
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

      {/* Pagination controls */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
           Prev
        </button>
        <span className="text-sm text-slate-600 px-2">
          Page {page} / {totalPages}
        </span>
        <button
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next 
        </button>
      </div>
    </div>
  );
}
