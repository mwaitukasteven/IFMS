import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, parseNumber, formatMoney } from '../utils/format';

export default function ExpensesPage() {
  const [budgets, setBudgets] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState('');
  const [editingLine, setEditingLine] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (budgetId = null) => {
    try {
      // Show budgets for every year — expenses aren't tied to the current
      // calendar year (a lease officer may still be closing out prior years).
      const [budgetRes, linesRes] = await Promise.all([
        api.get('/budgets/budgets/'),
        budgetId ? api.get('/budgets/lines/', { params: { budget: budgetId } }) : Promise.resolve({ data: [] }),
      ]);

      // Newest year first so the current period is at the top.
      const allBudgets = [...(budgetRes.data || [])].sort((a, b) => b.year - a.year);
      setBudgets(allBudgets);

      if (budgetId) {
        setLines(linesRes.data);
      } else {
        setLines([]);
      }
    } catch (err) {
      setError('Failed to load budgets');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleBudgetChange = (e) => {
    const budgetId = e.target.value;
    setSelectedBudget(budgetId);
    setError('');
    setMessage('');
    setEditingLine(null);
    if (budgetId) {
      load(budgetId);
    } else {
      setLines([]);
    }
  };

  const handleEditExpense = (line) => {
    setEditingLine(line.id);
    setExpenseAmount(formatInputNumber(String(line.spent_amount)));
    setError('');
    setMessage('');
  };

  const handleCancelEdit = () => {
    setEditingLine(null);
    setExpenseAmount('');
    setError('');
  };

  const handleSaveExpense = async () => {
    const amount = parseNumber(expenseAmount);
    
    if (amount < 0) {
      setError('Expense amount cannot be negative');
      return;
    }

    const line = lines.find(l => l.id === editingLine);
    if (!line) {
      setError('Budget line not found');
      return;
    }

    if (amount > line.allocated_amount) {
      setError(`Expense (${formatMoney(amount)}) cannot exceed allocated amount (${formatMoney(line.allocated_amount)})`);
      return;
    }

    try {
      await api.patch(`/budgets/lines/${editingLine}/`, {
        spent_amount: amount,
      });
      setMessage('Expense recorded successfully');
      setEditingLine(null);
      setExpenseAmount('');
      load(selectedBudget);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save expense');
    }
  };

  const calculateRemaining = (line) => {
    return line.allocated_amount - line.spent_amount;
  };

  const calculatePercentage = (line) => {
    if (line.allocated_amount === 0) return 0;
    return (line.spent_amount / line.allocated_amount) * 100;
  };

  return (
    <>
      <div className="page-header">
        <h2>Record Expenses</h2>
        <p className="muted">Add actual spending amounts to allocated budget lines</p>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="card">
        <div className="toolbar">
          <select value={selectedBudget} onChange={handleBudgetChange}>
            <option value="">Select a budget year</option>
            {budgets.length === 0 && (
              <option value="" disabled>No budget plans found</option>
            )}
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                Year {b.year} — Total {formatMoney(b.total_budget)}{b.is_closed ? ' (closed)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedBudget && lines.length > 0 && (
          <div className="budget-summary">
            <div className="summary-item">
              <span>Total Allocated:</span>
              <strong>
                {formatMoney(lines.reduce((sum, l) => sum + Number(l.allocated_amount), 0))}
              </strong>
            </div>
            <div className="summary-item">
              <span>Total Spent:</span>
              <strong>
                {formatMoney(lines.reduce((sum, l) => sum + Number(l.spent_amount), 0))}
              </strong>
            </div>
            <div className="summary-item">
              <span>Total Remaining:</span>
              <strong>
                {formatMoney(lines.reduce((sum, l) => sum + calculateRemaining(l), 0))}
              </strong>
            </div>
          </div>
        )}
      </div>

      {selectedBudget && lines.length === 0 && (
        <div className="card">
          <p className="muted">No budget lines found for this budget.</p>
        </div>
      )}

      {selectedBudget && lines.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Allocated</th>
                  <th>Spent</th>
                  <th>Remaining</th>
                  <th>Progress</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className={editingLine === line.id ? 'row-editing' : ''}>
                    <td>
                      <span className={`badge ${line.category}`}>
                        {line.category.toUpperCase()}
                      </span>
                    </td>
                    <td>{line.description}</td>
                    <td>{formatMoney(line.allocated_amount)}</td>
                    <td>
                      {editingLine === line.id ? (
                        <input
                          type="text"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(formatInputNumber(e.target.value))}
                          placeholder="0"
                          autoFocus
                        />
                      ) : (
                        formatMoney(line.spent_amount)
                      )}
                    </td>
                    <td className={calculateRemaining(line) <= 0 ? 'text-danger' : ''}>
                      {formatMoney(Math.max(0, calculateRemaining(line)))}
                    </td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, calculatePercentage(line))}%`,
                            backgroundColor:
                              calculatePercentage(line) > 100 ? '#ef4444' :
                              calculatePercentage(line) > 80 ? '#f59e0b' :
                              '#10b981'
                          }}
                        />
                        <span className="progress-text">
                          {calculatePercentage(line).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      {editingLine === line.id ? (
                        <div className="actions">
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={handleSaveExpense}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-sm secondary"
                            type="button"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-sm secondary"
                          type="button"
                          onClick={() => handleEditExpense(line)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
