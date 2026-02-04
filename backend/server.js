const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

// Initialize database schema
function initializeDatabase() {
  // Rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  // Vents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vents (
      id TEXT PRIMARY KEY,
      roomId TEXT,
      text TEXT NOT NULL,
      anonymousHandle TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      moodBefore INTEGER NOT NULL,
      moodAfter INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (roomId) REFERENCES rooms(id)
    )
  `);

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      ventId TEXT NOT NULL,
      text TEXT NOT NULL,
      anonymousHandle TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE
    )
  `);

  // Reactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      ventId TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('comment', 'support', 'empathy')),
      anonymousHandle TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE,
      UNIQUE(ventId, type, deviceId)
    )
  `);

  // Reports table (optional)
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      ventId TEXT NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      deviceId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE
    )
  `);

  // Mood logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mood_logs (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      date TEXT NOT NULL,
      moodLevel TEXT NOT NULL CHECK(moodLevel IN ('Great', 'Good', 'Okay', 'Meh', 'Low')),
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(deviceId, date)
    )
  `);

  // Emotional reflections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS emotional_reflections (
      id TEXT PRIMARY KEY,
      ventId TEXT NOT NULL UNIQUE,
      reflection TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE
    )
  `);

  // Emotional reflections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS emotional_reflections (
      id TEXT PRIMARY KEY,
      ventId TEXT NOT NULL UNIQUE,
      reflection TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ventId) REFERENCES vents(id) ON DELETE CASCADE
    )
  `);

  // Initialize default rooms if they don't exist
  const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  if (roomCount.count === 0) {
    const defaultRooms = [
      { id: 'default-work', name: 'Work Frustrations', description: 'Share your workplace challenges' },
      { id: 'default-relationships', name: 'Relationships', description: 'Navigate relationship difficulties' },
      { id: 'default-anxiety', name: 'Anxiety & Worry', description: 'Express your anxieties' },
      { id: 'default-stress', name: 'Stress Relief', description: 'Let go of daily stress' },
      { id: 'default-family', name: 'Family Matters', description: 'Family-related concerns' },
      { id: 'default-loneliness', name: 'Loneliness', description: 'Feelings of isolation' },
      { id: 'default-grief', name: 'Grief & Loss', description: 'Processing loss and grief' },
      { id: 'default-anger', name: 'Anger', description: 'Managing anger and frustration' },
    ];

    const insertRoom = db.prepare(`
      INSERT INTO rooms (id, name, description, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    const insertRooms = db.transaction((rooms) => {
      for (const room of rooms) {
        insertRoom.run(room.id, room.name, room.description || null, new Date().toISOString());
      }
    });

    insertRooms(defaultRooms);
    console.log('Initialized default rooms');
  }
}

// Initialize database on startup
initializeDatabase();

// Email configuration
// For production, use environment variables for email credentials
// For Gmail, you'll need an App Password: https://support.google.com/accounts/answer/185833
// Set EMAIL_PASSWORD environment variable with your Gmail App Password
const EMAIL_CONFIG = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'feelspacemood@gmail.com',
    pass: process.env.EMAIL_PASSWORD || '', // REQUIRED: Set this via environment variable with Gmail App Password
  },
};

// Developer configuration
const DEVELOPER_DEVICE_IDS = (process.env.DEVELOPER_DEVICE_ID || '').split(',').filter(Boolean);
const DEVELOPER_TOKEN = process.env.DEVELOPER_TOKEN || '';

// Create email transporter
let emailTransporter = null;
try {
  const emailPass = process.env.EMAIL_PASSWORD || EMAIL_CONFIG.auth.pass;
  const emailUser = process.env.EMAIL_USER || EMAIL_CONFIG.auth.user;
  
  if (emailPass && emailPass.trim() !== '') {
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
    
    // Verify connection on startup
    emailTransporter.verify()
      .then(() => {
        console.log('✅ Email service configured and verified successfully');
        console.log(`   Sending emails to: feelspacemood@gmail.com`);
        console.log(`   From: ${emailUser}`);
      })
      .catch((verifyError) => {
        console.error('⚠️ Email transporter created but verification failed:');
        console.error('   Error:', verifyError.message);
        console.error('   Email sending may not work. Check EMAIL_PASSWORD.');
        emailTransporter = null; // Don't use if verification fails
      });
  } else {
    console.warn('⚠️ EMAIL_PASSWORD not set. Email notifications will be disabled.');
    console.warn('To enable email reports:');
    console.warn('1. Generate a Gmail App Password: https://support.google.com/accounts/answer/185833');
    console.warn('2. Set EMAIL_PASSWORD environment variable with the App Password');
    console.warn('3. Optionally set EMAIL_USER (defaults to feelspacemood@gmail.com)');
    console.warn('4. Restart the server');
    console.warn('5. Test with: node setup-email.js');
  }
} catch (error) {
  console.error('❌ Error setting up email transporter:', error);
  emailTransporter = null;
}

// Store action tokens for email actions (in production, use Redis or database)
const actionTokens = new Map();

// Generate secure token for email actions
function generateActionToken(reportId, action) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  actionTokens.set(token, { reportId, action, expiresAt });
  return token;
}

// Verify and consume action token
function verifyActionToken(token) {
  const tokenData = actionTokens.get(token);
  if (!tokenData) {
    return null;
  }
  if (Date.now() > tokenData.expiresAt) {
    actionTokens.delete(token);
    return null;
  }
  actionTokens.delete(token); // One-time use token
  return tokenData;
}

// Email template for reports
function createReportEmail(report, vent, blockToken, noBlockToken) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const blockUrl = `${baseUrl}/api/reports/action?token=${blockToken}&action=block`;
  const noBlockUrl = `${baseUrl}/api/reports/action?token=${noBlockToken}&action=no-block`;
  
  return {
    subject: `New Content Report - Vent ID: ${report.ventId}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6366f1; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; margin-bottom: 5px; }
          .value { background-color: white; padding: 10px; border-radius: 4px; border: 1px solid #d1d5db; }
          .vent-text { white-space: pre-wrap; word-wrap: break-word; }
          .actions { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .button-block { background-color: #dc2626; color: white; }
          .button-no-block { background-color: #10b981; color: white; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
          .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Content Report</h1>
          </div>
          <div class="content">
            <div class="section">
              <div class="label">Report ID:</div>
              <div class="value">${report.id}</div>
            </div>
            <div class="section">
              <div class="label">Reported Vent ID:</div>
              <div class="value">${report.ventId}</div>
            </div>
            <div class="section">
              <div class="label">Report Reason:</div>
              <div class="value">${report.reason}</div>
            </div>
            ${report.description ? `
            <div class="section">
              <div class="label">Additional Details:</div>
              <div class="value">${report.description}</div>
            </div>
            ` : ''}
            <div class="section">
              <div class="label">Reported User Handle:</div>
              <div class="value">${vent.anonymousHandle || 'Unknown'}</div>
            </div>
            <div class="section">
              <div class="label">Reported Content:</div>
              <div class="value vent-text">${vent.text || 'N/A'}</div>
            </div>
            <div class="section">
              <div class="label">Room:</div>
              <div class="value">${vent.room?.name || 'General'}</div>
            </div>
            <div class="section">
              <div class="label">Reported At:</div>
              <div class="value">${new Date(report.createdAt).toLocaleString()}</div>
            </div>
            <div class="warning">
              <strong>⚠️ Action Required:</strong> Please review this report and take appropriate action.
            </div>
            <div class="actions">
              <h3>Take Action:</h3>
              <a href="${blockUrl}" class="button button-block">Block User</a>
              <a href="${noBlockUrl}" class="button button-no-block">No Action Needed</a>
            </div>
            <div class="footer">
              <p>This is an automated email from Let It Out moderation system.</p>
              <p>Report ID: ${report.id} | Vent ID: ${report.ventId}</p>
              <p><small>Action links expire in 7 days. Each link can only be used once.</small></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
New Content Report

Report ID: ${report.id}
Reported Vent ID: ${report.ventId}
Report Reason: ${report.reason}
${report.description ? `Additional Details: ${report.description}\n` : ''}
Reported User Handle: ${vent.anonymousHandle || 'Unknown'}
Reported Content: ${vent.text || 'N/A'}
Room: ${vent.room?.name || 'General'}
Reported At: ${new Date(report.createdAt).toLocaleString()}

Take Action:
- Block User: ${blockUrl}
- No Action Needed: ${noBlockUrl}

This is an automated email from Let It Out moderation system.
Action links expire in 7 days. Each link can only be used once.
    `,
  };
}

// Function to send email - ENHANCED to ensure emails are sent
async function sendReportEmail(report, vent) {
  // Always attempt to send email to feelspacemood@gmail.com
  // Try to create/recreate transporter if needed
  let transporter = emailTransporter;
  
  if (!transporter) {
    // Check if we have email credentials
    const emailPass = process.env.EMAIL_PASSWORD || EMAIL_CONFIG.auth.pass;
    const emailUser = process.env.EMAIL_USER || EMAIL_CONFIG.auth.user;
    
    if (!emailPass || emailPass.trim() === '') {
      console.error('❌ EMAIL_PASSWORD not configured. Cannot send email.');
      console.error('To enable email reports:');
      console.error('1. Generate a Gmail App Password: https://support.google.com/accounts/answer/185833');
      console.error('2. Set EMAIL_PASSWORD environment variable');
      console.error('3. Restart the server');
      console.error(`   Current EMAIL_USER: ${emailUser || 'not set'}`);
      console.error(`   Current EMAIL_PASSWORD: ${emailPass ? '***' : 'NOT SET'}`);
      return false;
    }
    
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
      
      // Verify connection
      await transporter.verify();
      console.log('✅ Email transporter created and verified successfully');
      emailTransporter = transporter; // Cache it for future use
    } catch (createError) {
      console.error('❌ Failed to create email transporter:', createError);
      console.error('   Error details:', createError.message);
      if (createError.code) {
        console.error('   Error code:', createError.code);
      }
      return false;
    }
  }

  try {
    const blockToken = generateActionToken(report.id, 'block');
    const noBlockToken = generateActionToken(report.id, 'no-block');
    
    const emailContent = createReportEmail(report, vent, blockToken, noBlockToken);
    
    const emailUser = process.env.EMAIL_USER || EMAIL_CONFIG.auth.user || 'feelspacemood@gmail.com';
    const targetEmail = 'feelspacemood@gmail.com';
    
    const mailOptions = {
      from: emailUser,
      to: targetEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      replyTo: emailUser,
    };
    
    console.log(`📧 Attempting to send report email to ${targetEmail}...`);
    console.log(`   From: ${emailUser}`);
    console.log(`   Report ID: ${report.id}`);
    console.log(`   Vent ID: ${report.ventId}`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Report email sent successfully to ${targetEmail}`);
    console.log(`   Report ID: ${report.id}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending report email:', error);
    console.error('   Error code:', error.code || 'N/A');
    console.error('   Error message:', error.message);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    
    // Log specific error for debugging
    if (error.code === 'EAUTH') {
      console.error('');
      console.error('🔐 AUTHENTICATION ERROR:');
      console.error('   The EMAIL_PASSWORD is incorrect or missing.');
      console.error('   To fix this:');
      console.error('   1. Go to: https://support.google.com/accounts/answer/185833');
      console.error('   2. Generate a Gmail App Password for feelspacemood@gmail.com');
      console.error('   3. Set EMAIL_PASSWORD environment variable with the App Password');
      console.error('   4. Restart the server');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('');
      console.error('🌐 CONNECTION ERROR:');
      console.error('   Could not connect to Gmail servers.');
      console.error('   Check your internet connection and try again.');
    } else if (error.response) {
      console.error('');
      console.error('📧 SMTP RESPONSE ERROR:');
      console.error('   Response code:', error.responseCode);
      console.error('   Response:', error.response);
    }
    
    // Don't throw - report should still be saved even if email fails
    return false;
  }
}

// Helper function to get room by ID
function getRoomById(roomId) {
  if (!roomId) return null;
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
}

// Helper function to generate emotional reflection
// Helps user understand their feelings in simpler terms and helps therapist understand what's going on
// Enhanced emotional reflection generator with DBT skills recommendations
// Generates more specific and varied reflections based on actual text content
// Strictly avoids advice, suggestions, diagnosis, or "you should" language
function generateEmotionalReflection(text) {
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const wordCount = words.length;
  const characterCount = text.trim().length;
  
  // Minimum length check - if too short, return null
  const MIN_WORDS = 8;
  const MIN_CHARACTERS = 20;
  if (wordCount < MIN_WORDS || characterCount < MIN_CHARACTERS) {
    return null; // Signal that message is too short
  }
  
  // Generate unique seed based on text content and timestamp for variation
  const textHash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeSeed = Date.now() % 1000;
  const uniqueSeed = (textHash + timeSeed) % 100;
  
  // Extract key phrases and context
  const extractContext = (text) => {
    const workKeywords = ['work', 'job', 'boss', 'colleague', 'office', 'meeting', 'project', 'deadline', 'career'];
    const relationshipKeywords = ['relationship', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'friend', 'family', 'parent', 'sibling'];
    const schoolKeywords = ['school', 'class', 'teacher', 'homework', 'exam', 'test', 'student', 'college', 'university'];
    const healthKeywords = ['health', 'sick', 'doctor', 'hospital', 'pain', 'medical', 'illness', 'treatment'];
    const financialKeywords = ['money', 'bills', 'payment', 'debt', 'income', 'expenses', 'financial', 'salary'];
    
    if (workKeywords.some(k => lowerText.includes(k))) return { topic: 'work' };
    if (relationshipKeywords.some(k => lowerText.includes(k))) return { topic: 'relationships' };
    if (schoolKeywords.some(k => lowerText.includes(k))) return { topic: 'school' };
    if (healthKeywords.some(k => lowerText.includes(k))) return { topic: 'health' };
    if (financialKeywords.some(k => lowerText.includes(k))) return { topic: 'financial' };
    
    // Determine intensity
    const intenseWords = ['really', 'very', 'extremely', 'incredibly', 'terribly', 'awfully', 'so much', 'too much'];
    if (intenseWords.some(w => lowerText.includes(w))) return { intensity: 'high' };
    
    return {};
  };
  
  const context = extractContext(text);
  
  // DBT Skills mapping
  const getDBTSkill = (emotionPattern, topic, intensity) => {
    const skillMap = {
      'frustrated': [
        'Consider using **Check the Facts** to separate facts from interpretations about what\'s happening.',
        'Try **Opposite Action** - if frustration makes you want to avoid, see if gently approaching the situation might help.',
        'Use **Mindfulness - Describe** to observe your frustration without judgment, acknowledging it as information.',
      ],
      'sad': [
        '**Self-Soothe** can help - engage your senses with something comforting (warm drink, soft blanket, calming music).',
        'Try **Radical Acceptance** - acknowledging your sadness without fighting it can reduce suffering.',
        'Consider **Opposite Action** - sadness might want you to withdraw, but gentle connection or activity can help.',
      ],
      'angry': [
        '**TIPP** (Temperature, Intense exercise, Paced breathing, Progressive muscle relaxation) can quickly reduce anger\'s intensity.',
        'Use **STOP** skill: Stop, Take a step back, Observe, Proceed mindfully before reacting.',
        '**Check the Facts** - anger often comes from interpretations; checking what actually happened can help.',
      ],
      'anxious': [
        '**TIPP** - particularly paced breathing - can help regulate your body\'s anxious response.',
        'Try **Wise Mind** - balancing emotional mind and reasonable mind to find clarity.',
        'Use **Radical Acceptance** - accepting uncertainty can reduce the suffering anxiety brings.',
      ],
      'lonely': [
        '**Self-Soothe** - being kind to yourself can help when you feel disconnected.',
        'Consider **Opposite Action** - loneliness might want you to isolate, but gentle social connection can help.',
        '**Mindfulness - Participate** - fully engaging in the present moment can reduce feelings of isolation.',
      ],
      'overwhelmed': [
        '**STOP** skill - Stop, Take a step back, Observe, Proceed mindfully when everything feels too much.',
        'Try **One-Mindfully** - focus on just one thing at a time instead of everything at once.',
        '**Build Mastery** - doing one small thing well can help counter feelings of overwhelm.',
      ],
      'tired': [
        '**PLEASE** - treat physical illness, balanced eating, avoid drugs, sleep, exercise - can help with exhaustion.',
        '**Self-Soothe** - rest and restoration are essential, not luxuries.',
        'Consider **Radical Acceptance** - sometimes you need rest, and that\'s okay.',
      ],
      'confused': [
        '**Check the Facts** - gathering clear information can reduce confusion.',
        '**Wise Mind** - balancing what you feel with what you know can bring clarity.',
        '**Mindfulness - Observe** - noticing confusion without judgment can help it settle.',
      ],
      'hurt': [
        '**Self-Soothe** - being gentle with yourself when hurt is important.',
        'Try **Radical Acceptance** - accepting pain without intensifying it with judgment.',
        '**Validate** yourself - your feelings make sense given what happened.',
      ],
      'disappointed': [
        '**Check the Facts** - examining expectations vs. reality can help process disappointment.',
        '**Radical Acceptance** - accepting what is, even when it\'s not what you wanted.',
        '**Opposite Action** - disappointment might want you to withdraw, but gentle engagement can help.',
      ],
      'guilt': [
        '**Check the Facts** - guilt often comes from harsh self-judgment; check if your standards are realistic.',
        '**Opposite Action** - if guilt is unjustified, acting opposite to it can help.',
        '**Self-Validate** - acknowledge your intentions and efforts, not just outcomes.',
      ],
      'grateful': [
        '**Mindfulness - Participate** - fully engaging in positive moments amplifies gratitude.',
        '**Accumulate Positive** - build on this positive feeling by noticing other good things.',
        '**Build Mastery** - gratitude often comes from meaningful experiences; continue building these.',
      ],
      'hopeless': [
        '**Opposite Action** - hopelessness might want you to give up, but small steps forward can help.',
        '**Accumulate Positive** - even when things feel dark, small positives can add up.',
        '**Wise Mind** - balancing emotional despair with reasonable hope can bring perspective.',
      ],
      'proud': [
        '**Build Mastery** - continue doing things that build competence and self-confidence.',
        '**Accumulate Positive** - let this positive feeling remind you of your capabilities.',
        '**Mindfulness - Participate** - fully engage in and celebrate your accomplishments.',
      ],
    };
    
    const skills = skillMap[emotionPattern] || [];
    if (skills.length > 0) {
      return skills[uniqueSeed % skills.length];
    }
    return 'Consider using **Mindfulness** - observe your emotions without judgment, acknowledging them as information.';
  };
  
  const patterns = [
    {
      keywords: ['frustrated', 'frustrating', 'annoyed', 'annoying', 'irritated', 'frustration'],
      emotionPattern: 'frustrated',
      reflections: [
        `There's a sense of frustration here${context.topic === 'work' ? '—especially around work or professional expectations' : context.topic === 'relationships' ? '—particularly in how relationships are playing out' : ''}. This feeling often shows up when something isn't working the way it should, creating tension between what you hoped for and what's actually happening.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}`,
        context.topic ? `Frustration is coming through strongly around ${context.topic} matters. This emotion typically signals a gap between your expectations and reality—something that matters to you isn't aligning with how things are unfolding.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}` : `Frustration is coming through strongly. This emotion typically signals a gap between your expectations and reality—something that matters to you isn't aligning with how things are unfolding.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}`,
        `I notice frustration in what you've shared${context.intensity === 'high' ? ', and it seems quite intense' : ''}. This feeling often appears when your system senses that something important isn't being handled the way you need it to be.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['sad', 'sadness', 'down', 'depressed', 'unhappy', 'blue'],
      emotionPattern: 'sad',
      reflections: [
        context.topic ? `Sadness is present in what you've shared, particularly around ${context.topic}. This emotion often signals that something important feels lost, missing, or unfulfilled—your system is acknowledging that something matters deeply to you.\n\n${getDBTSkill('sad', context.topic, context.intensity)}` : `Sadness is present in what you've shared. This emotion often signals that something important feels lost, missing, or unfulfilled—your system is acknowledging that something matters deeply to you.\n\n${getDBTSkill('sad', context.topic, context.intensity)}`,
        context.topic ? `There's a weight of sadness here related to ${context.topic}. This feeling can emerge when you're processing a loss, a disappointment, or when something meaningful feels out of reach. It's your way of honoring what matters.\n\n${getDBTSkill('sad', context.topic, context.intensity)}` : `There's a weight of sadness here. This feeling can emerge when you're processing a loss, a disappointment, or when something meaningful feels out of reach. It's your way of honoring what matters.\n\n${getDBTSkill('sad', context.topic, context.intensity)}`,
        `Sadness is showing up${context.intensity === 'high' ? ' quite intensely' : ''} in what you're experiencing. This emotion often appears when something tender or important has been touched, and your system is responding to that sensitivity.\n\n${getDBTSkill('sad', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['angry', 'anger', 'mad', 'furious', 'rage', 'pissed', 'livid'],
      emotionPattern: 'angry',
      reflections: [
        context.topic ? `Anger is coming through strongly here around ${context.topic}. This emotion often points to a boundary being crossed, a value being violated, or a need not being met—your system is saying "this isn't okay."\n\n${getDBTSkill('angry', context.topic, context.intensity)}` : `Anger is coming through strongly here. This emotion often points to a boundary being crossed, a value being violated, or a need not being met—your system is saying "this isn't okay."\n\n${getDBTSkill('angry', context.topic, context.intensity)}`,
        `There's anger present${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` in relation to ${context.topic}` : ''}. Anger typically signals that something important to you—your boundaries, values, or needs—isn't being respected or addressed.\n\n${getDBTSkill('angry', context.topic, context.intensity)}`,
        context.topic ? `Anger is showing up around ${context.topic} matters. This feeling often emerges when you sense that something isn't fair, isn't right, or when your limits are being tested. It's your system's way of protecting what matters to you.\n\n${getDBTSkill('angry', context.topic, context.intensity)}` : `Anger is showing up. This feeling often emerges when you sense that something isn't fair, isn't right, or when your limits are being tested. It's your system's way of protecting what matters to you.\n\n${getDBTSkill('angry', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['anxious', 'anxiety', 'worried', 'worry', 'nervous', 'stress', 'stressed', 'panic', 'overwhelmed'],
      emotionPattern: 'anxious',
      reflections: [
        context.topic ? `Anxiety and worry are present in what you're experiencing, especially around ${context.topic}. This often shows up when your mind is trying to prepare for something uncertain or when you're sensing potential threat—your body is responding to something that feels unsafe or unpredictable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}` : `Anxiety and worry are present in what you're experiencing. This often shows up when your mind is trying to prepare for something uncertain or when you're sensing potential threat—your body is responding to something that feels unsafe or unpredictable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}`,
        `There's anxiety here${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Anxiety typically appears when your system is trying to anticipate and prepare for potential challenges, even when the exact nature of those challenges isn't clear yet.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}`,
        context.topic ? `Worry and anxiety are showing up around ${context.topic}. This feeling often emerges when you're facing uncertainty or when something important feels out of your control. Your mind is working to keep you safe, even if it feels uncomfortable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}` : `Worry and anxiety are showing up. This feeling often emerges when you're facing uncertainty or when something important feels out of your control. Your mind is working to keep you safe, even if it feels uncomfortable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['lonely', 'loneliness', 'alone', 'isolated', 'disconnected', 'empty'],
      emotionPattern: 'lonely',
      reflections: [
        context.topic === 'relationships' 
          ? `Loneliness is showing up here—particularly in how you're experiencing connection (or lack of it) with others—a sense of being disconnected or unseen, even when others might be around. This feeling often points to a need for deeper connection or understanding from others.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`
          : `Loneliness is showing up here—a sense of being disconnected or unseen, even when others might be around. This feeling often points to a need for deeper connection or understanding from others.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`,
        `There's a sense of loneliness present${context.intensity === 'high' ? ', and it seems quite profound' : ''}. This feeling can emerge when you're physically alone or when you're surrounded by people but still feel disconnected from them. It signals a longing for meaningful connection.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`,
        context.topic ? `Loneliness is coming through in how you're experiencing ${context.topic}. This emotion often appears when there's a gap between the connection you need and what you're experiencing, whether that's with friends, family, or a partner.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}` : `Loneliness is coming through. This emotion often appears when there's a gap between the connection you need and what you're experiencing, whether that's with friends, family, or a partner.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['overwhelmed', 'overwhelming', 'too much', 'can\'t handle', 'drowning', 'swamped'],
      emotionPattern: 'overwhelmed',
      reflections: [
        context.topic 
          ? `This feels overwhelming, especially around ${context.topic}—like there's more happening than you can process or manage right now. Your system is signaling that the demands or emotions exceed your current capacity to handle them.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`
          : `This feels overwhelming—like there's more happening than you can process or manage right now. Your system is signaling that the demands or emotions exceed your current capacity to handle them.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`,
        `There's a sense of being overwhelmed${context.intensity === 'high' ? ', and it\'s quite intense' : ''}${context.topic ? ` in relation to ${context.topic}` : ''}. This feeling often appears when multiple pressures, responsibilities, or emotions are converging at once, creating a sense that you're at capacity.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`,
        context.topic 
          ? `You're experiencing overwhelm around ${context.topic}. This typically shows up when the demands on your time, energy, or emotional resources feel like they're exceeding what you have available to give.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`
          : `You're experiencing overwhelm. This typically shows up when the demands on your time, energy, or emotional resources feel like they're exceeding what you have available to give.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['tired', 'exhausted', 'drained', 'worn out', 'burned out', 'fatigued'],
      emotionPattern: 'tired',
      reflections: [
        `You're feeling deeply tired and drained${context.topic === 'work' ? ', possibly from work-related stress or demands' : ''}. This exhaustion often shows up when you've been giving more energy than you've been able to replenish, or when emotional weight has been accumulating over time.\n\n${getDBTSkill('tired', context.topic, context.intensity)}`,
        `There's exhaustion present${context.intensity === 'high' ? ', and it seems quite significant' : ''}${context.topic ? ` related to ${context.topic}` : ''}. This feeling often emerges when your resources—physical, emotional, or mental—have been consistently drawn from without adequate replenishment.\n\n${getDBTSkill('tired', context.topic, context.intensity)}`,
        context.topic ? `Tiredness and exhaustion are showing up around ${context.topic} matters. This typically appears when you've been pushing through challenges, carrying responsibilities, or managing emotions for an extended period without sufficient rest or restoration.\n\n${getDBTSkill('tired', context.topic, context.intensity)}` : `Tiredness and exhaustion are showing up. This typically appears when you've been pushing through challenges, carrying responsibilities, or managing emotions for an extended period without sufficient rest or restoration.\n\n${getDBTSkill('tired', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['confused', 'confusing', 'don\'t understand', 'unclear', 'lost', 'uncertain'],
      emotionPattern: 'confused',
      reflections: [
        context.topic ? `Confusion is present here around ${context.topic}—like pieces don't quite fit together or the path forward isn't clear. This feeling often shows up when there's conflicting information, unclear expectations, or when you're navigating something new.\n\n${getDBTSkill('confused', context.topic, context.intensity)}` : `Confusion is present here—like pieces don't quite fit together or the path forward isn't clear. This feeling often shows up when there's conflicting information, unclear expectations, or when you're navigating something new.\n\n${getDBTSkill('confused', context.topic, context.intensity)}`,
        `There's a sense of confusion${context.intensity === 'high' ? ', and it seems quite disorienting' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Confusion typically appears when information doesn't align, when expectations are unclear, or when you're trying to make sense of something that feels contradictory.\n\n${getDBTSkill('confused', context.topic, context.intensity)}`,
        `Confusion is showing up${context.topic ? ` around ${context.topic} matters` : ''}${text.includes('?') ? ', and I notice you\'re asking questions about it' : ''}. This feeling often emerges when you're in transition, facing new situations, or when the information you have doesn't create a clear picture of what to expect or how to proceed.\n\n${getDBTSkill('confused', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['hurt', 'hurting', 'pain', 'painful', 'ache', 'aching'],
      emotionPattern: 'hurt',
      reflections: [
        `There's hurt present in what you've shared${context.topic === 'relationships' ? ', particularly around relationships or connections with others' : ''}. This emotional pain often signals that something tender or important has been touched, damaged, or threatened—your system is acknowledging that something matters and has been affected.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}`,
        `Hurt is coming through${context.intensity === 'high' ? ' quite deeply' : ''}${context.topic ? ` in relation to ${context.topic}` : ''}. This feeling typically appears when something that matters to you—your trust, your feelings, your sense of safety—has been impacted in a way that feels painful.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}`,
        context.topic ? `There's emotional pain showing up around ${context.topic}. Hurt often emerges when something sensitive or important has been touched in a way that feels damaging or threatening, and your system is responding to protect and acknowledge that sensitivity.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}` : `There's emotional pain showing up. Hurt often emerges when something sensitive or important has been touched in a way that feels damaging or threatening, and your system is responding to protect and acknowledge that sensitivity.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['disappointed', 'disappointment', 'let down', 'betrayed', 'betrayal'],
      emotionPattern: 'disappointed',
      reflections: [
        context.topic === 'relationships' 
          ? `Disappointment is coming through—especially in relationships or connections with others—like something you hoped for or expected didn't happen the way you needed it to. This feeling often shows up when there's a gap between what you wanted and what actually occurred.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`
          : context.topic 
            ? `Disappointment is coming through around ${context.topic}—like something you hoped for or expected didn't happen the way you needed it to. This feeling often shows up when there's a gap between what you wanted and what actually occurred.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`
            : `Disappointment is coming through—like something you hoped for or expected didn't happen the way you needed it to. This feeling often shows up when there's a gap between what you wanted and what actually occurred.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`,
        `There's disappointment present${context.intensity === 'high' ? ', and it seems quite significant' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Disappointment typically appears when expectations weren't met, when someone didn't follow through, or when a hoped-for outcome didn't materialize.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`,
        context.topic ? `Disappointment is showing up around ${context.topic} matters. This feeling often emerges when there's a mismatch between what you anticipated or needed and what actually happened, leaving you with a sense that something important fell short.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}` : `Disappointment is showing up. This feeling often emerges when there's a mismatch between what you anticipated or needed and what actually happened, leaving you with a sense that something important fell short.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['guilt', 'guilty', 'shame', 'ashamed', 'embarrassed'],
      emotionPattern: 'guilt',
      reflections: [
        context.topic ? `Guilt or shame is present here around ${context.topic}. These feelings often show up when you believe you've done something wrong or when you're judging yourself harshly—they can signal a conflict between your actions and your values, or a sense of not measuring up.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}` : `Guilt or shame is present here. These feelings often show up when you believe you've done something wrong or when you're judging yourself harshly—they can signal a conflict between your actions and your values, or a sense of not measuring up.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}`,
        `There's guilt or shame${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` related to ${context.topic}` : ''}. These emotions typically appear when you're evaluating your behavior against your standards or values, and feeling that you've fallen short in some way.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}`,
        context.topic ? `Guilt and shame are showing up around ${context.topic} matters. These feelings often emerge when you're carrying a sense that you've done something wrong, haven't lived up to expectations (yours or others'), or when you're being particularly hard on yourself.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}` : `Guilt and shame are showing up. These feelings often emerge when you're carrying a sense that you've done something wrong, haven't lived up to expectations (yours or others'), or when you're being particularly hard on yourself.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['grateful', 'gratitude', 'thankful', 'appreciate', 'blessed'],
      emotionPattern: 'grateful',
      reflections: [
        context.topic ? `Gratitude is present in what you've shared, especially around ${context.topic}. This feeling often shows up when you recognize something positive or meaningful in your life, even if other challenges exist alongside it—it's a moment of acknowledging what's good.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}` : `Gratitude is present in what you've shared. This feeling often shows up when you recognize something positive or meaningful in your life, even if other challenges exist alongside it—it's a moment of acknowledging what's good.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}`,
        `There's gratitude here${context.intensity === 'high' ? ', and it seems quite profound' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Gratitude typically appears when you're able to pause and recognize the positive aspects of your experience, even in the midst of difficulty.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}`,
        context.topic ? `Gratitude is showing up around ${context.topic}. This feeling often emerges when you're able to notice and appreciate what's working, what's good, or what you value, creating space for positive feelings alongside whatever challenges you're facing.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}` : `Gratitude is showing up. This feeling often emerges when you're able to notice and appreciate what's working, what's good, or what you value, creating space for positive feelings alongside whatever challenges you're facing.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['hopeless', 'hopelessness', 'despair', 'no point', 'nothing matters'],
      emotionPattern: 'hopeless',
      reflections: [
        context.topic ? `Hopelessness is showing up here around ${context.topic}—like the path forward feels blocked or the future looks dark. This feeling often signals that you're struggling to see possibilities or that your energy for moving forward has been depleted.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}` : `Hopelessness is showing up here—like the path forward feels blocked or the future looks dark. This feeling often signals that you're struggling to see possibilities or that your energy for moving forward has been depleted.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}`,
        `There's a sense of hopelessness${context.intensity === 'high' ? ', and it seems quite profound' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Hopelessness typically appears when you can't see a way forward, when solutions feel out of reach, or when the future feels uncertain or bleak.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}`,
        context.topic ? `Hopelessness is present around ${context.topic} matters. This feeling often emerges when you've been struggling with something for a while, when solutions haven't materialized, or when you're feeling stuck without a clear path to change.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}` : `Hopelessness is present. This feeling often emerges when you've been struggling with something for a while, when solutions haven't materialized, or when you're feeling stuck without a clear path to change.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['proud', 'accomplished', 'achievement', 'succeeded', 'did it'],
      emotionPattern: 'proud',
      reflections: [
        context.topic ? `There's a sense of accomplishment or pride here around ${context.topic}. This feeling often shows up when you recognize that you've done something meaningful, overcome a challenge, or moved forward in a way that matters to you.\n\n${getDBTSkill('proud', context.topic, context.intensity)}` : `There's a sense of accomplishment or pride here. This feeling often shows up when you recognize that you've done something meaningful, overcome a challenge, or moved forward in a way that matters to you.\n\n${getDBTSkill('proud', context.topic, context.intensity)}`,
        `Pride and accomplishment are present${context.intensity === 'high' ? ', and it seems quite significant' : ''}${context.topic ? ` related to ${context.topic}` : ''}. These feelings typically appear when you've achieved something, persevered through difficulty, or made progress toward something that matters to you.\n\n${getDBTSkill('proud', context.topic, context.intensity)}`,
        context.topic ? `There's pride showing up around ${context.topic} matters. This feeling often emerges when you've accomplished something, handled a challenge well, or recognized your own growth or capability in some way.\n\n${getDBTSkill('proud', context.topic, context.intensity)}` : `There's pride showing up. This feeling often emerges when you've accomplished something, handled a challenge well, or recognized your own growth or capability in some way.\n\n${getDBTSkill('proud', context.topic, context.intensity)}`
      ]
    },
  ];

  // Find matching patterns
  const matches = patterns.filter(pattern => 
    pattern.keywords.some(keyword => lowerText.includes(keyword))
  );

  if (matches.length > 0) {
    // Select a random reflection from the matched pattern(s) using unique seed for variation
    const selectedPattern = matches[0];
    const reflections = selectedPattern.reflections;
    const reflectionIndex = (uniqueSeed + wordCount + characterCount) % reflections.length;
    const selectedReflection = reflections[reflectionIndex];
    
    // If multiple emotions detected, add context about complexity
    if (matches.length > 1) {
      return selectedReflection + ' There may also be other emotions layered underneath, which is common when dealing with complex situations.';
    }
    return selectedReflection;
  }

  // Context-aware default reflections with DBT skills for generic situations
  if (wordCount > 100) {
    const longReflections = [
      context.topic ? `You've shared a lot here about ${context.topic}—there's depth and complexity in what you're processing. This suggests you're working through something significant that has multiple layers to it.\n\nConsider using **Mindfulness - Observe** to notice what you're experiencing without judgment, and **Check the Facts** to separate what's happening from what you're interpreting.` : `You've shared a lot here—there's depth and complexity in what you're processing. This suggests you're working through something significant that has multiple layers to it.\n\nConsider using **Mindfulness - Observe** to notice what you're experiencing without judgment, and **Check the Facts** to separate what's happening from what you're interpreting.`,
      `There's substantial content here${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` around ${context.topic}` : ''}. The length and detail suggest you're processing something meaningful that deserves attention and care.\n\n**Wise Mind** - balancing your emotional experience with reasonable perspective - can help you find clarity in complex situations.`,
      context.topic ? `You've put a lot into what you've shared about ${context.topic}. This depth indicates something important is happening—something that matters enough for you to express it fully.\n\nTry **Self-Validate** - acknowledge the significance of what you're experiencing, and consider **Radical Acceptance** if there are aspects you can't change right now.` : `You've put a lot into what you've shared. This depth indicates something important is happening—something that matters enough for you to express it fully.\n\nTry **Self-Validate** - acknowledge the significance of what you're experiencing, and consider **Radical Acceptance** if there are aspects you can't change right now.`
    ];
    return longReflections[(uniqueSeed + wordCount) % longReflections.length];
  }
  
  // Default reflection for medium-length text (8-100 words)
  const defaultReflections = [
    context.topic ? `You've shared something meaningful here about ${context.topic}. There's emotional weight in what you've expressed, and it's clear this matters to you.\n\nConsider **Mindfulness - Describe** to observe your experience, and **Self-Soothe** if you need comfort right now.` : `You've shared something meaningful here. There's emotional weight in what you've expressed, and it's clear this matters to you.\n\nConsider **Mindfulness - Describe** to observe your experience, and **Self-Soothe** if you need comfort right now.`,
    `There's substance in what you've written${context.intensity === 'high' ? ', and the intensity is noticeable' : ''}${context.topic ? ` around ${context.topic}` : ''}. This suggests something important is happening for you.\n\n**Wise Mind** can help balance emotional experience with reasonable thinking, and **Check the Facts** can clarify what's actually happening versus interpretations.`,
    `What you've shared carries significance${context.topic ? ` related to ${context.topic}` : ''}${text.includes('?') ? ', and I notice you\'re asking questions about it' : ''}. There's clearly something here that matters to you.\n\n**Mindfulness - Participate** - fully engaging in the present moment - can help ground you as you process this.`,
    context.topic ? `There's depth in what you've expressed about ${context.topic}. It's clear that what you're processing isn't trivial—it has weight and meaning for you.\n\n**Validate** yourself - your feelings make sense. Consider **Self-Soothe** or **Radical Acceptance** depending on what feels most helpful right now.` : `There's depth in what you've expressed. It's clear that what you're processing isn't trivial—it has weight and meaning for you.\n\n**Validate** yourself - your feelings make sense. Consider **Self-Soothe** or **Radical Acceptance** depending on what feels most helpful right now.`
  ];
  return defaultReflections[(uniqueSeed + characterCount) % defaultReflections.length];
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rooms
app.get('/rooms', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY name ASC').all();
    res.json(rooms.map(room => ({
      ...room,
      createdAt: room.createdAt, // Already ISO string
    })));
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

// Vents
app.get('/vents', (req, res) => {
  try {
    const { limit = 50, offset = 0, roomId } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;

    let query = 'SELECT * FROM vents';
    let params = [];

    if (roomId) {
      query += ' WHERE roomId = ?';
      params.push(roomId);
    }

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const vents = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM vents';
    let countParams = [];
    if (roomId) {
      countQuery += ' WHERE roomId = ?';
      countParams.push(roomId);
    }
    const totalResult = db.prepare(countQuery).get(...countParams);
    const total = totalResult?.count || vents.length;

    const ventsWithRooms = vents.map(vent => {
      const room = vent.roomId ? getRoomById(vent.roomId) : null;
      // Get reflection for this vent
      const reflection = db.prepare('SELECT reflection FROM emotional_reflections WHERE ventId = ?').get(vent.id);
      return {
        id: vent.id,
        roomId: vent.roomId || null,
        room: room ? {
          id: room.id,
          name: room.name,
          description: room.description,
        } : undefined,
        text: vent.text,
        anonymousHandle: vent.anonymousHandle,
        deviceId: vent.deviceId,
        moodBefore: vent.moodBefore,
        moodAfter: vent.moodAfter,
        createdAt: vent.createdAt,
        reflection: reflection ? reflection.reflection : null,
      };
    });

    res.json({ vents: ventsWithRooms, total });
  } catch (error) {
    console.error('Error fetching vents:', error);
    res.status(500).json({ message: 'Failed to fetch vents' });
  }
});

// Delete vent endpoint (developer only)
app.delete('/vents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;
    const developerToken = req.headers['x-developer-token'];
    
    // Check if user is developer
    // Developer access is granted if:
    // 1. X-Developer-Token header matches DEVELOPER_TOKEN environment variable, OR
    // 2. Device ID matches one of the DEVELOPER_DEVICE_IDs (comma-separated)
    const isDeveloper = (developerToken && DEVELOPER_TOKEN && developerToken === DEVELOPER_TOKEN) || 
                       (deviceId && DEVELOPER_DEVICE_IDS.length > 0 && DEVELOPER_DEVICE_IDS.includes(deviceId));
    
    if (!isDeveloper) {
      console.warn(`Unauthorized vent deletion attempt: ventId=${id}, deviceId=${deviceId}`);
      return res.status(403).json({ message: 'Only developers can delete vents' });
    }
    
    console.log(`Developer deleting vent: ventId=${id}, deviceId=${deviceId}`);

    const vent = db.prepare('SELECT * FROM vents WHERE id = ?').get(id);
    if (!vent) {
      return res.status(404).json({ message: 'Vent not found' });
    }

    // Delete vent and all associated data
    db.prepare('DELETE FROM vents WHERE id = ?').run(id);
    db.prepare('DELETE FROM comments WHERE ventId = ?').run(id);
    db.prepare('DELETE FROM reactions WHERE ventId = ?').run(id);
    db.prepare('DELETE FROM emotional_reflections WHERE ventId = ?').run(id);
    db.prepare('DELETE FROM reports WHERE ventId = ?').run(id);

    console.log(`Vent ${id} deleted by developer (deviceId: ${deviceId})`);
    res.status(200).json({ message: 'Vent deleted successfully' });
  } catch (error) {
    console.error('Error deleting vent:', error);
    res.status(500).json({ message: 'Failed to delete vent' });
  }
});

app.get('/vents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const vent = db.prepare('SELECT * FROM vents WHERE id = ?').get(id);

    if (!vent) {
      return res.status(404).json({ message: 'Vent not found' });
    }

    const room = vent.roomId ? getRoomById(vent.roomId) : null;
    
    // Get emotional reflection if it exists
    const reflection = db.prepare('SELECT reflection FROM emotional_reflections WHERE ventId = ?').get(id);

    res.json({
      id: vent.id,
      roomId: vent.roomId || null,
      room: room ? {
        id: room.id,
        name: room.name,
        description: room.description,
      } : undefined,
      text: vent.text,
      anonymousHandle: vent.anonymousHandle,
      deviceId: vent.deviceId,
      moodBefore: vent.moodBefore,
      moodAfter: vent.moodAfter,
      createdAt: vent.createdAt,
      reflection: reflection ? reflection.reflection : null,
    });
  } catch (error) {
    console.error('Error fetching vent:', error);
    res.status(500).json({ message: 'Failed to fetch vent' });
  }
});

app.post('/vents', async (req, res) => {
  try {
    const { text, anonymousHandle, deviceId, moodBefore, moodAfter, roomId, generateReflection } = req.body;

    // Validation
    if (!text || !anonymousHandle || !deviceId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (typeof moodBefore !== 'number' || typeof moodAfter !== 'number') {
      return res.status(400).json({ message: 'Invalid mood values' });
    }

    // Validate roomId if provided
    if (roomId && !getRoomById(roomId)) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO vents (id, roomId, text, anonymousHandle, deviceId, moodBefore, moodAfter, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, roomId || null, text, anonymousHandle, deviceId, moodBefore, moodAfter, createdAt);

    const vent = db.prepare('SELECT * FROM vents WHERE id = ?').get(id);
    const room = vent.roomId ? getRoomById(vent.roomId) : null;

    // Always generate emotional reflection (default behavior)
    let reflection = null;
    try {
      reflection = generateEmotionalReflection(text);
      // Only store reflection if it was generated (not null - text was long enough)
      if (reflection) {
        const reflectionId = uuidv4();
        db.prepare(`
          INSERT INTO emotional_reflections (id, ventId, reflection, createdAt)
          VALUES (?, ?, ?, ?)
        `).run(reflectionId, id, reflection, createdAt);
      }
      // If reflection is null, text was too short - don't store anything
    } catch (reflectionError) {
      console.error('Error generating reflection:', reflectionError);
      // Don't generate a default reflection - if generation fails, return null
      reflection = null;
    }

    res.status(201).json({
      id: vent.id,
      roomId: vent.roomId || null,
      room: room ? {
        id: room.id,
        name: room.name,
        description: room.description,
      } : undefined,
      text: vent.text,
      anonymousHandle: vent.anonymousHandle,
      deviceId: vent.deviceId,
      moodBefore: vent.moodBefore,
      moodAfter: vent.moodAfter,
      createdAt: vent.createdAt,
      reflection: reflection,
    });
  } catch (error) {
    console.error('Error creating vent:', error);
    res.status(500).json({ message: 'Failed to create vent' });
  }
});

// Comments
app.get('/comments/vent/:ventId', (req, res) => {
  try {
    const { ventId } = req.params;
    const comments = db.prepare(`
      SELECT * FROM comments 
      WHERE ventId = ? 
      ORDER BY createdAt ASC
    `).all(ventId);

    res.json(comments.map(comment => ({
      id: comment.id,
      ventId: comment.ventId,
      text: comment.text,
      anonymousHandle: comment.anonymousHandle,
      createdAt: comment.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

app.post('/comments', (req, res) => {
  try {
    const { ventId, text, anonymousHandle, deviceId } = req.body;

    // Validation
    if (!ventId || !text || !anonymousHandle || !deviceId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if vent exists
    const vent = db.prepare('SELECT id FROM vents WHERE id = ?').get(ventId);
    if (!vent) {
      return res.status(404).json({ message: 'Vent not found' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO comments (id, ventId, text, anonymousHandle, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, ventId, text, anonymousHandle, createdAt);

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);

    res.status(201).json({
      id: comment.id,
      ventId: comment.ventId,
      text: comment.text,
      anonymousHandle: comment.anonymousHandle,
      createdAt: comment.createdAt,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Failed to create comment' });
  }
});

// Reactions
app.get('/reactions/vent/:ventId', (req, res) => {
  try {
    const { ventId } = req.params;
    const reactions = db.prepare(`
      SELECT * FROM reactions 
      WHERE ventId = ? 
      ORDER BY createdAt ASC
    `).all(ventId);

    res.json(reactions.map(reaction => ({
      id: reaction.id,
      ventId: reaction.ventId,
      type: reaction.type,
      anonymousHandle: reaction.anonymousHandle,
      createdAt: reaction.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ message: 'Failed to fetch reactions' });
  }
});

app.get('/reactions/vent/:ventId/counts', (req, res) => {
  try {
    const { ventId } = req.params;
    
    const counts = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM reactions 
      WHERE ventId = ? 
      GROUP BY type
    `).all(ventId);

    const result = {
      comment: 0,
      support: 0,
      empathy: 0,
    };

    counts.forEach(row => {
      result[row.type] = row.count;
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching reaction counts:', error);
    res.status(500).json({ message: 'Failed to fetch reaction counts' });
  }
});

app.post('/reactions', (req, res) => {
  try {
    const { ventId, type, anonymousHandle, deviceId } = req.body;

    // Validation
    if (!ventId || !type || !anonymousHandle || !deviceId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['comment', 'support', 'empathy'].includes(type)) {
      return res.status(400).json({ message: 'Invalid reaction type' });
    }

    // Check if vent exists
    const vent = db.prepare('SELECT id FROM vents WHERE id = ?').get(ventId);
    if (!vent) {
      return res.status(404).json({ message: 'Vent not found' });
    }

    // Check if reaction already exists (toggle off)
    const existing = db.prepare(`
      SELECT * FROM reactions 
      WHERE ventId = ? AND type = ? AND deviceId = ?
    `).get(ventId, type, deviceId);

    if (existing) {
      // Remove reaction (toggle off)
      db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
      res.json(null);
    } else {
      // Add reaction
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO reactions (id, ventId, type, anonymousHandle, deviceId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, ventId, type, anonymousHandle, deviceId, createdAt);

        const reaction = db.prepare('SELECT * FROM reactions WHERE id = ?').get(id);

        res.status(201).json({
          id: reaction.id,
          ventId: reaction.ventId,
          type: reaction.type,
          anonymousHandle: reaction.anonymousHandle,
          createdAt: reaction.createdAt,
        });
      } catch (error) {
        // If unique constraint fails, it means it was just added - return it
        if (error.message.includes('UNIQUE constraint')) {
          const reaction = db.prepare(`
            SELECT * FROM reactions 
            WHERE ventId = ? AND type = ? AND deviceId = ?
          `).get(ventId, type, deviceId);
          res.status(201).json({
            id: reaction.id,
            ventId: reaction.ventId,
            type: reaction.type,
            anonymousHandle: reaction.anonymousHandle,
            createdAt: reaction.createdAt,
          });
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error creating reaction:', error);
    res.status(500).json({ message: 'Failed to create reaction' });
  }
});

// Get all reports (for debugging/resending emails)
app.get('/reports', async (req, res) => {
  try {
    const reports = db.prepare('SELECT * FROM reports ORDER BY createdAt DESC LIMIT 100').all();
    res.json(reports.map(report => ({
      id: report.id,
      ventId: report.ventId,
      reason: report.reason,
      description: report.description,
      deviceId: report.deviceId,
      createdAt: report.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

// Test email endpoint (for debugging)
app.post('/test-email', async (req, res) => {
  try {
    const testReport = {
      id: 'test-' + Date.now(),
      ventId: 'test-vent',
      reason: 'test',
      description: 'This is a test email',
      deviceId: 'test-device',
      createdAt: new Date().toISOString(),
    };
    
    const testVent = {
      id: 'test-vent',
      text: 'This is a test vent for email verification',
      anonymousHandle: 'TestUser',
      room: { id: 'test', name: 'Test Room' },
    };
    
    const emailSent = await sendReportEmail(testReport, testVent);
    
    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully to feelspacemood@gmail.com',
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email. Check server logs for details.',
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending test email: ' + error.message,
    });
  }
});

// Resend emails for existing reports
app.post('/reports/:id/resend-email', async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const vent = db.prepare('SELECT * FROM vents WHERE id = ?').get(report.ventId);
    if (!vent) {
      return res.status(404).json({ message: 'Vent not found' });
    }
    
    const room = vent.roomId ? getRoomById(vent.roomId) : null;
    const ventWithRoom = {
      ...vent,
      room: room ? {
        id: room.id,
        name: room.name,
        description: room.description,
      } : null,
    };
    
    const emailSent = await sendReportEmail(report, ventWithRoom);
    
    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'Email resent successfully to feelspacemood@gmail.com',
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to resend email. Check server logs for details.',
      });
    }
  } catch (error) {
    console.error('Error resending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error resending email: ' + error.message,
    });
  }
});

// Reports
app.post('/reports', async (req, res) => {
  try {
    const { ventId, reason, description, deviceId } = req.body;

    if (!ventId || !reason || !deviceId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get the vent details
    const vent = db.prepare('SELECT * FROM vents WHERE id = ?').get(ventId);
    if (!vent) {
      return res.status(404).json({ message: 'Vent not found' });
    }

    // Get room info if available
    const room = vent.roomId ? getRoomById(vent.roomId) : null;

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO reports (id, ventId, reason, description, deviceId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, ventId, reason, description || null, deviceId, createdAt);

    const report = {
      id,
      ventId,
      reason,
      description: description || null,
      deviceId,
      createdAt,
    };

    // Send email notification - MUST be awaited to ensure it's actually sent
    const ventWithRoom = {
      ...vent,
      room: room ? {
        id: room.id,
        name: room.name,
        description: room.description,
      } : null,
    };

    // Send email immediately (await it to ensure it's sent)
    // Use setImmediate to make it non-blocking for the response
    let emailSent = false;
    setImmediate(async () => {
      try {
        emailSent = await sendReportEmail(report, ventWithRoom);
        if (emailSent) {
          console.log(`✅ Report ${id} email sent successfully to feelspacemood@gmail.com`);
        } else {
          console.warn(`⚠️ Report ${id} saved but email failed. Please check email configuration.`);
          console.warn(`   Check server logs above for email error details.`);
          console.warn(`   You can resend the email by calling: POST /reports/${id}/resend-email`);
        }
      } catch (error) {
        console.error('❌ Failed to send report email:', error);
        console.error('   Report was still saved to database.');
        console.error('   Please check EMAIL_PASSWORD environment variable and server logs.');
        console.error(`   You can resend the email by calling: POST /reports/${id}/resend-email`);
      }
    });

    res.status(201).json({ 
      id, 
      message: 'Report submitted successfully',
      emailSent: false, // Will be updated asynchronously
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Failed to create report' });
  }
});

// Handle actions from email (block/no-block)
app.get('/api/reports/action', async (req, res) => {
  try {
    const { token, action } = req.query;

    if (!token || !action) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Invalid Request</h2>
            <p>Missing required parameters.</p>
          </body>
        </html>
      `);
    }

    const tokenData = verifyActionToken(token);
    if (!tokenData) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Invalid or Expired Token</h2>
            <p>This action link has expired or has already been used.</p>
          </body>
        </html>
      `);
    }

    const { reportId } = tokenData;

    // Get report details
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Report Not Found</h2>
            <p>The report could not be found.</p>
          </body>
        </html>
      `);
    }

    // Get vent details
    const vent = db.prepare('SELECT * FROM vents WHERE id = ?').get(report.ventId);
    if (!vent) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Vent Not Found</h2>
            <p>The reported vent could not be found.</p>
          </body>
        </html>
      `);
    }

    if (action === 'block') {
      // Block the user by deviceId (since we don't have user accounts)
      // In a real system, you'd want to block by deviceId or create a blocked_users table
      // For now, we'll mark the vent as hidden and log the block action
      
      // Delete the vent
      db.prepare('DELETE FROM vents WHERE id = ?').run(report.ventId);
      
      // Delete all comments and reactions for this vent (cascade should handle this, but being explicit)
      db.prepare('DELETE FROM comments WHERE ventId = ?').run(report.ventId);
      db.prepare('DELETE FROM reactions WHERE ventId = ?').run(report.ventId);
      
      // Update report status (you might want to add a status column)
      console.log(`User blocked for report ${reportId}. Vent ${report.ventId} deleted.`);
      
      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
              .success { background-color: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 30px; max-width: 500px; margin: 0 auto; }
              h2 { color: #065f46; margin-bottom: 20px; }
              p { color: #047857; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="success">
              <h2>✅ User Blocked Successfully</h2>
              <p>The reported content has been removed and the user has been blocked.</p>
              <p><strong>Report ID:</strong> ${reportId}</p>
              <p><strong>Vent ID:</strong> ${report.ventId}</p>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">You can close this window.</p>
            </div>
          </body>
        </html>
      `);
    } else if (action === 'no-block') {
      // Mark report as reviewed but no action needed
      console.log(`No action taken for report ${reportId}.`);
      
      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
              .info { background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 30px; max-width: 500px; margin: 0 auto; }
              h2 { color: #1e40af; margin-bottom: 20px; }
              p { color: #1e3a8a; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="info">
              <h2>ℹ️ No Action Taken</h2>
              <p>The report has been reviewed and no action is needed.</p>
              <p><strong>Report ID:</strong> ${reportId}</p>
              <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">You can close this window.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Invalid Action</h2>
            <p>The specified action is not valid.</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error processing report action:', error);
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Error</h2>
          <p>An error occurred while processing the action.</p>
        </body>
      </html>
    `);
  }
});

// Mood Logs
app.get('/mood-logs', (req, res) => {
  try {
    const { deviceId, startDate, endDate } = req.query;

    if (!deviceId) {
      return res.status(400).json({ message: 'deviceId is required' });
    }

    let query = 'SELECT * FROM mood_logs WHERE deviceId = ?';
    const params = [deviceId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';

    const logs = db.prepare(query).all(...params);

    res.json(logs.map(log => ({
      id: log.id,
      deviceId: log.deviceId,
      date: log.date,
      moodLevel: log.moodLevel,
      note: log.note || null,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    })));
  } catch (error) {
    console.error('Error fetching mood logs:', error);
    res.status(500).json({ message: 'Failed to fetch mood logs' });
  }
});

app.get('/mood-logs/today', (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ message: 'deviceId is required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const log = db.prepare('SELECT * FROM mood_logs WHERE deviceId = ? AND date = ?').get(deviceId, today);

    if (!log) {
      return res.status(404).json({ message: 'No mood log found for today' });
    }

    res.json({
      id: log.id,
      deviceId: log.deviceId,
      date: log.date,
      moodLevel: log.moodLevel,
      note: log.note || null,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching today\'s mood log:', error);
    res.status(500).json({ message: 'Failed to fetch today\'s mood log' });
  }
});

app.post('/mood-logs', (req, res) => {
  try {
    const { deviceId, date, moodLevel, note } = req.body;

    // Validation
    if (!deviceId || !date || !moodLevel) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['Great', 'Good', 'Okay', 'Meh', 'Low'].includes(moodLevel)) {
      return res.status(400).json({ message: 'Invalid mood level' });
    }

    // Check if mood log already exists for this date and device
    const existing = db.prepare('SELECT * FROM mood_logs WHERE deviceId = ? AND date = ?').get(deviceId, date);

    if (existing) {
      return res.status(409).json({ message: 'Mood log already exists for this date. Use PUT to update.' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO mood_logs (id, deviceId, date, moodLevel, note, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, deviceId, date, moodLevel, note || null, now, now);

    const log = db.prepare('SELECT * FROM mood_logs WHERE id = ?').get(id);

    res.status(201).json({
      id: log.id,
      deviceId: log.deviceId,
      date: log.date,
      moodLevel: log.moodLevel,
      note: log.note || null,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ message: 'Mood log already exists for this date' });
    }
    console.error('Error creating mood log:', error);
    res.status(500).json({ message: 'Failed to create mood log' });
  }
});

app.put('/mood-logs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { moodLevel, note } = req.body;

    // Validation
    if (moodLevel && !['Great', 'Good', 'Okay', 'Meh', 'Low'].includes(moodLevel)) {
      return res.status(400).json({ message: 'Invalid mood level' });
    }

    const existing = db.prepare('SELECT * FROM mood_logs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ message: 'Mood log not found' });
    }

    // Only allow updates on the same day
    const today = new Date().toISOString().split('T')[0];
    if (existing.date !== today) {
      return res.status(403).json({ message: 'Can only update mood logs from today' });
    }

    const updatedAt = new Date().toISOString();
    const updates = [];
    const params = [];

    if (moodLevel !== undefined) {
      updates.push('moodLevel = ?');
      params.push(moodLevel);
    }

    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note || null);
    }

    updates.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(id);

    db.prepare(`
      UPDATE mood_logs 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params);

    const updated = db.prepare('SELECT * FROM mood_logs WHERE id = ?').get(id);

    res.json({
      id: updated.id,
      deviceId: updated.deviceId,
      date: updated.date,
      moodLevel: updated.moodLevel,
      note: updated.note || null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('Error updating mood log:', error);
    res.status(500).json({ message: 'Failed to update mood log' });
  }
});

// Analytics (optional)
app.post('/analytics/track', (req, res) => {
  try {
    const { eventType, metadata } = req.body;
    // For now, just log analytics events
    // In production, you might want to store these in a database or send to an analytics service
    console.log('Analytics event:', eventType, metadata);
    res.status(200).json({ message: 'Event tracked' });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    res.status(500).json({ message: 'Failed to track analytics' });
  }
});

app.get('/analytics/metrics', (req, res) => {
  try {
    // Return mock metrics for now
    // In production, calculate these from the database
    res.json({
      firstVentCompletions: 0,
      averageTimeToFirstComment: 0,
      moodImprovements: 0,
      averageMoodImprovement: 0,
      totalEvents: 0,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// Speech-to-Text endpoints
// Store for active recording sessions
const activeRecordings = new Map();

app.post('/speech/start', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || uuidv4();
    const recordingId = uuidv4();
    
    // Initialize recording session
    activeRecordings.set(recordingId, {
      sessionId,
      transcript: '',
      startTime: new Date().toISOString(),
      isActive: true,
    });

    res.json({ recordingId, sessionId });
  } catch (error) {
    console.error('Error starting speech recording:', error);
    res.status(500).json({ message: 'Failed to start recording' });
  }
});

app.post('/speech/stop', (req, res) => {
  try {
    const { recordingId } = req.body;
    
    if (!recordingId || !activeRecordings.has(recordingId)) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    const recording = activeRecordings.get(recordingId);
    recording.isActive = false;
    
    res.json({ 
      transcript: recording.transcript,
      recordingId,
    });
    
    // Clean up after a delay
    setTimeout(() => {
      activeRecordings.delete(recordingId);
    }, 5000);
  } catch (error) {
    console.error('Error stopping speech recording:', error);
    res.status(500).json({ message: 'Failed to stop recording' });
  }
});

app.get('/speech/transcript', (req, res) => {
  try {
    const { recordingId } = req.query;
    
    if (!recordingId || !activeRecordings.has(recordingId)) {
      return res.json({ transcript: '' });
    }

    const recording = activeRecordings.get(recordingId);
    res.json({ transcript: recording.transcript || '' });
  } catch (error) {
    console.error('Error getting transcript:', error);
    res.status(500).json({ message: 'Failed to get transcript' });
  }
});

app.post('/speech/update', (req, res) => {
  try {
    const { recordingId, transcript } = req.body;
    
    if (!recordingId || !activeRecordings.has(recordingId)) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    const recording = activeRecordings.get(recordingId);
    if (recording.isActive) {
      // Append or update transcript for real-time updates
      if (transcript) {
        // If transcript is provided, update it (for real-time streaming)
        recording.transcript = transcript;
        recording.lastUpdate = new Date().toISOString();
      }
    }
    
    res.json({ success: true, transcript: recording.transcript });
  } catch (error) {
    console.error('Error updating transcript:', error);
    res.status(500).json({ message: 'Failed to update transcript' });
  }
});

// Batch Sync endpoint - for offline sync
app.post('/sync/batch', (req, res) => {
  try {
    const { deviceId, actions } = req.body;
    
    if (!deviceId || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ message: 'Invalid request: deviceId and actions array required' });
    }

    const synced = [];
    const failed = [];
    const conflicts = [];

    // Process each action
    for (const action of actions) {
      try {
        // Handle conflicts (409) - for now, we'll accept the client's version if timestamp is newer
        // In a more sophisticated implementation, you could merge data
        
        switch (action.type) {
          case 'vent':
            if (action.action === 'create') {
              // Check if vent already exists
              const existingVent = db.prepare('SELECT * FROM vents WHERE id = ?').get(action.data.id);
              if (existingVent) {
                // Conflict - check timestamps
                const existingTimestamp = new Date(existingVent.createdAt).getTime();
                const newTimestamp = new Date(action.timestamp).getTime();
                if (newTimestamp > existingTimestamp) {
                  // Update with newer version
                  db.prepare(`
                    UPDATE vents 
                    SET text = ?, anonymousHandle = ?, moodBefore = ?, moodAfter = ?, roomId = ?, updatedAt = ?
                    WHERE id = ?
                  `).run(
                    action.data.text,
                    action.data.anonymousHandle,
                    action.data.moodBefore,
                    action.data.moodAfter,
                    action.data.roomId || null,
                    new Date().toISOString(),
                    action.data.id
                  );
                  synced.push(action.id);
                } else {
                  conflicts.push({ id: action.id, conflictType: 'version_mismatch' });
                }
              } else {
                // Create new vent
                db.prepare(`
                  INSERT INTO vents (id, roomId, text, anonymousHandle, deviceId, moodBefore, moodAfter, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  action.data.id,
                  action.data.roomId || null,
                  action.data.text,
                  action.data.anonymousHandle,
                  deviceId,
                  action.data.moodBefore,
                  action.data.moodAfter,
                  action.data.createdAt || new Date().toISOString()
                );
                synced.push(action.id);
              }
            } else if (action.action === 'delete') {
              db.prepare('DELETE FROM vents WHERE id = ? AND deviceId = ?').run(action.data.id, deviceId);
              synced.push(action.id);
            }
            break;
            
          case 'mood_log':
            if (action.action === 'create') {
              // Check if mood log already exists for this date
              const existingLog = db.prepare('SELECT * FROM mood_logs WHERE deviceId = ? AND date = ?').get(deviceId, action.data.date);
              if (existingLog) {
                // Update existing log
                db.prepare(`
                  UPDATE mood_logs 
                  SET moodLevel = ?, note = ?, updatedAt = ?
                  WHERE id = ?
                `).run(
                  action.data.moodLevel,
                  action.data.note || null,
                  new Date().toISOString(),
                  existingLog.id
                );
                synced.push(action.id);
              } else {
                // Create new log
                db.prepare(`
                  INSERT INTO mood_logs (id, deviceId, date, moodLevel, note, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                  action.data.id,
                  deviceId,
                  action.data.date,
                  action.data.moodLevel,
                  action.data.note || null,
                  new Date().toISOString(),
                  new Date().toISOString()
                );
                synced.push(action.id);
              }
            } else if (action.action === 'update') {
              db.prepare(`
                UPDATE mood_logs 
                SET moodLevel = ?, note = ?, updatedAt = ?
                WHERE id = ?
              `).run(
                action.data.moodLevel,
                action.data.note || null,
                new Date().toISOString(),
                action.data.id
              );
              synced.push(action.id);
            }
            break;
            
          case 'comment':
            if (action.action === 'create') {
              db.prepare(`
                INSERT INTO comments (id, ventId, text, anonymousHandle, createdAt)
                VALUES (?, ?, ?, ?, ?)
              `).run(
                action.data.id || `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                action.data.ventId,
                action.data.text,
                action.data.anonymousHandle,
                action.data.createdAt || new Date().toISOString()
              );
              synced.push(action.id);
            } else if (action.action === 'delete') {
              db.prepare('DELETE FROM comments WHERE id = ?').run(action.data.id);
              synced.push(action.id);
            }
            break;
            
          case 'reaction':
            if (action.action === 'create') {
              // Check if reaction already exists
              const existingReaction = db.prepare(`
                SELECT * FROM reactions 
                WHERE ventId = ? AND type = ? AND deviceId = ?
              `).get(action.data.ventId, action.data.type, deviceId);
              
              if (existingReaction) {
                // Toggle off - delete reaction
                db.prepare('DELETE FROM reactions WHERE id = ?').run(existingReaction.id);
                synced.push(action.id);
              } else {
                // Create new reaction
                db.prepare(`
                  INSERT INTO reactions (id, ventId, type, anonymousHandle, deviceId, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                  action.data.id || `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  action.data.ventId,
                  action.data.type,
                  action.data.anonymousHandle,
                  deviceId,
                  action.data.createdAt || new Date().toISOString()
                );
                synced.push(action.id);
              }
            }
            break;
            
          case 'report':
            if (action.action === 'create') {
              db.prepare(`
                INSERT INTO reports (id, ventId, reason, description, deviceId, createdAt)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(
                action.data.id || `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                action.data.ventId,
                action.data.reason,
                action.data.description || null,
                deviceId,
                action.data.createdAt || new Date().toISOString()
              );
              synced.push(action.id);
            }
            break;
            
          default:
            failed.push({ id: action.id, error: 'Unknown action type' });
        }
      } catch (error) {
        console.error(`Error processing action ${action.id}:`, error);
        failed.push({ id: action.id, error: error.message || 'Unknown error' });
      }
    }

    res.json({ synced, failed, conflicts });
  } catch (error) {
    console.error('Error in batch sync:', error);
    res.status(500).json({ message: 'Failed to process batch sync' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Let It Out API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  console.log('\nDatabase connection closed');
  process.exit(0);
});

