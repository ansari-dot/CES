import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, AuthContextType } from '../types/auth';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { BrandLoader } from '../components/common/BrandLoader';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeSession, setActiveSessionState] = useState<string>('2024-2025');
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useToast();

  const verifyExistingSession = useCallback(async () => {
    try {
      setLoading(true);
      // Clean up any legacy or exposed tokens in client browser storage
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('iqra_principal_portal_auth_token_v1');
          localStorage.removeItem('iqra_principal_portal_remember_email');
          localStorage.removeItem('iqra_principal_portal_db_clean_v4');
          sessionStorage.removeItem('iqra_principal_portal_auth_token_v1');
        } catch (_) {}
      }

      // Verify session via secure HttpOnly session cookie directly with server
      const profile = await api.getProfile();
      if (profile) {
        setCurrentUser(profile);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
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
      const user = await api.login(email, password, rememberMe);

      // Clean up any legacy storage keys
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('iqra_principal_portal_auth_token_v1');
          localStorage.removeItem('iqra_principal_portal_remember_email');
          localStorage.removeItem('iqra_principal_portal_db_clean_v4');
          sessionStorage.removeItem('iqra_principal_portal_auth_token_v1');
        } catch (_) {}
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('iqra_principal_portal_auth_token_v1');
        localStorage.removeItem('iqra_principal_portal_remember_email');
        localStorage.removeItem('iqra_principal_portal_db_clean_v4');
        sessionStorage.removeItem('iqra_principal_portal_auth_token_v1');
      } catch (_) {}
    }
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
