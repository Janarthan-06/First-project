import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard({ onLogout, user, token }) {
  const [forms, setForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/forms', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setForms(data);
      } else {
        setError('Failed to load forms');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/customize?new=true');
  };

  const handleCreateTemplate = (template) => {
    navigate(`/customize?new=true&template=${encodeURIComponent(template)}`);
  };

  const handleFormClick = (formId) => {
    navigate(`/form?formId=${formId}`);
  };

  const handleDeleteForm = async (formId, formName) => {
    if (!window.confirm(`Are you sure you want to delete "${formName}"? This will also delete all associated data.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setForms(forms.filter(form => form._id !== formId));
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete form');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', gap: '16px' }}>
      <div className="dashboard-header" style={{ position: 'relative', paddingRight: '120px' }}>
        <div className="header-content">
          <h1>My Forms Dashboard</h1>
          <p>Welcome back, {user?.username}!</p>
        </div>
        <button 
          className="logout-button btn btn-outline" 
          onClick={onLogout}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000 }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Templates sidebar */}
      <div style={{ flex: '0 0 260px', order: 2 }}>
        <div className="templates-card" style={{ position: 'sticky', top: 20, background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Templates</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button
              onClick={() => handleCreateTemplate('facebook')}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', textAlign: 'left' }}
            >
              📘 Facebook Login
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Name, Phone, Email, Password</div>
            </button>
            <button
              onClick={() => handleCreateTemplate('instagram')}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', textAlign: 'left' }}
            >
              📸 Instagram Login
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Name, Phone, Email, Password</div>
            </button>
            <button
              onClick={() => handleCreateTemplate('whatsapp')}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', textAlign: 'left' }}
            >
              💬 WhatsApp Login
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Name, Phone, Email, Password</div>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-content" style={{ flex: 1, order: 1 }}>
        <div className="forms-grid">
          {/* New Form Card */}
          <div className="form-card new-form-card" onClick={handleCreateNew}>
            <div className="card-content">
              <div className="new-form-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <h3>Create New Form</h3>
              <p>Start building a new custom form</p>
            </div>
          </div>

          {/* Existing Forms */}
          {isLoading ? (
            <div className="loading-card">
              <div className="loading-spinner"></div>
              <p>Loading forms...</p>
            </div>
          ) : forms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              <h3>No forms yet</h3>
              <p>Create your first form to get started</p>
            </div>
          ) : (
            forms.map((form) => (
              <div key={form._id} className="form-card existing-form-card" onClick={() => handleFormClick(form._id)}>
                <div className="card-content">
                  <div className="form-header">
                    <h3>{form.formName}</h3>
                    <button 
                      className="delete-form-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteForm(form._id, form.formName);
                      }}
                      title="Delete form"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                  <p className="form-title">{form.formTitle}</p>
                  <div className="form-meta">
                    <span className="form-fields-count">
                      {form.formFields?.length || 0} fields
                    </span>
                    <span className="form-date">
                      Created {formatDate(form.createdAt)}
                    </span>
                  </div>
                  {form.formHeader && (
                    <div className="form-header-preview">
                      <small>Header: {form.formHeader}</small>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
