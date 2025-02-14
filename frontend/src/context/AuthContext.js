import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = sessionStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    if (storedToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      const decoded = jwtDecode(storedToken);
      const storedUser = { id: decoded.userId, email: decoded.email };
      setUser(storedUser);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      console.log('Login response:', response.data);

      const { token } = response.data;
      if (!token) {
        throw new Error('Invalid login response');
      }

      // Decode the token to get the user information
      const decoded = jwtDecode(token);
      const user = { id: decoded.userId, email };

      setUser(user);
      setToken(token);
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('token', token);

      // Set the token in the API headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      toast.success('Login successful');
    } catch (error) {
      console.error('Login failed:', error.response ? error.response.data : error.message);
      toast.error('Login failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    toast.success('Logout successful');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
