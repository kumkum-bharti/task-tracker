import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, User, Clock, Trash2 } from 'lucide-react';

export default function TaskDetailModal({ task, isOpen, onClose, onUpdate, onError }) {
  const { user } = useAuth();
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [deleting, setDeleting] = useState(false);

  const [projectMembers, setProjectMembers] = useState([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      client.get(`/tasks/${task.id}/timeline`)
        .then(res => setTimeline(res.data))
        .catch(err => onError("Failed to load timeline"));

      // Fetch project to get member list for assignment
      client.get('/projects')
        .then(res => {
          const proj = res.data.find(p => p.id === task.projectId);
          if (proj) {
            const members = [proj.owner, ...(proj.members?.map(m => m.user) || [])];
            // Deduplicate owner/members
            const uniqueMembers = Array.from(new Map(members.map(m => [m.id, m])).values());
            setProjectMembers(uniqueMembers);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, task, onError]);

  const handleAddAssignee = async (userId) => {
    if (!userId) return;
    try {
      await client.post(`/tasks/${task.id}/assignees`, { userId: parseInt(userId) });
      setSelectedAssigneeId('');
      if (onUpdate) onUpdate();
      window.dispatchEvent(new Event('task-updated'));
    } catch (err) {
      onError(err.response?.data?.error || "Failed to add assignee");
    }
  };

  const handleRemoveAssignee = async (userId) => {
    try {
      await client.delete(`/tasks/${task.id}/assignees/${userId}`);
      if (onUpdate) onUpdate();
      window.dispatchEvent(new Event('task-updated'));
    } catch (err) {
      onError(err.response?.data?.error || "Failed to remove assignee");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete task "${task.title}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await client.delete(`/tasks/${task.id}`);
      window.dispatchEvent(new Event('task-updated'));
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
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

            {user?.role === 'MANAGER' && (
              <button 
                onClick={handleDelete} 
                disabled={deleting}
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete Task'}
              </button>
            )}
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
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>ASSIGNEES</span>
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {task.assignees && task.assignees.length > 0 ? (
                        task.assignees.map(a => (
                          <span 
                            key={a.user.id} 
                            style={{ 
                              background: 'var(--bg)', 
                              border: '1px solid var(--border)', 
                              padding: '4px 10px', 
                              borderRadius: '16px', 
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: 'var(--text-h)'
                            }}
                          >
                            <User size={12} /> {a.user.name}
                            <button 
                              onClick={() => handleRemoveAssignee(a.user.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: '14px', fontWeight: 'bold' }}
                              title="Unassign User"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--text)' }}>Unassigned</span>
                      )}
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        className="input-glass" 
                        style={{ fontSize: '13px', padding: '6px 10px', minWidth: '200px' }}
                        value={selectedAssigneeId}
                        onChange={e => setSelectedAssigneeId(e.target.value)}
                      >
                        <option value="">Select project member...</option>
                        {projectMembers
                          .filter(pm => !task.assignees?.some(a => a.user.id === pm.id))
                          .map(pm => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                          ))
                        }
                      </select>
                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ fontSize: '13px', padding: '6px 14px' }}
                        disabled={!selectedAssigneeId}
                        onClick={() => handleAddAssignee(selectedAssigneeId)}
                      >
                        Assign Member
                      </button>
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
