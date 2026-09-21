import { useEffect, useState } from 'react';
import api from '../api/client';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [externalAssets, setExternalAssets] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadLocal = async () => {
    const { data } = await api.get('/properties/buildings/');
    const list = Array.isArray(data) ? data : (data?.results ?? []);
    setProperties(list);
  };

  useEffect(() => {
    loadLocal();
  }, []);

  const fetchExternal = async () => {
    setError('');
    setMessage('');
    try {
      const { data } = await api.get('/integration/external/assets/');
      const items = Array.isArray(data) ? data : data.results || [];
      setExternalAssets(items);
      setMessage(`Fetched ${items.length} assets from valuation module.`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reach external asset API.');
    }
  };

  const syncAssets = async () => {
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/integration/sync/assets/');
      setMessage(`Synced ${data.total_synced} assets (${data.created} new, ${data.updated} updated).`);
      loadLocal();
    } catch (err) {
      setError(err.response?.data?.detail || 'Sync failed.');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Assets / Properties</h2>
          <p className="page-subtitle">Registered buildings available for leasing.</p>
        </div>
      </div>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="card">
        <div className="card-header-row">
          <div className="card-title-block">
            <h3>Local registered assets</h3>
            <span className="card-subtitle">{properties.length} building{properties.length === 1 ? '' : 's'} registered</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Available for lease</th>
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>No properties registered.</td></tr>
              ) : properties.map((p) => (
                <tr key={p.id}>
                  <td className="text-mono">{p.asset_code}</td>
                  <td>{p.asset_name || p.name}</td>
                  <td>{p.location || '—'}</td>
                  <td>
                    <span className={`badge ${p.available_for_lease ? 'active' : ''}`}>
                      {p.available_for_lease ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {externalAssets.length > 0 && (
        <div className="card">
          <h3>External assets (Developer 1 — Asset Valuation)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {externalAssets.map((a, idx) => (
                  <tr key={a.id || idx}>
                    <td className="text-mono">{a.asset_code || a.code || a.id}</td>
                    <td>{a.asset_name || a.name}</td>
                    <td>{a.location || '—'}</td>
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
