
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { UserType } from './AuthContext';
import { 
  getAllJobs, 
  getJobById, 
  createJob as apiCreateJob,
  updateJob as apiUpdateJob,
  deleteJob as apiDeleteJob,
  addCommentToJob, 
  addReplyToComment as apiAddReplyToComment
} from '@/lib/api';
import axios from 'axios';

export type ReplyType = {
  id: string;
  commentId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  timestamp: number;
};

export type CommentType = {
  id: string;
  jobId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  timestamp: number;
  replies: ReplyType[];
};

export type JobType = {
  id: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  skills: string[];
  userId: string;
  userName: string;
  userPhoto?: string;
  timestamp: number;
  status: 'open' | 'in-progress' | 'completed';
  comments: CommentType[];
  likes: string[]; // Array de IDs de usuarios que dieron like;
};

type JobContextType = {
  jobs: JobType[];
  loading: boolean;
  createJob: (jobData: Omit<JobType, 'id' | 'timestamp' | 'comments' | 'likes'>) => Promise<JobType>;
  updateJob: (jobId: string, jobData: Partial<JobType>) => Promise<JobType>;
  deleteJob: (jobId: string) => Promise<boolean>;
  addComment: (jobId: string, content: string, user: UserType) => Promise<void>;
  addReplyToComment: (jobId: string, commentId: string, content: string, user: UserType) => Promise<void>;
  getJob: (jobId: string) => JobType | undefined;
  toggleSavedJob: (jobId: string, userId: string) => void;
  getSavedJobs: (userId: string) => Promise<JobType[]>;
  toggleLike: (jobId: string, userId: string) => void;
  savedJobs: string[]; // Array de IDs de trabajos guardados por el usuario actual
  loadJobs: () => Promise<void>; // Add method to refresh jobs
};

const JobContext = createContext<JobContextType | null>(null);

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};

interface JobProviderProps {
  children: ReactNode;
}

export const JobProvider: React.FC<JobProviderProps> = ({ children }) => {
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const jobsData = await getAllJobs();
      setJobs(jobsData);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const createJob = async (jobData: Omit<JobType, 'id' | 'timestamp' | 'comments' | 'likes'>) => {
    try {
      const newJob = await apiCreateJob(jobData);
      setJobs(prevJobs => [newJob, ...prevJobs]);
      return newJob;
    } catch (error) {
      console.error("Error creating job:", error);
      throw error;
    }
  };

  const updateJob = async (jobId: string, jobData: Partial<JobType>) => {
    try {
      const updatedJob = await apiUpdateJob(jobId, jobData);
      
      setJobs(prevJobs => prevJobs.map(job => 
        job.id === jobId ? updatedJob : job
      ));
      
      return updatedJob;
    } catch (error) {
      console.error("Error updating job:", error);
      throw error;
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const { success } = await apiDeleteJob(jobId);
      
      if (success) {
        setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      }
      
      return success;
    } catch (error) {
      console.error("Error deleting job:", error);
      throw error;
    }
  };

  const addComment = async (jobId: string, content: string, user: UserType) => {
    try {
      const newComment = await addCommentToJob(jobId, content);
      
      setJobs(prevJobs => prevJobs.map(job => 
        job.id === jobId 
          ? { ...job, comments: [...job.comments, newComment] }
          : job
      ));
    } catch (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
  };

  const addReplyToComment = async (jobId: string, commentId: string, content: string, user: UserType) => {
    try {
      const newReply = await apiAddReplyToComment(commentId, content);
      
      setJobs(prevJobs => prevJobs.map(job => {
        if (job.id !== jobId) return job;
        
        return {
          ...job,
          comments: job.comments.map(comment => 
            comment.id === commentId
              ? { ...comment, replies: [...comment.replies, newReply] }
              : comment
          )
        };
      }));
    } catch (error) {
      console.error("Error adding reply:", error);
      throw error;
    }
  };

  const getJob = (jobId: string) => {
    return jobs.find(job => job.id === jobId);
  };

  const toggleSavedJob = async (jobId: string, userId: string) => {
    try {
      // Esta función deberá implementarse en el backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await axios.post(
        `${API_URL}/users/saved-jobs/${jobId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const isNowSaved = response.data.saved;
      
      setSavedJobs(prev => {
        if (isNowSaved) {
          return [...prev, jobId];
        } else {
          return prev.filter(id => id !== jobId);
        }
      });
    } catch (error) {
      console.error("Error toggling saved job:", error);
    }
  };

  const getSavedJobs = async (userId: string) => {
    try {
      // Esta función deberá implementarse en el backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await axios.get(
        `${API_URL}/users/saved-jobs`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const savedJobsData = response.data;
      const savedJobIds = savedJobsData.map(job => job.id);
      setSavedJobs(savedJobIds);
      return savedJobsData;
    } catch (error) {
      console.error("Error getting saved jobs:", error);
      return [];
    }
  };

  const toggleLike = async (jobId: string, userId: string) => {
    try {
      // Esta función deberá implementarse en el backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await axios.post(
        `${API_URL}/jobs/${jobId}/likes`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const isNowLiked = response.data.liked;
      
      setJobs(prevJobs => prevJobs.map(job => {
        if (job.id !== jobId) return job;
        
        return {
          ...job,
          likes: isNowLiked
            ? [...job.likes, userId]
            : job.likes.filter(id => id !== userId)
        };
      }));
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  return (
    <JobContext.Provider
      value={{
        jobs,
        loading,
        createJob,
        updateJob,
        deleteJob,
        addComment,
        addReplyToComment,
        getJob,
        toggleSavedJob,
        getSavedJobs,
        toggleLike,
        savedJobs,
        loadJobs
      }}
    >
      {children}
    </JobContext.Provider>
  );
};
