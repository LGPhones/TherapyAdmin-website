const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const db = require('./db');
const geminiService = require('./services/geminiService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Helper to get clinician and their voice profile
const getClinicianProfile = (id) => {
  const clinician = db.prepare('SELECT * FROM clinicians WHERE id = ?').get(id);
  if (!clinician) return null;
  return {
    ...clinician,
    voice_profile: clinician.voice_profile ? JSON.parse(clinician.voice_profile) : null
  };
};

// --- API Endpoints ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'TherapyAdmin AI (Gemini Edition)' });
});

// CLINICIANS & CALIBRATION
app.post('/api/clinicians', (req, res) => {
  const { email, full_name } = req.body;
  try {
    const info = db.prepare('INSERT INTO clinicians (email, full_name) VALUES (?, ?)').run(email, full_name);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/clinicians/:id', (req, res) => {
  const { id } = req.params;
  try {
    const clinician = getClinicianProfile(id);
    if (!clinician) return res.status(404).json({ error: 'Clinician not found' });
    res.json({ success: true, clinician });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/:clinicianId', upload.single('file'), async (req, res) => {
  const { clinicianId } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let content = '';
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdf(dataBuffer);
      content = data.text;
    } else {
      content = fs.readFileSync(file.path, 'utf8');
    }

    db.prepare(`
      INSERT INTO reference_documents (clinician_id, filename, file_path, content, status)
      VALUES (?, ?, ?, ?, 'processed')
    `).run(clinicianId, file.originalname, file.path, content);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calibrate/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  try {
    const docs = db.prepare("SELECT content FROM reference_documents WHERE clinician_id = ? AND status = 'processed'").all(clinicianId);
    if (docs.length === 0) return res.status(400).json({ error: 'No documents for calibration' });

    const allText = docs.map(d => d.content).join('\n\n---\n\n');
    const profile = await geminiService.calibrateVoice(allText);
    profile.calibration_date = new Date().toISOString();

    db.prepare('UPDATE clinicians SET voice_profile = ? WHERE id = ?').run(JSON.stringify(profile), clinicianId);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MODULE 1: INTAKE
app.post('/api/generate/intake/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  const context = req.body; // { diagnosis_focus, needs_telehealth, etc }
  try {
    const clinician = getClinicianProfile(clinicianId);
    const output = await geminiService.generateDocument('Intake Packet (Questionnaire, Consent, Policies)', context, clinician.voice_profile);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MODULE 2: INSURANCE
app.post('/api/generate/insurance/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  const context = req.body; // { type: 'appeal', patient_initials, diagnosis, denial_reason }
  try {
    const clinician = getClinicianProfile(clinicianId);
    const output = await geminiService.generateDocument(`Insurance ${context.type || 'Document'}`, context, clinician.voice_profile);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MODULE 3: TREATMENT
app.post('/api/generate/treatment/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  const context = req.body; // { type: 'plan', goals, modality }
  try {
    const clinician = getClinicianProfile(clinicianId);
    const output = await geminiService.generateDocument(`Treatment ${context.type || 'Draft'}`, context, clinician.voice_profile);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MODULE 4: PSYCHOEDUCATION
app.post('/api/generate/psychoed/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  const context = req.body; // { diagnosis, reading_level }
  try {
    const clinician = getClinicianProfile(clinicianId);
    const output = await geminiService.generateDocument('Psychoeducation Handout', context, clinician.voice_profile);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MODULE 5: CLIENT COMMUNICATIONS
app.post('/api/generate/communication/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  const context = req.body; // { type: 'welcome', notes }
  try {
    const clinician = getClinicianProfile(clinicianId);
    const output = await geminiService.generateDocument(`Client Communication (${context.type})`, context, clinician.voice_profile);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MODULE 6: PRACTICE OPERATIONS
app.post('/api/generate/operations/:clinicianId', async (req, res) => {
  const { clinicianId } = req.params;
  const context = req.body; // { type: 'job_posting', details }
  try {
    const clinician = getClinicianProfile(clinicianId);
    const output = await geminiService.generateDocument(`Practice Operations (${context.type})`, context, clinician.voice_profile);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TherapyAdmin AI backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
