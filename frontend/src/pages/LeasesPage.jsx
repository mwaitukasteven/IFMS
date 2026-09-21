import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import SearchablePicker from '../components/SearchablePicker';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

const emptyForm = {
  tenant: '',
  property: '',
  unit: '',
  unit_description: '',
  start_date: '',
  end_date: '',
  monthly_rent: '',
  bank_name: '',
  bank_account_number: '',
  status: 'active',
};

function calcMonths(sd, ed) {
  if (!sd || !ed) return 0;
  const s = new Date(sd); const e = new Date(ed);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (diff === 0 && e.getDate() > s.getDate()) return 1;
  if (diff > 0 && e.getDate() < s.getDate()) return Math.max(diff - 1, 1);
  return Math.max(diff, 1);
}

export default function LeasesPage() {
  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [wholeProperty, setWholeProperty] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaseSearch, setLeaseSearch] = useState('');

  const load = async () => {
    const [leaseRes, tenantRes, propertyRes] = await Promise.all([
      api.get('/leases/leases/'),
      api.get('/tenants/tenants/'),
      api.get('/properties/properties/?available_for_lease=true'),
    ]);
    setLeases(leaseRes.data);
    setTenants(tenantRes.data);
    setProperties(propertyRes.data);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.property) { setUnits([]); return; }
    api.get(`/properties/units/?property=${form.property}&available=true`)
      .then(({ data }) => setUnits(data))
      .catch(() => setUnits([]));
  }, [form.property]);

  const months = useMemo(() => calcMonths(form.start_date, form.end_date), [form.start_date, form.end_date]);
  const totalRent = useMemo(
    () => (months && form.monthly_rent) ? parseNumber(form.monthly_rent) * months : 0,
    [months, form.monthly_rent],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setWholeProperty(true);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.tenant) return setError('Select a tenant.');
    if (!form.property) return setError('Select a property.');
    setBusy(true);
    try {
      await api.post('/leases/leases/', {
        ...form,
        tenant: Number(form.tenant),
        property: form.property,
        unit: null,
        unit_description: wholeProperty ? '' : form.unit_description,
        monthly_rent: parseNumber(form.monthly_rent),
        bank_name: form.bank_name,
        bank_account_number: form.bank_account_number,
      });
      resetForm();
      setShowForm(false);
      setMessage('Lease created and invoice generated. Tenant has been notified.');
      load();
    } catch (err) {
      const data = err.response?.data;
      const detail = typeof data === 'string' ? data
        : data?.detail
        || (data && Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '))
        || 'Failed to create lease';
      setError(detail);
    } finally {
      setBusy(false);
    }
  };

  const terminateLease = async (id) => {
    if (!window.confirm('Terminate this lease? The unit will be released and the tenant notified.')) return;
    await api.patch(`/leases/leases/${id}/`, { status: 'terminated' });
    load();
  };

  const downloadContract = async (id, leaseNumber) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/leases/leases/${id}/download-contract/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert(`Download failed (HTTP ${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${leaseNumber || `lease_${id}`}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filteredLeases = useMemo(() => {
    const q = leaseSearch.trim().toLowerCase();
    if (!q) return leases;
    return leases.filter((l) =>
      (l.lease_number || '').toLowerCase().includes(q)
      || (l.tenant_name || '').toLowerCase().includes(q)
      || (l.property_name || '').toLowerCase().includes(q)
      || (l.status || '').toLowerCase().includes(q),
    );
  }, [leases, leaseSearch]);

  const kpis = useMemo(() => {
    const active = leases.filter((l) => l.status === 'active').length;
    const terminated = leases.filter((l) => l.status === 'terminated').length;
    const monthly = leases
      .filter((l) => l.status === 'active')
      .reduce((sum, l) => sum + Number(l.monthly_rent || 0), 0);
    return { active, terminated, total: leases.length, monthly };
  }, [leases]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Lease Agreements</h2>
          <p className="page-subtitle">Register tenants against properties, generate invoices, and issue signed contracts.</p>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}>
            {showForm ? 'Close form' : '+ New Lease'}
          </button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="stat-grid">
        <div className="stat-card stat-revenue">
          <span>Active Leases</span>
          <p>{kpis.active}</p>
        </div>
        <div className="stat-card">
          <span>Total Leases</span>
          <p>{kpis.total}</p>
        </div>
        <div className="stat-card stat-warn">
          <span>Terminated</span>
          <p>{kpis.terminated}</p>
        </div>
        <div className="stat-card stat-capex">
          <span>Monthly Rent (active)</span>
          <p>{formatMoney(kpis.monthly.toFixed(2))}</p>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-header-row">
            <div className="card-title-block">
              <h3>Create Lease Agreement</h3>
              <span className="card-subtitle">Pick a tenant and property, set the term, and issue the contract.</span>
            </div>
            <button className="btn secondary btn-sm" type="button" onClick={resetForm}>Reset</button>
          </div>

          <form className="form-grid form-wide" onSubmit={handleSubmit}>
            <div className="form-section-title">Parties</div>

            <label>
              Tenant
              <SearchablePicker
                items={tenants}
                value={form.tenant}
                onChange={(v) => setForm({ ...form, tenant: v })}
                getId={(t) => t.id}
                getPrimary={(t) => t.full_name}
                getSecondary={(t) => `${t.email}${t.phone_number ? ` · ${t.phone_number}` : ''}`}
                placeholder="Search tenant by name, email or phone…"
                emptyLabel="No tenants match your search."
                icon="👤"
              />
              <span className="field-hint">Only registered tenants appear here.</span>
            </label>

            <label>
              Property / Asset
              <SearchablePicker
                items={properties}
                value={form.property}
                onChange={(v) => setForm({ ...form, property: v, unit: '' })}
                getId={(p) => p.id}
                getPrimary={(p) => p.asset_name || p.name}
                getSecondary={(p) => `${p.asset_code || p.code}${p.location ? ` · ${p.location}` : ''}`}
                placeholder="Search available property by name, code or location…"
                emptyLabel="No available properties."
                icon="🏢"
              />
              <span className="field-hint">Only buildings marked available for lease are listed.</span>
            </label>

            <div className="form-section-title">Scope of lease</div>

            <label className="form-col-span-2">
              What is being leased?
              <div className="radio-row">
                <label>
                  <input
                    type="radio"
                    checked={wholeProperty}
                    onChange={() => { setWholeProperty(true); setForm({ ...form, unit: '', unit_description: '' }); }}
                  /> Whole property
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!wholeProperty}
                    onChange={() => { setWholeProperty(false); setForm({ ...form, unit: '', unit_description: '' }); }}
                  /> Specific unit / space
                </label>
              </div>
            </label>

            {!wholeProperty && (
              <label className="form-col-span-2">
                Unit or space description
                <input
                  placeholder="e.g. Floor 2 East Wing, Shop A, Room 12…"
                  value={form.unit_description}
                  onChange={(e) => setForm({ ...form, unit_description: e.target.value })}
                  required
                />
              </label>
            )}

            <div className="form-section-title">Term & rent</div>

            <label>
              Start date
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </label>
            <label>
              End date
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
            </label>

            <label>
              Monthly rent
              <input
                type="text" inputMode="decimal"
                value={formatInputNumber(form.monthly_rent)}
                onChange={(e) => setForm({ ...form, monthly_rent: formatInputNumber(e.target.value) })}
                placeholder="e.g. 500,000"
                required
              />
              <span className="field-hint">{months ? `Term: ${months} month${months === 1 ? '' : 's'}` : 'Set both dates to compute the term.'}</span>
            </label>
            <label>
              Total rent for period
              <input type="text" value={totalRent ? formatMoney(totalRent.toFixed(2)) : '—'} readOnly />
              <span className="field-hint">Auto-calculated: monthly rent × months.</span>
            </label>

            <div className="form-section-title">Payment details (printed on invoice)</div>

            <label>
              Bank name
              <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. CRDB Bank" required />
            </label>
            <label>
              Bank account number
              <input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} placeholder="Account number" required />
            </label>

            {error && <p className="error form-col-span-2">{error}</p>}

            <div className="form-footer">
              <div className="summary-pill">
                <span>Estimated total:</span>
                <strong>{totalRent ? formatMoney(totalRent.toFixed(2)) : '—'}</strong>
              </div>
              <div className="actions">
                <button className="btn secondary" type="button" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Creating…' : 'Create Lease & Generate Invoice'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header-row">
          <div className="card-title-block">
            <h3>All Leases</h3>
            <span className="card-subtitle">{filteredLeases.length} of {leases.length} shown</span>
          </div>
          <input
            className="picker-input"
            style={{ maxWidth: 260, border: '1px solid var(--border)', padding: '0.55rem 0.85rem', borderRadius: 10 }}
            placeholder="Search by lease #, tenant, property, status…"
            value={leaseSearch}
            onChange={(e) => setLeaseSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lease #</th>
                <th>Tenant</th>
                <th>Property</th>
                <th>Unit / Space</th>
                <th>Period</th>
                <th className="text-right">Monthly Rent</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeases.length === 0 ? (
                <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No leases match your search.</td></tr>
              ) : filteredLeases.map((l) => (
                <tr key={l.id}>
                  <td className="text-mono">{l.lease_number || `LSA-${l.id}`}</td>
                  <td>{l.tenant_name}</td>
                  <td>{l.property_name}</td>
                  <td>{l.unit_description || l.unit_number || 'Whole property'}</td>
                  <td className="text-mono">{l.start_date} → {l.end_date}</td>
                  <td className="text-right">{formatMoney(l.monthly_rent)}</td>
                  <td className="text-right"><strong>{formatMoney(l.total_rent ?? l.monthly_rent)}</strong></td>
                  <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-sm secondary" type="button" onClick={() => downloadContract(l.id, l.lease_number)}>Download</button>
                      {l.status === 'active' && (
                        <button className="btn btn-sm danger" type="button" onClick={() => terminateLease(l.id)}>Terminate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
