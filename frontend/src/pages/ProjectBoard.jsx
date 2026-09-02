import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import TaskCard from '../components/TaskCard';
import NewTaskModal from '../components/NewTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import '../Kanban.css';
import { Search, Download, Plus } from 'lucide-react';

const COLUMNS = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

export default function ProjectBoard() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  
  // Modals
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchProjectData = async () => {
    try {
      // Assuming projectId is 1, let's fetch projects and find it
      const projRes = await client.get('/projects');
      const proj = projRes.data.find(p => p.id === parseInt(projectId));
      setProject(proj);
      
      const tasksRes = await client.get(`/tasks/project/${projectId}`);
      setTasks(tasksRes.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load project data.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const handleExportCSV = async () => {
    try {
      const res = await client.get(`/projects/${projectId}/export-csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-${projectId}-tasks.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export CSV.');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPriority = priorityFilter ? task.priority === priorityFilter : true;
      const matchAssignee = assigneeFilter ? task.assignees.some(a => a.user.name === assigneeFilter) : true;
      return matchSearch && matchPriority && matchAssignee;
    });
  }, [tasks, searchTerm, priorityFilter, assigneeFilter]);

  const tasksByColumn = useMemo(() => {
    const cols = {
      BACKLOG: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      BLOCKED: []
    };
    filteredTasks.forEach(task => {
      if (cols[task.status]) cols[task.status].push(task);
    });
    return cols;
  }, [filteredTasks]);

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div className="kanban-board">
      <div className="kanban-header">
        <div className="kanban-header-left">
          <h1 className="kanban-title">
            {project?.name || 'Project Board'}
            {project?.key && <span className="kanban-badge">{project.key}</span>}
          </h1>
          <div style={{ color: 'var(--text)', fontSize: '14px', marginLeft: '12px' }}>
            {project?.members?.length || 0} Members
          </div>
        </div>
        <div className="kanban-header-right">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Search size={16} style={{ color: 'var(--text)', position: 'absolute', marginLeft: '12px' }} />
            <input 
              className="input-glass" 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            
            <select className="input-glass" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            
            <button className="btn-secondary" onClick={handleExportCSV}>
              <Download size={16} /> Export
            </button>
            <button className="btn-primary" onClick={() => setIsNewTaskOpen(true)}>
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>
      </div>

      <div className="kanban-columns">
        {COLUMNS.map(col => (
          <div key={col} className="kanban-column">
            <div className="kanban-column-header">
              {col.replace('_', ' ')}
              <span className="kanban-badge">{tasksByColumn[col].length}</span>
            </div>
            <div className="kanban-tasks">
              {tasksByColumn[col].map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={fetchProjectData}
                  onError={setError}
                  onClick={setSelectedTask}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <NewTaskModal 
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        projectId={projectId}
        onCreated={fetchProjectData}
        onError={setError}
      />
      
      <TaskDetailModal
        isOpen={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onError={setError}
      />

      {error && (
        <div className="toast">
          {error}
          <button style={{ background: 'none', border: 'none', color: 'white', marginLeft: '12px', cursor: 'pointer' }} onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
