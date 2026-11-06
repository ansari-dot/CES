import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, AuthContextType } from '../types/auth';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { BrandLoader } from '../components/common/BrandLoader';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_SESSION_KEY = 'iqra_principal_portal_auth_token_v1';
const AUTH_EMAIL_KEY = 'iqra_principal_portal_remember_email';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeSession, setActiveSessionState] = useState<string>('2024-2025');
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useToast();

  const verifyExistingSession = useCallback(async () => {
    try {
      setLoading(true);
      const persistentToken = localStorage.getItem(AUTH_SESSION_KEY);
      const sessionToken = sessionStorage.getItem(AUTH_SESSION_KEY);

      if (persistentToken || sessionToken) {
        const profile = await api.getProfile();
        if (profile) {
          setCurrentUser(profile);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(AUTH_SESSION_KEY);
          sessionStorage.removeItem(AUTH_SESSION_KEY);
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        // Fallback: check if active HTTP cookie session exists
        const profile = await api.getProfile();
        if (profile) {
          setCurrentUser(profile);
          setIsAuthenticated(true);
          sessionStorage.setItem(AUTH_SESSION_KEY, 'cookie_session_active');
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.warn('No active authenticated session found:', err);
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyExistingSession();
  }, [verifyExistingSession]);

  const login = async (email: string, password: string, rememberMe = true): Promise<UserProfile> => {
    try {
      const user = await api.login(email, password);
      const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      if (rememberMe) {
        localStorage.setItem(AUTH_SESSION_KEY, token);
        localStorage.setItem(AUTH_EMAIL_KEY, email);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      } else {
        sessionStorage.setItem(AUTH_SESSION_KEY, token);
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_EMAIL_KEY);
      }

      setCurrentUser(user);
      setIsAuthenticated(true);
      toast.success(`Welcome, ${user.name}! Principal operational session active.`);
      return user;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      toast.error(msg);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // quiet fallback
    }
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setCurrentUser(null);
    setIsAuthenticated(false);
    toast.info('Signed out. Your security credentials have been cleared.');
  };

  const setActiveSession = (session: string) => {
    setActiveSessionState(session);
    toast.info(`Active academic session switched to ${session}`);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      const updated = await api.updateProfile(data);
      setCurrentUser(updated);
      toast.success('Principal profile updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      toast.error(msg);
      throw err;
    }
  };

  if (loading) {
    return (
      <BrandLoader
        fullScreen
        message="Verifying Principal Security Session..."
        subtext="Cambridge Education System"
        size="lg"
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        loading,
        activeSession,
        setActiveSession,
        updateProfile,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
