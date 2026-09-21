import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

const emptyBudget = { year: new Date().getFullYear(), total_budget: '' };
const emptyLine = {
  budget: '',
  category: 'opex',
  description: '',
  allocated_amount: '',
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [budgetForm, setBudgetForm] = useState(emptyBudget);
  const [lineForm, setLineForm] = useState(emptyLine);
  const [error, setError] = useState('');

  const load = async () => {
    const [budgetRes, propertyRes] = await Promise.all([
      api.get('/budgets/budgets/'),
      api.get('/properties/properties/'),
    ]);
    setBudgets(budgetRes.data);
    setProperties(propertyRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const createBudget = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/budgets/budgets/', budgetForm);
      setBudgetForm(emptyBudget);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Failed to create budget'));
    }
  };

  const createLine = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/budgets/lines/', {
        budget: Number(lineForm.budget),
        category: lineForm.category,
        description: lineForm.description,
        allocated_amount: parseNumber(lineForm.allocated_amount),
      });
      setLineForm(emptyLine);
      load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || 'Failed to create budget line'));
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>Budget Planning</h2>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Create annual budget</h3>
          <form className="form-grid" onSubmit={createBudget}>
            <label>
              Year
              <input
                type="number"
                value={budgetForm.year}
                onChange={(e) => setBudgetForm({ ...budgetForm, year: e.target.value })}
                required
              />
            </label>
            <label>
              Total budget
              <input
                type="text"
                value={formatInputNumber(budgetForm.total_budget)}
                onChange={(e) => setBudgetForm({ ...budgetForm, total_budget: formatInputNumber(e.target.value) })}
                placeholder="0"
                required
              />
            </label>
            <button className="btn" type="submit">
              Save Budget
            </button>
          </form>
        </div>
        <div className="card">
          <h3>Add budget line</h3>
          <form className="form-grid" onSubmit={createLine}>
            <label>
              Budget year
              <select
                value={lineForm.budget}
                onChange={(e) => setLineForm({ ...lineForm, budget: e.target.value })}
                required
              >
                <option value="">Select budget</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={lineForm.category}
                onChange={(e) => setLineForm({ ...lineForm, category: e.target.value })}
              >
                <option value="opex">OPEX</option>
                <option value="capex">CAPEX</option>
              </select>
            </label>
            <label>
              Description
              <input
                value={lineForm.description}
                onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                required
              />
            </label>
            <label>
              Allocated amount
              <input
                type="text"
                value={formatInputNumber(lineForm.allocated_amount)}
                onChange={(e) => setLineForm({ ...lineForm, allocated_amount: formatInputNumber(e.target.value) })}
                placeholder="0"
                required
              />
            </label>
            <button className="btn" type="submit">
              Add Line
            </button>
          </form>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {budgets.map((budget) => (
        <div className="card" key={budget.id}>
          <h3>
            {budget.year} — Total {formatMoney(budget.total_budget)}
          </h3>
          <p className="muted">
            Allocated: {formatMoney(budget.total_allocated)} · Spent: {formatMoney(budget.total_spent)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Allocated</th>
                <th className="text-right">Spent</th>
              </tr>
            </thead>
            <tbody>
              {(budget.lines || []).map((line) => (
                <tr key={line.id}>
                  <td>{line.category.toUpperCase()}</td>
                  <td>{line.description}</td>
                  <td className="text-right">{formatMoney(line.allocated_amount)}</td>
                  <td className="text-right">{formatMoney(line.spent_amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
