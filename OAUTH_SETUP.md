# OAuth Setup Guide for Google and GitHub

This guide will help you set up OAuth authentication for Google and GitHub in your MERN stack application.

## 🔐 Google OAuth Setup

### 1. Create Google OAuth Application

1. Go to Google Cloud Console
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Go to "APIs & Services" > "Credentials"
5. Click "Create Credentials" > "OAuth 2.0 Client IDs"
6. Choose "Web application" as the application type
7. Add authorized redirect URIs:
   - `http://localhost:3000` (for development)
   - `http://localhost:3000/auth/google/callback` (if using callback)
8. Copy the Client ID and Client Secret

### 2. Update Configuration Files

Backend (`back end/server.js`):
```javascript
const GOOGLE_CLIENT_ID = 'your-actual-google-client-id.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'your-actual-google-client-secret';
```

Frontend (`front end/client/public/index.html`):
```html
<meta name="google-signin-client_id" content="your-actual-google-client-id.apps.googleusercontent.com">
```

Frontend (`front end/client/src/Login.jsx`):
```javascript
client_id: 'your-actual-google-client-id.apps.googleusercontent.com'
```

## 🐙 GitHub OAuth Setup

### 1. Create GitHub OAuth Application

1. Go to GitHub Developer Settings
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: Your app name
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github/callback`
4. Click "Register application"
5. Copy the Client ID and Client Secret

### 2. Update Configuration Files

Backend (`back end/server.js`):
```javascript
const GITHUB_CLIENT_ID = 'your-actual-github-client-id';
const GITHUB_CLIENT_SECRET = 'your-actual-github-client-secret';
```

Frontend (`front end/client/src/Login.jsx`):
```javascript
const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=your-actual-github-client-id&scope=user:email&redirect_uri=${encodeURIComponent(window.location.origin)}`;
```

## 🚀 Installation Steps

Backend:
```bash
cd "back end"
npm install axios dotenv
```

Frontend:
```bash
cd "front end/client"
npm install
```

## 🔧 Environment Variables (Recommended)

Create a `.env` file in your backend directory:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
JWT_SECRET=your-super-secret-jwt-key
MONGODB_URI=your-mongodb-connection-string
```

Then update `server.js` to use environment variables:
```javascript
require('dotenv').config();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
```

## 🔒 Security Best Practices

- Never expose OAuth secrets in client-side code
- Use environment variables for all sensitive configuration
- Validate OAuth tokens on the backend
- Use HTTPS in production
- Log OAuth activities

## 📚 References

- Google OAuth 2.0 Documentation
- GitHub OAuth Documentation
- JWT.io
- OAuth.net
