import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { CheckCircle2, AlertTriangle, Calendar, TrendingUp, LayoutDashboard, UserCheck } from 'lucide-react';
import '../Dashboard.css';

const STATUS_COLORS = {
  BACKLOG: '#64748b',
  IN_PROGRESS: '#3b82f6',
  IN_REVIEW: '#8b5cf6',
  DONE: '#10b981',
  BLOCKED: '#f43f5e'
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
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h2>Access Restricted</h2>
        <p style={{ marginTop: '8px', color: 'var(--text)' }}>Manager permissions are required to view the executive dashboard.</p>
        <a href="/my-tasks" className="btn-primary" style={{ display: 'inline-flex', marginTop: '20px', textDecoration: 'none' }}>
          Go to My Tasks
        </a>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text)' }}>Loading Dashboard Analytics...</div>;
  if (error) return <div style={{ padding: '40px', color: '#f43f5e' }}>{error}</div>;

  // Prepare data for Recharts
  const statusData = Object.entries(summary.statusDistribution || {}).map(([key, value]) => ({
    name: key.replace('_', ' '),
    value,
    color: STATUS_COLORS[key] || '#cccccc'
  }));

  const completionsData = summary.completionsLastEightWeeks || [];

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 className="dashboard-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutDashboard size={28} color="var(--accent)" /> Executive Dashboard
        </h1>
      </div>

      {/* 4 Headline Metrics Cards (Requirement 8) */}
      <div className="metrics-grid">
        <div className="metric-card accent-indigo">
          <div className="metric-info">
            <div className="metric-title">Open Tasks</div>
            <div className="metric-value">{summary.openTasks}</div>
          </div>
          <div className="metric-icon-tile" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="metric-card accent-rose">
          <div className="metric-info">
            <div className="metric-title">Overdue Tasks</div>
            <div className="metric-value" style={{ color: summary.overdueCount > 0 ? '#f43f5e' : 'var(--text-h)' }}>
              {summary.overdueCount}
            </div>
          </div>
          <div className="metric-icon-tile" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="metric-card accent-amber">
          <div className="metric-info">
            <div className="metric-title">Due This Week</div>
            <div className="metric-value">{summary.dueThisWeek}</div>
          </div>
          <div className="metric-icon-tile" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Calendar size={22} />
          </div>
        </div>

        <div className="metric-card accent-emerald">
          <div className="metric-info">
            <div className="metric-title">Completed This Week</div>
            <div className="metric-value" style={{ color: '#10b981' }}>
              {summary.completedThisWeek}
            </div>
          </div>
          <div className="metric-icon-tile" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Visual Charts (Requirement 8) */}
      <div className="charts-grid">
        {/* Status Breakdown */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Task Breakdown by Status</h3>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-h)' }} 
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* 8 Weeks Completions Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Completions Trend (Last 8 Weeks)</h3>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={completionsData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="week" stroke="var(--text)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--text)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-h)' }}
                />
                <Bar dataKey="completions" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Assignee Breakdown Table (Requirement 8) */}
      <div className="table-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <UserCheck size={20} color="var(--accent)" />
          <h3 className="chart-title" style={{ margin: 0 }}>Team Workload & Capacity Breakdown</h3>
        </div>
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
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '50%', 
                        background: 'var(--accent-bg)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px'
                      }}>
                        {member.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{member.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text)' }}>{member.email}</td>
                  <td><span className="kanban-badge" style={{ fontSize: '12px' }}>{member.activeTasks}</span></td>
                  <td>{member.inProgress}</td>
                  <td>{member.blocked > 0 ? <span style={{ color: '#f43f5e', fontWeight: 600 }}>{member.blocked}</span> : 0}</td>
                  <td>
                    <span style={{ color: hasOverdue ? '#f43f5e' : 'var(--text)', fontWeight: hasOverdue ? 700 : 400 }}>
                      {member.overdue}
                    </span>
                  </td>
                </tr>
              );
            })}
            {workload.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text)' }}>No team members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
