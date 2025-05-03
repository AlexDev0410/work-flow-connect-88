
/**
 * Application Entry Point
 * 
 * This is the main entry point for the React application that:
 * - Sets up global providers
 * - Renders the main App component to the DOM
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { DataProvider } from './contexts/DataContext.tsx'
import { JobProvider } from './contexts/JobContext.tsx'
import { ChatProvider } from './contexts/ChatContext.tsx'
import { Toaster } from './components/ui/toaster.tsx'
import { initializeBackend } from './lib/initializeBackend.ts'

// Initialize backend connection before rendering the app
initializeBackend().then(() => {
  console.log("Backend initialization complete or already initialized");
}).catch(error => {
  console.error("Backend initialization failed:", error);
});

// Render the application to the DOM
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <JobProvider>
            <ChatProvider>
              <App />
              <Toaster />
            </ChatProvider>
          </JobProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
