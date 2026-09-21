import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const emptyForm = { first_name: '', last_name: '', email: '', phone_number: '', address: '' };

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [notifyTenant, setNotifyTenant] = useState(null);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '', send_email: true });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    const { data } = await api.get('/tenants/tenants/');
    setTenants(data);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((t) =>
      [t.full_name, t.username, t.email, t.phone_number, t.address]
        .some((v) => String(v || '').toLowerCase().includes(query)),
    );
  }, [tenants, q]);

  const kpis = useMemo(() => {
    const withActive = tenants.filter((t) => (t.active_leases?.length || 0) > 0).length;
    const totalActive = tenants.reduce((s, t) => s + (t.active_leases?.length || 0), 0);
    return { total: tenants.length, withActive, totalActive };
  }, [tenants]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/tenants/tenants/', form);
      setForm(emptyForm);
      setShowForm(false);
      setMessage(`Tenant "${data.full_name}" registered. Login with username "${data.username}" or email "${data.email}". Password: ${data.default_password || form.last_name.toUpperCase()}`);
      load();
    } catch (err) {
      const d = err.response?.data;
      const detail = typeof d === 'string' ? d
        : d?.detail
        || (d && Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '))
        || 'Failed to register tenant';
      setError(detail);
    }
  };

  const openProfile = (tenant) => {
    setSelectedTenant(tenant);
    setEditForm(null);
    setResetPassword('');
    setError('');
    setMessage('');
  };

  const closeProfile = () => {
    setSelectedTenant(null);
    setEditForm(null);
    setResetPassword('');
  };

  const startEdit = () => {
    setEditForm({
      first_name: selectedTenant.first_name,
      last_name: selectedTenant.last_name,
      email: selectedTenant.email,
      phone_number: selectedTenant.phone_number,
      address: selectedTenant.address,
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch(`/tenants/tenants/${selectedTenant.id}/`, editForm);
      setMessage(`Updated profile for ${data.full_name}`);
      setSelectedTenant(data);
      setEditForm(null);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Update failed'));
    }
  };

  const handleResetPassword = async () => {
    try {
      const payload = resetPassword ? { new_password: resetPassword } : {};
      const { data } = await api.post(`/tenants/tenants/${selectedTenant.id}/reset-password/`, payload);
      setMessage(`Password reset. Temporary password: ${data.temporary_password}`);
      setResetPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed');
    }
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tenants/tenants/${notifyTenant.id}/send-notification/`, notifyForm);
      setMessage(`Notification sent to ${notifyTenant.full_name}`);
      setNotifyTenant(null);
      setNotifyForm({ title: '', message: '', send_email: true });
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Failed'));
    }
  };

  const remindExpiry = async (tenant) => {
    try {
      const { data } = await api.post(`/tenants/tenants/${tenant.id}/remind-lease-expiry/`);
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'No expiring leases');
    }
  };

  const initials = (name) => (name || '')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Tenants</h2>
          <p className="page-subtitle">Register new tenants, notify them, and reset passwords. New tenants receive their login credentials by email.</p>
        </div>
        <button className="btn" type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Tenant'}
        </button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}
      {error && <p className="error">{error}</p>}

      <div className="stat-grid">
        <div className="stat-card"><span>Total Tenants</span><p>{kpis.total}</p></div>
        <div className="stat-card stat-revenue"><span>Tenants with Active Lease</span><p>{kpis.withActive}</p></div>
        <div className="stat-card stat-capex"><span>Total Active Leases</span><p>{kpis.totalActive}</p></div>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-header-row">
            <div className="card-title-block">
              <h3>Register Tenant</h3>
              <span className="card-subtitle">A welcome email with the temporary password is sent automatically after creation.</span>
            </div>
          </div>
          <form className="form-grid form-wide" onSubmit={handleSubmit}>
            <label>First name<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></label>
            <label>Last name<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Phone<input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required /></label>
            <label className="form-col-span-2">Address<textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></label>
            <div className="form-footer">
              <span className="muted">Default password will be the surname in UPPERCASE.</span>
              <button className="btn" type="submit">Register Tenant</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header-row">
          <div className="card-title-block">
            <h3>All Tenants</h3>
            <span className="card-subtitle">{filtered.length} of {tenants.length} shown</span>
          </div>
          <input
            placeholder="Search by name, username, email or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 320, padding: '0.55rem 0.85rem', borderRadius: 10, border: '1px solid var(--border)' }}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}></th>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="text-right">Active Leases</th>
                <th style={{ width: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No tenants found.</td></tr>
              ) : filtered.map((t) => {
                const activeCount = t.active_leases?.length || 0;
                return (
                  <tr key={t.id} className={selectedTenant?.id === t.id ? 'row-selected' : ''}>
                    <td>
                      <div className="tenant-avatar" title={t.full_name}>{initials(t.full_name)}</div>
                    </td>
                    <td><strong>{t.full_name}</strong></td>
                    <td className="text-mono">{t.username}</td>
                    <td>{t.email}</td>
                    <td className="text-mono">{t.phone_number}</td>
                    <td className="text-right">
                      {activeCount > 0
                        ? <span className="badge active">{activeCount}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm" type="button" onClick={() => openProfile(t)}>Profile</button>
                        <button className="btn secondary btn-sm" type="button" onClick={() => setNotifyTenant(t)}>Notify</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profile modal — keeps the table full width even when a tenant is selected */}
      {selectedTenant && (
        <div className="modal-overlay" onClick={closeProfile}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="card-header-row">
              <div className="card-title-block">
                <h3>Tenant Profile — {selectedTenant.full_name}</h3>
                <span className="card-subtitle">Username: {selectedTenant.username}</span>
              </div>
              <div className="actions">
                {!editForm && (
                  <button className="btn secondary btn-sm" type="button" onClick={startEdit}>Edit profile</button>
                )}
                <button className="btn secondary btn-sm" type="button" onClick={closeProfile}>Close</button>
              </div>
            </div>

            {editForm ? (
              <form className="form-grid form-wide" onSubmit={handleUpdate}>
                <label>First name<input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} required /></label>
                <label>Last name<input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} required /></label>
                <label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></label>
                <label>Phone<input value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} required /></label>
                <label className="form-col-span-2">Address<textarea rows={3} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} required /></label>
                <div className="form-footer">
                  <button className="btn secondary" type="button" onClick={() => setEditForm(null)}>Cancel</button>
                  <button className="btn" type="submit">Save Changes</button>
                </div>
              </form>
            ) : (
              <>
                <dl className="profile-dl profile-dl-grid">
                  <div><dt>Username</dt><dd className="text-mono">{selectedTenant.username}</dd></div>
                  <div><dt>Full name</dt><dd>{selectedTenant.full_name}</dd></div>
                  <div><dt>Email</dt><dd>{selectedTenant.email}</dd></div>
                  <div><dt>Phone</dt><dd className="text-mono">{selectedTenant.phone_number}</dd></div>
                  <div className="profile-dl-full"><dt>Address</dt><dd>{selectedTenant.address}</dd></div>
                </dl>

                {selectedTenant.active_leases?.length > 0 ? (
                  <div className="lease-list-mini">
                    <h4>Active Leases</h4>
                    <ul>
                      {selectedTenant.active_leases.map((l) => (
                        <li key={l.id}>{l.lease_number} — {l.property_name} (ends {l.end_date})</li>
                      ))}
                    </ul>
                    <button className="btn secondary btn-sm" type="button" onClick={() => remindExpiry(selectedTenant)}>
                      Send Expiry Reminder
                    </button>
                  </div>
                ) : (
                  <p className="muted">This tenant has no active leases.</p>
                )}
              </>
            )}

            <div className="reset-password-section">
              <h4>Reset Password</h4>
              <p className="muted">Leave blank to reset to last name in uppercase. The tenant will be forced to change it on next login.</p>
              <div className="actions" style={{ alignItems: 'stretch' }}>
                <input
                  placeholder="New password (optional)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: 10, border: '1px solid var(--border)' }}
                />
                <button className="btn secondary" type="button" onClick={handleResetPassword}>Reset Password</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notifyTenant && (
        <div className="modal-overlay" onClick={() => setNotifyTenant(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="card-header-row">
              <div className="card-title-block">
                <h3>Send Notification</h3>
                <span className="card-subtitle">To {notifyTenant.full_name} · {notifyTenant.email}</span>
              </div>
            </div>
            <form className="form-grid" onSubmit={sendNotification}>
              <label>Subject<input value={notifyForm.title} onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })} required /></label>
              <label>Message<textarea rows={5} value={notifyForm.message} onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })} required /></label>
              <label className="checkbox-label">
                <input type="checkbox" checked={notifyForm.send_email} onChange={(e) => setNotifyForm({ ...notifyForm, send_email: e.target.checked })} />
                Also send email
              </label>
              <div className="form-footer">
                <button className="btn secondary" type="button" onClick={() => setNotifyTenant(null)}>Cancel</button>
                <button className="btn" type="submit">Send Notification</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
