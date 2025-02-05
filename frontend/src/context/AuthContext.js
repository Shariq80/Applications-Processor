import React, { createContext, useState, useContext } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode'; // Correct import statement

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

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
      localStorage.setItem('token', token);

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
    localStorage.removeItem('token');
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
