import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

export default function TenantInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showConfirmationForm, setShowConfirmationForm] = useState(false);
  const [confirmationData, setConfirmationData] = useState({
    invoice_number: '',
    amount_paid: '',
    payment_type: 'partial',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    payment_note: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/invoices/my-invoices/').then(({ data }) => setInvoices(data));
  }, []);

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowConfirmationForm(false);
    setMessage(null);
  };

  const handleCloseDetail = () => {
    setSelectedInvoice(null);
    setShowConfirmationForm(false);
    setConfirmationData({
      invoice_number: '',
      amount_paid: '',
      payment_type: 'partial',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      reference_number: '',
      payment_note: '',
    });
    setMessage(null);
  };

  const handleConfirmationChange = (e) => {
    const { name, value } = e.target;
    setConfirmationData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitConfirmation = async (e) => {
    e.preventDefault();
    const amountPaid = parseNumber(confirmationData.amount_paid);
    if (Number.isNaN(amountPaid) || amountPaid <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid amount.' });
      return;
    }

    // Use amount_due for validation (remaining balance, not total invoice amount)
    const amountDue = Number(selectedInvoice.amount_due || selectedInvoice.amount);
    
    if (confirmationData.payment_type === 'full' && amountPaid !== amountDue) {
      setMessage({ type: 'error', text: `Full payment must equal the remaining amount due: ${formatMoney(amountDue)}.` });
      return;
    }

    if (confirmationData.payment_type === 'partial' && amountPaid > amountDue) {
      setMessage({ type: 'error', text: `Payment cannot exceed the remaining amount due: ${formatMoney(amountDue)}.` });
      return;
    }

    // Cash payments have no transaction reference — force '-'. Other
    // methods need a real reference number for reconciliation.
    const isCash = confirmationData.payment_method === 'cash';
    const referenceToSend = isCash ? '-' : confirmationData.reference_number.trim();
    if (!isCash && !referenceToSend) {
      setMessage({
        type: 'error',
        text: `Reference number is required for ${confirmationData.payment_method}.`,
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        invoice: selectedInvoice.id,
        invoice_number: confirmationData.invoice_number || selectedInvoice.invoice_number,
        amount_paid: amountPaid,
        payment_type: confirmationData.payment_type,
        payment_date: confirmationData.payment_date,
        payment_method: confirmationData.payment_method,
        reference_number: referenceToSend,
        payment_note: confirmationData.payment_note,
      };

      await api.post('/payments/payment-confirmations/', payload);
      setMessage({ type: 'success', text: 'Payment confirmation submitted successfully! The lease officer will review it soon.' });
      
      // Reload invoices
      const { data } = await api.get('/invoices/my-invoices/');
      setInvoices(data);
      
      setTimeout(() => {
        setSelectedInvoice(null);
        setShowConfirmationForm(false);
        setMessage(null);
      }, 2000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to submit payment confirmation' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header"><h2>My Invoices</h2></div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Number</th><th>Property</th><th>Amount</th><th>Issue</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="muted">No invoices.</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoice_number}</td>
                  <td>{inv.property_name}</td>
                  <td>{formatMoney(inv.amount)}</td>
                  <td>{inv.issue_date}</td>
                  <td>{inv.due_date}</td>
                  <td><span className={`badge ${inv.status}`}>{inv.status}</span></td>
                  <td>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => handleViewInvoice(inv)}
                    >
                      View & Pay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <div className="modal-overlay" onClick={handleCloseDetail}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseDetail}>×</button>
            
            {!showConfirmationForm ? (
              <>
                <h3>Invoice Details</h3>
                <div className="form-grid">
                  <div>
                    <label>Invoice Number</label>
                    <p>{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <label>Property</label>
                    <p>{selectedInvoice.property_name}</p>
                  </div>
                  <div>
                    <label>Total Rent Amount</label>
                    <p>{formatMoney(selectedInvoice.amount)}</p>
                  </div>
                  <div>
                    <label>Amount Already Paid</label>
                    <p>{formatMoney(selectedInvoice.amount_paid || 0)}</p>
                  </div>
                  <div>
                    <label>Amount Due</label>
                    <p className="highlight-amount">{formatMoney(selectedInvoice.amount_due || selectedInvoice.amount)}</p>
                  </div>
                  <div>
                    <label>Issue Date</label>
                    <p>{selectedInvoice.issue_date}</p>
                  </div>
                  <div>
                    <label>Due Date</label>
                    <p>{selectedInvoice.due_date}</p>
                  </div>
                  <div>
                    <label>Status</label>
                    <p><span className={`badge ${selectedInvoice.status}`}>{selectedInvoice.status}</span></p>
                  </div>
                </div>
                
                {selectedInvoice.status !== 'paid' && (
                  <button 
                    className="btn primary" 
                    onClick={() => setShowConfirmationForm(true)}
                  >
                    Confirm Payment
                  </button>
                )}
              </>
            ) : (
              <>
                <h3>Confirm Payment for {selectedInvoice.invoice_number}</h3>
                {message && (
                  <div className={`alert alert-${message.type}`}>{message.text}</div>
                )}
                <form onSubmit={handleSubmitConfirmation} className="form-grid">
                  <div>
                    <label>Invoice Number</label>
                    <input
                      type="text"
                      name="invoice_number"
                      value={confirmationData.invoice_number || selectedInvoice.invoice_number}
                      onChange={handleConfirmationChange}
                      placeholder={selectedInvoice.invoice_number}
                      required
                    />
                  </div>
                  <div>
                    <label>Payment Type</label>
                    <select
                      name="payment_type"
                      value={confirmationData.payment_type}
                      onChange={handleConfirmationChange}
                      required
                    >
                      <option value="partial">Partial Amount</option>
                      <option value="full">Full Amount</option>
                    </select>
                  </div>
                  <div>
                    <label>Amount Paid</label>
                    <input
                      type="text"
                      name="amount_paid"
                      value={formatInputNumber(confirmationData.amount_paid)}
                      onChange={(e) => setConfirmationData(prev => ({ ...prev, amount_paid: formatInputNumber(e.target.value) }))}
                      placeholder={formatMoney(selectedInvoice.amount_due || selectedInvoice.amount)}
                      required
                    />
                    <small className="muted">Max amount: {formatMoney(selectedInvoice.amount_due || selectedInvoice.amount)}</small>
                  </div>
                  <div>
                    <label>Payment Date</label>
                    <input
                      type="date"
                      name="payment_date"
                      value={confirmationData.payment_date}
                      onChange={handleConfirmationChange}
                      required
                    />
                  </div>
                  <div>
                    <label>Payment Method</label>
                    <select
                      name="payment_method"
                      value={confirmationData.payment_method}
                      onChange={(e) => {
                        // Switching to cash clears the reference so a stale
                        // value from bank/mobile can't accidentally submit.
                        const newMethod = e.target.value;
                        setConfirmationData((prev) => ({
                          ...prev,
                          payment_method: newMethod,
                          reference_number: newMethod === 'cash' ? '' : prev.reference_number,
                        }));
                      }}
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="bank transfer">Bank Transfer</option>
                      <option value="mobile transfer">Mobile Transfer</option>
                    </select>
                  </div>
                  {/* Cash has no transaction reference, so hide the field
                      entirely. Bank/Mobile transfers must supply one. */}
                  {confirmationData.payment_method !== 'cash' && (
                    <div>
                      <label>Invoice/Transaction Reference</label>
                      <input
                        type="text"
                        name="reference_number"
                        value={confirmationData.reference_number}
                        onChange={handleConfirmationChange}
                        placeholder={
                          confirmationData.payment_method === 'bank transfer'
                            ? 'Bank slip / transaction ID'
                            : 'M-Pesa/Airtel transaction ID'
                        }
                        required
                      />
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>Additional Note</label>
                    <textarea
                      name="payment_note"
                      value={confirmationData.payment_note}
                      onChange={handleConfirmationChange}
                      rows="3"
                      placeholder="Add any extra payment details"
                    />
                  </div>
                  <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
                    <button 
                      type="submit" 
                      className="btn primary"
                      disabled={loading}
                    >
                      {loading ? 'Submitting...' : 'Submit Payment Confirmation'}
                    </button>
                    <button 
                      type="button" 
                      className="btn secondary"
                      onClick={() => setShowConfirmationForm(false)}
                    >
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #64748b;
        }
        .modal-close:hover {
          color: #1e293b;
        }
        .form-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .alert {
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }
        .alert-success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #6ee7b7;
        }
        .alert-error {
          background-color: #fee2e2;
          color: #7f1d1d;
          border: 1px solid #fca5a5;
        }
      `}</style>
    </>
  );
}
