import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import NewTaskModal from '../components/NewTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import ManageMembersModal from '../components/ManageMembersModal';
import EditProjectModal from '../components/EditProjectModal';
import '../Kanban.css';
import { Search, Download, Plus, Users, Archive, RotateCcw, Edit2 } from 'lucide-react';

const COLUMNS = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

export default function ProjectBoard() {
  const { user } = useAuth();
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
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchProjectData = async () => {
    try {
      // Fetch active & archived projects to find this project
      const projRes = await client.get('/projects?archived=true');
      const activeRes = await client.get('/projects');
      const allProjects = [...projRes.data, ...activeRes.data];
      const proj = allProjects.find(p => p.id === parseInt(projectId));
      setProject(proj);
      
      const tasksRes = await client.get(`/tasks/project/${projectId}`);
      setTasks(tasksRes.data);
      setSelectedTask(prev => {
        if (!prev) return null;
        return tasksRes.data.find(t => t.id === prev.id) || prev;
      });
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

  const handleArchiveProject = async () => {
    if (!window.confirm('Are you sure you want to archive this project?')) return;
    try {
      await client.patch(`/projects/${projectId}/archive`);
      fetchProjectData();
    } catch (err) {
      setError('Failed to archive project.');
    }
  };

  const handleRestoreProject = async () => {
    try {
      await client.patch(`/projects/${projectId}/restore`);
      fetchProjectData();
    } catch (err) {
      setError('Failed to restore project.');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchSearch = task.title ? task.title.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchPriority = priorityFilter ? task.priority === priorityFilter : true;
      const matchAssignee = assigneeFilter ? task.assignees?.some(a => a.user?.name === assigneeFilter) : true;
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
            {project?.isArchived && (
              <span style={{ 
                background: 'rgba(239, 68, 68, 0.15)', 
                color: '#ef4444', 
                padding: '4px 10px', 
                borderRadius: '12px', 
                fontSize: '12px', 
                fontWeight: 700 
              }}>
                ARCHIVED
              </span>
            )}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
            <span style={{ color: 'var(--text)', fontSize: '14px' }}>
              {project?.members?.length || 0} Members
            </span>
            {user?.role === 'MANAGER' && (
              <>
                <button 
                  onClick={() => setIsEditProjectOpen(true)}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-h)' }}
                >
                  <Edit2 size={14} /> Edit Project
                </button>

                <button 
                  onClick={() => setIsMembersModalOpen(true)}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-h)' }}
                >
                  <Users size={14} /> Manage
                </button>

                {project?.isArchived ? (
                  <button 
                    onClick={handleRestoreProject}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}
                  >
                    <RotateCcw size={14} /> Restore Project
                  </button>
                ) : (
                  <button 
                    onClick={handleArchiveProject}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}
                  >
                    <Archive size={14} /> Archive
                  </button>
                )}
              </>
            )}
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
        onUpdate={fetchProjectData}
        onError={setError}
      />

      {project && (
        <ManageMembersModal
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
          project={project}
          onUpdated={fetchProjectData}
          onError={setError}
        />
      )}

      {project && (
        <EditProjectModal
          isOpen={isEditProjectOpen}
          onClose={() => setIsEditProjectOpen(false)}
          project={project}
          onUpdated={fetchProjectData}
          onError={setError}
        />
      )}

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
