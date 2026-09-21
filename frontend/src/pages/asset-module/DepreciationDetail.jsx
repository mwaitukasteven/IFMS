// DepreciationDetail - view one policy, run the engine, see the schedule.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client.js';


function money(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


export default function DepreciationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  function refresh() {
    return api
      .get(`/depreciation/policies/${id}/`)
      .then((res) => setPolicy(res.data));
  }

  useEffect(() => {
    refresh().catch((err) =>
      setError(err.response?.data?.detail || 'Failed to load policy.')
    );
  }, [id]);

  async function handleGenerate() {
    if (!confirm('Re-generate the schedule? Existing rows will be replaced.')) return;
    setGenerating(true);
    try {
      const res = await api.post(`/depreciation/policies/${id}/generate_schedule/`);
      alert(res.data.message || 'Schedule generated.');
      await refresh();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Generate failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this policy and its schedule?')) return;
    await api.delete(`/depreciation/policies/${id}/`);
    navigate('/depreciation', { replace: true });
  }

  if (error) {
    return (
      <div className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        {error}
      </div>
    );
  }
  if (!policy) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {policy.method_display} | {policy.standard_display}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Policy for {policy.asset_name}
          </h1>
          <div className="font-mono text-xs text-slate-500 mt-1">
            {policy.asset_code}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate schedule'}
          </button>
          <Link to={`/depreciation/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <button onClick={handleDelete} className="btn-danger">
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Acquisition cost" value={money(policy.acquisition_cost)} />
        <Stat label="Useful life" value={`${policy.useful_life_years} yrs`} />
        <Stat label="Residual value" value={money(policy.residual_value)} />
        <Stat
          label="Current NBV"
          value={money(policy.current_nbv)}
          hint={`After ${policy.schedule_count || 0} period(s)`}
        />
      </div>

      {policy.method === 'DBM' && (
        <div className="card text-sm text-slate-700">
          <strong>Declining Balance rate:</strong>{' '}
          {policy.depreciation_rate ? `${policy.depreciation_rate}%` : '- not set'}
        </div>
      )}
      {policy.method === 'UPM' && (
        <div className="card text-sm text-slate-700">
          <strong>Total units expected:</strong>{' '}
          {policy.total_units || '-'}{' '}
          <span className="text-slate-500">
            (UPM schedules are entered manually per period via the Schedules API.)
          </span>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Schedule ({policy.schedule_count || 0} periods)
        </h2>
        <div className="card p-0 overflow-hidden">
          {policy.schedules.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm">
              No schedule generated yet. Click "Generate schedule" above to run the engine.
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="text-right">Opening NBV</th>
                  <th className="text-right">Depreciation</th>
                  <th className="text-right">Accumulated</th>
                  <th className="text-right">Closing NBV</th>
                </tr>
              </thead>
              <tbody>
                {policy.schedules.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td>{s.period_year}</td>
                    <td className="text-right tabular-nums">{money(s.opening_nbv)}</td>
                    <td className="text-right tabular-nums">{money(s.depreciation_amount)}</td>
                    <td className="text-right tabular-nums">{money(s.accumulated_depreciation)}</td>
                    <td className="text-right tabular-nums font-medium">{money(s.closing_nbv)}</td>
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


function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
