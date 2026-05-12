// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// ==========================================
// IMPORT HALAMAN ASLI (V3 SAAS)
// ==========================================
import LoginPortal from './pages/auth/LoginPortal';
import MasterDashboard from './pages/superadmin/MasterDashboard';
import SchoolAdminDashboard from './pages/teacher/SchoolAdminDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ExamRoom from './pages/student/ExamRoom';
import ResultPage from './pages/student/ResultPage';
import ProctorDashboard from './pages/teacher/ProctorDashboard';

// ==========================================
// SATPAM DIGITAL (ROLE-BASED PROTECTED ROUTE)
// ==========================================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userData, loading } = useAuth();
  const studentData = localStorage.getItem('studentData');

  if (loading) return null;

  // Proteksi khusus Siswa
  if (allowedRoles.includes('student')) {
    if (studentData) return children;
    return <Navigate to="/login" replace />;
  }

  // Proteksi User (Admin/Guru)
  if (!currentUser) return <Navigate to="/login" replace />;

  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    // Jika rolenya tidak diizinkan, kembalikan ke login
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100">
          <Routes>
            {/* PUBLIC ROUTE */}
            <Route path="/login" element={<LoginPortal />} />
            
            {/* SUPER ADMIN ROUTE (Master SaaS) */}
            <Route path="/master/*" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <MasterDashboard />
              </ProtectedRoute>
            } />

            {/* SCHOOL ADMIN ROUTE (Operator Sekolah) */}
            <Route path="/admin-sekolah/*" element={
              <ProtectedRoute allowedRoles={['admin_sekolah']}>
                <SchoolAdminDashboard />
              </ProtectedRoute>
            } />

            {/* TEACHER ROUTE (Guru) */}
            <Route path="/teacher/*" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherDashboard />
              </ProtectedRoute>
            } />

            {/* PROCTOR ROUTE (Pengawas Ruang) */}
            <Route path="/proctor" element={
              <ProtectedRoute allowedRoles={['teacher', 'admin_sekolah', 'proctor']}>
                <ProctorDashboard />
              </ProtectedRoute>
            } />

            {/* STUDENT ROUTE (Peserta Ujian) */}
            <Route path="/student/result" element={
              <ProtectedRoute allowedRoles={['student']}>
                <ResultPage />
              </ProtectedRoute>
            } />

            <Route path="/exam" element={
              <ProtectedRoute allowedRoles={['student']}>
                <ExamRoom onFinish={() => window.location.href = '/student/result'} />
              </ProtectedRoute>
            } />

            {/* DEFAULT REDIRECT */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}