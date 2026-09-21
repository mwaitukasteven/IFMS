import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

// Realistic year window — must match backend serializer validation.
const YEAR_MIN_OFFSET = 10;
const YEAR_MAX_OFFSET = 20;

function formatError(data) {
  if (!data) return 'Failed to save budget plan.';
  if (typeof data === 'string') return data;
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' | ');
}

export default function BudgetPlansPage() {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - YEAR_MIN_OFFSET;
  const maxYear = currentYear + YEAR_MAX_OFFSET;

  const [budgets, setBudgets] = useState([]);
  const [revenue, setRevenue] = useState('0');
  const [form, setForm] = useState({ year: currentYear, total_budget: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const existingYears = useMemo(
    () => new Set(budgets.map((b) => Number(b.year))),
    [budgets],
  );
  const yearAlreadyExists = existingYears.has(Number(form.year));

  // Totals across all planned budgets — used to derive how much revenue is
  // still uncommitted and available for a new plan. Closed budgets only
  // commit their actually-spent portion; their unspent remainder is released
  // back to the pool (matches backend committed_against_revenue()).
  const totalCommitted = useMemo(
    () => budgets.reduce((s, b) => {
      const committed = b.is_closed
        ? Number(b.total_spent || 0)
        : Number(b.total_budget || 0);
      return s + committed;
    }, 0),
    [budgets],
  );
  const totalRevenue = Number(revenue || 0);
  const revenueRemaining = Math.max(0, totalRevenue - totalCommitted);
  const totalReleased = useMemo(
    () => budgets
      .filter((b) => b.is_closed)
      .reduce((s, b) => s + Math.max(0, Number(b.total_budget || 0) - Number(b.total_spent || 0)), 0),
    [budgets],
  );

  const proposedNum = parseNumber(form.total_budget);
  const wouldExceedRevenue = proposedNum > revenueRemaining && proposedNum > 0;

  const load = async () => {
    // Revenue is now all-time collected revenue (not tied to a year), so we
    // omit the year param.
    const [bRes, rRes] = await Promise.all([
      api.get('/budgets/budgets/'),
      api.get('/budgets/revenue/'),
    ]);
    setBudgets(bRes.data);
    setRevenue(rRes.data.total_revenue);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const yearNum = Number(form.year);
    if (!Number.isInteger(yearNum) || yearNum < minYear || yearNum > maxYear) {
      setError(`Year must be between ${minYear} and ${maxYear}.`);
      return;
    }
    if (existingYears.has(yearNum)) {
      setError(`A budget plan for ${yearNum} already exists. Choose a different year.`);
      return;
    }
    if (totalRevenue <= 0) {
      setError('No revenue has been collected yet. Record at least one payment before planning any budget.');
      return;
    }
    if (proposedNum > revenueRemaining) {
      setError(
        `Budget (${formatMoney(proposedNum)}) exceeds available revenue (${formatMoney(revenueRemaining)}). ` +
        `Total collected revenue is ${formatMoney(totalRevenue)}; ${formatMoney(totalCommitted)} is already committed.`,
      );
      return;
    }

    try {
      // Strip commas from total_budget before sending — backend expects a
      // clean decimal string.
      await api.post('/budgets/budgets/', {
        year: form.year,
        total_budget: parseNumber(form.total_budget),
      });
      setMessage('Budget plan created.');
      setForm({ year: currentYear, total_budget: '' });
      load();
    } catch (err) {
      setError(formatError(err.response?.data));
    }
  };

  const closeBudget = async (b) => {
    const remainder = Math.max(0, Number(b.total_budget || 0) - Number(b.total_spent || 0));
    const ok = window.confirm(
      `Approve budget ${b.year}? This releases ${formatMoney(remainder)} of unspent budget back to available revenue.`,
    );
    if (!ok) return;
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/budgets/budgets/${b.id}/close/`);
      setMessage(data.message || `Budget ${b.year} closed.`);
      load();
    } catch (err) {
      setError(formatError(err.response?.data));
    }
  };

  const reopenBudget = async (b) => {
    if (!window.confirm(`Reopen budget ${b.year}? Its full amount will be re-committed against revenue.`)) return;
    setError('');
    setMessage('');
    try {
      await api.post(`/budgets/budgets/${b.id}/reopen/`);
      setMessage(`Budget ${b.year} reopened.`);
      load();
    } catch (err) {
      setError(formatError(err.response?.data));
    }
  };

  return (
    <>
      <div className="page-header"><h2>Budget Plans</h2></div>

      {/* Revenue / commitment summary — always visible so the officer knows
          exactly how much room is left before they even start typing. */}
      <div className="stat-grid">
        <div className="stat-card stat-revenue">
          <span>Total Collected Revenue</span>
          <p>{formatMoney(totalRevenue)}</p>
        </div>
        <div className="stat-card stat-capex">
          <span>Committed to Budgets</span>
          <p>{formatMoney(totalCommitted)}</p>
        </div>
        <div className="stat-card stat-opex">
          <span>Released Back</span>
          <p>{formatMoney(totalReleased)}</p>
          <span className="stat-sub muted">From closed budgets</span>
        </div>
        <div className={`stat-card ${revenueRemaining <= 0 ? 'stat-warn' : 'stat-revenue'}`}>
          <span>Available Revenue</span>
          <p>{formatMoney(revenueRemaining)}</p>
        </div>
      </div>

      <div className="alert alert-info">
        Budgets draw from collected revenue. You can plan a budget for <strong>any year</strong> as long
        as revenue is available. Total across all plans cannot exceed <strong>{formatMoney(totalRevenue)}</strong>.
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>Create Annual Budget Plan</h3>
        <form className="form-grid form-wide" onSubmit={handleSubmit}>
          <label>Year
            <input
              type="number"
              min={minYear}
              max={maxYear}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              required
            />
          </label>
          <label>Total Budget
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatInputNumber(form.total_budget)}
              onChange={(e) =>
                setForm({ ...form, total_budget: formatInputNumber(e.target.value) })
              }
              required
            />
          </label>
          <button
            className="btn"
            type="submit"
            disabled={yearAlreadyExists || wouldExceedRevenue || totalRevenue <= 0}
          >
            {yearAlreadyExists
              ? `Plan for ${form.year} exists`
              : wouldExceedRevenue
              ? 'Exceeds available revenue'
              : 'Save Budget Plan'}
          </button>
        </form>
        {yearAlreadyExists && (
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            A plan for {form.year} already exists — pick a different year to create another plan.
          </p>
        )}
        {wouldExceedRevenue && !yearAlreadyExists && (
          <p className="error" style={{ marginTop: '0.5rem' }}>
            Proposed budget {formatMoney(proposedNum)} exceeds the {formatMoney(revenueRemaining)} of
            revenue still available.
          </p>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th className="text-right">Total Budget</th>
                <th className="text-right">Allocated</th>
                <th className="text-right">Spent</th>
                <th className="text-right">Remaining</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {budgets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '1.25rem' }}>
                    No budget plans yet.
                  </td>
                </tr>
              ) : budgets.map((b) => {
                const remainder = Math.max(0, Number(b.total_budget || 0) - Number(b.total_spent || 0));
                return (
                  <tr key={b.id}>
                    <td>{b.year}</td>
                    <td className="text-right">{formatMoney(b.total_budget)}</td>
                    <td className="text-right">{formatMoney(b.total_allocated)}</td>
                    <td className="text-right">{formatMoney(b.total_spent)}</td>
                    <td className="text-right"><strong>{formatMoney(remainder)}</strong></td>
                    <td>
                      {b.is_closed ? (
                        <span className="badge paid">Closed</span>
                      ) : (
                        <span className="badge active">Open</span>
                      )}
                    </td>
                    <td className="text-right">
                      {b.is_closed ? (
                        <button
                          type="button"
                          className="btn btn-sm secondary"
                          onClick={() => reopenBudget(b)}
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => closeBudget(b)}
                          title={`Release ${formatMoney(remainder)} back to revenue`}
                        >
                          Approve & Release
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
