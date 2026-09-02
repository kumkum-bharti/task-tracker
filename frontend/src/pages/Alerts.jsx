import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { BellOff, Eye, Clock } from 'lucide-react';
import '../Dashboard.css'; // Reusing some table container styles

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchAlerts = async () => {
    try {
      const res = await client.get('/alerts');
      setAlerts(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    const handleTaskUpdated = () => {
      fetchAlerts();
    };

    window.addEventListener('task-updated', handleTaskUpdated);
    return () => window.removeEventListener('task-updated', handleTaskUpdated);
  }, []);

  const handleDismiss = async (taskId) => {
    try {
      await client.post(`/alerts/${taskId}/dismiss`);
      // Update local state immediately
      setAlerts(prev => prev.filter(a => a.taskId !== taskId));
      // Dispatch event so AlertBell updates
      window.dispatchEvent(new Event('task-updated'));
    } catch (err) {
      setError('Failed to dismiss alert.');
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading Alerts...</div>;

  return (
    <div className="dashboard-container" style={{ maxWidth: '900px' }}>
      <h1 className="dashboard-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Clock className="metric-warning" size={32} /> Overdue Tasks
      </h1>

      {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

      <div className="table-container">
        <table className="workload-table">
          <thead>
            <tr>
              <th>Task Title</th>
              <th>Project</th>
              <th>Due Date</th>
              <th>Days Overdue</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text)' }}>
                  You're all caught up! No overdue tasks.
                </td>
              </tr>
            ) : (
              alerts.map(alert => (
                <tr key={alert.taskId}>
                  <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>{alert.taskTitle}</td>
                  <td>{alert.projectName}</td>
                  <td>{new Date(alert.dueDate).toLocaleDateString()}</td>
                  <td>
                    <span style={{ 
                      background: 'rgba(220, 38, 38, 0.1)', 
                      color: '#ef4444', 
                      padding: '4px 8px', 
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {alert.daysOverdue} {alert.daysOverdue === 1 ? 'day' : 'days'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-secondary" 
                        title="View Task"
                        onClick={() => navigate(`/projects/${alert.projectId}`)}
                        style={{ padding: '6px', display: 'flex', alignItems: 'center' }}
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="btn-primary" 
                        title="Dismiss Alert"
                        onClick={() => handleDismiss(alert.taskId)}
                        style={{ padding: '6px', display: 'flex', alignItems: 'center', background: '#ef4444' }}
                      >
                        <BellOff size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
