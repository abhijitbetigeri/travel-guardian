import { useState, useEffect, useRef } from 'react';
import { getSafetyCheckins } from '../api';
import { WS_URL, SERVICE_KEY } from '../config';

export default function GuardianDashboard({ token, user }) {
  const [checkins, setCheckins] = useState([]);
  const [connected, setConnected] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    getSafetyCheckins('00000000-0000-0000-0000-000000000002').then(data => {
      setCheckins(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    const wsToken = token || SERVICE_KEY;
    const ws = new WebSocket(`${WS_URL}?token=${wsToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', table: 'safety_checkins' }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'change' && msg.op === 'INSERT') {
        setLiveAlerts(prev => [msg.record, ...prev]);
        setCheckins(prev => [msg.record, ...prev]);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, [token]);

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  };

  const statusColor = (status) => {
    switch (status) {
      case 'safe': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'emergency': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="guardian-page">
      <div className="guardian-header">
        <h1>🛡️ Guardian Dashboard</h1>
        <p>Monitor your traveler's safety check-ins in real-time</p>
        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot" />
          {connected ? 'Live — Receiving real-time updates' : 'Connecting...'}
        </div>
      </div>

      {liveAlerts.length > 0 && (
        <div className="live-alerts">
          <h3>🔔 New Check-ins</h3>
          {liveAlerts.map((alert, i) => (
            <div key={i} className="alert-card">
              <div className="alert-status" style={{ background: statusColor(alert.status) }}>
                {alert.status?.toUpperCase() || 'UNKNOWN'}
              </div>
              <div className="alert-body">
                <p className="alert-summary">{alert.ai_summary}</p>
                <p className="alert-time">{formatTime(alert.created_at)}</p>
                {alert.latitude && (
                  <p className="alert-coords">📍 {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="checkin-history">
        <h3>📋 Check-in History</h3>
        {checkins.length === 0 ? (
          <div className="empty-state">
            <p>No check-ins yet. Your traveler hasn't sent any safety updates.</p>
            <p className="hint">Check-ins will appear here in real-time when sent from the Explore page.</p>
          </div>
        ) : (
          <div className="checkin-list">
            {checkins.map((c, i) => (
              <div key={c.id || i} className="checkin-card">
                <div className="checkin-status" style={{ background: statusColor(c.status) }}>
                  {c.status?.toUpperCase() || 'SAFE'}
                </div>
                <div className="checkin-body">
                  <p className="checkin-summary">{c.ai_summary || 'No details available'}</p>
                  <div className="checkin-meta">
                    <span>{formatTime(c.created_at)}</span>
                    {c.latitude && <span>📍 {c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
