import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState, User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if Cognito is configured
      const hasCognitoConfig = Boolean(
        import.meta.env.VITE_COGNITO_USER_POOL_ID &&
        import.meta.env.VITE_COGNITO_CLIENT_ID
      );

      if (!hasCognitoConfig) {
        // Use mock authentication for local development
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setAuthState({
            isAuthenticated: true,
            user,
            loading: false,
            error: null,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: null,
          });
        }
        return;
      }

      // Use real Cognito authentication
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        const user = await authService.getCurrentUser();
        setAuthState({
          isAuthenticated: true,
          user,
          loading: false,
          error: null,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Failed to check authentication',
      });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      // Check if Cognito is configured
      const hasCognitoConfig = Boolean(
        import.meta.env.VITE_COGNITO_USER_POOL_ID &&
        import.meta.env.VITE_COGNITO_CLIENT_ID
      );

      if (!hasCognitoConfig) {
        // Mock login for local development
        const mockUser: User = {
          userId: 'mock-user-id',
          email,
          name: email.split('@')[0],
          group: email.includes('reviewer') ? 'Reviewer_Group' : 'Requester_Group',
          cognitoSub: 'mock-sub',
        };

        localStorage.setItem('user', JSON.stringify(mockUser));

        setAuthState({
          isAuthenticated: true,
          user: mockUser,
          loading: false,
          error: null,
        });
        return;
      }

      // Real Cognito login
      const user = await authService.signIn(email, password);

      setAuthState({
        isAuthenticated: true,
        user,
        loading: false,
        error: null,
      });
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Login failed',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Check if Cognito is configured
      const hasCognitoConfig = Boolean(
        import.meta.env.VITE_COGNITO_USER_POOL_ID &&
        import.meta.env.VITE_COGNITO_CLIENT_ID
      );

      if (hasCognitoConfig) {
        await authService.signOut();
      } else {
        localStorage.removeItem('user');
      }

      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
