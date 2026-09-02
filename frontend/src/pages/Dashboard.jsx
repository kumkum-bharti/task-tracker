import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import '../Dashboard.css';

const STATUS_COLORS = {
  BACKLOG: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  IN_REVIEW: '#8b5cf6',
  DONE: '#10b981',
  BLOCKED: '#ef4444'
};

const PRIORITY_COLORS = {
  LOW: '#6366f1',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  URGENT: '#991b1b'
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'MANAGER') return;

    const fetchData = async () => {
      try {
        const [sumRes, workRes] = await Promise.all([
          client.get('/dashboard/summary'),
          client.get('/dashboard/team-workload')
        ]);
        setSummary(sumRes.data);
        setWorkload(workRes.data);
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (user?.role !== 'MANAGER') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Access Restricted</h2>
        <p>Manager role required to view the dashboard.</p>
        <a href="/my-tasks" className="btn-primary" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>
          Go to My Tasks
        </a>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '40px' }}>Loading Dashboard...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red' }}>{error}</div>;

  // Prepare data for Recharts
  const statusData = Object.entries(summary.statusDistribution).map(([key, value]) => ({
    name: key.replace('_', ' '),
    value,
    color: STATUS_COLORS[key] || '#cccccc'
  }));

  const priorityData = Object.entries(summary.priorityDistribution).map(([key, value]) => ({
    name: key,
    tasks: value,
    fill: PRIORITY_COLORS[key] || '#cccccc'
  }));

  const blockedCount = summary.statusDistribution['BLOCKED'] || 0;

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Manager Dashboard</h1>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Active Projects</div>
          <div className="metric-value">{summary.totalProjects}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Total Tasks</div>
          <div className="metric-value">{summary.totalTasks}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Overdue Tasks</div>
          <div className={`metric-value ${summary.overdueCount > 0 ? 'metric-warning' : ''}`}>
            {summary.overdueCount}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Bottlenecks (Blocked)</div>
          <div className={`metric-value ${blockedCount > 0 ? 'metric-warning' : ''}`}>
            {blockedCount}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Task Status Distribution</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="chart-card">
          <h3 className="chart-title">Priority Breakdown</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="tasks" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="table-container">
        <h3 className="chart-title" style={{ marginBottom: '24px' }}>Team Workload</h3>
        <table className="workload-table">
          <thead>
            <tr>
              <th>Team Member</th>
              <th>Email</th>
              <th>Active Tasks</th>
              <th>In Progress</th>
              <th>Blocked</th>
              <th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {workload.map(member => {
              const hasHighLoad = member.activeTasks > 5;
              const hasOverdue = member.overdue > 0;
              const isWarning = hasHighLoad || hasOverdue;
              
              return (
                <tr key={member.userId} className={isWarning ? 'row-warning' : ''}>
                  <td style={{ fontWeight: 500 }}>{member.name}</td>
                  <td style={{ color: 'var(--text)' }}>{member.email}</td>
                  <td>{member.activeTasks}</td>
                  <td>{member.inProgress}</td>
                  <td>{member.blocked}</td>
                  <td className={hasOverdue ? 'metric-warning' : ''} style={{ fontWeight: hasOverdue ? 600 : 400 }}>
                    {member.overdue}
                  </td>
                </tr>
              );
            })}
            {workload.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No team members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
