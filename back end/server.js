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
    submittedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const FormData = mongoose.model('FormData', formDataSchema);

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
        const { name, age, number, email, hobby } = req.body;
        const newFormData = new FormData({ name, age, number, email, hobby, submittedBy: req.user.userId });
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
        const list = await FormData.find({ submittedBy: req.user.userId }).sort({ submittedAt: -1 });
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Excel data parsed:', jsonData.slice(0, 2)); // Log first 2 rows for debugging
    
    if (jsonData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or has no data' });
    }

    let importedCount = 0;
    const errors = [];

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      try {
        // Map Excel columns to our schema (flexible mapping)
        const formData = {
          name: row.Name || row.name || row.NAME || row['Full Name'] || row['Full name'] || row['full name'] || '',
          age: parseInt(row.Age || row.age || row.AGE || row['Age (Years)'] || row['Age (years)'] || row['age (years)'] || 0) || 0,
          number: String(row.Number || row.Phone || row.number || row.phone || row.NUMBER || row.PHONE || row['Phone Number'] || row['Phone number'] || row['phone number'] || row['Mobile'] || row['mobile'] || ''),
          email: row.Email || row.email || row.EMAIL || row['Email Address'] || row['Email address'] || row['email address'] || '',
          hobby: row.Hobby || row.hobby || row.HOBBY || '',
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