const db = require('../db');
const auth = require('../auth'); // Original auth.js logic
const crypto = require('crypto');
const mail = require('../mail');

async function registerUser(email, password, name) {
  const existing = await db.getUserByEmail(email);
  if (existing) throw new Error('User already exists');

  const passwordHash = auth.hashPassword(password);
  const userId = await db.createUser({ email, passwordHash, name, onboarded: 0, plan: 'trial' });
  
  const verificationToken = crypto.randomBytes(32).toString('hex');
  await db.saveVerificationToken(userId, verificationToken);
  await mail.sendVerificationEmail(email, verificationToken);
  
  return userId;
}

async function loginUser(email, password) {
  const user = await db.getUserByEmail(email);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    throw new Error('Invalid email or password');
  }
  return user;
}

module.exports = { registerUser, loginUser };
