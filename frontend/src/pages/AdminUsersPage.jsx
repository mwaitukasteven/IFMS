import { useEffect, useState } from 'react';
import api from '../api/client';

const emptyUser = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  role: 'lease_officer',
  phone_number: '',
};

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'asset_manager', label: 'Asset Manager' },
  { value: 'lease_officer', label: 'Lease Manager' },
  { value: 'finance_officer', label: 'Finance Manager' },
  { value: 'tenant', label: 'Tenant' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyUser);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const params = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    const { data } = await api.get('/users/', { params });
    // DRF paginates by default: { count, next, previous, results: [...] }
    const list = Array.isArray(data) ? data : (data?.results ?? []);
    setUsers(list);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/users/', form);
      setForm(emptyUser);
      setShowForm(false);
      setMessage(`User created. Default password: ${form.last_name.toUpperCase()}`);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Failed to create user'));
    }
  };

  const openProfile = (user) => {
    setSelectedUser(user);
    setEditForm(null);
    setResetPassword('');
    setError('');
  };

  const startEdit = () => {
    setEditForm({
      first_name: selectedUser.first_name,
      last_name: selectedUser.last_name,
      email: selectedUser.email,
      role: selectedUser.role,
      phone_number: selectedUser.phone_number || '',
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch(`/users/${selectedUser.id}/`, editForm);
      setMessage(`Updated profile for ${data.first_name} ${data.last_name}`);
      setSelectedUser({ ...selectedUser, ...data });
      setEditForm(null);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Update failed'));
    }
  };

  const handleResetPassword = async () => {
    try {
      const payload = resetPassword ? { new_password: resetPassword } : {};
      const { data } = await api.post(`/users/${selectedUser.id}/reset-password/`, payload);
      setMessage(`Password reset. Temporary password: ${data.temporary_password}`);
      setResetPassword('');
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed');
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      await api.delete(`/users/${id}/`);
      if (selectedUser?.id === id) setSelectedUser(null);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed');
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>Manage Users</h2>
        <button className="btn" type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {showForm && (
        <div className="card">
          <h3>Add User (Asset Manager / Lease Manager / Finance Manager / Tenant)</h3>
          <form className="form-grid form-wide" onSubmit={handleCreate}>
            <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
            <label>First name<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></label>
            <label>Last name<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label>Phone<input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></label>
            <p className="muted">Default password: last name in UPPERCASE. User must change on first login.</p>
            <button className="btn" type="submit">Create User</button>
          </form>
        </div>
      )}

      <div className="admin-users-layout">
        <div className="card">
          <form className="toolbar" onSubmit={handleSearch}>
            <input placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button className="btn secondary" type="submit">Search</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Username</th><th>Name</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={selectedUser?.id === u.id ? 'row-selected' : ''}>
                    <td>{u.username}</td>
                    <td>{u.first_name} {u.last_name}</td>
                    <td><span className="badge">{(u.role || 'unassigned').replace(/_/g, ' ')}</span></td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm" type="button" onClick={() => openProfile(u)}>View</button>
                        <button className="btn danger btn-sm" type="button" onClick={() => handleDelete(u.id, u.username)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedUser && (
          <div className="card profile-panel">
            <div className="card-header-row">
              <h3>User Profile</h3>
              {!editForm && (
                <button className="btn secondary btn-sm" type="button" onClick={startEdit}>Edit</button>
              )}
            </div>

            {editForm ? (
              <form className="form-grid" onSubmit={handleUpdate}>
                <label>First name<input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} required /></label>
                <label>Last name<input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} required /></label>
                <label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></label>
                <label>Role
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                <label>Phone<input value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} /></label>
                <div className="actions">
                  <button className="btn" type="submit">Save Changes</button>
                  <button className="btn secondary" type="button" onClick={() => setEditForm(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <dl className="profile-dl">
                <div><dt>Username</dt><dd>{selectedUser.username}</dd></div>
                <div><dt>Full name</dt><dd>{selectedUser.first_name} {selectedUser.last_name}</dd></div>
                <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                <div><dt>Role</dt><dd><span className="badge">{(selectedUser.role || 'unassigned').replace(/_/g, ' ')}</span></dd></div>
                <div><dt>Phone</dt><dd>{selectedUser.phone_number || '-'}</dd></div>
                <div><dt>Must change password</dt><dd>{selectedUser.must_change_password ? 'Yes' : 'No'}</dd></div>
                <div><dt>Joined</dt><dd>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : '-'}</dd></div>
              </dl>
            )}

            <div className="reset-password-section">
              <h4>Reset Password</h4>
              <p className="muted">Leave blank to reset to last name in uppercase.</p>
              <div className="actions">
                <input
                  placeholder="New password (optional)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  style={{ flex: 1, padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <button className="btn secondary" type="button" onClick={handleResetPassword}>Reset Password</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
