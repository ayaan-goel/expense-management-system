import { User } from '@/types';

export const setAuthData = (token: string, user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const getAuthData = (): { token: string | null; user: User | null } => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  }
  return { token: null, user: null };
};

export const clearAuthData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export const isAuthenticated = (): boolean => {
  const { token, user } = getAuthData();
  return !!(token && user);
};

export const getUserRole = (): string | null => {
  const { user } = getAuthData();
  return user?.role || null;
};

export const hasRole = (requiredRole: string): boolean => {
  const userRole = getUserRole();
  return userRole === requiredRole;
};

export const hasAnyRole = (requiredRoles: string[]): boolean => {
  const userRole = getUserRole();
  return userRole ? requiredRoles.includes(userRole) : false;
};

export const getRedirectPath = (role: string): string => {
  switch (role) {
    case 'admin':
      return '/dashboard/admin';
    case 'manager':
      return '/dashboard/manager';
    case 'employee':
      return '/employee';
    default:
      return '/login';
  }
};
