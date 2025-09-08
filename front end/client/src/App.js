import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './Login';
import Dashboard from './Dashboard';
import Form from './Form';
import Customize from './Customize';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <Router>
      <div className="App">
        {!isAuthenticated ? (
          <Login onLogin={handleLogin} />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard onLogout={handleLogout} user={user} token={token} />} />
            <Route path="/form" element={<Form onLogout={handleLogout} user={user} token={token} />} />
            <Route path="/customize" element={<Customize onLogout={handleLogout} user={user} token={token} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
