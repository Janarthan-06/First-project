import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Form({ onLogout, user, token }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const [formData, setFormData] = useState({ name: '', number: '', email: '' });
  const [submittedData, setSubmittedData] = useState([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', number: '', email: '' });

  const [filters, setFilters] = useState({ name: '', number: '', email: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'submittedAt', direction: 'desc' });
  const [customization, setCustomization] = useState({ formTitle: 'Data Entry Form', formHeader: '', formFields: [], submitText: 'Submit' });

  // Load customization (title, header, fields)
  useEffect(() => {
    // Prefer cached customization immediately for UX
    try {
      const cached = localStorage.getItem('customization');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.formFields)) {
          setCustomization({
            formTitle: parsed.formTitle || 'Data Entry Form',
            formHeader: parsed.formHeader || '',
            formFields: parsed.formFields,
            submitText: parsed.submitText || 'Submit'
          });
        }
      }
    } catch (_) {}

    const loadCustomization = async () => {
      try {
        let endpoint = '/api/customization';
        if (formId) {
          endpoint = `/api/forms/${formId}`;
        }
        
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCustomization({
            formTitle: data.formTitle || 'Data Entry Form',
            formHeader: data.formHeader || '',
            formFields: Array.isArray(data.formFields) ? data.formFields : [],
            submitText: data.submitText || 'Submit'
          });
          try { localStorage.setItem('customization', JSON.stringify({ formTitle: data.formTitle, formHeader: data.formHeader || '', formFields: data.formFields, submitText: data.submitText })); } catch (_) {}
        }
      } catch (e) {}
    };
    loadCustomization();
  }, [token, formId]);

  const fetchFormData = async () => {
    try {
      let url = '/api/form-data';
      if (formId) {
        url += `?formId=${formId}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmittedData(data);
      }
    } catch (e) {}
  };

  useEffect(() => { 
    fetchFormData(); 
    
    // Test server connection
    fetch('/api/profile', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.ok) {
        console.log('Server connection: OK');
      } else {
        console.log('Server connection: Error', res.status);
      }
    }).catch(err => {
      console.log('Server connection: Failed', err);
    });
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      // Client-side required field guard
      const requiredMissing = ['name','number','email'].filter(k => !String(formData[k] || '').trim());
      if (requiredMissing.length) {
        setMessage(`Please fill required field(s): ${requiredMissing.join(', ')}`);
        setIsSubmitting(false);
        return;
      }

      const normalized = { ...formData };

      const res = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...normalized, formId })
      });
      let data;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
      if (res.ok) {
        setMessage('Form submitted successfully!');
        setFormData({ name: '', number: '', email: '' });
        fetchFormData();
      } else {
        const detail = data?.message || data?.error || `HTTP ${res.status}`;
        setMessage(`Failed to submit form: ${detail}`);
      }
    } catch (e) {
      setMessage(`Network error. Please try again. ${e?.message || ''}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    setMessage(`File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setMessage('Please select a file (.xlsx, .xls, or .csv)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File size too large. Please select a file smaller than 5MB.');
      return;
    }

    setIsUploading(true);
    setMessage('Uploading file...');

    const formData = new FormData();
    formData.append('excelFile', file);

    console.log('FormData created, sending request...');

    try {
      const res = await fetch(`/api/upload-excel${formId ? `?formId=${encodeURIComponent(formId)}` : ''}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);

      if (!res.ok) {
        let errorText;
        try { errorText = await res.text(); } catch (_) { errorText = ''; }
        console.error('Server error response:', errorText);
        setMessage(`Server error: ${res.status} - ${errorText || 'Upload failed'}`);
        return;
      }

      const data = await res.json();
      console.log('Response data:', data);

      setMessage(`Successfully imported ${data.importedCount} records from Excel file!`);
      fetchFormData(); // Refresh the table
      
    } catch (e) {
      console.error('Upload error:', e);
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setMessage('Cannot connect to server. Please make sure the backend is running on port 5000.');
      } else {
        setMessage(`Network error: ${e.message}`);
      }
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setEditFormData({
      name: item.name,
      number: item.number,
      email: item.email
    });
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (id) => {
    try {
      const res = await fetch(`/api/form-data/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editFormData)
      });

      if (res.ok) {
        setMessage('Record updated successfully!');
        setEditingId(null);
        setEditFormData({ name: '', number: '', email: '' });
        fetchFormData();
      } else {
        const data = await res.json();
        setMessage(data.message || 'Failed to update record');
      }
    } catch (e) {
      setMessage('Network error. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({ name: '', number: '', email: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      const res = await fetch(`/api/form-data/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage('Record deleted successfully!');
        fetchFormData();
      } else {
        const data = await res.json();
        setMessage(data.message || 'Failed to delete record');
      }
    } catch (e) {
      setMessage('Network error. Please try again.');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString();

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    // Search in both name and email fields
    setFilters(prev => ({
      ...prev,
      name: searchTerm,
      email: searchTerm
    }));
  };

  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setFilters({ name: '', number: '', email: '' });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        const nextDir = prev.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction: nextDir };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredSortedData = useMemo(() => {
    const f = filters;
    const normalized = (v) => String(v || '').toLowerCase();
    let data = submittedData.filter((row) => {
      // Check if search term matches name or email
      const searchMatch = !f.name || 
        normalized(row.name).includes(normalized(f.name)) ||
        normalized(row.email).includes(normalized(f.email));
      
      // Check other filters
      const numberMatch = !f.number || String(row.number).includes(f.number);
      
      return searchMatch && numberMatch;
    });

    const { key, direction } = sortConfig;
    data.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return direction === 'asc' ? -1 : 1;
      if (bv == null) return direction === 'asc' ? 1 : -1;
      if (key === 'number') {
        const na = Number(av), nb = Number(bv);
        return direction === 'asc' ? na - nb : nb - na;
      }
      if (key === 'submittedAt') {
        const ta = new Date(av).getTime();
        const tb = new Date(bv).getTime();
        return direction === 'asc' ? ta - tb : tb - ta;
      }
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      if (sa < sb) return direction === 'asc' ? -1 : 1;
      if (sa > sb) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [submittedData, filters, sortConfig]);

  const SortIndicator = ({ column }) => {
    if (sortConfig.key !== column) return <span className="sort-indicator">⇅</span>;
    return <span className="sort-indicator">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="form-container">
      {/* Welcome box positioned at top-left */}
      <div className="welcome-box-top-left">
        <div className="text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Welcome</div>
        <h2 style={{ margin: 0 }}>{user?.username || user?.name}</h2>
        <p style={{ marginTop: '8px' }}>Submit your information or import data from Excel</p>
      </div>

      {/* Logout button positioned at top-right */}
      <button className="logout-button-top-right" onClick={onLogout}>Logout</button>
      
      {/* Edit button positioned next to logout */}
      <button 
        className="edit-button-top-right" 
        onClick={() => navigate(formId ? `/customize?formId=${formId}` : '/customize')}
        style={{
          position: 'absolute',
          top: '20px',
          marginRight:'5%',
          right: '120px',
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        Edit
      </button>
      
      {/* Back to Dashboard button */}
      <button 
        className="back-button-top-left" 
        onClick={() => navigate('/')}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '8px 16px',
          backgroundColor: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        ← Dashboard
      </button>

      <h1 className="page-title" style={{ fontWeight: 'bold', textAlign: 'center' }}>{customization.formTitle || 'Data Entry Form'}</h1>
      <div className='container' >

     
      <div className="form-content surface-lg">
        <div className="split-row" style={{ display: 'flex', gap: '0px', alignItems: 'flex-start', justifyContent: 'flex-start', flexWrap: 'nowrap',marginLeft:'20px'}}>
          <div style={{ flex: '0 0 0%', boxSizing: 'border-box' }}>
            <div className="form-header">
              <h4 style={{ whiteSpace: 'nowrap' }}> Excel file to import data.</h4>
            </div>
            {/* Excel Upload Section */}
            <div className="excel-upload-section surface" style={{ padding: '16px', borderRadius: '12px' }}>
              <h3>Import Data from Excel</h3>
              <div className="upload-container">
                {/* Direct file input - more reliable */}
                <input
                  type="file"
                  id="excelFile"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="file-input"
                  disabled={isUploading}
                  style={{ 
                    display: 'flex',
                    width: '100%',
                    padding: '8px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#f9fafb',
                    cursor: 'pointer'
                  }}
                />
                <span className="file-info">Supports .xlsx and .xls files</span>
                {isUploading && <div className="upload-progress">Processing file...</div>}
                
                {/* Excel Format Guide – dynamic based on fields */}
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0369a1' }}>📋 Excel Format Required:</h4>
                  <div style={{ fontSize: '12px', color: '#0c4a6e' }}>
                    {(customization.formFields || []).map((f, idx) => (
                      <div key={f.name}>• <strong>Column {String.fromCharCode(65 + idx)}:</strong> {f.label || f.name} {f.required ? '(required)' : '(optional)'}{f.type === 'number' ? ', numbers only' : ''}</div>
                    ))}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                    <em>First row should contain column headers matching your field labels.</em>
                  </div>
                  
                  {/* Sample Data Button */}
                  <button 
                    type="button"
                    onClick={() => {
                      const header = (customization.formFields || []).map(f => f.label || f.name);
                      const row1 = (customization.formFields || []).map(f => f.name === 'number' ? '123-456-7890' : f.name === 'email' ? 'john@example.com' : f.name === 'name' ? 'John Doe' : f.name === 'password' ? '••••••' : '');
                      const row2 = (customization.formFields || []).map(f => f.name === 'number' ? '987-654-3210' : f.name === 'email' ? 'jane@example.com' : f.name === 'name' ? 'Jane Smith' : f.name === 'password' ? '••••••' : '');
                      const sampleData = [header, row1, row2];
                      
                      let csvContent = "data:text/csv;charset=utf-8,";
                      sampleData.forEach(row => {
                        csvContent += row.join(",") + "\r\n";
                      });
                      
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "sample_data.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    style={{ 
                      marginTop: '8px', 
                      display:'flex',
                      padding: '6px 12px', 
                      fontSize: '11px', 
                      backgroundColor: '#0369a1', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: 'pointer' 
                    }}
                  >
                    📥 Download Sample CSV
                  </button>
                </div>
                
                {/* Status display */}
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  <div>Server Status: <span style={{ color: '#10b981' }}>✓ Ready</span></div>
                  <div>File Input: <span style={{ color: '#10b981' }}>✓ Active</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: '0 0 30%', boxSizing: 'border-box', marginLeft: '0%' }}>
            <div className="form-header2" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
              <h4
                style={{
                  textAlign: 'center',
                  margin: '0 auto',
                  fontWeight: 500,
                  width: '100%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  color: '#1e293b',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '32px',
                  padding: 0
                }}
              >
                {customization.formHeader || (
                  <span style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                    Enter your information below and Submit the form.
                  </span>
                )}
              </h4>
            </div>
            <form id="created"  onSubmit={handleSubmit} className="data-form surface" style={{ padding: '16px', borderRadius: '12px' }}>
              {(customization.formFields || []).map((field, idx) => (
                <div className="form-row" key={field.name || idx}>
                  <div className="form-group" style={{ width: '100%' }}>
                    <label htmlFor={field.name || `field_${idx}`}>{field.label || field.name || `Field ${idx+1}`}</label>
                    <input
                      id={field.name || `field_${idx}`}
                      name={field.name}
                      type={field.type || 'text'}
                      value={formData[field.name] || ''}
                      onChange={handleChange}
                      required={!!field.required}
                      className="input"
                    />
                  </div>
                </div>
              ))}

              {message && <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>{message}</div>}

              <button type="submit" className="submit-button btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : (customization.submitText || 'Submit')}</button>
          </form>
          </div>
        </div>
      </div>

        <div className="data-table-section">
          <div className="table-toolbar">
            <div className="filters-row">
              <div className="search-container" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                <input 
                  className="filter-input" 
                  type="text"
                  placeholder="Search by name or email..." 
                  value={searchTerm} 
                  onChange={handleSearchInputChange}
                  onKeyPress={handleSearchKeyPress}
                  style={{ flex: 1, minWidth: '200px' }}
                />
                <button 
                  type="button" 
                  onClick={handleSearch}
                  className="search-btn"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🔍 Search
                </button>
                <button 
                  type="button" 
                  onClick={handleClearSearch}
                  className="clear-btn"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ✕ Clear
                </button>
              </div>
              
              {/* Individual filters for age and number if needed */}

            </div>
          </div>
          <h2>Submitted Data</h2>
          {filteredSortedData.length === 0 ? (
            <p className="no-data">No data submitted yet.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {(customization.formFields || []).map((f) => (
                      <th key={f.name} className={f.name === 'number' ? 'th-sort center' : f.name === 'email' ? 'th-sort left' : 'th-sort left'} onClick={() => handleSort(f.name)}>
                        {f.label || f.name} <SortIndicator column={f.name} />
                      </th>
                    ))}
                    <th onClick={() => handleSort('submittedAt')} className="th-sort right">Submitted At <SortIndicator column="submittedAt" /></th>
                    <th className="th-actions center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSortedData.map((item) => (
                    <tr key={item._id}>
                      {(customization.formFields || []).map((f) => (
                        <td key={f.name} className={f.name === 'number' ? 'center' : f.name === 'email' ? 'left' : 'left'}>
                          {item[f.name] ?? '-'}
                        </td>
                      ))}
                          <td className="right">{formatDate(item.submittedAt)}</td>
                          <td className="center">
                            <div className="action-buttons">
                              <button
                                onClick={() => handleDelete(item._id)}
                                className="action-btn delete-btn"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default Form;
