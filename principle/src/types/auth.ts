export type UserRole = 'Administrator' | 'Principal' | 'Teacher' | 'Student' | 'Parent';

export type AccountStatus = 'Active' | 'Temporarily Suspended' | 'Deactivated' | 'Pending Verification';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  designation: string;
  avatarUrl?: string;
  accountStatus: AccountStatus;
  lastLogin: string;
  joiningDate: string;
}

export interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  activeSession: string;
  setActiveSession: (session: string) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<UserProfile>;
  logout: () => void;
}
