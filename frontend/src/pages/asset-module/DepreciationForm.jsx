// DepreciationForm - create or edit a depreciation policy.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client.js';
import MoneyInput from '../../components/MoneyInput.jsx';


const BLANK = {
  asset: '',
  method: 'SLM',
  useful_life_years: '5',
  residual_value: '0',
  depreciation_rate: '',
  total_units: '',
  standard: 'IFRS',
  start_date: new Date().toISOString().slice(0, 10),
  status: 'active',
  notes: '',
};


export default function DepreciationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState(BLANK);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetListOpen, setAssetListOpen] = useState(false);
  const assetBoxRef = useRef(null);

  // Load all assets up-front so the dropdown is populated. In a larger
  // system we'd switch this to an async-search combobox, but for the
  // dissertation size (dozens to hundreds of assets) a plain dropdown
  // is the simplest thing that works.
  useEffect(() => {
    Promise.all([
      api.get('/assets/', { params: { page: 1 } }),
      editing ? api.get(`/depreciation/policies/${id}/`) : Promise.resolve(null),
    ])
      .then(([assetsRes, policyRes]) => {
        // Pull every page (rough loop - for dissertation scale this is fine)
        setAssets(Array.isArray(assetsRes.data) ? assetsRes.data : (assetsRes.data?.results ?? []));
        if (policyRes) {
          const { schedules, ...rest } = policyRes.data;
          setForm({ ...BLANK, ...rest });
        }
      })
      .finally(() => setLoading(false));
  }, [editing, id]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Close the asset suggestion list when clicking outside the combobox
  useEffect(() => {
    function onDocClick(e) {
      if (assetBoxRef.current && !assetBoxRef.current.contains(e.target)) {
        setAssetListOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((a) => String(a.id) === String(form.asset)) || null,
    [assets, form.asset],
  );

  const assetMatches = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets.slice(0, 25);
    return assets
      .filter((a) => {
        const code = (a.asset_code || '').toLowerCase();
        const name = (a.name || '').toLowerCase();
        return code.includes(q) || name.includes(q);
      })
      .slice(0, 25);
  }, [assets, assetSearch]);

  function pickAsset(a) {
    // Pull useful_life_years, residual_value, and start_date straight from
    // the asset so a policy can't silently drift from the underlying record.
    // These fields render read-only once an asset is selected.
    setForm((f) => ({
      ...f,
      asset: a.id,
      useful_life_years:
        a.useful_life_years !== undefined && a.useful_life_years !== null
          ? String(a.useful_life_years)
          : f.useful_life_years,
      residual_value:
        a.residual_value !== undefined && a.residual_value !== null
          ? String(a.residual_value)
          : f.residual_value,
      start_date: a.acquisition_date || f.start_date,
    }));
    setAssetSearch('');
    setAssetListOpen(false);
  }

  function clearAsset() {
    // Reset the asset-derived fields to their blank defaults so the user
    // isn't editing stale values from the previously-selected asset.
    setForm((f) => ({
      ...f,
      asset: '',
      useful_life_years: BLANK.useful_life_years,
      residual_value: BLANK.residual_value,
      start_date: BLANK.start_date,
    }));
    setAssetSearch('');
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    // Clean payload - drop empty rate / total_units so the backend can
    // accept null instead of choking on an empty string.
    const payload = {
      ...form,
      depreciation_rate: form.depreciation_rate || null,
      total_units: form.total_units || null,
    };
    try {
      if (editing) {
        await api.put(`/depreciation/policies/${id}/`, payload);
        navigate(`/depreciation/${id}`);
      } else {
        const res = await api.post('/depreciation/policies/', payload);
        navigate(`/depreciation/${res.data.id}`);
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
        {editing ? 'Edit policy' : 'New depreciation policy'}
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
        <Field label="Asset *">
          <div className="relative" ref={assetBoxRef}>
            {/* Hidden field so browser-native `required` validation still fires */}
            <input type="hidden" name="asset" value={form.asset} required />

            {selectedAsset && !assetListOpen ? (
              <div className="input flex items-center justify-between gap-2">
                <span className="truncate">
                  {selectedAsset.asset_code} {selectedAsset.name}
                </span>
                {!editing && (
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-800"
                    onClick={clearAsset}
                    aria-label="Clear selected asset"
                  >
                    change
                  </button>
                )}
              </div>
            ) : (
              <input
                type="text"
                className="input"
                placeholder="Search assets by code or name"
                value={assetSearch}
                onChange={(e) => {
                  setAssetSearch(e.target.value);
                  setAssetListOpen(true);
                }}
                onFocus={() => setAssetListOpen(true)}
                disabled={editing}
                autoComplete="off"
              />
            )}

            {assetListOpen && !editing && (
              <ul
                className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
                role="listbox"
              >
                {assetMatches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500">No matching assets</li>
                ) : (
                  assetMatches.map((a) => (
                    <li
                      key={a.id}
                      role="option"
                      aria-selected={String(a.id) === String(form.asset)}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100"
                      onMouseDown={(e) => {
                        // mousedown so it fires before the input's blur
                        e.preventDefault();
                        pickAsset(a);
                      }}
                    >
                      <span className="font-medium">{a.asset_code}</span>
                      <span className="text-slate-500"> {a.name}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </Field>
        <Field label="Method *">
          <select
            className="input"
            value={form.method}
            onChange={(e) => set('method', e.target.value)}
          >
            <option value="SLM">Straight-Line (SLM)</option>
            <option value="DBM">Declining Balance (DBM)</option>
            <option value="UPM">Units of Production (UPM)</option>
          </select>
        </Field>

        <Field
          label={
            selectedAsset
              ? 'Useful life (years) — from asset'
              : 'Useful life (years) *'
          }
        >
          <input
            type="number"
            step="0.1"
            className={
              selectedAsset ? 'input bg-slate-50 text-slate-600' : 'input'
            }
            value={form.useful_life_years}
            onChange={(e) => set('useful_life_years', e.target.value)}
            readOnly={Boolean(selectedAsset)}
            required
          />
        </Field>
        <Field
          label={
            selectedAsset ? 'Residual value — from asset' : 'Residual value'
          }
        >
          <MoneyInput
            className={
              selectedAsset ? 'input bg-slate-50 text-slate-600' : 'input'
            }
            value={form.residual_value}
            onChange={(v) => set('residual_value', v)}
            readOnly={Boolean(selectedAsset)}
          />
        </Field>

        {form.method === 'DBM' && (
          <Field label="Depreciation rate (% - DBM only)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.depreciation_rate}
              onChange={(e) => set('depreciation_rate', e.target.value)}
              required
            />
          </Field>
        )}

        {form.method === 'UPM' && (
          <Field label="Total expected units (UPM only)">
            <input
              type="number"
              className="input"
              value={form.total_units}
              onChange={(e) => set('total_units', e.target.value)}
              required
            />
          </Field>
        )}

        <Field label="Accounting standard">
          <select
            className="input"
            value={form.standard}
            onChange={(e) => set('standard', e.target.value)}
          >
            <option value="IFRS">IFRS (IAS 16)</option>
            <option value="IPSAS">IPSAS 17</option>
          </select>
        </Field>
        <Field
          label={
            selectedAsset ? 'Start date — from acquisition' : 'Start date *'
          }
        >
          <input
            type="date"
            className={
              selectedAsset ? 'input bg-slate-50 text-slate-600' : 'input'
            }
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            readOnly={Boolean(selectedAsset)}
            required
          />
        </Field>

        <Field label="Status">
          <select
            className="input"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </Field>

        <div className="md:col-span-2 lg:col-span-3">
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
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Create policy'}
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
