import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Simple placeholder components for routing
const Login = () => <div>Login Page</div>;
const Register = () => <div>Register Page</div>;
const Dashboard = () => <div>Dashboard</div>;
const ProjectsList = () => <div>Projects</div>;
const ProjectBoard = () => <div>Project Board</div>;
const MyTasks = () => <div>My Tasks</div>;
const Alerts = () => <div>Alerts</div>;

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading Application...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Navigate to={user?.role === 'MANAGER' ? "/dashboard" : "/projects"} replace />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectsList />
          </ProtectedRoute>
        } />
        
        <Route path="/projects/:projectId" element={
          <ProtectedRoute>
            <ProjectBoard />
          </ProtectedRoute>
        } />
        
        <Route path="/my-tasks" element={
          <ProtectedRoute>
            <MyTasks />
          </ProtectedRoute>
        } />
        
        <Route path="/alerts" element={
          <ProtectedRoute>
            <Alerts />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
