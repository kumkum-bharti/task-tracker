import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Simple placeholder components for routing
const Login = () => <div>Login Page</div>;
const Register = () => <div>Register Page</div>;
import Dashboard from './pages/Dashboard';
const ProjectsList = () => <div>Projects</div>;
import ProjectBoard from './pages/ProjectBoard';

const MyTasks = () => <div>My Tasks</div>;
import Alerts from './pages/Alerts';

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
        
        {/* Protected Routes wrapped in Layout */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to={user?.role === 'MANAGER' ? "/dashboard" : "/projects"} replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/:projectId" element={<ProjectBoard />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/alerts" element={<Alerts />} />
        </Route>
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
