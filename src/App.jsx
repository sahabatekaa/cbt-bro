// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// ==========================================
// IMPORT HALAMAN (Nanti kita buat filenya satu-satu)
// ==========================================
import LoginPortal from './pages/auth/LoginPortal';
// Placeholder untuk komponen yang akan datang
const SuperAdminDashboard = () => <div className="p-10 text-center font-bold">Master Dashboard (Soon)</div>;
const TeacherDashboard = () => <div className="p-10 text-center font-bold">Teacher Dashboard (Soon)</div>;
const StudentDashboard = () => <div className="p-10 text-center font-bold">Student Dashboard (Soon)</div>;
const ExamRoom = () => <div className="p-10 text-center font-bold">Exam Room (Soon)</div>;
const ProctorDashboard = () => <div className="p-10 text-center font-bold">Proctor Dashboard (Soon)</div>;

// ==========================================
// SATPAM DIGITAL (ROLE-BASED PROTECTED ROUTE)
// ==========================================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userData, loading } = useAuth();
  
  // Karena siswa login pakai Token/LocalStorage (bukan email), kita buat bypass aman
  const isStudent = allowedRoles.includes('student');
  const studentData = localStorage.getItem('studentData');

  if (loading) return null; // Loading state sudah diurus oleh AuthProvider

  if (isStudent && studentData) {
    return children;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  // Pengaturan Dark Mode Global
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
                <SuperAdminDashboard />
              </ProtectedRoute>
            } />

            {/* TEACHER & SCHOOL ADMIN ROUTE (Client) */}
            <Route path="/teacher/*" element={
              <ProtectedRoute allowedRoles={['teacher', 'admin_sekolah']}>
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
            <Route path="/student/dashboard" element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/exam" element={
              <ProtectedRoute allowedRoles={['student']}>
                <ExamRoom />
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