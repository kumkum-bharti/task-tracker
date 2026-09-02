import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import AlertBell from './AlertBell';
import { useAuth } from '../context/AuthContext';
import { Briefcase, LayoutDashboard, FolderKanban, Search, CheckCircle2, LogOut, Shield } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();

  const getNavLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    textDecoration: 'none',
    color: isActive ? 'var(--accent)' : 'var(--text)',
    background: isActive ? 'var(--accent-bg)' : 'transparent',
    transition: 'all 0.15s ease'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Executive Top Navigation Header */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '12px 32px',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {/* Brand Logo & Title */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
            }}>
              <Briefcase size={20} />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-h)', letterSpacing: '-0.02em' }}>
              BusyTracker
            </span>
          </Link>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {user?.role === 'MANAGER' && (
              <NavLink to="/dashboard" style={getNavLinkStyle}>
                <LayoutDashboard size={16} /> Dashboard
              </NavLink>
            )}
            <NavLink to="/projects" style={getNavLinkStyle}>
              <FolderKanban size={16} /> Projects
            </NavLink>
            <NavLink to="/tasks" style={getNavLinkStyle}>
              <Search size={16} /> Find Tasks
            </NavLink>
            <NavLink to="/my-tasks" style={getNavLinkStyle}>
              <CheckCircle2 size={16} /> My Tasks
            </NavLink>
          </nav>
        </div>
        
        {/* User Actions & Alerts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <AlertBell />

          <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              padding: '4px 12px 4px 6px',
              borderRadius: '9999px'
            }}>
              <div style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                background: 'var(--accent)', 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px'
              }}>
                {user?.name?.charAt(0) || 'U'}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)' }}>
                  {user?.name}
                </span>
              </div>

              <span style={{ 
                fontSize: '10px', 
                fontWeight: 700, 
                padding: '2px 6px', 
                borderRadius: '4px', 
                background: user?.role === 'MANAGER' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                color: user?.role === 'MANAGER' ? 'var(--accent)' : 'var(--text)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {user?.role}
              </span>
            </div>

            <button 
              onClick={logout} 
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Sign out of your account"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Page Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}
