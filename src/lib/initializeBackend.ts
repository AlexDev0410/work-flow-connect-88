
/**
 * Initialize backend connection
 * This file handles initial setup tasks when the application starts
 */

import { toast } from "@/components/ui/use-toast";

export const initializeBackend = async () => {
  try {
    // Check if the backend server is available
    const response = await fetch(`${import.meta.env.VITE_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(() => null);

    if (response && response.ok) {
      console.log("Backend connection initialized successfully");
      return true;
    } else {
      console.warn("Backend server may not be available. Some features may not work properly.");
      return false;
    }
  } catch (error) {
    console.error("Error initializing backend connection:", error);
    return false;
  }
};
