import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { X, Calendar, User, Clock } from 'lucide-react';

export default function TaskDetailModal({ task, isOpen, onClose, onError }) {
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (isOpen && task) {
      client.get(`/tasks/${task.id}/timeline`)
        .then(res => setTimeline(res.data))
        .catch(err => onError("Failed to load timeline"));
    }
  }, [isOpen, task, onError]);

  if (!isOpen || !task) return null;

  const renderTimeline = () => {
    if (timeline.length === 0) return <p>No timeline events found.</p>;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {timeline.map(event => (
          <div key={event.id} style={{ fontSize: '13px', padding: '8px', background: 'var(--social-bg)', borderRadius: '8px' }}>
            <strong>{event.actor?.name || 'Unknown'}</strong> {event.eventType.replace('_', ' ').toLowerCase()}
            <span style={{ color: 'var(--text)', marginLeft: '8px', fontSize: '11px' }}>
              {new Date(event.createdAt).toLocaleString()}
            </span>
            {event.details && (
              <div style={{ marginTop: '4px', color: 'var(--text)' }}>
                {JSON.stringify(event.details)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <dialog open style={{ zIndex: 100, maxWidth: '700px' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">{task.title}</h2>
            <button className="modal-close" onClick={onClose}><X size={24} /></button>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <button 
              style={{ background: 'transparent', border: 'none', padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'details' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'details' ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button 
              style={{ background: 'transparent', border: 'none', padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'timeline' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'timeline' ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </div>

          <div style={{ minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
            {activeTab === 'details' && (
              <div>
                <p style={{ whiteSpace: 'pre-wrap', marginBottom: '24px' }}>{task.description || 'No description provided.'}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--social-bg)', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>STATUS</span>
                    <div style={{ marginTop: '4px', fontWeight: 500 }}>{task.status.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>PRIORITY</span>
                    <div style={{ marginTop: '4px', fontWeight: 500 }}>{task.priority}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>DUE DATE</span>
                    <div style={{ marginTop: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>ASSIGNEES</span>
                    <div style={{ marginTop: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={14} /> {task.assignees?.map(a => a.user.name).join(', ') || 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'timeline' && renderTimeline()}
          </div>
        </div>
      </dialog>
    </>
  );
}
