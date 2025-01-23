import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { AccountProvider } from './context/AccountContext';
import ProtectedRoute from './components/Layout/ProtectedRoutes';
import Navbar from './components/Layout/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobReview from './pages/JobReview';
import OAuthCallback from './components/Auth/OAuthCallback';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <div className="min-h-screen bg-gray-100">
            <Toaster position="top-right" />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute><Navbar /></ProtectedRoute>}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/jobs/:id" element={<JobReview />} />
                <Route path="/oauth-callback" element={<OAuthCallback />} />
              </Route>
            </Routes>
          </div>
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}