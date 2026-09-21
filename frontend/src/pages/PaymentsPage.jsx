import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

const empty = { invoice: '', amount_paid: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'Bank Transfer', reference_number: '' };

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [inv, pay] = await Promise.all([
      api.get('/invoices/invoices/'),
      api.get('/payments/payments/'),
    ]);
    setInvoices(inv.data.filter((i) => i.status !== 'paid'));
    setPayments(pay.data);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payments/payments/', {
        ...form,
        invoice: Number(form.invoice),
        amount_paid: parseNumber(form.amount_paid),
      });
      setMessage('Payment recorded. Invoice status updated.');
      setForm(empty);
      load();
    } catch (err) {
      setMessage(JSON.stringify(err.response?.data || 'Failed'));
    }
  };

  return (
    <>
      <div className="page-header"><h2>Record Payment</h2></div>
      {message && <p className="success">{message}</p>}
      <div className="card">
        <h3>Confirm Tenant Payment</h3>
        <form className="form-grid form-wide" onSubmit={handleSubmit}>
          <label>
            Search pending invoices
            <input
              placeholder="Search by number, tenant or amount"
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
            />
          </label>
          <label>
            Invoice
            <select value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} required>
              <option value="">Select pending invoice</option>
              {invoices.filter((i) => {
                const query = invoiceQuery.toLowerCase();
                return (
                  !query ||
                  i.invoice_number.toLowerCase().includes(query) ||
                  i.tenant_name?.toLowerCase().includes(query) ||
                  String(i.amount).includes(query)
                );
              }).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {i.tenant_name} — {formatMoney(i.amount)}
                </option>
              ))}
            </select>
          </label>
          <label>Amount Paid<input type="text" inputMode="decimal" placeholder="0" value={formatInputNumber(form.amount_paid)} onChange={(e) => setForm({ ...form, amount_paid: formatInputNumber(e.target.value) })} required /></label>
          <label>Payment Date<input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required /></label>
          <label>Method<input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} required /></label>
          <label>Reference<input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} required /></label>
          <button className="btn" type="submit">Confirm Payment</button>
        </form>
      </div>
      <div className="card">
        <h3>Payment History</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th className="text-right">Amount</th><th>Method</th><th>Reference</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}><td>{p.payment_date}</td><td className="text-right">{formatMoney(p.amount_paid)}</td><td>{p.payment_method}</td><td>{p.reference_number}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
