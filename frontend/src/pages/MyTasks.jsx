import React, { useEffect, useState } from 'react';
import client from '../api/client';
import TaskCard from '../components/TaskCard';
import '../Dashboard.css';
import { CheckCircle } from 'lucide-react';

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMyTasks = async () => {
    try {
      const res = await client.get('/tasks/my-tasks');
      setTasks(res.data);
    } catch (err) {
      setError('Failed to fetch your tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const handleTaskUpdate = () => {
    fetchMyTasks();
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading your tasks...</div>;

  return (
    <div className="dashboard-container" style={{ maxWidth: '1240px' }}>
      <h1 className="dashboard-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <CheckCircle size={32} color="var(--accent)" /> My Tasks
      </h1>

      {error && <div style={{ color: 'red', marginBottom: '24px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {tasks.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text)' }}>
            You have no tasks assigned right now. Enjoy your free time!
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} style={{ position: 'relative' }}>
              {/* Optional: we could add a small header above the card to show project name if needed */}
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                Project: {task.project?.name || 'Unknown'}
              </div>
              <TaskCard 
                task={task} 
                onUpdate={handleTaskUpdate}
                onError={(err) => alert(`Error updating task: ${err}`)}
                onClick={() => {}} // Could navigate to project board or open modal
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
