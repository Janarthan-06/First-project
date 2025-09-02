import React, { useEffect, useState } from 'react';

function Login({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle GitHub token returned via hash from backend redirect
  useEffect(() => {
    if (window.location.hash && window.location.hash.includes('token=')) {
      const params = new URLSearchParams(window.location.hash.replace('#', ''));
      const token = params.get('token');
      const username = params.get('username') || 'GitHub User';
      const email = params.get('email') || '';
      if (token) {
        const user = { username, email, provider: 'github' };
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        onLogin(user, token);
        // Clean hash
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    }
  }, [onLogin]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isSignup && formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      const endpoint = isSignup ? '/api/signup' : '/api/login';
      const payload = isSignup 
        ? { username: formData.username, email: formData.email, password: formData.password }
        : { username: formData.username, password: formData.password };

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setTimeout(() => { onLogin(data.user, data.token); }, 800);
      } else {
        setError(data.message || 'Request failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    setError('');
    setSuccess('');
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      // Use Google Identity Services One Tap or popup if available
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.initialize({ client_id: 'YOUR_GOOGLE_CLIENT_ID', callback: async (response) => {
          try {
            const googleJwt = response.credential; // ID token
            // Exchange ID token for user info -> use Google userinfo via implicit access token is typical; here we call backend if you have access token flow
            // If you configure frontend to obtain access token, send it instead. For simplicity, call Google endpoint is not possible with just ID token; so send to backend (requires backend verifier). Skipping exchange, show fallback message:
            setError('Please configure Google access token flow or backend ID token verification.');
          } catch (e) {
            setError('Google authentication failed');
          } finally {
            setIsLoading(false);
          }
        }});
        window.google.accounts.id.prompt();
      } else {
        // Fallback: inform to add script and client id
        setError('Google script not loaded. Add Client ID and script in index.html');
        setIsLoading(false);
      }
    } catch (e) {
      setError('Google authentication failed');
      setIsLoading(false);
    }
  };

  const handleGithubLogin = () => {
    // Redirect to GitHub authorize, backend handles callback and redirects back with token in hash
    const clientId = 'YOUR_GITHUB_CLIENT_ID';
    const redirectUri = window.location.origin; // backend redirects back to this after token exchange
    const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=user:email&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = url;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
          <p>{isSignup ? 'Sign up to get started' : 'Sign in to continue'}</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleSubmit} className="auth-form surface">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" type="text" value={formData.username} onChange={handleInputChange} required placeholder="Enter your username" className="input" />
          </div>

          {isSignup && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="Enter your email" className="input" />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} required placeholder="Enter your password" className="input" />
          </div>

          {isSignup && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleInputChange} required placeholder="Confirm your password" className="input" />
            </div>
          )}

          <button type="submit" className="submit-button btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Processing...' : (isSignup ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="toggle-mode">
          <p>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <button type="button" className="toggle-button" onClick={toggleMode}>
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
        <div className="divider"><span>or</span></div>
        <div className="login-buttons">
          <button className="auth-button google-button btn btn-outline" onClick={handleGoogleLogin} disabled={isLoading}>
            <svg className="auth-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.91 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>
         
          <button className="auth-button github-button btn btn-outline" onClick={handleGithubLogin} disabled={isLoading}>
            <svg className="auth-icon" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            {isLoading ? 'Signing in...' : 'Continue with GitHub'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default Login;
