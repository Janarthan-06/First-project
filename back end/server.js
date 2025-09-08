const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();



app.use(cors());
app.use(express.urlencoded({extended:true}));
app.use(express.json()); 

const mongoDB_URL = process.env.MONGO_URI || 'mongodb+srv://Mango:mango%402006@mango.fhyv0kv.mongodb.net/?retryWrites=true&w=majority&appName=Mango'

mongoose.connect(mongoDB_URL)
.then(()=>{
    console.log("Connected to MongoDB")
})
.catch((err)=>{
    console.log("Failed to connect to MongoDB:", err)
});

// User Schema for authentication
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for OAuth users
    provider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
    providerId: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Form Data Schema
const formDataSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, required: true },
    number: { type: String, required: true }, // Changed to String to handle phone numbers
    email: { type: String, required: true },
    hobby: { type: String }, // Optional field
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    formId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormConfig' }, // Link to form configuration
    submittedAt: { type: Date, default: Date.now }
});

// Form Configuration Schema (for multiple forms per user)
const formConfigSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    formName: { type: String, required: true },
    formTitle: { type: String, default: 'Data Entry Form' },
    formHeader: { type: String, default: '' },
    formFields: [{
        name: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: false },
        type: { type: String, enum: ['text', 'number', 'tel', 'email', 'date'], default: 'text' },
        visible: { type: Boolean, default: true }
    }],
    excelColumns: [{
        name: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: false }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const FormData = mongoose.model('FormData', formDataSchema);
const FormConfig = mongoose.model('FormConfig', formConfigSchema);

// Customization Schema (per user)
const customizationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    formTitle: { type: String, default: 'Data Entry Form' },
    formHeader: { type: String, default: '' },
    formFields: [{
        name: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: false },
        type: { type: String, enum: ['text', 'number', 'tel', 'email', 'date'], default: 'text' }
    }],
    excelColumns: [{
        name: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: false }
    }],
    updatedAt: { type: Date, default: Date.now }
});
const Customization = mongoose.model('Customization', customizationSchema);

// JWT Secret (use env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access token required' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

const generateToken = (user) => jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) return res.status(400).json({ message: 'Username or email already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword, provider: 'local' });
        await newUser.save();
        const token = generateToken(newUser);
        res.status(201).json({ message: 'User created successfully', token, user: { id: newUser._id, username: newUser.username, email: newUser.email, provider: newUser.provider } });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        if (!user.password) return res.status(401).json({ message: 'This account was created with OAuth. Please use OAuth login.' });
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return res.status(401).json({ message: 'Invalid credentials' });
        const token = generateToken(user);
        res.json({ message: 'Login successful', token, user: { id: user._id, username: user.username, email: user.email, provider: user.provider } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Submit form (protected)
app.post('/api/submit-form', authenticateToken, async (req, res) => {
    try {
        const { name, age, number, email, hobby, formId } = req.body;
        const newFormData = new FormData({ name, age, number, email, hobby, submittedBy: req.user.userId, formId });
        await newFormData.save();
        res.status(201).json({ message: 'Form submitted successfully', data: newFormData });
    } catch (err) {
        console.error('Form submission error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get form data (protected)
app.get('/api/form-data', authenticateToken, async (req, res) => {
    try {
        const { formId } = req.query;
        const query = { submittedBy: req.user.userId };
        if (formId) query.formId = formId;
        const list = await FormData.find(query).sort({ submittedAt: -1 });
        res.json(list);
    } catch (err) {
        console.error('Error fetching form data:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Profile (protected)
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json(user);
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Excel upload endpoint
app.post('/api/upload-excel', authenticateToken, multer({ storage: multer.memoryStorage() }).single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse Excel file from buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log('Excel data parsed:', jsonData.slice(0, 2)); // Log first 2 rows for debugging
    
    if (jsonData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or has no data' });
    }

    let importedCount = 0;
    const errors = [];

    // Load customization for current user to map columns dynamically
    let customization = null;
    try {
      customization = await Customization.findOne({ userId: req.user.userId });
    } catch (_) {}

    // Build a helper to read values from a row by known keys/labels
    const getValueByAliases = (row, aliases) => {
      for (const alias of aliases) {
        if (Object.prototype.hasOwnProperty.call(row, alias) && row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
          return row[alias];
        }
      }
      return '';
    };

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      try {
        // Default aliases if no customization is present
        let nameAliases = ['Name', 'name', 'NAME', 'Full Name', 'Full name', 'full name'];
        let ageAliases = ['Age', 'age', 'AGE', 'Age (Years)', 'Age (years)', 'age (years)'];
        let numberAliases = ['Number', 'Phone', 'number', 'phone', 'NUMBER', 'PHONE', 'Phone Number', 'Phone number', 'phone number', 'Mobile', 'mobile'];
        let emailAliases = ['Email', 'email', 'EMAIL', 'Email Address', 'Email address', 'email address'];
        let hobbyAliases = ['Hobby', 'hobby', 'HOBBY'];

        // If customization exists, prefer its column labels/names as first aliases
        if (customization) {
          const pushFront = (arr, v) => { if (v && !arr.includes(v)) arr.unshift(v); };
          const colByName = (n) => (Array.isArray(customization.excelColumns) ? customization.excelColumns : []).find(c => c.name === n)
            || (Array.isArray(customization.formFields) ? customization.formFields : []).find(c => c.name === n);
          const maybeAlias = (c) => [c?.label, c?.name].filter(Boolean);
          const nameCol = colByName('name');
          const ageCol = colByName('age');
          const numberCol = colByName('number');
          const emailCol = colByName('email');
          const hobbyCol = colByName('hobby');
          maybeAlias(nameCol).forEach(v => pushFront(nameAliases, v));
          maybeAlias(ageCol).forEach(v => pushFront(ageAliases, v));
          maybeAlias(numberCol).forEach(v => pushFront(numberAliases, v));
          maybeAlias(emailCol).forEach(v => pushFront(emailAliases, v));
          maybeAlias(hobbyCol).forEach(v => pushFront(hobbyAliases, v));
        }

        const formData = {
          name: getValueByAliases(row, nameAliases),
          age: parseInt(getValueByAliases(row, ageAliases) || 0) || 0,
          number: String(getValueByAliases(row, numberAliases) || ''),
          email: getValueByAliases(row, emailAliases),
          hobby: getValueByAliases(row, hobbyAliases) || '',
          submittedBy: req.user.userId,
          submittedAt: new Date()
        };

        // Validate required fields
        if (!formData.name || !formData.email || !formData.age || !formData.number) {
          errors.push(`Row ${i + 1}: Missing required fields (name, email, age, number)`);
          continue;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          errors.push(`Row ${i + 1}: Invalid email format`);
          continue;
        }

        // Save to database
        const newFormData = new FormData(formData);
        await newFormData.save();
        importedCount++;

      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    const response = {
      importedCount,
      totalRows: jsonData.length,
      errors: errors.slice(0, 10) // Limit to first 10 errors
    };

    if (importedCount === 0) {
      return res.status(400).json({ 
        message: 'No data could be imported',
        ...response
      });
    }

    res.json({
      message: `Successfully imported ${importedCount} out of ${jsonData.length} records`,
      ...response
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(500).json({ message: 'Error processing Excel file', error: error.message });
  }
});

// Update form data (protected)
app.put('/api/form-data/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
  const { name, age, number, email, hobby } = req.body;

    // Validate required fields
    if (!name || !age || !number || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Find and update the record (only if it belongs to the user)
    const formData = await FormData.findOneAndUpdate(
      { _id: id, submittedBy: req.user.userId },
      { name, age, number, email, hobby },
      { new: true, runValidators: true }
    );

    if (!formData) {
      return res.status(404).json({ message: 'Record not found or access denied' });
    }

    res.json({ message: 'Record updated successfully', data: formData });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete form data (protected)
app.delete('/api/form-data/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the record (only if it belongs to the user)
    const formData = await FormData.findOneAndDelete({
      _id: id,
      submittedBy: req.user.userId
    });

    if (!formData) {
      return res.status(404).json({ message: 'Record not found or access denied' });
    }

    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get customization settings (protected)
app.get('/api/customization', authenticateToken, async (req, res) => {
  try {
    const customization = await Customization.findOne({ userId: req.user.userId });
    if (!customization) {
      // default payload
      return res.json({
        formTitle: 'Data Entry Form',
        formHeader: '',
        formFields: [
          { name: 'name', label: 'Name', required: true, type: 'text' },
          { name: 'age', label: 'Age', required: true, type: 'number' },
          { name: 'number', label: 'Phone Number', required: true, type: 'tel' },
          { name: 'email', label: 'Email', required: true, type: 'email' },
          { name: 'hobby', label: 'Hobby', required: false, type: 'text' }
        ],
        excelColumns: []
      });
    }
    res.json(customization);
  } catch (err) {
    console.error('Get customization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Save customization settings (protected, upsert)
app.post('/api/save-customization', authenticateToken, async (req, res) => {
  try {
    const { formTitle, formHeader, formFields, excelColumns } = req.body;

    if (!formTitle || !Array.isArray(formFields)) {
      return res.status(400).json({ message: 'Invalid customization payload' });
    }

    // Derive excelColumns from formFields if not provided
    const derivedExcelColumns = Array.isArray(excelColumns) && excelColumns.length > 0
      ? excelColumns
      : formFields.map(f => ({ name: f.name, label: f.label, required: !!f.required }));

    const updated = await Customization.findOneAndUpdate(
      { userId: req.user.userId },
      { userId: req.user.userId, formTitle, formHeader: formHeader || '', formFields, excelColumns: derivedExcelColumns, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Customization saved successfully', data: updated });
  } catch (err) {
    console.error('Save customization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all forms for user (dashboard)
app.get('/api/forms', authenticateToken, async (req, res) => {
  try {
    const forms = await FormConfig.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(forms);
  } catch (err) {
    console.error('Get forms error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new form
app.post('/api/forms', authenticateToken, async (req, res) => {
  try {
    const { formName, formTitle, formHeader, formFields, excelColumns } = req.body;

    if (!formName || !Array.isArray(formFields)) {
      return res.status(400).json({ message: 'Form name and fields are required' });
    }

    // Check if form name already exists for this user
    const existingForm = await FormConfig.findOne({ userId: req.user.userId, formName });
    if (existingForm) {
      return res.status(400).json({ message: 'Form name already exists' });
    }

    // Derive excelColumns from formFields if not provided
    const derivedExcelColumns = Array.isArray(excelColumns) && excelColumns.length > 0
      ? excelColumns
      : formFields.map(f => ({ name: f.name, label: f.label, required: !!f.required }));

    const newForm = new FormConfig({
      userId: req.user.userId,
      formName,
      formTitle: formTitle || 'Data Entry Form',
      formHeader: formHeader || '',
      formFields,
      excelColumns: derivedExcelColumns
    });

    await newForm.save();
    res.status(201).json({ message: 'Form created successfully', data: newForm });
  } catch (err) {
    console.error('Create form error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get specific form configuration
app.get('/api/forms/:formId', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const form = await FormConfig.findOne({ _id: formId, userId: req.user.userId });
    
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json(form);
  } catch (err) {
    console.error('Get form error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update form configuration
app.put('/api/forms/:formId', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const { formName, formTitle, formHeader, formFields, excelColumns } = req.body;

    if (!formName || !Array.isArray(formFields)) {
      return res.status(400).json({ message: 'Form name and fields are required' });
    }

    // Check if form name already exists for another form of this user
    const existingForm = await FormConfig.findOne({ 
      userId: req.user.userId, 
      formName, 
      _id: { $ne: formId } 
    });
    if (existingForm) {
      return res.status(400).json({ message: 'Form name already exists' });
    }

    // Derive excelColumns from formFields if not provided
    const derivedExcelColumns = Array.isArray(excelColumns) && excelColumns.length > 0
      ? excelColumns
      : formFields.map(f => ({ name: f.name, label: f.label, required: !!f.required }));

    const updatedForm = await FormConfig.findOneAndUpdate(
      { _id: formId, userId: req.user.userId },
      { 
        formName, 
        formTitle: formTitle || 'Data Entry Form', 
        formHeader: formHeader || '', 
        formFields, 
        excelColumns: derivedExcelColumns,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!updatedForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form updated successfully', data: updatedForm });
  } catch (err) {
    console.error('Update form error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete form
app.delete('/api/forms/:formId', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;

    // Delete form configuration
    const deletedForm = await FormConfig.findOneAndDelete({ 
      _id: formId, 
      userId: req.user.userId 
    });

    if (!deletedForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Also delete all form data associated with this form
    await FormData.deleteMany({ formId });

    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    console.error('Delete form error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve React build (single URL deploy)
const clientBuildPath = path.resolve(__dirname, '../front end/client/build');
app.use(express.static(clientBuildPath));

// Fallback to React index for non-API routes
app.get('*', (req, res) => {
  // If route starts with /api, skip to 404 (not caught here)
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'Not found' });
  return res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});