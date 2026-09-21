import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatMoney } from '../utils/format';

async function downloadContract(id) {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`/api/leases/my-contracts/${id}/download-contract/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lease_${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TenantContractsPage() {
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    api.get('/leases/my-contracts/').then(({ data }) => setContracts(data));
  }, []);

  return (
    <>
      <div className="page-header"><h2>My Lease Contracts</h2></div>
      <div className="contract-grid">
        {contracts.length === 0 ? (
          <div className="card"><p className="muted">No contracts yet.</p></div>
        ) : contracts.map((c) => (
          <article className="contract-card" key={c.id}>
            <div className="contract-header">
              <h3>{c.lease_number || `#${c.id}`}</h3>
              <span className={`badge ${c.status}`}>{c.status}</span>
            </div>
            <dl>
              <div><dt>Property</dt><dd>{c.property_name}</dd></div>
              <div><dt>Unit</dt><dd>{c.unit_description || c.unit_number || 'Whole property'}</dd></div>
              <div><dt>Period</dt><dd>{c.start_date} → {c.end_date}</dd></div>
              <div><dt>Monthly Rent</dt><dd>{formatMoney(c.monthly_rent)}</dd></div>
              <div><dt>Total Rent</dt><dd>{formatMoney(c.total_rent)}</dd></div>
              <div><dt>Bank Name</dt><dd>{c.bank_name || '—'}</dd></div>
              <div><dt>Account Number</dt><dd>{c.bank_account_number || '—'}</dd></div>
            </dl>
            <button className="btn btn-sm" type="button" onClick={() => downloadContract(c.id)}>Download Agreement</button>
          </article>
        ))}
      </div>
    </>
  );
}
