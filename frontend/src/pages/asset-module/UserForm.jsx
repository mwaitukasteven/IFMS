// UserForm - admin-only form to create a new user or edit an existing one.
//
// Same page handles both flows, distinguished by whether there's an
// `id` URL parameter:
//   /users/new        -> create flow
//   /users/:id/edit   -> edit flow
//
// On create we POST /api/users/ (which the UserViewSet routes through
// RegisterSerializer - meaning password/password_confirm validation
// runs server-side and we just surface any errors that come back).
//
// On edit we PATCH /api/users/<id>/ with only the fields the admin
// actually changed. Password is intentionally NOT editable here - to
// reset a user's password we'd add a separate "reset password"
// action; mixing it into the regular update flow makes the form
// dangerous (a stray submit would wipe the existing password).

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/client.js';


// Empty-form default - used for the create flow and as a baseline
// when the edit fetch hasn't returned yet.
const EMPTY = {
  username: '',
  email: '',
  full_name: '',
  phone: '',
  password: '',
  password_confirm: '',
  role_id: '',
  status: 'active',
};


export default function UserForm() {
  const { id } = useParams(); // undefined on /users/new
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(isEdit); // only show loading on edit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Per-field validation errors from DRF (e.g. {"username": ["taken"]})
  const [fieldErrors, setFieldErrors] = useState({});

  // Pull the role list once so the dropdown is populated. Roles are
  // seeded by `python manage.py seed_roles`; if the list comes back
  // empty we still render the form but show a hint.
  useEffect(() => {
    api
      .get('/users/roles/')
      .then((res) => setRoles(res.data.results || res.data))
      .catch(() => setRoles([]));
  }, []);

  // On edit, fetch the existing user so the form is pre-filled.
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api
      .get(`/users/${id}/`)
      .then((res) => {
        const u = res.data;
        setForm({
          username: u.username,
          email: u.email,
          full_name: u.full_name || '',
          phone: u.phone || '',
          password: '',
          password_confirm: '',
          role_id: u.role || '',
          status: u.status,
        });
      })
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load user.')
      )
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Generic field-change handler - keeps the form state in one object
  // so adding a new field doesn't require touching the handler.
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      if (isEdit) {
        // PATCH - only send mutable fields, never password fields
        await api.patch(`/users/${id}/`, {
          email: form.email,
          full_name: form.full_name,
          phone: form.phone,
          role_id: form.role_id || null,
          status: form.status,
        });
      } else {
        // POST - full payload incl. password & password_confirm.
        // RegisterSerializer on the backend validates the match.
        await api.post('/users/', {
          username: form.username,
          email: form.email,
          full_name: form.full_name,
          phone: form.phone,
          password: form.password,
          password_confirm: form.password_confirm,
          role_id: form.role_id || null,
        });
      }
      navigate('/users');
    } catch (err) {
      // DRF puts validation errors directly in the body, one entry
      // per field. A generic message ("detail") lives at the top level.
      const body = err.response?.data;
      if (body && typeof body === 'object' && !body.detail) {
        setFieldErrors(body);
      } else {
        setError(body?.detail || 'Failed to save user.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-slate-500">Loading user...</div>;
  }

  // Convenience renderer - keeps each input + label + error message
  // visually consistent across the form.
  function field(label, name, props = {}) {
    const errs = fieldErrors[name];
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
        <input
          {...props}
          name={name}
          className="input"
          value={form[name]}
          onChange={handleChange}
        />
        {errs && (
          <div className="text-xs text-red-600 mt-1">
            {Array.isArray(errs) ? errs.join(' ') : String(errs)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {isEdit ? 'Edit user' : 'Add user'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEdit
            ? 'Update the user details and role assignment.'
            : 'Create a new system user and assign them a role.'}
        </p>
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        {/* Username can't be changed after creation - Django uses it
            as the login identifier and renaming it on the fly would
            break the user's saved password manager entry. */}
        {!isEdit && field('Username', 'username', { required: true })}

        {field('Email', 'email', { type: 'email', required: true })}
        {field('Full name', 'full_name')}
        {field('Phone', 'phone', { placeholder: '+255 712 345 678' })}

        {/* Role dropdown - populated from /api/users/roles/ */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Role
          </label>
          <select
            name="role_id"
            className="input"
            value={form.role_id}
            onChange={handleChange}
          >
            <option value="">- no role -</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}
              </option>
            ))}
          </select>
          {roles.length === 0 && (
            <div className="text-xs text-amber-700 mt-1">
              No roles found. Run <code>python manage.py seed_roles</code> on
              the backend to populate them.
            </div>
          )}
          {fieldErrors.role_id && (
            <div className="text-xs text-red-600 mt-1">
              {Array.isArray(fieldErrors.role_id)
                ? fieldErrors.role_id.join(' ')
                : String(fieldErrors.role_id)}
            </div>
          )}
        </div>

        {/* Password fields only on create. Editing a user from this
            screen never touches their password - that's a separate
            "reset password" flow we can add later if needed. */}
        {!isEdit && (
          <>
            {field('Password', 'password', {
              type: 'password',
              required: true,
              autoComplete: 'new-password',
            })}
            {field('Confirm password', 'password_confirm', {
              type: 'password',
              required: true,
              autoComplete: 'new-password',
            })}
          </>
        )}

        {/* Account status - admins use this to disable / suspend
            accounts without deleting them outright. */}
        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              name="status"
              className="input"
              value={form.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create user'}
          </button>
          <Link to="/users" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
