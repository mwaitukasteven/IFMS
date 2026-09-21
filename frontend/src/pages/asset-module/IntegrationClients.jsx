// IntegrationClients - admin page for managing external API consumers.
//
// Lets Patrick (or any admin user) provision Stephen's lease/budget
// system with an api_key, copy it once, rotate it if leaked, and
// revoke it instantly by toggling is_active off.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';


export default function IntegrationClients() {
  const [clients, setClients] = useState([]);
  const [logsStats, setLogsStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState(null); // last created/rotated key
  const [error, setError] = useState('');

  function refresh() {
    return Promise.all([
      api.get('/integration/clients/'),
      api.get('/integration/logs/stats/'),
    ]).then(([cRes, sRes]) => {
      setClients(cRes.data.results || cRes.data);
      setLogsStats(sRes.data);
    });
  }

  useEffect(() => {
    refresh()
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load clients.')
      )
      .finally(() => setLoading(false));
  }, []);

  async function createClient(payload) {
    try {
      const res = await api.post('/integration/clients/', payload);
      setCreated({
        name: res.data.name,
        api_key: res.data.api_key,
        kind: 'created',
      });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      alert(JSON.stringify(err.response?.data || err.message));
    }
  }

  async function rotateKey(client) {
    if (!confirm(`Rotate API key for "${client.name}"? The old key stops working immediately.`)) return;
    try {
      const res = await api.post(`/integration/clients/${client.id}/rotate_key/`);
      setCreated({ name: client.name, api_key: res.data.api_key, kind: 'rotated' });
      await refresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Rotate failed.');
    }
  }

  async function toggleActive(client) {
    try {
      await api.patch(`/integration/clients/${client.id}/`, {
        is_active: !client.is_active,
      });
      await refresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Update failed.');
    }
  }

  async function destroy(client) {
    if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    await api.delete(`/integration/clients/${client.id}/`);
    await refresh();
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key).then(
      () => alert('Key copied to clipboard.'),
      () => alert('Copy failed - please select and copy manually.')
    );
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Integration clients
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            External systems authorised to call <code>/api/integration/</code> with an X-API-Key header.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/integration/logs" className="btn-secondary">
            View logs
          </Link>
          <button className="btn-primary" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? 'Cancel' : '+ New client'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Newly created or rotated key - shown once, prominently */}
      {created && (
        <div className="card border-amber-300 bg-amber-50">
          <div className="text-sm font-semibold text-amber-900">
            {created.kind === 'created' ? 'Client created' : 'API key rotated'} - copy the key now
          </div>
          <div className="text-xs text-amber-800 mt-1">
            For <strong>{created.name}</strong>. You won't see this again from the UI in plain text.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 break-all bg-white border border-amber-200 rounded px-3 py-2 text-xs">
              {created.api_key}
            </code>
            <button className="btn-secondary" onClick={() => copyKey(created.api_key)}>
              Copy
            </button>
            <button className="btn-secondary" onClick={() => setCreated(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Quick stats from the logs endpoint */}
      {logsStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Total calls" value={logsStats.total_calls} />
          <Stat label="Successful" value={logsStats.successful_calls} />
          <Stat label="Failed" value={logsStats.failed_calls} />
        </div>
      )}

      {showCreate && <CreateForm onSubmit={createClient} />}

      <div className="card p-0 overflow-hidden">
        {clients.length === 0 ? (
          <div className="p-6 text-slate-500">
            No clients yet. Create one to give Stephen's system access.
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Last used</th>
                <th className="text-right">Logs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td>
                    <div className="font-medium text-slate-900">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-slate-500">{c.description}</div>
                    )}
                  </td>
                  <td className="text-slate-600">{c.contact_email || '-'}</td>
                  <td>
                    <span
                      className={`badge ${
                        c.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="text-slate-600 text-xs">
                    {c.last_used_at
                      ? new Date(c.last_used_at).toLocaleString()
                      : 'never'}
                  </td>
                  <td className="text-right tabular-nums">{c.log_count}</td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <button
                      className="text-brand hover:underline text-sm"
                      onClick={() => rotateKey(c)}
                    >
                      Rotate key
                    </button>
                    <button
                      className="text-slate-600 hover:underline text-sm"
                      onClick={() => toggleActive(c)}
                    >
                      {c.is_active ? 'Revoke' : 'Activate'}
                    </button>
                    <button
                      className="text-red-600 hover:underline text-sm"
                      onClick={() => destroy(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


function CreateForm({ onSubmit }) {
  const [form, setForm] = useState({ name: '', description: '', contact_email: '' });

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      <Field label="Client name *">
        <input
          className="input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
      </Field>
      <Field label="Contact email">
        <input
          type="email"
          className="input"
          value={form.contact_email}
          onChange={(e) => set('contact_email', e.target.value)}
        />
      </Field>
      <button className="btn-primary">Create client</button>
      <div className="md:col-span-3">
        <Field label="Description">
          <textarea
            rows={2}
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
      </div>
    </form>
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


function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
