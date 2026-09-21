import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

const emptyLine = { budget: '', category: 'opex', description: '', allocated_amount: '' };

export default function BudgetLinesPage() {
  const [budgets, setBudgets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [lines, setLines] = useState([]);
  const [form, setForm] = useState(emptyLine);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [b, p, l] = await Promise.all([
      api.get('/budgets/budgets/'),
      api.get('/properties/properties/'),
      api.get('/budgets/lines/', { params: filter ? { budget: filter } : {} }),
    ]);
    setBudgets(b.data);
    setProperties(p.data);
    setLines(l.data);
  };

  useEffect(() => { load(); }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/budgets/lines/', {
        budget: Number(form.budget),
        category: form.category,
        description: form.description,
        allocated_amount: parseNumber(form.allocated_amount),
      });
      setForm(emptyLine);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Failed'));
    }
  };

  return (
    <>
      <div className="page-header"><h2>Budget Lines (OPEX / CAPEX)</h2></div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <h3>Add Budget Line</h3>
        <form className="form-grid form-wide" onSubmit={handleSubmit}>
          <label>Budget<select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} required>
            <option value="">Select</option>{budgets.map((b) => <option key={b.id} value={b.id}>{b.year}</option>)}
          </select></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="opex">OPEX</option><option value="capex">CAPEX</option>
          </select></label>
          <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
          <label>Allocated Amount<input type="text" value={formatInputNumber(form.allocated_amount)} onChange={(e) => setForm({ ...form, allocated_amount: formatInputNumber(e.target.value) })} placeholder="0" required /></label>
          <button className="btn" type="submit">Add Line</button>
        </form>
      </div>
      <div className="card">
        <div className="toolbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All budgets</option>
            {budgets.map((b) => <option key={b.id} value={b.id}>{b.year}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Description</th><th className="text-right">Allocated</th><th className="text-right">Spent</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td><span className={`badge ${l.category}`}>{l.category.toUpperCase()}</span></td>
                  <td>{l.description}</td>
                  <td className="text-right">{formatMoney(l.allocated_amount)}</td>
                  <td className="text-right">{formatMoney(l.spent_amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
