-- Add verification_token to users table
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0;
