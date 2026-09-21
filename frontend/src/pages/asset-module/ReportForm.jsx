// ReportForm - create a new (draft) financial report.
// Line items get populated later via the Generate action on the detail page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';


export default function ReportForm() {
  const navigate = useNavigate();

  // Default the period to the current calendar year.
  const today = new Date();
  const start = `${today.getFullYear()}-01-01`;
  const end = `${today.getFullYear()}-12-31`;

  const [form, setForm] = useState({
    title: '',
    report_type: 'nbv_summary',
    period_start: start,
    period_end: end,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(null);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      const res = await api.post('/reports/reports/', form);
      navigate(`/reports/${res.data.id}`);
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">New report</h1>

      {errors && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
          {Object.entries(errors).map(([k, v]) => (
            <div key={k}>
              <strong>{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}
            </div>
          ))}
        </div>
      )}

      <div className="card grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Title *">
            <input
              className="input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Report type *">
          <select
            className="input"
            value={form.report_type}
            onChange={(e) => set('report_type', e.target.value)}
          >
            <option value="valuation">Valuation report</option>
            <option value="depreciation">Depreciation report</option>
            <option value="nbv_summary">NBV summary</option>
          </select>
        </Field>
        <div />
        <Field label="Period start *">
          <input
            type="date"
            className="input"
            value={form.period_start}
            onChange={(e) => set('period_start', e.target.value)}
            required
          />
        </Field>
        <Field label="Period end *">
          <input
            type="date"
            className="input"
            value={form.period_end}
            onChange={(e) => set('period_end', e.target.value)}
            required
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Notes">
            <textarea
              rows={3}
              className="input"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Create report'}
        </button>
      </div>
    </form>
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
