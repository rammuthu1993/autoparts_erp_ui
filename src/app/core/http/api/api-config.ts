export const API_BASE_URL = 'http://localhost:8080';

export const AUTH_API = {
  login: `${API_BASE_URL}/api/v1/auth/login`,
  refresh: `${API_BASE_URL}/api/v1/auth/refresh`,
  logout: `${API_BASE_URL}/api/v1/auth/logout`
} as const;
