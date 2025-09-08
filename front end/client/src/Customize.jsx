import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Customize({ onLogout, user, token }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewForm = searchParams.get('new') === 'true';
  const formId = searchParams.get('formId');
  const [customizationData, setCustomizationData] = useState({
    formName: '',
    formTitle: 'Data Entry Form',
    formHeader: '',
    formFields: [
      { name: 'name', label: 'Name', required: true, type: 'text' },
      { name: 'age', label: 'Age', required: true, type: 'number' },
      { name: 'number', label: 'Phone Number', required: true, type: 'tel' },
      { name: 'email', label: 'Email', required: true, type: 'email' },
      { name: 'hobby', label: 'Hobby', required: false, type: 'text' }
    ],
    excelColumns: [
      { name: 'name', label: 'Name', required: true },
      { name: 'age', label: 'Age', required: true },
      { name: 'number', label: 'Phone Number', required: true },
      { name: 'email', label: 'Email', required: true },
      { name: 'hobby', label: 'Hobby', required: false }
    ]
  });

  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load saved customization on mount
  useEffect(() => {
    const load = async () => {
      try {
        let endpoint = '/api/customization';
        if (formId && !isNewForm) {
          endpoint = `/api/forms/${formId}`;
        }
        
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Support both raw doc and wrapped payload
          const loaded = data && data.formFields ? data : {
            formName: data.formName || '',
            formTitle: data.formTitle,
            formHeader: data.formHeader || '',
            formFields: data.formFields,
            excelColumns: data.excelColumns
          };
          if (loaded && Array.isArray(loaded.formFields) && Array.isArray(loaded.excelColumns)) {
            setCustomizationData({
              formName: loaded.formName || '',
              formTitle: loaded.formTitle || 'Data Entry Form',
              formHeader: loaded.formHeader || '',
              formFields: loaded.formFields,
              excelColumns: loaded.excelColumns
            });
          }
        }
      } catch (e) {
        // ignore load errors in UI
      }
    };
    load();
  }, [token]);

  const handleFieldChange = (index, field, value) => {
    const newFields = [...customizationData.formFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setCustomizationData({ ...customizationData, formFields: newFields });
  };

  const handleColumnChange = (index, field, value) => {
    const newColumns = [...customizationData.excelColumns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setCustomizationData({ ...customizationData, excelColumns: newColumns });
  };

  const addField = () => {
    const newField = { name: '', label: '', required: false, type: 'text' };
    setCustomizationData({
      ...customizationData,
      formFields: [...customizationData.formFields, newField]
    });
  };

  const removeField = (index) => {
    const newFields = customizationData.formFields.filter((_, i) => i !== index);
    setCustomizationData({ ...customizationData, formFields: newFields });
  };

  const addColumn = () => {
    const newColumn = { name: '', label: '', required: false };
    setCustomizationData({
      ...customizationData,
      excelColumns: [...customizationData.excelColumns, newColumn]
    });
  };

  const removeColumn = (index) => {
    const newColumns = customizationData.excelColumns.filter((_, i) => i !== index);
    setCustomizationData({ ...customizationData, excelColumns: newColumns });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    
    // Validate form name for new forms
    if (isNewForm && !customizationData.formName.trim()) {
      setMessage('Form name is required');
      setIsSaving(false);
      return;
    }
    
    try {
      let endpoint = '/api/save-customization';
      let method = 'POST';
      
      if (isNewForm) {
        endpoint = '/api/forms';
      } else if (formId) {
        endpoint = `/api/forms/${formId}`;
        method = 'PUT';
      }
      
      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(customizationData)
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessage('Customization saved successfully!');
        try {
          localStorage.setItem('customization', JSON.stringify(customizationData));
        } catch (_) {}
        
        // Navigate based on context
        if (isNewForm) {
          // Navigate to the new form
          navigate(`/form?formId=${data.data._id}`);
        } else if (formId) {
          // Navigate back to the form being edited
          navigate(`/form?formId=${formId}`);
        } else {
          // Navigate to dashboard
          navigate('/');
        }
      } else {
        const errorData = await res.json();
        setMessage(errorData.message || 'Failed to save customization');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#1f2937' }}>
          {isNewForm ? 'Create New Form' : 'Customize Form & Excel'}
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
          <button 
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          borderRadius: '6px',
          backgroundColor: message.includes('success') ? '#d1fae5' : '#fee2e2',
          color: message.includes('success') ? '#065f46' : '#991b1b',
          border: `1px solid ${message.includes('success') ? '#a7f3d0' : '#fca5a5'}`
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Form Customization */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#1f2937', marginBottom: '20px' }}>
            Form Customization
          </h2>
          
          {isNewForm && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Form Name: <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={customizationData.formName}
                onChange={(e) => setCustomizationData({...customizationData, formName: e.target.value})}
                placeholder="Enter a unique name for this form"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Form Title:
            </label>
            <input
              type="text"
              value={customizationData.formTitle}
              onChange={(e) => setCustomizationData({...customizationData, formTitle: e.target.value})}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <h3 style={{ marginBottom: '16px', color: '#374151' }}>Form Fields</h3>
          
          {customizationData.formFields.map((field, index) => (
            <div key={index} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '12px',
              backgroundColor: '#f9fafb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: '#374151' }}>Field {index + 1}</h4>
                <button
                  onClick={() => removeField(index)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Remove
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    Field Name:
                  </label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    Label:
                  </label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    Type:
                  </label>
                  <select
                    value={field.type}
                    onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                    <option value="tel">Phone</option>
                    <option value="date">Date</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <label style={{ fontSize: '12px' }}>Required</label>
                </div>
              </div>
            </div>
          ))}
          
          <button
            onClick={addField}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Add Field
          </button>
        </div>

        {/* Live Preview (mirrors Form.jsx layout and classes) */}
        <div className="form-container" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {/* Top header mimic */}
          
          {/* Editable header and title above the form, centered */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <input
              type="text"
              value={customizationData.formHeader}
              onChange={(e) => setCustomizationData({ ...customizationData, formHeader: e.target.value })}
              placeholder="Enter form header (above the form)"
              style={{
                width: '70%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '8px'
              }}
            />
          </div>
          <h1 className="page-title" style={{ fontWeight: 'bold', textAlign: 'center' }}>{customizationData.formTitle || 'Data Entry Form'}</h1>

          <div className='container'>
            <div className="form-content surface-lg">
              <div className="split-row" style={{ display: 'flex', gap: '0px', alignItems: 'flex-start', justifyContent: 'flex-start', flexWrap: 'nowrap', marginLeft: '20px' }}>
                {/* Left box (Excel area placeholder) */}
                <div style={{ flex: '0 0 0%', boxSizing: 'border-box' }}>
                 
                  
                </div>

                {/* Right box (actual form preview) */}
                <div style={{ flex: '0 0 30%', boxSizing: 'border-box', marginLeft: '0%' }}>
                  <div className="form-header2">
                    <h4 style={{ whiteSpace: 'nowrap', marginLeft:'30px', textAlign: 'center' }}>{customizationData.formHeader || 'Enter your information below and Submit the form .'}</h4>
                  </div>
                  <form className="data-form surface" style={{ padding: '16px', borderRadius: '12px', marginLeft:'130px'}} onSubmit={(e) => e.preventDefault()}>
                    {/* First row: name + age */}
                    <div className="form-row">
                      {(() => {
                        const nameField = (customizationData.formFields || []).find(f => f.name === 'name') || { label: 'Name', type: 'text', required: true };
                        const ageField = (customizationData.formFields || []).find(f => f.name === 'age') || { label: 'Age', type: 'number', required: true };
                        return (
                          <>
                            <div className="form-group">
                              <label htmlFor="name_prev">{nameField.label || 'Name'}</label>
                              <input id="name_prev" type={nameField.type || 'text'} className="input" placeholder={nameField.label || 'Name'} disabled required={!!nameField.required} />
                            </div>
                            <div className="form-group">
                              <label htmlFor="age_prev">{ageField.label || 'Age'}</label>
                              <input id="age_prev" type={ageField.type || 'number'} className="input" placeholder={ageField.label || 'Age'} disabled required={!!ageField.required} />
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Second row: number + email */}
                    <div className="form-row">
                      {(() => {
                        const numberField = (customizationData.formFields || []).find(f => f.name === 'number') || { label: 'Phone Number', type: 'tel', required: true };
                        const emailField = (customizationData.formFields || []).find(f => f.name === 'email') || { label: 'Email', type: 'email', required: true };
                        return (
                          <>
                            <div className="form-group">
                              <label htmlFor="number_prev">{numberField.label || 'Phone Number'}</label>
                              <input id="number_prev" type={numberField.type || 'tel'} className="input" placeholder={numberField.label || 'Phone Number'} disabled required={!!numberField.required} />
                            </div>
                            <div className="form-group">
                              <label htmlFor="email_prev">{emailField.label || 'Email'}</label>
                              <input id="email_prev" type={emailField.type || 'email'} className="input" placeholder={emailField.label || 'Email'} disabled required={!!emailField.required} />
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Hobby row (optional) */}
                    {(() => {
                      const hobbyField = (customizationData.formFields || []).find(f => f.name === 'hobby');
                      if (!hobbyField) return null;
                      return (
                        <div className="form-row">
                          <div className="form-group" style={{ width: '100%' }}>
                            <label htmlFor="hobby_prev">{hobbyField.label || 'Hobby'}</label>
                            <input id="hobby_prev" type={hobbyField.type || 'text'} className="input" placeholder={hobbyField.label || 'Hobby'} disabled required={!!hobbyField.required} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Save button positioned like submit */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="submit-button btn btn-primary"
                        style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
                      >
                        {isSaving ? 'Saving...' : 'Save Customization'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removed separate bottom save button; save lives in preview */}
    </div>
  );
}

export default Customize;
