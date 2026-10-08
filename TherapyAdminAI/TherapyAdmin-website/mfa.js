// ============================================================
// TherapyAdmin AI — mfa.js
// Two-Factor Authentication (TOTP and Backup Codes) Module
// ============================================================

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generates a new TOTP secret and returns the base32 secret,
 * the otpauth url, and a QR code Data URL for client rendering.
 * @param {string} email 
 * @returns {Promise<{secret: string, otpauthUrl: string, qrCodeDataUrl: string}>}
 */
async function generateMfaSecret(email) {
  try {
    const secret = speakeasy.generateSecret({
      name: `TherapyAdmin AI (${email})`,
      issuer: 'TherapyAdmin'
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl
    };
  } catch (error) {
    console.error('[MFA SECRET GENERATION ERROR]', error);
    throw new Error('Failed to generate MFA secret');
  }
}

/**
 * Verifies a TOTP code against a base32 secret.
 * Supports a window of +/- 1 step (30 seconds) to tolerate client clock drift.
 * @param {string} secret Base32 encoded secret
 * @param {string} code 6-digit TOTP code
 * @returns {boolean} True if verified
 */
function verifyMfaCode(secret, code) {
  if (!secret || !code) return false;
  
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: code.trim(),
    window: 1 // Tolerates 1 period (30 seconds) before/after
  });
}

/**
 * Generates an array of secure 8-character backup codes.
 * Returns both plain text codes (to display to user once) and SHA-256 hashes (to store in DB).
 * @param {number} count Number of backup codes to generate
 * @returns {{plainCodes: string[], hashedCodes: string[]}}
 */
function generateBackupCodes(count = 10) {
  const plainCodes = [];
  const hashedCodes = [];
  
  for (let i = 0; i < count; i++) {
    // Generate an 8-character uppercase hexadecimal backup code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    
    plainCodes.push(code);
    hashedCodes.push(hash);
  }
  
  return { plainCodes, hashedCodes };
}

/**
 * Verifies a backup code against a list of hashed backup codes.
 * If verified, it removes the code from the list to prevent reuse.
 * @param {string[]|string} hashedCodesList Database backup_codes field (array or JSON-parsed array)
 * @param {string} plainCode User inputted backup code
 * @returns {{verified: boolean, remainingCodes: string[]}}
 */
function verifyBackupCode(hashedCodesList, plainCode) {
  let codes = [];
  if (typeof hashedCodesList === 'string') {
    try {
      codes = JSON.parse(hashedCodesList);
    } catch {
      codes = [];
    }
  } else if (Array.isArray(hashedCodesList)) {
    codes = hashedCodesList;
  }
  
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return { verified: false, remainingCodes: [] };
  }

  const cleanCode = plainCode.trim().toUpperCase();
  const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
  
  const index = codes.indexOf(inputHash);
  if (index !== -1) {
    // Remove the verified code from the list
    const remainingCodes = [...codes];
    remainingCodes.splice(index, 1);
    return { verified: true, remainingCodes };
  }

  return { verified: false, remainingCodes: codes };
}

module.exports = {
  generateMfaSecret,
  verifyMfaCode,
  generateBackupCodes,
  verifyBackupCode
};
