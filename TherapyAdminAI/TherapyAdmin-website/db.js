// ============================================================
// TherapyAdmin AI — db.js
// Unified Database Layer supporting SQLite and PostgreSQL
// Field-Level AES-256-GCM PHI Encryption at Rest (HIPAA-Ready)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Initialize database type and client
let dbType = 'sqlite';
let sqliteDb = null;
let pgPool = null;

// Encryption Configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_SECRET = process.env.SESSION_SECRET || 'fallback-key-replace-in-production-12345';
// Derive a secure 32-byte key from the SESSION_SECRET using SHA-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_SECRET).digest();

/**
 * Encrypts plain text using AES-256-GCM.
 * Returns a colon-separated string: "iv:encryptedData:authTag"
 */
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(12); // 12-byte IV is standard for GCM
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (err) {
    console.error('[ENCRYPTION ERROR]', err);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts a colon-separated string: "iv:encryptedData:authTag"
 * using AES-256-GCM and returns plain text.
 * Falls back to returning the original text if it is not encrypted (legacy data).
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // Legacy unencrypted data, return as-is
    return encryptedText;
  }
  
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('[DECRYPTION ERROR] Failed to decrypt content; returning raw ciphertext/text.', err);
    return encryptedText;
  }
}

// Simple environment variable loader fallback
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL;

if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  dbType = 'postgres';
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('[DB] Running in PostgreSQL mode');
} else {
  dbType = 'sqlite';
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(__dirname, 'therapyadmin.db');
  sqliteDb = new Database(dbPath);
  console.log(`[DB] Running in SQLite mode (${dbPath})`);
}

// Convert "?" placeholders to "$1, $2" for PostgreSQL compatibility
function prepareSql(sql) {
  if (dbType === 'sqlite') return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Generic query executor returning rows
async function query(sql, params = []) {
  const prepared = prepareSql(sql);
  try {
    if (dbType === 'postgres') {
      const res = await pgPool.query(prepared, params);
      return res.rows;
    } else {
      const stmt = sqliteDb.prepare(prepared);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        const info = stmt.run(...params);
        return { insertId: info.lastInsertRowid, changes: info.changes };
      }
    }
  } catch (error) {
    console.error(`[DB ERROR] Query failed: ${sql}`, error);
    throw error;
  }
}

// Execute single-row query helper
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Initialize database schema
async function initDb() {
  if (dbType === 'sqlite') {
    // Schema for SQLite
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        practice TEXT,
        phone TEXT,
        insurance TEXT,
        style TEXT,
        specialties TEXT,
        modalities TEXT,
        voice_instruction TEXT,
        mfa_enabled INTEGER DEFAULT 0,
        mfa_secret TEXT,
        backup_codes TEXT,
        onboarded INTEGER DEFAULT 0,
        plan TEXT DEFAULT 'trial',
        trial_ends_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } else {
    // Schema for PostgreSQL
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        practice VARCHAR(255),
        phone VARCHAR(50),
        insurance VARCHAR(255),
        style VARCHAR(50),
        specialties TEXT,
        modalities TEXT,
        voice_instruction TEXT,
        mfa_enabled INTEGER DEFAULT 0,
        mfa_secret VARCHAR(255),
        backup_codes TEXT,
        onboarded INTEGER DEFAULT 0,
        plan VARCHAR(50) DEFAULT 'trial',
        trial_ends_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }
  console.log('[DB] Schemas verified/created successfully.');
}

// ── USER MODEL OPERATIONS ─────────────────────────────────────

async function getUserByEmail(email) {
  return queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
}

async function getUserById(id) {
  return queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

async function createUser({ email, passwordHash, name, onboarded = 0, plan = 'trial', trialEndsAt = null }) {
  const trialEnds = trialEndsAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const res = await query(
    'INSERT INTO users (email, password_hash, name, onboarded, plan, trial_ends_at) VALUES (?, ?, ?, ?, ?, ?)',
    [email.toLowerCase(), passwordHash, name || null, onboarded, plan, trialEnds]
  );
  
  if (dbType === 'sqlite') {
    return res.insertId;
  } else {
    const row = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    return row.id;
  }
}

async function updateUserProfile(id, { name, practice, phone, insurance, style, specialties, modalities, voiceInstruction, onboarded }) {
  await query(
    `UPDATE users SET 
      name = ?, 
      practice = ?, 
      phone = ?, 
      insurance = ?, 
      style = ?, 
      specialties = ?, 
      modalities = ?, 
      voice_instruction = ?, 
      onboarded = ? 
    WHERE id = ?`,
    [
      name || null,
      practice || null,
      phone || null,
      insurance || null,
      style || null,
      Array.isArray(specialties) ? JSON.stringify(specialties) : specialties || null,
      Array.isArray(modalities) ? JSON.stringify(modalities) : modalities || null,
      voiceInstruction || null,
      onboarded === undefined ? 1 : onboarded,
      id
    ]
  );
  return true;
}

async function updateUserMFA(id, { enabled, secret, backupCodes }) {
  await query(
    'UPDATE users SET mfa_enabled = ?, mfa_secret = ?, backup_codes = ? WHERE id = ?',
    [
      enabled ? 1 : 0,
      secret || null,
      Array.isArray(backupCodes) ? JSON.stringify(backupCodes) : backupCodes || null,
      id
    ]
  );
  return true;
}

async function updateUserPlan(id, plan) {
  await query('UPDATE users SET plan = ? WHERE id = ?', [plan, id]);
  return true;
}

// ── DOCUMENT OPERATIONS ───────────────────────────────────────

async function saveDocument({ userId, name, type, content, status }) {
  // Encrypt sensitive document content before writing to DB
  const encryptedContent = encrypt(content);
  
  const res = await query(
    'INSERT INTO documents (user_id, name, type, content, status) VALUES (?, ?, ?, ?, ?)',
    [userId, name, type, encryptedContent, status]
  );
  if (dbType === 'sqlite') {
    return res.insertId;
  } else {
    const row = await queryOne('SELECT id FROM documents WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
    return row.id;
  }
}

async function getDocuments(userId, filters = {}) {
  let sql = 'SELECT * FROM documents WHERE user_id = ?';
  const params = [userId];

  if (filters.type && filters.type !== 'all') {
    sql += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.query) {
    // Encrypted columns cannot be searched with SQL LIKE operators.
    // We safe-route search index filters exclusively to the plain-text name column.
    sql += ' AND LOWER(name) LIKE ?';
    const searchStr = `%${filters.query.toLowerCase()}%`;
    params.push(searchStr);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  
  // Decrypt each document's content row
  return rows.map(row => ({
    ...row,
    content: decrypt(row.content)
  }));
}

async function getDocumentById(id) {
  const row = await queryOne('SELECT * FROM documents WHERE id = ?', [id]);
  if (!row) return null;
  
  // Decrypt content of single row
  return {
    ...row,
    content: decrypt(row.content)
  };
}

async function deleteDocument(id, userId) {
  const info = await query('DELETE FROM documents WHERE id = ? AND user_id = ?', [id, userId]);
  return dbType === 'sqlite' ? info.changes > 0 : true;
}

// ── REFRESH TOKEN OPERATIONS ──────────────────────────────────

async function saveRefreshToken(userId, token, expiresAt) {
  await query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt.toISOString ? expiresAt.toISOString() : expiresAt]
  );
  return true;
}

async function getRefreshToken(token) {
  return queryOne('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
}

async function deleteRefreshToken(token) {
  await query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  return true;
}

async function deleteUserRefreshTokens(userId) {
  await query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  return true;
}

async function saveVerificationToken(userId, token) {
  await query('UPDATE users SET verification_token = ? WHERE id = ?', [token, userId]);
  return true;
}

async function verifyUser(token) {
  const user = await queryOne('SELECT id FROM users WHERE verification_token = ?', [token]);
  if (!user) return false;
  await query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [user.id]);
  return true;
}

module.exports = {
  initDb,
  query,
  queryOne,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserProfile,
  updateUserMFA,
  updateUserPlan,
  saveDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  deleteUserRefreshTokens,
  saveVerificationToken,
  verifyUser,
  encrypt,
  decrypt,
  dbType: () => dbType
};