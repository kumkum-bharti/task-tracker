import React, { useState } from 'react';
import client from '../api/client';
import { X } from 'lucide-react';

export default function NewTaskModal({ isOpen, onClose, projectId, onCreated, onError }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post(`/tasks/project/${projectId}`, {
        title,
        description,
        priority,
        dueDate: dueDate || null
      });
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate('');
      onCreated();
      window.dispatchEvent(new Event('task-updated'));
      onClose();
    } catch (err) {
      if (err.response?.data?.error) {
        onError(err.response.data.error);
      } else {
        onError("Failed to create task");
      }
    }
  };

  return (
    <>
      {/* Fallback backdrop for unsupported browsers; new browsers use ::backdrop */}
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      
      <dialog open style={{ zIndex: 100 }}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">New Task</h2>
            <button className="modal-close" onClick={onClose}><X size={24} /></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title</label>
              <input 
                className="input-glass" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea 
                className="input-glass" 
                rows={3} 
                value={description} 
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>Priority</label>
              <select className="input-glass" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Due Date</label>
              <input 
                type="date" 
                className="input-glass" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Create Task</button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
