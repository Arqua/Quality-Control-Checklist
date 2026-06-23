import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

export type UserRole = 'manager' | 'inspector';

export interface AuthUser {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  /** JWT token from backend login. */
  token: string | null;
  /** True when the signed-in user is an approved management account. */
  isManager: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_USER_KEY = 'authUser';
const STORAGE_TOKEN_KEY = 'authToken';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore a previous session, if any.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [userRaw, tokenRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_USER_KEY),
          AsyncStorage.getItem(STORAGE_TOKEN_KEY),
        ]);
        if (userRaw) {
          setUser(JSON.parse(userRaw) as AuthUser);
        }
        if (tokenRaw) {
          setToken(tokenRaw);
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
    if (!API_BASE_URL) {
      console.error('Backend URL not configured; cannot login');
      return false;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        { username: username.trim(), password },
        { timeout: 15000 }
      );

      if (response.data?.success && response.data?.token && response.data?.user) {
        const authUser: AuthUser = {
          username: response.data.user.username,
          role: response.data.user.role,
        };
        const newToken = response.data.token;

        try {
          await Promise.all([
            AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser)),
            AsyncStorage.setItem(STORAGE_TOKEN_KEY, newToken),
          ]);
          setUser(authUser);
          setToken(newToken);
          return true;
        } catch (error) {
          console.error('Failed to save auth session', error);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error instanceof Error ? error.message : error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_USER_KEY),
        AsyncStorage.removeItem(STORAGE_TOKEN_KEY),
      ]);
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user && !!token,
        isLoading,
        user,
        token,
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
