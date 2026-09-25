import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';

import { ToastProvider } from './context/ToastContext';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { LessonSession } from './pages/LessonSession';
import { ReviewSession } from './pages/ReviewSession';
import { SubjectsList } from './pages/SubjectsList';
import { AiCurriculum } from './pages/AiCurriculum';
import { SystemLogs } from './pages/SystemLogs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col font-sans transition-colors selection:bg-[#8b9a6e] selection:text-white">
                <Navbar />

                <div className="flex-1 flex flex-col">
                  <Routes>
                    {/* Public Auth routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Protected learning routes */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/lessons" element={<LessonSession />} />
                      <Route path="/lessons/session" element={<LessonSession />} />
                      <Route path="/reviews" element={<ReviewSession />} />
                      <Route path="/reviews/session" element={<ReviewSession />} />
                      <Route path="/subjects" element={<SubjectsList />} />
                      <Route path="/ai" element={<AiCurriculum />} />
                      <Route path="/logs" element={<SystemLogs />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>

                <BottomNav />
              </div>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
