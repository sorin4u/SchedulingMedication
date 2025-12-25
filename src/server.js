/* eslint-env node */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import { sendMedicationReminder, calculateNextDoses, getIntervalMs } from './utils/emailService.js';

const { Pool } = pg;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret-change-in-production';
const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration to allow credentials
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
    httpOnly: true,
    maxAge: 5 * 60 * 1000, // 5 minutes
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

// Database pool configuration (more robust than single client)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_bOlWTdNa7e9K@ep-misty-glitter-ab1puzd7-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
  keepAlive: true,
});

// Initial sanity check (non-fatal)
pool.query('SELECT 1').then(() => {
  console.log('✅ DB pool ready');
}).catch((err) => {
  console.warn('⚠️ DB initial check failed (will retry on requests):', err.message);
});

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// DB health endpoint
app.get('/healthz/db', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, result: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Route to get all data from users table
app.get('/api/data', async (req, res) => {
  try {
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Available tables:', tablesResult.rows);
    
    // Get all data from users table
    const result = await pool.query('SELECT * FROM users');
    res.json({ 
      tables: tablesResult.rows,
      data: result.rows 
    });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route to execute custom query
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = user;
    next();
  });
};

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, is_admin, created_at',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin || false },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store user info in session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;

    res.json({ 
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin || false
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin || false },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store user info in session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin || false
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ message: 'Logout successful' });
  });
});

// Get current user (protected route example)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ADMIN ENDPOINTS

app.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/medications', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.username, u.email as user_email 
      FROM medications m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

app.patch('/api/admin/users/:id/admin', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_admin } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, username, email, is_admin',
      [is_admin, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user's medications first
    await pool.query('DELETE FROM medications WHERE user_id = $1', [id]);
    
    // Delete user
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.patch('/api/admin/medications/:id/quantity', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_left } = req.body;
    
    if (quantity_left === undefined || quantity_left < 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    
    const result = await pool.query(
      'UPDATE medications SET quantity_left = $1 WHERE id = $2 RETURNING *',
      [quantity_left, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating medication quantity:', error);
    res.status(500).json({ error: 'Failed to update medication quantity' });
  }
});

// MEDICATIONS CRUD ENDPOINTS

// Get all medications for the logged-in user
app.get('/api/medications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM medications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get medications error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single medication
app.get('/api/medications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM medications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get medication error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new medication
app.post('/api/medications', authenticateToken, async (req, res) => {
  try {
    const { name,email, dosage, frequency, time, notes, quantity, quantity_left } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Medication name is required' });
    }

    const result = await pool.query(
      `INSERT INTO medications (user_id, name, email, quantity, quantity_left, dosage, frequency, start_datetime, notes) 
       VALUES ($1, $2, $3, $4, $5, $6 , $7, $8, $9) 
       RETURNING *`,
      [req.user.id, name,email, quantity, quantity_left, dosage, frequency, time, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create medication error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update medication
app.put('/api/medications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, dosage, frequency, time, notes, quantity, quantity_left } = req.body;

    // Check if medication belongs to user
    const checkResult = await pool.query(
      'SELECT * FROM medications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const result = await pool.query(
      `UPDATE medications 
       SET name = $1, email = $2, dosage = $3, frequency = $4, start_datetime = $5, notes = $6, quantity = $7, quantity_left = $8, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $9 AND user_id = $10 
       RETURNING *`,
      [name, email, dosage, frequency, time, notes, quantity, quantity_left, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update medication error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete medication
app.delete('/api/medications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM medications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json({ message: 'Medication deleted successfully', medication: result.rows[0] });
  } catch (err) {
    console.error('Delete medication error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark medication as taken
app.patch('/api/medications/:id/taken', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { taken } = req.body;

    // Get current medication data
    const currentMed = await pool.query(
      'SELECT quantity_left FROM medications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (currentMed.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const currentQuantityLeft = currentMed.rows[0].quantity_left || 0;
    
    // Decrease quantity_left by 1 when marking as taken, but not below 0
    const newQuantityLeft = taken && currentQuantityLeft > 0 ? currentQuantityLeft - 1 : currentQuantityLeft;

    const result = await pool.query(
      `UPDATE medications 
       SET taken_today = $1, 
           last_taken = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE last_taken END, 
           last_notification_sent = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE last_notification_sent END,
           quantity_left = CASE WHEN $1 = true THEN $4 ELSE quantity_left END,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [taken, id, req.user.id, newQuantityLeft]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update medication taken status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get next scheduled doses for a medication
app.get('/api/medications/:id/schedule', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM medications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const medication = result.rows[0];
    if (!medication.start_datetime || !medication.frequency) {
      return res.json({ nextDoses: [] });
    }

    const nextDoses = calculateNextDoses(medication.start_datetime, medication.frequency);
    res.json({ 
      nextDoses,
      intervalMs: getIntervalMs(medication.frequency)
    });
  } catch (err) {
    console.error('Get medication schedule error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send test email notification
app.post('/api/medications/:id/test-notification', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get medication and user
    const medicationResult = await pool.query(
      'SELECT m.*, u.email as user_email FROM medications m JOIN users u ON m.user_id = u.id WHERE m.id = $1 AND m.user_id = $2',
      [id, req.user.id]
    );

    if (medicationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const medication = medicationResult.rows[0];
    const emailToUse = medication.email || medication.user_email;
    
    console.log('🧪 Testing email notification for:', medication.name);
    console.log('📧 Sending to:', emailToUse);
    const result = await sendMedicationReminder(emailToUse, medication);
    
    if (result.success) {
      // Update last notification time for test emails too
      await pool.query(
        'UPDATE medications SET last_notification_sent = CURRENT_TIMESTAMP WHERE id = $1',
        [medication.id]
      );
    }
    
    res.json(result);
  } catch (err) {
    console.error('Test notification error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notification status for a medication
app.get('/api/medications/:id/notification-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id, 
        name, 
        email,
        frequency, 
        start_datetime, 
        last_notification_sent,
        quantity_left,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_notification_sent)) / 60 as minutes_since_last_notification
      FROM medications 
      WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const medication = result.rows[0];
    const intervalMs = getIntervalMs(medication.frequency);
    const nextDoses = medication.start_datetime && medication.frequency 
      ? calculateNextDoses(medication.start_datetime, medication.frequency) 
      : [];

    res.json({
      ...medication,
      interval_hours: intervalMs / (60 * 60 * 1000),
      next_doses: nextDoses,
      scheduler_active: true
    });
  } catch (err) {
    console.error('Get notification status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Simple test endpoint to verify email is working
app.get('/api/test-email', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const testMedication = {
      name: 'Test Medication',
      dosage: '100mg',
      frequency: 'Test',
      notes: 'This is a test email'
    };

    console.log('🧪 Sending test email to:', userResult.rows[0].email);
    const result = await sendMedicationReminder(userResult.rows[0].email, testMedication);
    
    res.json(result);
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Medication notification scheduler - runs every minute
const scheduleMedicationNotifications = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      console.log(`⏰ Scheduler running at: ${now.toLocaleString()}`);
      
      // Get all medications with start_datetime, frequency, and email
      const result = await pool.query(`
        SELECT m.*, u.email as user_email
        FROM medications m 
        JOIN users u ON m.user_id = u.id 
        WHERE m.start_datetime IS NOT NULL 
        AND m.frequency IS NOT NULL
        AND m.email IS NOT NULL
      `);

      console.log(`📋 Found ${result.rows.length} medication(s) with schedules`);

      for (const medication of result.rows) {
        console.log(`\n🔍 Checking medication: ${medication.name}`);
        console.log(`   Email: ${medication.email}`);
        console.log(`   Frequency: ${medication.frequency}`);
        console.log(`   Start: ${medication.start_datetime}`);
        console.log(`   Last notification: ${medication.last_notification_sent || 'Never'}`);
        
        // Check if frequency is valid
        if (!medication.frequency || medication.frequency.trim().length < 3) {
          console.log(`   ⚠️ WARNING: Invalid frequency! Please edit and select proper frequency like "Every 6 hours"`);
          continue;
        }
        
        const startTime = new Date(medication.start_datetime);
        const intervalMs = getIntervalMs(medication.frequency);
        
        console.log(`   Interval: ${intervalMs / (60 * 60 * 1000)} hours`);
        
        // Calculate time since start
        const timeSinceStart = now - startTime;
        
        console.log(`   Time since start: ${Math.floor(timeSinceStart / 60000)} minutes`);
        
        // Only process if medication start time has passed
        if (timeSinceStart > 0) {
          // Calculate time since last scheduled dose
          const timeSinceLastDose = timeSinceStart % intervalMs;
          
          console.log(`   Time since last dose window: ${Math.floor(timeSinceLastDose / 60000)} minutes`);
          
          // If within 5 minutes of scheduled dose time (0-5 minutes) - expanded window for easier testing
          if (timeSinceLastDose < 5 * 60000) {
            // Check if we already sent notification for this dose
            const lastNotification = medication.last_notification_sent 
              ? new Date(medication.last_notification_sent) 
              : new Date(0);
            
            const timeSinceLastNotification = now - lastNotification;
            
            // Calculate minimum time between notifications based on interval
            // Use half the interval or 3 minutes, whichever is smaller, to prevent duplicates
            const minTimeBetweenNotifications = Math.min(intervalMs / 2, 3 * 60 * 1000);
            
            console.log(`   Min time between notifications: ${Math.floor(minTimeBetweenNotifications / 60000)} minutes`);
            
            // Only send if enough time has passed since last notification
            if (timeSinceLastNotification > minTimeBetweenNotifications) {
              // Check if there are pills left
              const currentQuantityLeft = medication.quantity_left || 0;
              
              if (currentQuantityLeft <= 0) {
                console.log(`⚠️ Skipping ${medication.name} - NO PILLS LEFT! Please refill.`);
                continue;
              }
              
              console.log(`\n📧 ====== SENDING EMAIL REMINDER ======`);
              console.log(`   Medication: ${medication.name}`);
              console.log(`   Frequency: ${medication.frequency}`);
              console.log(`   To: ${medication.email}`);
              console.log(`   Pills Left: ${medication.quantity_left}`);
              console.log(`   Last Notification: ${medication.last_notification_sent || 'Never'}`);
              console.log(`   Time Since Last: ${Math.floor(timeSinceLastNotification / 60000)} minutes`);
              console.log(`======================================\n`);
              
              // Calculate new quantity left (decrease by 1, but not below 0)
              const newQuantityLeft = currentQuantityLeft - 1;
              
              // Update medication object with new quantity for email
              const medicationForEmail = {
                ...medication,
                quantity_left: newQuantityLeft
              };
              
              const emailResult = await sendMedicationReminder(medication.email, medicationForEmail);
              
              if (emailResult.success) {
                // Update last notification time and decrease quantity_left
                await pool.query(
                  'UPDATE medications SET last_notification_sent = CURRENT_TIMESTAMP, quantity_left = $2 WHERE id = $1',
                  [medication.id, newQuantityLeft]
                );
                console.log(`✅ Email sent successfully and timestamp updated for ${medication.name}`);
                console.log(`💊 Pills left updated: ${currentQuantityLeft} → ${newQuantityLeft}`);
              } else {
                console.error(`❌ Email failed for ${medication.name}:`, emailResult.error);
              }
            } else {
              console.log(`⏭️ Skipping ${medication.name} - notification sent ${Math.floor(timeSinceLastNotification / 60000)} minutes ago (need ${Math.floor(minTimeBetweenNotifications / 60000)} min gap)`);
            }
          }
        } else {
          console.log(`⏳ Medication ${medication.name} start time is in the future`);
        }
      }
    } catch (err) {
      console.error('❌ Notification scheduler error:', err);
    }
  });
  
  console.log('📅 Medication notification scheduler started (runs every minute)');
  console.log('📧 Will send email reminders based on medication frequency');
};

// Initialize database tables
const initDatabase = async () => {
  try {
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if username column exists, if not add it
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    `);

    if (columnCheck.rows.length === 0) {
      // Add username column if it doesn't exist
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN username VARCHAR(50) UNIQUE
      `);
      console.log('✅ Added username column to users table');
    }

    // Check if password column exists, if not add it
    const passwordCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password'
    `);

    if (passwordCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN password VARCHAR(255)
      `);
      console.log('✅ Added password column to users table');
    }

    // Check if is_admin column exists, if not add it
    const adminCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `);

    if (adminCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN is_admin BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added is_admin column to users table');
    }

    // Create medications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(100),
        name VARCHAR(100) NOT NULL,
        dosage VARCHAR(50),
        frequency VARCHAR(50),
        start_datetime TIMESTAMP,
        quantity INTEGER,
        quantity_left INTEGER,
        notes TEXT,
        taken_today BOOLEAN DEFAULT FALSE,
        last_taken TIMESTAMP,
        last_notification_sent TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add taken_today column if it doesn't exist
    const takenTodayCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'medications' AND column_name = 'taken_today'
    `);

    if (takenTodayCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE medications 
        ADD COLUMN taken_today BOOLEAN DEFAULT FALSE,
        ADD COLUMN last_taken TIMESTAMP
      `);
      console.log('✅ Added taken_today and last_taken columns');
    }

    // Add last_notification_sent column if it doesn't exist
    const notificationCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'medications' AND column_name = 'last_notification_sent'
    `);

    if (notificationCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE medications 
        ADD COLUMN last_notification_sent TIMESTAMP
      `);
      console.log('✅ Added last_notification_sent column');
    }

    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
  }
};

// Serve static frontend if built (Render/production)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Root route: serve index.html if present, otherwise helpful message
app.get('/', (req, res) => {
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.type('text').send('Backend is running. Try GET /api/data');
  }
});

// Initialize database on startup
initDatabase();

// Start medication notification scheduler
scheduleMedicationNotifications();

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end();
  process.exit(0);
});
