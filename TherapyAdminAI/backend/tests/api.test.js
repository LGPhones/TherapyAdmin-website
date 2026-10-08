const test = require('node:test');
const assert = require('node:assert');

process.env.DB_PATH = ':memory:';
process.env.GEMINI_API_KEY = 'dummy-test-key';

const app = require('../src/index');
const geminiService = require('../src/services/geminiService');

test('API Endpoints Integration', async (t) => {
  let server;
  let baseUrl;

  t.before(() => {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  t.after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  await t.test('GET /api/health - should return 200 and project health details', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.project, 'TherapyAdmin AI (Gemini Edition)');
  });

  await t.test('Clinician Lifecycle: POST and GET /api/clinicians', async () => {
    // 1. Create clinician
    const createRes = await fetch(`${baseUrl}/api/clinicians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'api-test@example.com', full_name: 'Dr. API Test' })
    });
    
    assert.strictEqual(createRes.status, 200);
    const createData = await createRes.json();
    assert.strictEqual(createData.success, true);
    assert.ok(createData.id > 0);
    
    const clinicianId = createData.id;

    // 2. Fetch existing clinician
    const getRes = await fetch(`${baseUrl}/api/clinicians/${clinicianId}`);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.success, true);
    assert.strictEqual(getData.clinician.id, clinicianId);
    assert.strictEqual(getData.clinician.email, 'api-test@example.com');
    assert.strictEqual(getData.clinician.full_name, 'Dr. API Test');
    assert.strictEqual(getData.clinician.voice_profile, null);

    // 3. Fetch non-existent clinician (404)
    const get404Res = await fetch(`${baseUrl}/api/clinicians/99999`);
    assert.strictEqual(get404Res.status, 404);
    const get404Data = await get404Res.json();
    assert.strictEqual(get404Data.error, 'Clinician not found');
  });

  await t.test('POST /api/calibrate/:id - should return 400 if no documents', async () => {
    const res = await fetch(`${baseUrl}/api/calibrate/1`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'No documents for calibration');
  });

  await t.test('POST /api/generate/intake/:id - should return generated doc in voice style', async () => {
    // Mock the geminiService generateDocument implementation
    const originalGenerate = geminiService.generateDocument;
    geminiService.generateDocument = async (type, context, voiceProfile) => {
      return `MOCK GENERATED: ${type} for focus ${context.diagnosis_focus}`;
    };

    try {
      // 1. First, create the clinician so we have a valid ID
      const createRes = await fetch(`${baseUrl}/api/clinicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'gen-test@example.com', full_name: 'Dr. Gen Test' })
      });
      const createData = await createRes.json();
      const clinicianId = createData.id;

      // 2. Generate intake packet
      const genRes = await fetch(`${baseUrl}/api/generate/intake/${clinicianId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis_focus: 'PTSD' })
      });

      assert.strictEqual(genRes.status, 200);
      const genData = await genRes.json();
      assert.strictEqual(genData.success, true);
      assert.strictEqual(genData.output, 'MOCK GENERATED: Intake Packet (Questionnaire, Consent, Policies) for focus PTSD');
    } finally {
      // Restore mock
      geminiService.generateDocument = originalGenerate;
    }
  });
});
