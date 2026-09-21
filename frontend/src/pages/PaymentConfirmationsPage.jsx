import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { formatInputNumber, formatMoney, parseNumber } from '../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentConfirmationsPage() {
  const [confirmations, setConfirmations] = useState([]);
  const [selectedConfirmation, setSelectedConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Cash payment (officer records offline payment for a tenant)
  const [showCashModal, setShowCashModal] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [cashForm, setCashForm] = useState({
    invoice: '',
    amount_paid: '',
    payment_date: today(),
    payment_method: 'cash',
    reference_number: '',
    payment_note: '',
  });
  const [cashSaving, setCashSaving] = useState(false);
  const [cashMessage, setCashMessage] = useState(null);
  const isCash = cashForm.payment_method === 'cash';

  useEffect(() => {
    loadConfirmations();
  }, []);

  const loadConfirmations = () => {
    api.get('/payments/payment-confirmations/').then(({ data }) => setConfirmations(data));
  };

  const openCashModal = async () => {
    setShowCashModal(true);
    setCashMessage(null);
    setCashForm({
      invoice: '',
      amount_paid: '',
      payment_date: today(),
      payment_method: 'cash',
      reference_number: '',
      payment_note: '',
    });
    try {
      const { data } = await api.get('/invoices/invoices/');
      // Only invoices that still owe something
      setInvoices((data || []).filter((i) => i.status !== 'paid'));
    } catch {
      setInvoices([]);
    }
  };

  const closeCashModal = () => {
    setShowCashModal(false);
    setCashMessage(null);
  };

  const selectedInvoice = useMemo(
    () => invoices.find((i) => String(i.id) === String(cashForm.invoice)),
    [invoices, cashForm.invoice],
  );

  const submitCashPayment = async (e) => {
    e.preventDefault();
    // Cash never has a transaction reference — force '-'. Non-cash methods
    // must supply a real reference.
    const referenceToSend = isCash ? '-' : cashForm.reference_number.trim();
    if (!isCash && !referenceToSend) {
      setCashMessage({
        type: 'error',
        text: `Reference number is required for ${cashForm.payment_method}.`,
      });
      return;
    }
    setCashSaving(true);
    setCashMessage(null);
    try {
      await api.post('/payments/payment-confirmations/record_cash_payment/', {
        invoice: cashForm.invoice,
        amount_paid: parseNumber(cashForm.amount_paid),
        payment_date: cashForm.payment_date,
        payment_method: cashForm.payment_method,
        reference_number: referenceToSend,
        payment_note: cashForm.payment_note,
      });
      setCashMessage({
        type: 'success',
        text: `${cashForm.payment_method[0].toUpperCase() + cashForm.payment_method.slice(1)} payment recorded successfully.`,
      });
      setTimeout(() => {
        closeCashModal();
        loadConfirmations();
      }, 1200);
    } catch (err) {
      setCashMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to record payment.',
      });
    } finally {
      setCashSaving(false);
    }
  };

  const handleViewDetails = (confirmation) => {
    setSelectedConfirmation(confirmation);
    setMessage(null);
  };

  const handleCloseDetail = () => {
    setSelectedConfirmation(null);
    setMessage(null);
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    try {
      await api.post(`/payments/payment-confirmations/${selectedConfirmation.id}/confirm_payment/`);
      setMessage({ type: 'success', text: 'Payment confirmed successfully!' });
      
      setTimeout(() => {
        handleCloseDetail();
        loadConfirmations();
      }, 1500);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to confirm payment' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!window.confirm('Are you sure you want to reject this payment confirmation?')) {
      return;
    }

    setLoading(true);
    try {
      await api.post(`/payments/payment-confirmations/${selectedConfirmation.id}/reject_payment/`);
      setMessage({ type: 'success', text: 'Payment confirmation rejected.' });
      
      setTimeout(() => {
        handleCloseDetail();
        loadConfirmations();
      }, 1500);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to reject payment' 
      });
    } finally {
      setLoading(false);
    }
  };

  const pendingConfirmations = confirmations.filter(c => c.status === 'pending');
  const processedConfirmations = confirmations.filter(c => c.status !== 'pending');

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Payment Confirmations</h2>
          <p className="page-subtitle">Review tenant-submitted payments. Confirming or rejecting sends the tenant an email.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={openCashModal}>+ Record Payment</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Pending Confirmations</span>
          <p>{pendingConfirmations.length}</p>
        </div>
        <div className="stat-card">
          <span>Total Confirmations</span>
          <p>{confirmations.length}</p>
        </div>
      </div>

      {pendingConfirmations.length > 0 && (
        <div className="card">
          <h3>Pending Payment Confirmations</h3>
          <p className="muted">Tenants have submitted payment confirmations that need your review.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Tenant</th>
                  <th>Amount</th>
                  <th>Payment Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingConfirmations.map((conf) => (
                  <tr key={conf.id}>
                    <td>{conf.invoice_number_display || conf.invoice_number || '—'}</td>
                    <td>{conf.tenant_name}</td>
                    <td>{formatMoney(conf.amount_paid)}</td>
                    <td>{conf.payment_date}</td>
                    <td>{conf.payment_method}</td>
                    <td>{conf.reference_number}</td>
                    <td>{conf.created_at}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleViewDetails(conf)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {processedConfirmations.length > 0 && (
        <div className="card">
          <h3>Processed Confirmations</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Tenant</th>
                  <th className="text-right">Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Processed By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {processedConfirmations.map((conf) => (
                  <tr key={conf.id}>
                    <td>{conf.invoice_number_display || conf.invoice_number || '—'}</td>
                    <td>{conf.tenant_name}</td>
                    <td className="text-right">{formatMoney(conf.amount_paid)}</td>
                    <td>{conf.payment_method}</td>
                    <td className="text-mono">{conf.reference_number || '—'}</td>
                    <td>
                      <span className={`badge ${conf.status}`}>
                        {conf.status}
                      </span>
                    </td>
                    <td>{conf.confirmed_by_name}</td>
                    <td>{conf.confirmed_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedConfirmation && (
        <div className="modal-overlay" onClick={handleCloseDetail}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseDetail}>×</button>
            
            <h3>Review Payment Confirmation</h3>
            
            {message && (
              <div className={`alert alert-${message.type}`}>{message.text}</div>
            )}

            <div className="form-grid">
              <div>
                <label>Invoice Number</label>
                <p><strong>{selectedConfirmation.invoice_number_display || selectedConfirmation.invoice_number}</strong></p>
              </div>
              <div>
                <label>Tenant</label>
                <p><strong>{selectedConfirmation.tenant_name}</strong></p>
              </div>
              <div>
                <label>Property</label>
                <p><strong>{selectedConfirmation.property_name}</strong></p>
              </div>
              <div>
                <label>Amount Paid</label>
                <p><strong>{formatMoney(selectedConfirmation.amount_paid)}</strong></p>
              </div>
              <div>
                <label>Payment Date</label>
                <p><strong>{selectedConfirmation.payment_date}</strong></p>
              </div>
              <div>
                <label>Payment Type</label>
                <p><strong>{selectedConfirmation.payment_type === 'full' ? 'Full Amount' : 'Partial Amount'}</strong></p>
              </div>
              <div>
                <label>Payment Method</label>
                <p><strong>{selectedConfirmation.payment_method}</strong></p>
              </div>
              <div>
                <label>Invoice/Transaction Reference</label>
                <p><strong>{selectedConfirmation.reference_number}</strong></p>
              </div>
              <div>
                <label>Reference</label>
                <p><strong>{selectedConfirmation.reference_number}</strong></p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Additional Note</label>
                <p><strong>{selectedConfirmation.payment_note || '—'}</strong></p>
              </div>
              <div>
                <label>Status</label>
                <p>
                  <span className={`badge ${selectedConfirmation.status}`}>
                    {selectedConfirmation.status}
                  </span>
                </p>
              </div>
              <div>
                <label>Submitted On</label>
                <p><strong>{selectedConfirmation.created_at}</strong></p>
              </div>
            </div>

            {selectedConfirmation.status === 'pending' && (
              <div className="form-actions">
                <button
                  className="btn primary"
                  onClick={handleConfirmPayment}
                  disabled={loading}
                >
                  {loading ? 'Confirming...' : 'Confirm Payment'}
                </button>
                <button
                  className="btn danger"
                  onClick={handleRejectPayment}
                  disabled={loading}
                >
                  {loading ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  className="btn secondary"
                  onClick={handleCloseDetail}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="modal-overlay" onClick={closeCashModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeCashModal}>×</button>
            <h3>Record Payment</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Record a payment for a tenant who cannot submit their own confirmation.
              Choose the method used. Cash has no transaction reference; bank and mobile
              transfers require the reference from the receipt.
            </p>

            {cashMessage && (
              <div className={`alert alert-${cashMessage.type}`}>{cashMessage.text}</div>
            )}

            <form onSubmit={submitCashPayment} className="form-grid">
              <label>
                Invoice
                <select
                  value={cashForm.invoice}
                  onChange={(e) => setCashForm({ ...cashForm, invoice: e.target.value })}
                  required
                >
                  <option value="">Select an unpaid invoice…</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.tenant_name} — {formatMoney(inv.total_rent ?? inv.amount)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedInvoice && (
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  Tenant: <strong>{selectedInvoice.tenant_name}</strong> · Property:{' '}
                  <strong>{selectedInvoice.property_name}</strong> · Billed:{' '}
                  <strong>{formatMoney(selectedInvoice.total_rent ?? selectedInvoice.amount)}</strong>
                </div>
              )}

              <label>
                Amount Paid
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatInputNumber(cashForm.amount_paid)}
                  onChange={(e) =>
                    setCashForm({ ...cashForm, amount_paid: formatInputNumber(e.target.value) })
                  }
                  required
                />
              </label>

              <label>
                Payment Date
                <input
                  type="date"
                  value={cashForm.payment_date}
                  onChange={(e) => setCashForm({ ...cashForm, payment_date: e.target.value })}
                  required
                />
              </label>

              <label>
                Payment Method
                <select
                  value={cashForm.payment_method}
                  onChange={(e) =>
                    setCashForm({
                      ...cashForm,
                      payment_method: e.target.value,
                      // Clear any stale reference when switching to cash so
                      // the user can't accidentally submit an old value.
                      reference_number: e.target.value === 'cash' ? '' : cashForm.reference_number,
                    })
                  }
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="bank transfer">Bank Transfer</option>
                  <option value="mobile transfer">Mobile Transfer</option>
                </select>
              </label>

              <label>
                Reference Number
                {isCash ? (
                  <input
                    value="-"
                    readOnly
                    disabled
                    title="Cash payments have no transaction reference"
                    style={{ background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={cashForm.reference_number}
                    onChange={(e) =>
                      setCashForm({ ...cashForm, reference_number: e.target.value })
                    }
                    placeholder={
                      cashForm.payment_method === 'bank transfer'
                        ? 'e.g. bank slip / transaction ID'
                        : 'e.g. M-Pesa/Airtel transaction ID'
                    }
                    required
                  />
                )}
              </label>

              <label style={{ gridColumn: '1 / -1' }}>
                Note (optional)
                <textarea
                  rows={2}
                  value={cashForm.payment_note}
                  onChange={(e) => setCashForm({ ...cashForm, payment_note: e.target.value })}
                  placeholder="e.g. Received cash at office, receipt #123"
                />
              </label>

              <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn" disabled={cashSaving}>
                  {cashSaving ? 'Recording…' : 'Record Payment'}
                </button>
                <button type="button" className="btn secondary" onClick={closeCashModal}>
                  Cancel
                </button>
              </div>
            </form>
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
          max-width: 600px;
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
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .btn.danger {
          background-color: #dc2626;
          color: white;
        }
        .btn.danger:hover {
          background-color: #b91c1c;
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
