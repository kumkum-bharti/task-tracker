import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import client from '../api/client';

export default function EditProjectModal({ isOpen, onClose, project, onUpdated, onError }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.patch(`/projects/${project.id}`, { name, description });
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      if (onError) onError(err.response?.data?.error || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <dialog open style={{ zIndex: 100, maxWidth: '450px', width: '100%' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">Edit Project ({project.key})</h2>
            <button className="modal-close" onClick={onClose}><X size={24} /></button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Project Name</label>
              <input 
                type="text" 
                className="input-glass" 
                required 
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Description</label>
              <textarea 
                className="input-glass" 
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
