import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AlertBell() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchAlerts = async () => {
    if (!user) return;
    try {
      const res = await client.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const handleTaskUpdated = () => {
      fetchAlerts();
    };

    window.addEventListener('task-updated', handleTaskUpdated);
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('task-updated', handleTaskUpdated);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user]);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const activeCount = alerts.length;
  const previewAlerts = alerts.slice(0, 3);

  return (
    <div className="alert-bell-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        onClick={toggleDropdown}
        className="alert-bell-btn"
        style={{ 
          background: 'transparent', 
          border: 'none', 
          cursor: 'pointer', 
          position: 'relative',
          padding: '8px',
          color: 'var(--text-h)'
        }}
      >
        <Bell size={24} />
        {activeCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: '#ef4444',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg)'
          }}>
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          width: '300px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow)',
          zIndex: 50,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '8px'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-h)' }}>
            Notifications
          </div>
          
          {previewAlerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text)' }}>
              No active alerts.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {previewAlerts.map(alert => (
                <div 
                  key={alert.taskId} 
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/projects/${alert.projectId}`);
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--social-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 500, color: 'var(--text-h)', marginBottom: '4px' }}>{alert.taskTitle}</div>
                  <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>
                    {alert.daysOverdue} {alert.daysOverdue === 1 ? 'day' : 'days'} overdue
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link 
            to="/alerts" 
            onClick={() => setIsOpen(false)}
            style={{ 
              display: 'block', 
              padding: '12px', 
              textAlign: 'center', 
              textDecoration: 'none', 
              color: 'var(--accent)',
              fontWeight: 500,
              background: 'var(--social-bg)'
            }}
          >
            View all alerts
          </Link>
        </div>
      )}
    </div>
  );
}
