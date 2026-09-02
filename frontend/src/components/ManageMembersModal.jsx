import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2 } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ManageMembersModal({ isOpen, onClose, project, onUpdated, onError }) {
  const { user } = useAuth();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.role === 'MANAGER') {
      fetchAvailableUsers();
    }
  }, [isOpen, user]);

  const fetchAvailableUsers = async () => {
    try {
      const res = await client.get('/users');
      // Filter out users already in the project
      const currentMemberIds = project?.members?.map(m => m.user.id) || [];
      const filtered = res.data.filter(u => 
        !currentMemberIds.includes(u.id) && 
        u.id !== project.owner.id
      );
      setAvailableUsers(filtered);
    } catch (err) {
      onError('Failed to load available users');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    
    setLoading(true);
    try {
      await client.post(`/projects/${project.id}/members`, { userId: selectedUserId });
      await onUpdated();
      setSelectedUserId('');
      await fetchAvailableUsers();
    } catch (err) {
      onError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member from the project? This will also unassign them from all tasks in this project.")) {
      return;
    }
    
    setLoading(true);
    try {
      await client.delete(`/projects/${project.id}/members/${userId}`);
      await onUpdated();
      await fetchAvailableUsers();
    } catch (err) {
      onError('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog open className="kanban-modal" onClick={e => e.target.tagName === 'DIALOG' && onClose()}>
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Manage Project Members</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-h)' }}>Current Members</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
            {/* Owner is always a member */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '14px' }}>{project.owner.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text)' }}>Project Owner</div>
              </div>
            </div>

            {/* Other Members */}
            {project.members?.map(member => (
              <div key={member.user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '14px' }}>{member.user.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text)' }}>{member.user.email}</div>
                </div>
                <button 
                  onClick={() => handleRemoveMember(member.user.id)}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                  disabled={loading}
                  title="Remove Member"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-h)' }}>Add New Member</h3>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '12px' }}>
            <select 
              className="input-glass" 
              style={{ flex: 1 }}
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              disabled={loading || availableUsers.length === 0}
            >
              <option value="">Select a user...</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !selectedUserId}
            >
              <UserPlus size={16} /> Add
            </button>
          </form>
          {availableUsers.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text)', marginTop: '8px' }}>
              No other users available to add.
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
