import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import AlertBell from './AlertBell';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '16px 32px',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{ fontSize: '20px', fontWeight: 700, textDecoration: 'none', color: 'var(--text-h)' }}>
            BusyTracker
          </Link>
          <nav style={{ display: 'flex', gap: '16px' }}>
            {user?.role === 'MANAGER' && (
              <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 500 }}>Dashboard</Link>
            )}
            <Link to="/projects" style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 500 }}>Projects</Link>
            <Link to="/tasks" style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 500 }}>Find Tasks</Link>
            <Link to="/my-tasks" style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 500 }}>My Tasks</Link>
          </nav>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <AlertBell />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'var(--accent)', 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-h)' }}>
                {user?.name}
              </div>
            </div>
            <button 
              onClick={logout} 
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--text)'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}
