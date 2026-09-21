// AssetDetail - read view of one asset with its valuation history,
// lifecycle events, and quick-action buttons for adding new entries.
//
// Edit / Delete / Add valuation / Add event are all asset-manager
// actions. Finance officers can land on this page (the list links
// here) but they see it strictly read-only - no write controls
// render for them. The corresponding write routes are also blocked
// at the App.jsx level.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client.js';
import MoneyInput from '../../components/MoneyInput.jsx';
import { useAuth } from '../../context/AuthContext.jsx';


function money(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');

  // Two small in-place forms — one for adding a valuation, one for an event
  const [showValForm, setShowValForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // Asset write actions (edit, delete, add valuation, add event)
  // are restricted to asset managers and administrators.
  const canEditAsset = role === 'asset_manager' || role === 'admin';

  useEffect(() => {
    api
      .get(`/assets/${id}/`)
      .then((res) => setAsset(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || 'Failed to load asset.')
      );
  }, [id]);

  async function handleDelete() {
    if (!confirm('Delete this asset? Valuations and events will go with it.')) return;
    try {
      await api.delete(`/assets/${id}/`);
      navigate('/assets', { replace: true });
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed.');
    }
  }

  // Adds a new valuation row for this asset and refreshes the page data
  async function addValuation(payload) {
    await api.post('/assets/valuations/', { ...payload, asset: id });
    const res = await api.get(`/assets/${id}/`);
    setAsset(res.data);
    setShowValForm(false);
  }

  async function addEvent(payload) {
    await api.post('/assets/events/', { ...payload, asset: id });
    const res = await api.get(`/assets/${id}/`);
    setAsset(res.data);
    setShowEventForm(false);
  }

  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        {error}
      </div>
    );
  }
  if (!asset) return <div className="text-slate-500">Loading</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {asset.category_display} {asset.status_display}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            {asset.name}
          </h1>
          <div className="font-mono text-xs text-slate-500 mt-1">
            {asset.asset_code}
          </div>
        </div>
        {canEditAsset && (
          <div className="flex gap-2">
            <Link to={`/assets/${id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <button onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Acquisition cost
          </div>
          <div className="text-xl font-semibold mt-1">
            {money(asset.acquisition_cost)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {asset.acquisition_date}
          </div>
        </div>
        <div className="card">                
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Latest market value
          </div>
          <div className="text-xl font-semibold mt-1">
            {money(asset.latest_market_value)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            From {asset.valuation_count || 0} valuation(s)
          </div>
        </div>   
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Useful life
          </div>
          <div className="text-xl font-semibold mt-1">
            {asset.useful_life_years} yrs
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Residual {money(asset.residual_value)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Location
          </div>
          <div className="text-xl font-semibold mt-1">
            {asset.location || '-'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {asset.valuation_method_display}
          </div>
        </div>
      </div>

      {asset.description && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Description</h2>
          <p className="text-slate-700 text-sm whitespace-pre-line">{asset.description}</p>
        </div>
      )}

      {/* VALUATIONS */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Valuations ({asset.valuation_count || 0})
          </h2>
          {canEditAsset && (
            <button
              className="btn-secondary"
              onClick={() => setShowValForm((s) => !s)}
            >
              {showValForm ? 'Cancel' : '+ Add valuation'}
            </button>
          )}
        </div>

        {canEditAsset && showValForm && (
          <InlineValuationForm onSubmit={addValuation} />
        )}

        <div className="card p-0 overflow-hidden mt-2">
          {asset.valuations.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm">No valuations yet.</div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th className="text-right">Market value</th>
                  <th className="text-right">Fair value</th>
                  <th>Performed by</th>
                </tr>
              </thead>
              <tbody>
                {asset.valuations.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td>{v.valuation_date}</td>
                    <td>{v.method_display}</td>
                    <td className="text-right tabular-nums">{money(v.market_value)}</td>
                    <td className="text-right tabular-nums">{money(v.fair_value)}</td>
                    <td className="text-slate-600">{v.performed_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* EVENTS */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Lifecycle events ({asset.event_count || 0})
          </h2>
          {canEditAsset && (
            <button
              className="btn-secondary"
              onClick={() => setShowEventForm((s) => !s)}
            >
              {showEventForm ? 'Cancel' : '+ Add event'}
            </button>
          )}
        </div>

        {canEditAsset && showEventForm && <InlineEventForm onSubmit={addEvent} />}

        <div className="card p-0 overflow-hidden mt-2">
          {asset.events.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm">No events recorded yet.</div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th>Description</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {asset.events.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td>{e.event_date}</td>
                    <td>{e.event_type_display}</td>
                    <td className="text-right tabular-nums">{money(e.amount)}</td>
                    <td className="text-slate-700">{e.description}</td>
                    <td className="text-slate-600">{e.recorded_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}


// In-page valuation form - kept small and local so we don't have to
// route to a new page for what is a 4-field operation.
function InlineValuationForm({ onSubmit }) {
  const [form, setForm] = useState({
    valuation_date: new Date().toISOString().slice(0, 10),
    market_value: '',
    fair_value: '',
    method: 'market',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      alert(JSON.stringify(err.response?.data || err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
      <Field label="Date">
        <input
          type="date"
          className="input"
          value={form.valuation_date}
          onChange={(e) => setForm({ ...form, valuation_date: e.target.value })}
          required
        />
      </Field>
      <Field label="Market value">
        <MoneyInput
          className="input"
          value={form.market_value}
          onChange={(v) => setForm({ ...form, market_value: v })}
          required
        />
      </Field>
      <Field label="Fair value">
        <MoneyInput
          className="input"
          value={form.fair_value}
          onChange={(v) => setForm({ ...form, fair_value: v })}
          required
        />
      </Field>
      <Field label="Method">
        <select
          className="input"
          value={form.method}
          onChange={(e) => setForm({ ...form, method: e.target.value })}
        >
          <option value="cost">Cost</option>
          <option value="market">Market</option>
          <option value="replacement">Replacement</option>
        </select>
      </Field>
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

function InlineEventForm({ onSubmit }) {
  const [form, setForm] = useState({
    event_date: new Date().toISOString().slice(0, 10),
    event_type: 'maintenance',
    amount: '0',
    description: '',
  });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      alert(JSON.stringify(err.response?.data || err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Date">
          <input
            type="date"
            className="input"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            required
          />
        </Field>
        <Field label="Type">
          <select
            className="input"
            value={form.event_type}
            onChange={(e) => setForm({ ...form, event_type: e.target.value })}
          >
            <option value="maintenance">Maintenance</option>
            <option value="upgrade">Upgrade</option>
            <option value="transfer">Transfer</option>
            <option value="impairment">Impairment</option>
            <option value="revaluation">Revaluation</option>
            <option value="disposal">Disposal</option>
          </select>
        </Field>
        <Field label="Amount">
          <MoneyInput
            className="input"
            value={form.amount}
            onChange={(v) => setForm({ ...form, amount: v })}
            required
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className="input"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
      </Field>
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Saving...' : 'Save event'}
      </button>
    </form>
  );
}


// Tiny field wrapper to avoid repeating label markup
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
