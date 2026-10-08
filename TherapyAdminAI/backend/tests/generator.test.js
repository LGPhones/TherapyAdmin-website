const test = require('node:test');
const assert = require('node:assert');

// Configure environment for an isolated in-memory test database
process.env.DB_PATH = ':memory:';
const db = require('../src/db');
const { generateIntakePacket } = require('../src/generator/intake');

test('Intake Packet Generator', async (t) => {
  // Pre-insert a clinician for test cases
  const clinicianStmt = db.prepare('INSERT INTO clinicians (email, full_name) VALUES (?, ?)');
  const cInfo = clinicianStmt.run('generator@example.com', 'Dr. Generator');
  const clinicianId = cInfo.lastInsertRowid;

  await t.test('should throw error if clinician does not exist', async () => {
    await assert.rejects(
      async () => {
        await generateIntakePacket(99999, { diagnosis_focus: 'anxiety' });
      },
      /Clinician not found/
    );
  });

  await t.test('should generate default intake packet with anxiety specific questions', async () => {
    const patientData = {
      diagnosis_focus: 'anxiety',
      needs_telehealth: false,
      requires_roi: false
    };

    const packet = await generateIntakePacket(clinicianId, patientData);
    
    assert.strictEqual(packet.title, "Intake Packet - Dr. Generator's Practice");
    
    // Check components
    const questionnaire = packet.components.find(c => c.type === 'Questionnaire');
    assert.ok(questionnaire);
    assert.ok(questionnaire.content.includes('GAD-7 Assessment'));
    assert.ok(!questionnaire.content.includes('PHQ-9 Assessment'));

    const consent = packet.components.find(c => c.type === 'Informed Consent');
    assert.ok(consent);
    assert.ok(!consent.content.includes('Telehealth Addendum'));

    const roi = packet.components.find(c => c.type === 'ROI Form');
    assert.strictEqual(roi, undefined);
  });

  await t.test('should generate packet with depression, telehealth, and ROI form', async () => {
    const patientData = {
      diagnosis_focus: 'depression',
      needs_telehealth: true,
      requires_roi: true
    };

    const packet = await generateIntakePacket(clinicianId, patientData);
    
    const questionnaire = packet.components.find(c => c.type === 'Questionnaire');
    assert.ok(questionnaire);
    assert.ok(questionnaire.content.includes('PHQ-9 Assessment'));
    assert.ok(!questionnaire.content.includes('GAD-7 Assessment'));

    const consent = packet.components.find(c => c.type === 'Informed Consent');
    assert.ok(consent);
    assert.ok(consent.content.includes('Telehealth Addendum'));

    const roi = packet.components.find(c => c.type === 'ROI Form');
    assert.ok(roi);
    assert.ok(roi.content.includes('Authorization to Disclose Protected Health Information'));
  });
});
