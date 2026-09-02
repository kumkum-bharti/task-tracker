import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import TaskDetailModal from '../components/TaskDetailModal';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, Clock, AlertTriangle, Download, CheckSquare, X, CheckCircle2, AlertCircle } from 'lucide-react';
import '../Dashboard.css';

export default function TaskSearch() {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dropdown filter options
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [overdue, setOverdue] = useState(false);

  // Sort State
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Multi-Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  // Bulk Action State
  const [bulkAction, setBulkAction] = useState('status'); // 'status', 'assignee', 'dueDate'
  const [bulkValue, setBulkValue] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { updatedCount, failed }

  // Modal
  const [selectedTask, setSelectedTask] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load dropdown options
  useEffect(() => {
    client.get('/projects').then(res => setProjects(res.data)).catch(() => {});
    client.get('/users').then(res => setUsers(res.data)).catch(() => {});
  }, []);

  // Fetch tasks from server
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (projectId) params.append('projectId', projectId);
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (assigneeId) params.append('assigneeId', assigneeId);
      if (overdue) params.append('overdue', 'true');
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      params.append('page', page);
      params.append('limit', 10);

      const res = await client.get(`/tasks?${params.toString()}`);
      setTasks(res.data.tasks || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      setError('Failed to load tasks from server.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, projectId, status, priority, assigneeId, overdue, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleFilterChange = (setter, value) => {
    setter(value);
    setPage(1);
    setSelectedTaskIds(new Set()); // Reset selections on filter change
  };

  // Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const ids = new Set(tasks.map(t => t.id));
      setSelectedTaskIds(ids);
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const handleToggleSelectTask = (e, taskId) => {
    e.stopPropagation();
    const next = new Set(selectedTaskIds);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    setSelectedTaskIds(next);
  };

  // CSV Export Handler
  const handleExportFilteredCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (projectId) params.append('projectId', projectId);
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (assigneeId) params.append('assigneeId', assigneeId);
      if (overdue) params.append('overdue', 'true');

      const res = await client.get(`/tasks/export-csv?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'filtered-tasks.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export filtered CSV.');
    }
  };

  // Bulk Apply Handler
  const handleApplyBulkAction = async () => {
    if (selectedTaskIds.size === 0 || !bulkValue) return;
    setBulkSubmitting(true);
    try {
      const taskIds = Array.from(selectedTaskIds);
      const res = await client.patch('/tasks/bulk-update', {
        taskIds,
        actionType: bulkAction,
        value: bulkValue
      });

      setBulkResult(res.data); // { updatedCount, updatedIds, failed }
      setSelectedTaskIds(new Set());
      setBulkValue('');
      fetchTasks();
      window.dispatchEvent(new Event('task-updated'));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply bulk update.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="dashboard-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Search size={32} color="var(--accent)" /> Global Task Finder
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={handleExportFilteredCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Export Filtered CSV
          </button>
          <div style={{ fontSize: '14px', color: 'var(--text)', background: 'var(--social-bg)', padding: '6px 14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            Total Matches: <strong style={{ color: 'var(--text-h)' }}>{total}</strong>
          </div>
        </div>
      </div>

      {/* Search & Filters Container */}
      <div className="chart-card" style={{ marginBottom: '24px', padding: '20px' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text)' }} />
          <input 
            className="input-glass"
            style={{ width: '100%', paddingLeft: '42px', fontSize: '15px' }}
            placeholder="Search tasks by title or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>PROJECT</label>
            <select className="input-glass" style={{ width: '100%', fontSize: '13px' }} value={projectId} onChange={e => handleFilterChange(setProjectId, e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.key})</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>STATUS</label>
            <select className="input-glass" style={{ width: '100%', fontSize: '13px' }} value={status} onChange={e => handleFilterChange(setStatus, e.target.value)}>
              <option value="">All Statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>PRIORITY</label>
            <select className="input-glass" style={{ width: '100%', fontSize: '13px' }} value={priority} onChange={e => handleFilterChange(setPriority, e.target.value)}>
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>ASSIGNEE</label>
            <select className="input-glass" style={{ width: '100%', fontSize: '13px' }} value={assigneeId} onChange={e => handleFilterChange(setAssigneeId, e.target.value)}>
              <option value="">All Assignees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>SORT BY</label>
            <select className="input-glass" style={{ width: '100%', fontSize: '13px' }} value={sortBy} onChange={e => handleFilterChange(setSortBy, e.target.value)}>
              <option value="updatedAt">Last Updated</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
            <button 
              className="btn-secondary" 
              style={{ fontSize: '13px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              title="Toggle sort direction"
            >
              <ArrowUpDown size={14} /> {sortOrder.toUpperCase()}
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: overdue ? '#ef4444' : 'var(--text)', fontWeight: overdue ? 600 : 400 }}>
              <input 
                type="checkbox" 
                checked={overdue} 
                onChange={e => handleFilterChange(setOverdue, e.target.checked)} 
              />
              Overdue Only
            </label>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (Rendered when tasks are selected) */}
      {selectedTaskIds.size > 0 && (
        <div style={{ 
          background: 'var(--accent-bg)', 
          border: '1px solid var(--accent-border)', 
          borderRadius: '12px', 
          padding: '16px 24px', 
          marginBottom: '24px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-h)', fontSize: '14px' }}>
            <CheckSquare size={18} color="var(--accent)" />
            {selectedTaskIds.size} task{selectedTaskIds.size > 1 ? 's' : ''} selected
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select 
              className="input-glass" 
              style={{ fontSize: '13px', padding: '6px 12px' }}
              value={bulkAction}
              onChange={e => { setBulkAction(e.target.value); setBulkValue(''); }}
            >
              <option value="status">Action: Status Move</option>
              <option value="assignee">Action: Assign User</option>
              <option value="dueDate">Action: Set Due Date</option>
            </select>

            {bulkAction === 'status' && (
              <select className="input-glass" style={{ fontSize: '13px', padding: '6px 12px' }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
                <option value="">Select Target Status...</option>
                <option value="BACKLOG">Backlog</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            )}

            {bulkAction === 'assignee' && (
              <select className="input-glass" style={{ fontSize: '13px', padding: '6px 12px' }} value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
                <option value="">Select User to Assign...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}

            {bulkAction === 'dueDate' && (
              <input 
                type="date" 
                className="input-glass" 
                style={{ fontSize: '13px', padding: '5px 10px' }}
                value={bulkValue}
                onChange={e => setBulkValue(e.target.value)}
              />
            )}

            <button 
              className="btn-primary" 
              disabled={!bulkValue || bulkSubmitting}
              onClick={handleApplyBulkAction}
              style={{ fontSize: '13px' }}
            >
              {bulkSubmitting ? 'Applying...' : `Apply Bulk Change`}
            </button>

            <button 
              className="btn-secondary" 
              onClick={() => setSelectedTaskIds(new Set())}
              style={{ fontSize: '13px' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>}

      {/* Task Results Table */}
      <div className="table-container" style={{ padding: 0 }}>
        <table className="workload-table">
          <thead>
            <tr style={{ background: 'var(--social-bg)' }}>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={tasks.length > 0 && tasks.every(t => selectedTaskIds.has(t.id))}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Task Title</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>Assignees</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text)' }}>
                  Searching tasks...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text)' }}>
                  No matching tasks found. Try adjusting your filters.
                </td>
              </tr>
            ) : (
              tasks.map(task => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <tr 
                    key={task.id} 
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--accent-bg)' : 'transparent', transition: 'background 0.2s' }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={e => handleToggleSelectTask(e, task.id)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>{task.title}</div>
                      {task.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="kanban-badge" style={{ fontSize: '11px' }}>
                        {task.project?.key || task.project?.name || 'Task'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-h)' }}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`task-priority priority-${task.priority}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      {task.dueDate ? (
                        <span style={{ fontSize: '13px', color: isOverdue ? '#ef4444' : 'var(--text)', fontWeight: isOverdue ? 600 : 400, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isOverdue ? <AlertTriangle size={13} /> : <Clock size={13} />}
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--text)' }}>None</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                        {task.assignees && task.assignees.length > 0 
                          ? task.assignees.map(a => a.user?.name || 'Unknown').join(', ')
                          : 'Unassigned'
                        }
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '0 8px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text)' }}>
          Page <strong style={{ color: 'var(--text-h)' }}>{page}</strong> of <strong style={{ color: 'var(--text-h)' }}>{totalPages}</strong> ({total} total matches)
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn-secondary" 
            disabled={page <= 1 || loading} 
            onClick={() => setPage(p => p - 1)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button 
            className="btn-secondary" 
            disabled={page >= totalPages || loading} 
            onClick={() => setPage(p => p + 1)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchTasks}
          onError={setError}
        />
      )}

      {/* Bulk Action Execution Result Modal */}
      {bulkResult && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.5)' }} onClick={() => setBulkResult(null)} />
          <dialog open style={{ zIndex: 100, maxWidth: '550px', width: '100%' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">Bulk Action Results</h2>
                <button className="modal-close" onClick={() => setBulkResult(null)}><X size={24} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {bulkResult.updatedCount > 0 && (
                  <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
                    <CheckCircle2 size={18} /> Successfully updated {bulkResult.updatedCount} task{bulkResult.updatedCount > 1 ? 's' : ''}.
                  </div>
                )}

                {bulkResult.failed && bulkResult.failed.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                      <AlertCircle size={18} /> {bulkResult.failed.length} Task{bulkResult.failed.length > 1 ? 's' : ''} Rejected
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {bulkResult.failed.map((f, i) => (
                        <div key={i} style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', fontSize: '13px' }}>
                          <strong style={{ color: 'var(--text-h)' }}>{f.title}</strong>
                          <div style={{ color: '#ef4444', marginTop: '2px', fontSize: '12px' }}>
                            Reason: {f.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button className="btn-primary" onClick={() => setBulkResult(null)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
