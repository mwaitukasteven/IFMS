// AssetForm - create or edit an asset.
// We reuse one component for both flows: if there's an :id in the URL
// we load the existing asset, otherwise start with an empty form.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client.js';
import MoneyInput from '../../components/MoneyInput.jsx';


const BLANK = {
  asset_code: '',
  name: '',
  description: '',
  category: 'equipment',
  location: '',
  acquisition_date: new Date().toISOString().slice(0, 10),
  acquisition_cost: '',
  useful_life_years: '5',
  residual_value: '0',
  valuation_method: 'cost',
  // status is always 'active' when registering — set implicitly, no UI field.
  status: 'active',
};

const CATEGORIES = [
  ['land', 'Land'],
  ['building', 'Building'],
  ['vehicle', 'Vehicle'],
  ['equipment', 'Equipment'],
  ['furniture', 'Furniture'],
  ['it_equipment', 'IT Equipment'],
  ['machinery', 'Machinery'],
  ['other', 'Other'],
];


export default function AssetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(null);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/assets/${id}/`)
      .then((res) => {
        // Backend returns nested arrays we don't need on the form
        const { valuations, events, ...rest } = res.data;
        setForm({ ...BLANK, ...rest });
      })
      .finally(() => setLoading(false));
  }, [editing, id]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Guard against residual value > acquisition cost. We compute this once
  // per render so we can both disable the submit button and render an inline
  // hint next to the residual field. Backend enforces the same rule.
  const acqNum = Number(form.acquisition_cost);
  const resNum = Number(form.residual_value);
  const residualTooHigh =
    Number.isFinite(acqNum) &&
    acqNum > 0 &&
    Number.isFinite(resNum) &&
    resNum > acqNum;

  async function submit(e) {
    e.preventDefault();
    if (residualTooHigh) {
      setErrors({ residual_value: 'Residual value cannot exceed acquisition cost.' });
      return;
    }
    setSaving(true);
    setErrors(null);
    try {
      if (editing) {
        await api.put(`/assets/${id}/`, form);
        navigate(`/assets/${id}`);
      } else {
        await api.post('/assets/', form);
        navigate('/assets');
      }
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-500">Loading</div>;

  return (
    <form onSubmit={submit} className="space-y-4 w-full">
      <h1 className="text-2xl font-semibold text-slate-900">
        {editing ? 'Edit asset' : 'New asset'}
      </h1>

      {errors && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
          {Object.entries(errors).map(([k, v]) => (
            <div key={k}>
              <strong>{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}
            </div>
          ))}
        </div>
      )}

      <div className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {editing && (
          <Field label="Asset code">
            <input
              className="input bg-slate-50 text-slate-600"
              value={form.asset_code}
              readOnly
            />
          </Field>
        )}
        <Field label="Name *">
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </Field>
        <Field label="Category *">
          <select
            className="input"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {editing && (
          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              <option value="active">Active</option>
              <option value="under_maintenance">Under maintenance</option>
              <option value="disposed">Disposed</option>
              <option value="transferred">Transferred</option>
              <option value="impaired">Impaired</option>
            </select>
          </Field>
        )}

        <Field label="Location">
          <input
            className="input"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>
        <Field label="Acquisition date *">
          <input
            type="date"
            className="input"
            value={form.acquisition_date}
            onChange={(e) => set('acquisition_date', e.target.value)}
            required
          />
        </Field>

        <Field label="Acquisition cost *">
          <MoneyInput
            className="input"
            value={form.acquisition_cost}
            onChange={(v) => set('acquisition_cost', v)}
            required
          />
        </Field>
        <Field label="Residual value">
          <MoneyInput
            className={`input ${residualTooHigh ? 'border-red-400 ring-1 ring-red-200' : ''}`}
            value={form.residual_value}
            onChange={(v) => set('residual_value', v)}
          />
          {residualTooHigh && (
            <span className="block text-xs text-red-600 mt-1">
              Cannot exceed acquisition cost.
            </span>
          )}
        </Field>

        <Field label="Useful life (years) *">
          <input
            type="number"
            step="0.1"
            className="input"
            value={form.useful_life_years}
            onChange={(e) => set('useful_life_years', e.target.value)}
            required
          />
        </Field>
        <Field label="Valuation method">
          <select
            className="input"
            value={form.valuation_method}
            onChange={(e) => set('valuation_method', e.target.value)}
          >
            <option value="cost">Cost</option>
            <option value="market">Market</option>
            <option value="replacement">Replacement</option>
          </select>
        </Field>

        <div className="md:col-span-2 lg:col-span-3">
          <Field label="Description">
            <textarea
              rows={3}
              className="input"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>
        <button className="btn-primary" disabled={saving || residualTooHigh}>
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Create asset'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
