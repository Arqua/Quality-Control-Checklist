import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'manager' | 'inspector';

export interface AuthUser {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  /** True when the signed-in user is an approved management account. */
  isManager: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'authUser';

/**
 * Approved accounts. Manager accounts automatically enter "management mode"
 * (extra visibility + the alerts inbox). For field testing these are static;
 * a real deployment would validate against the backend.
 */
const APPROVED_USERS: Record<string, { password: string; role: UserRole }> = {
  admin: { password: '1234', role: 'manager' },
  manager: { password: '1234', role: 'manager' },
  inspector: { password: '1234', role: 'inspector' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore a previous session, if any.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setUser(JSON.parse(raw) as AuthUser);
        }
      } catch (error) {
        console.error('Failed to check auth', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const key = username.trim().toLowerCase();
    const account = APPROVED_USERS[key];
    if (account && account.password === password) {
      const authUser: AuthUser = { username: key, role: account.role };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        setUser(authUser);
        return true;
      } catch (error) {
        console.error('Failed to save auth user', error);
        return false;
      }
    }
    return false;
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isLoading,
        user,
        isManager: user?.role === 'manager',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
