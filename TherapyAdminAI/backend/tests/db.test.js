const test = require('node:test');
const assert = require('node:assert');

// Configure environment for an isolated in-memory test database
process.env.DB_PATH = ':memory:';
const db = require('../src/db');

test('Database Schema and Operations', async (t) => {
  
  await t.test('should successfully insert a clinician', () => {
    const email = 'test@example.com';
    const name = 'Dr. Test';
    
    const stmt = db.prepare('INSERT INTO clinicians (email, full_name) VALUES (?, ?)');
    const info = stmt.run(email, name);
    
    assert.strictEqual(info.changes, 1);
    assert.ok(info.lastInsertRowid > 0);
    
    const inserted = db.prepare('SELECT * FROM clinicians WHERE id = ?').get(info.lastInsertRowid);
    assert.strictEqual(inserted.email, email);
    assert.strictEqual(inserted.full_name, name);
    assert.strictEqual(inserted.voice_profile, null);
  });

  await t.test('should enforce unique constraint on clinician email', () => {
    const email = 'duplicate@example.com';
    const stmt = db.prepare('INSERT INTO clinicians (email, full_name) VALUES (?, ?)');
    
    stmt.run(email, 'Clinician A');
    
    assert.throws(() => {
      stmt.run(email, 'Clinician B');
    }, /UNIQUE constraint failed: clinicians.email/);
  });

  await t.test('should successfully associate and cascade delete reference documents', () => {
    // Insert a new clinician
    const clinicianStmt = db.prepare('INSERT INTO clinicians (email, full_name) VALUES (?, ?)');
    const cInfo = clinicianStmt.run('cascade@example.com', 'Dr. Cascade');
    const clinicianId = cInfo.lastInsertRowid;

    // Insert reference documents
    const docStmt = db.prepare(`
      INSERT INTO reference_documents (clinician_id, filename, file_path, content, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const docInfo = docStmt.run(
      clinicianId, 
      'sample.txt', 
      '/path/to/sample.txt', 
      'Linguistic style content...', 
      'processed'
    );
    assert.strictEqual(docInfo.changes, 1);

    // Verify document exists
    const doc = db.prepare('SELECT * FROM reference_documents WHERE clinician_id = ?').get(clinicianId);
    assert.ok(doc);
    assert.strictEqual(doc.filename, 'sample.txt');

    // Delete clinician and verify cascade delete
    db.prepare('DELETE FROM clinicians WHERE id = ?').run(clinicianId);
    
    const deletedDoc = db.prepare('SELECT * FROM reference_documents WHERE clinician_id = ?').get(clinicianId);
    assert.strictEqual(deletedDoc, undefined);
  });
});
