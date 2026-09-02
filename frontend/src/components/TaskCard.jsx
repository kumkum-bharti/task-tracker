import React from 'react';
import { Lock, Clock } from 'lucide-react';
import client from '../api/client';

export default function TaskCard({ task, onUpdate, onError, onClick }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  const handleStatusChange = async (e) => {
    e.stopPropagation(); // prevent opening modal
    const newStatus = e.target.value;
    try {
      await client.patch(`/tasks/${task.id}/status`, { newStatus });
      onUpdate();
      window.dispatchEvent(new Event('task-updated'));
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        onError(err.response.data.error);
      } else {
        onError("An error occurred updating the task status.");
      }
    }
  };

  const blockers = task.blockedBy || [];
  const hasUnfinishedBlockers = blockers.some(b => b.blockingTask.status !== 'DONE');

  const validNextStatuses = {
    'BACKLOG': ['IN_PROGRESS'],
    'IN_PROGRESS': ['IN_REVIEW', 'BLOCKED'],
    'IN_REVIEW': ['DONE', 'BLOCKED'],
    'BLOCKED': ['IN_PROGRESS', 'IN_REVIEW'],
    'DONE': ['IN_PROGRESS']
  };
  
  const options = validNextStatuses[task.status] || [];

  return (
    <div className="task-card" onClick={() => onClick(task)}>
      {hasUnfinishedBlockers && (
        <div className="card-lock" title={`Blocked by: ${blockers.filter(b => b.blockingTask.status !== 'DONE').map(b => b.blockingTask.title).join(', ')}`}>
          <Lock size={16} />
        </div>
      )}
      {!hasUnfinishedBlockers && options.length > 0 && (
        <div className="card-actions" onClick={e => e.stopPropagation()}>
          <select value="" onChange={handleStatusChange}>
            <option value="" disabled>Move to...</option>
            {options.map(opt => (
              <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      )}
      
      <h4 className="task-title">{task.title}</h4>
      
      <div className="task-meta">
        <span className={`task-priority priority-${task.priority}`}>{task.priority}</span>
        {task.dueDate && (
          <span className={`due-date ${isOverdue ? 'overdue' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
      {task.assignees && task.assignees.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text)' }}>
          {task.assignees.map(a => a.user.name).join(', ')}
        </div>
      )}
    </div>
  );
}
