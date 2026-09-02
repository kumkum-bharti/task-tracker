import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import EditProjectModal from '../components/EditProjectModal';
import { Plus, Folder, Users, Archive, RotateCcw, Edit2 } from 'lucide-react';
import '../Dashboard.css';

export default function ProjectsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [viewArchived, setViewArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [newProject, setNewProject] = useState({ name: '', key: '', description: '' });
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    fetchProjects();
  }, [viewArchived]);

  useEffect(() => {
    if (showModal && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (dialogRef.current) {
      dialogRef.current.close();
    }
  }, [showModal]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const endpoint = viewArchived ? '/projects?archived=true' : '/projects';
      const res = await client.get(endpoint);
      setProjects(res.data);
    } catch (err) {
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveProject = async (e, projectId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to archive this project? It will be hidden from default views.')) return;
    try {
      await client.patch(`/projects/${projectId}/archive`);
      fetchProjects();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to archive project');
    }
  };

  const handleRestoreProject = async (e, projectId) => {
    e.stopPropagation();
    try {
      await client.patch(`/projects/${projectId}/restore`);
      fetchProjects();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restore project');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await client.post('/projects', newProject);
      setProjects([...projects, res.data]);
      setShowModal(false);
      setNewProject({ name: '', key: '', description: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading projects...</div>;

  return (
    <div className="dashboard-container" style={{ maxWidth: '1240px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 className="dashboard-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Folder size={32} color="var(--accent)" /> Projects Directory
        </h1>
        {user?.role === 'MANAGER' && (
          <button 
            className="btn-primary" 
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> New Project
          </button>
        )}
      </div>

      {user?.role === 'MANAGER' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button 
            className={!viewArchived ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setViewArchived(false)}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            Active Projects
          </button>
          <button 
            className={viewArchived ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setViewArchived(true)}
            style={{ fontSize: '13px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Archive size={14} /> Archived Projects
          </button>
        </div>
      )}

      {error && <div style={{ color: 'red', marginBottom: '24px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {projects.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text)' }}>
            No projects available.
          </div>
        ) : (
          projects.map(project => (
            <div 
              key={project.id}
              className="chart-card"
              style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '24px' }}
              onClick={() => navigate(`/projects/${project.id}`)}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-h)' }}>{project.name}</h3>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {viewArchived && (
                    <span style={{ 
                      background: 'rgba(239, 68, 68, 0.15)', 
                      color: '#ef4444', 
                      padding: '2px 8px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: 700 
                    }}>
                      ARCHIVED
                    </span>
                  )}
                  <span style={{ 
                    background: 'var(--social-bg)', 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '12px', 
                    fontWeight: 600,
                    color: 'var(--text-h)'
                  }}>
                    {project.key}
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '24px', minHeight: '40px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {project.description || 'No description provided.'}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                  Owner: <strong style={{ color: 'var(--text-h)' }}>{project.owner?.name || 'Unknown'}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)', background: 'var(--bg)', padding: '4px 8px', borderRadius: '12px' }}>
                    <Users size={14} /> {project.members?.length || 0}
                  </div>
                  {user?.role === 'MANAGER' && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-h)' }}
                        title="Edit Project"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      {viewArchived ? (
                        <button 
                          onClick={(e) => handleRestoreProject(e, project.id)}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}
                          title="Restore Project"
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => handleArchiveProject(e, project.id)}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}
                          title="Archive Project"
                        >
                          <Archive size={13} /> Archive
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Project Modal */}
      <dialog ref={dialogRef} className="kanban-modal" onCancel={() => setShowModal(false)}>
        <div style={{ width: '400px' }}>
          <h2 style={{ marginBottom: '24px', color: 'var(--text-h)' }}>Create New Project</h2>
          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Project Name</label>
              <input 
                type="text" 
                className="input-glass" 
                required 
                value={newProject.name}
                onChange={e => setNewProject({...newProject, name: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Project Key (Short)</label>
              <input 
                type="text" 
                className="input-glass" 
                required 
                maxLength={10}
                value={newProject.key}
                onChange={e => setNewProject({...newProject, key: e.target.value.toUpperCase()})}
                placeholder="e.g. BT"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Description</label>
              <textarea 
                className="input-glass" 
                rows={3}
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowModal(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
      {/* Edit Project Modal */}
      <EditProjectModal 
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        project={editingProject}
        onUpdated={fetchProjects}
        onError={setError}
      />
    </div>
  );
}
