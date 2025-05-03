
/**
 * Main Application Component
 * 
 * This is the entry point for the React application that contains:
 * - Global providers (Theme, Auth, Data, Jobs, Chat)
 * - Routing configuration using React Router
 * - Protected routes implementation
 * - Public routes configuration
 */

import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { JobProvider } from "@/contexts/JobContext";
import { DataProvider } from "@/contexts/DataContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { initializeBackend } from "@/lib/initializeBackend";

// Import page components
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import JobsPage from "./pages/JobsPage";
import JobDetail from "./pages/JobDetail";
import ProfilePage from "./pages/ProfilePage";
import ChatsPage from "./pages/ChatsPage";
import UserProfile from "./pages/UserProfile";
import CreateJobPage from "./pages/CreateJobPage";
import NotFound from "./pages/NotFound";

// Initialize React Query client
const queryClient = new QueryClient();

/**
 * Protected Route Component
 * Ensures the user is authenticated before accessing the route
 * Redirects to login if not authenticated
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};

/**
 * Public Only Route Component
 * Only accessible when not logged in
 * Redirects to dashboard if already authenticated
 */
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }
  
  if (currentUser) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
};

/**
 * App Routes Component
 * Contains all the routes and their access protection
 */
const AppRoutes = () => {
  // Initialize backend connection when the app loads
  useEffect(() => {
    initializeBackend();
  }, []);
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      
      {/* Protected routes - require authentication */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
      <Route path="/jobs/:jobId" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
      <Route path="/jobs/create" element={<ProtectedRoute><CreateJobPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/chats" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
      <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/create-job" element={<ProtectedRoute><CreateJobPage /></ProtectedRoute>} />
      
      {/* 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

/**
 * Main App Component
 * Sets up all providers and global configuration
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <JobProvider>
              <ChatProvider>
                <TooltipProvider>
                  <AppRoutes />
                  <Toaster />
                  <Sonner />
                </TooltipProvider>
              </ChatProvider>
            </JobProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
