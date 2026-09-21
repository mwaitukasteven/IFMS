// UsersList - the administrator's user management page.
//
// Lists every user with their role, status, and a quick edit link.
// Only administrators reach this page (guarded by App.jsx via
// <ProtectedRoute allowedRoles={['administrator']} />).
//
// Calls GET /api/users/ which returns a paginated payload
// (the same shape as every other list endpoint in the system).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';


// Small badge palette so the table is scannable at a glance.
// Keys mirror the User.STATUS_CHOICES values on the backend.
function statusClass(s) {
  return {
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-slate-200 text-slate-700',
    suspended: 'bg-red-100 text-red-800',
  }[s] || 'bg-slate-100 text-slate-700';
}


// Role badge - colour-codes each role so admins can spot the
// distribution at a glance (and so an "administrator" row is
// visually distinct from a regular user).
function roleClass(name) {
  return {
    administrator: 'bg-indigo-100 text-indigo-800',
    asset_manager: 'bg-emerald-100 text-emerald-800',
    finance_officer: 'bg-amber-100 text-amber-800',
  }[name] || 'bg-slate-100 text-slate-700';
}


export default function UsersList() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Re-fetch whenever pagination or search changes.
  useEffect(() => {
    setLoading(true);
    api
      .get('/users/', { params: { page, search: search || undefined } })
      .then((res) => { const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? []); const count = res.data?.count ?? rows.length; setData({ results: rows, count }); })
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load users.')
      )
      .finally(() => setLoading(false));
  }, [page, search]);

  // DRF default pagination = 20 per page (settings.py PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil((data.count || 0) / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.count} total | page {page} of {totalPages}
          </p>
        </div>
        <Link to="/users/new" className="btn-primary">
          + Add user
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="search"
          className="input max-w-md"
          placeholder="Search by username, email, full name..."
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

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-slate-500 text-center py-6">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && data.results.length === 0 && (
              <tr>
                <td colSpan={6} className="text-slate-500 text-center py-6">
                  No users found.
                </td>
              </tr>
            )}

            {!loading &&
              data.results.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="font-medium text-slate-900">{u.username}</td>
                  <td>{u.full_name || '-'}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.role ? (
                      <span className={`badge ${roleClass(u.role)}`}>
                        {u.role.display_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">No role</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${statusClass(u.status)}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link
                      to={`/users/${u.id}/edit`}
                      className="text-brand text-sm hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination - same controls as AssetsList for consistency */}
      <div className="flex items-center justify-end gap-2">
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Prev
        </button>
        <span className="text-sm text-slate-500">
          Page {page} of {totalPages}
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
