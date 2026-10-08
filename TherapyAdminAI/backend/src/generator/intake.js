const db = require('../db');

/**
 * Module 1: Intake Packet Generator
 * Generates complete new-client intake packets based on clinical needs.
 */

async function generateIntakePacket(clinicianId, patientData) {
  // 1. Fetch Clinician Profile (for branding/policies if needed)
  const clinician = db.prepare('SELECT * FROM clinicians WHERE id = ?').get(clinicianId);
  if (!clinician) throw new Error('Clinician not found');

  const { diagnosis_focus, needs_telehealth, requires_roi } = patientData;

  // 2. Assemble Packet Components
  const packet = {
    title: `Intake Packet - ${clinician.full_name}'s Practice`,
    components: []
  };

  // 2a. General Intake Questionnaire
  let questionnaire = "General Mental Health Questionnaire:\n1. What brings you in today?\n2. Medical history...\n";
  if (diagnosis_focus === 'anxiety') {
    questionnaire += "3. GAD-7 Assessment...\n";
  } else if (diagnosis_focus === 'depression') {
    questionnaire += "3. PHQ-9 Assessment...\n";
  }
  packet.components.push({ type: 'Questionnaire', content: questionnaire });

  // 2b. Informed Consent
  let consent = "Informed Consent for Treatment:\nConfidentiality limits...\n";
  if (needs_telehealth) {
    consent += "\nTelehealth Addendum: Risks and benefits of virtual sessions...\n";
  }
  packet.components.push({ type: 'Informed Consent', content: consent });

  // 2c. HIPAA NPP
  packet.components.push({ 
    type: 'HIPAA NPP', 
    content: "Notice of Privacy Practices: How your health information may be used and disclosed...\n" 
  });

  // 2d. Office Policies
  packet.components.push({ 
    type: 'Office Policies', 
    content: "Cancellation policy (24-hour notice), Payment terms, Emergency protocols...\n" 
  });

  // 2e. ROI (Release of Information)
  if (requires_roi) {
    packet.components.push({ 
      type: 'ROI Form', 
      content: "Authorization to Disclose Protected Health Information (PHI)...\n" 
    });
  }

  // MOCK: In production, this would use Claude to format and assemble a beautifully branded PDF/Markdown
  return packet;
}

module.exports = { generateIntakePacket };
