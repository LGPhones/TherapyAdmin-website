// ============================================================
// TherapyAdmin AI — auth.js
// Security & Authentication Layer (PBKDF2 & Custom HMAC JWT)
// ============================================================

const crypto = require('crypto');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'f95ad26a6c25785bbd1c5d9be25b57f0f08985c531d044234032d8a54d68e592';
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// ── PASSWORD SECURITY ─────────────────────────────────────────

/**
 * Hashes a password using PBKDF2 Sync with 600,000 iterations and SHA-512.
 * @param {string} password 
 * @returns {string} Stored hash format: pbkdf2_sha512$600000$salt$hash
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 64, 'sha512').toString('hex');
  return `pbkdf2_sha512$600000$${salt}$${hash}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash using timingSafeEqual.
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const [algo, iterationsStr, salt, hash] = parts;
    if (algo !== 'pbkdf2_sha512') return false;
    
    const iterations = parseInt(iterationsStr, 10);
    const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch (err) {
    return false;
  }
}

// ── CUSTOM JWT IMPLEMENTATION ─────────────────────────────────

function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a Custom JWT token using HMAC-SHA256.
 * @param {object} payload 
 * @returns {string} Signed JWT
 */
function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = base64url(Buffer.from(JSON.stringify(header)));
  const payloadStr = base64url(Buffer.from(JSON.stringify(payload)));
  const signatureInput = `${headerStr}.${payloadStr}`;
  const signature = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest()
  );
  return `${signatureInput}.${signature}`;
}

/**
 * Verifies a Custom JWT token and returns its payload if valid and unexpired.
 * @param {string} token 
 * @returns {object|null} Decoded payload or null
 */
function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerStr, payloadStr, signatureStr] = parts;
    const signatureInput = `${headerStr}.${payloadStr}`;
    const expectedSignature = base64url(
      crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest()
    );
    
    if (signatureStr !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(base64urlDecode(payloadStr));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}

// ── JWT GENERATORS ────────────────────────────────────────────

function generateAccessToken(user, mfaVerified = false) {
  const payload = {
    userId: user.id,
    email: user.email,
    mfaVerified: mfaVerified,
    exp: Date.now() + ACCESS_TOKEN_EXPIRY_MS
  };
  return signJwt(payload);
}

// ── MIDDLEWARES ───────────────────────────────────────────────

/**
 * Authentication Middleware
 * Validates the Access Token from the Authorization Header or request cookies.
 */
async function requireAuth(req, res, next) {
  let token = null;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const decoded = verifyJwt(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
  
  // Attach user to req
  try {
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User does not exist' });
    }
    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE ERROR]', err);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

/**
 * MFA Verification Middleware
 * Requires that the user has completed MFA if it is enabled on their account.
 */
function requireMFA(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.mfa_enabled && !req.tokenPayload.mfaVerified) {
    return res.status(401).json({ 
      error: 'MFA verification required', 
      mfaRequired: true 
    });
  }
  
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  signJwt,
  verifyJwt,
  requireAuth,
  requireMFA
};
