import { useEffect, useState } from 'react';
import api from '../api/client';

export default function TenantNotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  const load = () => {
    api.get('/notifications/').then(({ data }) => setNotifications(data));
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/`, { is_read: true });
    load();
  };

  return (
    <>
      <div className="page-header">
        <h2>Notifications</h2>
      </div>
      <div className="card">
        {notifications.length === 0 ? (
          <p className="muted">No notifications.</p>
        ) : (
          <ul className="notification-list">
            {notifications.map((n) => (
              <li key={n.id} className={n.is_read ? 'read' : 'unread'}>
                <div className="notification-row">
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <small className="muted">{new Date(n.created_at).toLocaleString()}</small>
                  </div>
                  {!n.is_read && (
                    <button className="btn secondary btn-sm" type="button" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
