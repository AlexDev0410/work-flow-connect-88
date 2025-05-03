
import React, { createContext, useContext, useState, useEffect } from 'react';
import { JobType } from './JobContext';
import { getAllUsers, getJobCategories, getSkillsList, getAllJobs } from '@/lib/api';

// Make sure the UserType in DataContext matches or extends the AuthContext UserType
export type UserType = {
  id: string;
  name: string;
  email: string;
  role: "freelancer" | "client";
  skills?: string[];
  bio?: string;
  photoURL?: string;
  hourlyRate?: number;
  joinedAt?: number;
};

export interface DataContextType {
  users: UserType[];
  getUserById: (userId: string) => UserType | undefined;
  getAllUsers: () => UserType[];
  loading: boolean;
  jobs: JobType[];
  jobCategories: string[];
  skillsList: string[];
  loadData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobCategories, setJobCategories] = useState<string[]>([]);
  const [skillsList, setSkillsList] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargamos en paralelo para optimizar
      const [usersData, jobsData, categories, skills] = await Promise.all([
        getAllUsers(),
        getAllJobs(),
        getJobCategories(),
        getSkillsList()
      ]);
      
      setUsers(usersData);
      setJobs(jobsData);
      setJobCategories(categories);
      setSkillsList(skills);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getUserById = (userId: string) => {
    return users.find(user => user.id === userId);
  };
  
  const getAllUsers = () => {
    return users;
  };

  return (
    <DataContext.Provider
      value={{
        users,
        getUserById,
        getAllUsers,
        loading,
        jobCategories,
        skillsList,
        jobs,
        loadData
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
