// ============================================================
// TherapyAdmin AI — ai.js
// Google Gemini 1.5 Flash Integration with SSE Streaming
// PHI/PII De-identification Scrubber
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./db');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const isMockMode = !GEMINI_API_KEY || GEMINI_API_KEY.includes('mockkey') || GEMINI_API_KEY === '';

let genAI = null;
if (!isMockMode) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// ── PHI/PII DE-IDENTIFICATION SCRUBBER ─────────────────────────

/**
 * Scans text and redacts common Protected Health Information (PHI)
 * and Personally Identifiable Information (PII) to maintain HIPAA compliance.
 */
function scrubPHI(text) {
  if (!text || typeof text !== 'string') return text;
  
  let scrubbed = text;
  
  // 1. Email Addresses
  scrubbed = scrubbed.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, '[REDACTED_EMAIL]');
  
  // 2. SSN / Tax IDs
  scrubbed = scrubbed.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  
  // 3. Phone Numbers
  scrubbed = scrubbed.replace(/\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g, '[REDACTED_PHONE]');
  
  // 4. Dates of Birth (e.g., DOB: 12/24/1985 or born on 05/12/1990)
  scrubbed = scrubbed.replace(/\b(?:dob|date\s*of\s*birth|born)(?:\s*on)?\s*[:\-]?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi, '[REDACTED_DOB]');
  
  // 5. ZIP Codes
  scrubbed = scrubbed.replace(/\b\d{5}(?:-\d{4})?\b/g, '[REDACTED_ZIP]');
  
  // 6. Direct Client/Patient Name patterns (e.g., Client: John Doe, Patient: Sarah Connor)
  scrubbed = scrubbed.replace(/\b(?:client|patient|member|patient's|client's)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi, (match, name) => {
    return match.replace(name, '[REDACTED_PATIENT_NAME]');
  });
  
  return scrubbed;
}

// ── MOCK SYSTEM DATA ──────────────────────────────────────────

const MOCK_RESPONSES = {
  appeal: `April 24, 2026

Aetna Behavioral Health
Appeals Department
Re: Request for Continued Authorization — Outpatient Psychotherapy
Member ID: AE-9923841

Dear Utilization Review Committee,

I am writing to appeal the denial of continued authorization for weekly individual psychotherapy for my client, who has been diagnosed with Major Depressive Disorder, Recurrent, Moderate (F33.1). 

My client has been engaged in weekly individual psychotherapy for six months, demonstrating meaningful engagement with the treatment framework. Despite these gains, their current presentation continues to exhibit moderate clinical symptoms, including persistent sleep disturbances and cognitive distortions that moderately impair their daily occupational and interpersonal functioning.

Discontinuing therapy at this juncture would pose a significant risk of clinical regression. Continued weekly sessions are clinically warranted to reinforce current coping strategies and address the remaining treatment goals.

Therefore, I respectfully request authorization for 16 additional sessions of CPT 90837 to ensure treatment continuity and facilitate long-term stabilization. Please contact my office if you require any further documentation.

Warm regards,
[Practitioner Name]`,

  intake: `Dear Client,

Welcome to our practice. I am honored to support you on your therapeutic journey. 

In this practice, we believe in building a collaborative, warm, and secure space where you can explore your thoughts and feelings. Our therapeutic framework draws on trauma-informed and cognitive-behavioral modalities to address your unique needs and goals.

During our first session, we will focus on understanding your current concerns, review your history, and begin formulating a personalized treatment plan. Please review and sign the standard practice intake documents in the portal before our appointment. 

I look forward to meeting you soon.

Warmly,
[Practitioner Name]`,

  referral: `April 24, 2026

Dear Dr. Chen,

I am writing to refer my client, a 28-year-old male, for a comprehensive psychiatric evaluation and medication consultation. 

The client has been receiving weekly individual cognitive-behavioral therapy at my practice for the past four months to address recurrent symptoms of Major Depressive Disorder (F33.1). While he has shown consistent engagement and effort in developing coping strategies, his current presentation continues to exhibit persistent depressive symptoms that significantly impair his daily occupational and social functioning.

I believe that integrating pharmacological support may help optimize his overall therapeutic progress. I welcome the opportunity to coordinate care and will gladly share additional treatment details with your consent.

Warm regards,
[Practitioner Name]`,

  psychoed: `Understanding Anxiety and Your Nervous System

Anxiety is a natural response designed to protect you from danger, but sometimes our brains perceive threats where none exist, keeping us in a state of hyper-arousal.

How it Affects You:
1. Physical: Heart racing, shallow breathing, muscle tension.
2. Cognitive: Worrying about future scenarios, overanalyzing.
3. Behavioral: Avoiding situations that trigger uncomfortable feelings.

3 Practical Coping Skills:
1. Box Breathing: Inhale for 4 seconds, hold for 4 seconds, exhale for 4 seconds, hold for 4 seconds. Repeat 5 times.
2. 5-4-3-2-1 Grounding: Identify 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste.
3. Thought Challenging: Ask yourself if a worrying thought is based on concrete facts or just an anxious feeling.`,

  treatment: `SMART Treatment Goals (90-Day Plan)

1. Long-term Goal: Reduce depressive symptoms and improve daily functioning.
   - Objective: Client will utilize cognitive re-framing techniques to challenge at least two negative self-talk thoughts daily, as tracked in a thought log.
   - Intervention: Therapist will teach cognitive restructuring worksheets and review log entries weekly.
   - Target Date: 90 Days.

2. Long-term Goal: Develop emotional regulation skills to manage acute anxiety.
   - Objective: Client will implement a progressive muscle relaxation exercise or deep breathing technique during periods of acute anxiety to reduce subjective distress from an 8/10 to a 4/10.
   - Intervention: Therapist will practice mindfulness and somatic grounding techniques in session.
   - Target Date: 90 Days.`,

  comms: `Dear Client,

This is a brief reminder of our upcoming therapy session scheduled for Tuesday at 2:00 PM. We will meet via our secure telehealth platform. 

If you need to make any changes or reschedule, please let me know at least 24 hours in advance to avoid the standard cancellation fee.

I look forward to our session.

Warm regards,
[Practitioner Name]`
};

const MOCK_VOICE_PROFILE = {
  sentence_length: 'Medium to long, multi-clause',
  formality: 'Professional but warm',
  tone: 'Advocacy-oriented, client-centered',
  vocab_register: 'Clinical precision with accessible language',
  client_reference: '"My client" preferred over case numbers',
  voice_instruction: 'Write with professional warmth, centering the client\'s functional impact. Use complete sentences and "my client" over identifiers.'
};

// ── PROMPT COMPILER ───────────────────────────────────────────

function compilePrompt(docType, context, userProfile) {
  const voiceInstr = userProfile.voice_instruction ||
    'Write professionally and warmly, using "my client" and centering functional impact.';

  const practiceInfo = `
Practitioner: ${userProfile.name || 'Dr. Sarah Reeves, LCSW'}
Practice: ${userProfile.practice || 'Hillside Therapy Practice'}
Insurance: ${userProfile.insurance || 'Aetna, BCBS'}
Modalities: ${userProfile.modalities ? (Array.isArray(userProfile.modalities) ? userProfile.modalities.join(', ') : userProfile.modalities) : 'Integrative, CBT'}
Specialties: ${userProfile.specialties ? (Array.isArray(userProfile.specialties) ? userProfile.specialties.join(', ') : userProfile.specialties) : 'General Mental Health, Trauma'}`;

  const templates = {
    appeal: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite a complete insurance appeal / medical necessity letter.\nCONTEXT:\n${context}\n\nInclude: date, proper salutation, clinical justification with DSM language, functional impairment, and professional close. Do not use bullet points.`,
    intake: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite a warm, professional new client welcome letter.\nCONTEXT:\n${context}\n\nInclude: personal welcome, what to expect, logistics, and encouraging close.`,
    referral: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite a professional referral letter to another provider.\nCONTEXT:\n${context}\n\nInclude: clinical summary, reason for referral, treatment history, coordination request.`,
    psychoed: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nCreate a psychoeducation handout for a therapy client.\nCONTEXT:\n${context}\n\nWrite in plain language matching the requested reading level. Include: what it is, why it happens, 3 practical coping skills.`,
    treatment: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite 2-3 SMART treatment plan goals.\nCONTEXT:\n${context}\n\nFormat as numbered goals with measurable objectives, interventions, and review date. Use DSM-aligned language.`,
    comms: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite the requested client communication.\nCONTEXT:\n${context}\n\nKeep it warm, concise, and professional.`,
  };

  return templates[docType] || templates.appeal;
}

// ── GENERATION CONTROLLERS ────────────────────────────────────

async function generateText(docType, context, userProfile) {
  // Scrub PII/PHI context before compiling prompt
  const cleanContext = scrubPHI(context);
  const prompt = compilePrompt(docType, cleanContext, userProfile);

  if (isMockMode) {
    await new Promise(resolve => setTimeout(resolve, 800));
    let text = MOCK_RESPONSES[docType] || MOCK_RESPONSES.appeal;
    if (userProfile.name) {
      text = text.replace(/\[Practitioner Name\]/g, userProfile.name);
    }
    return text;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error('[GEMINI API ERROR]', err);
    throw new Error('Google Gemini AI generation failed');
  }
}

async function generateStream(docType, context, userProfile, res) {
  // Scrub PII/PHI context before compiling prompt
  const cleanContext = scrubPHI(context);
  const prompt = compilePrompt(docType, cleanContext, userProfile);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (isMockMode) {
    let text = MOCK_RESPONSES[docType] || MOCK_RESPONSES.appeal;
    if (userProfile.name) {
      text = text.replace(/\[Practitioner Name\]/g, userProfile.name);
    }
    
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      if (res.writableEnded) break;
      const word = words[i] + (i === words.length - 1 ? '' : ' ');
      res.write(`data: ${JSON.stringify({ delta: { text: word } })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      if (res.writableEnded) break;
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ delta: { text: chunkText } })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[GEMINI STREAMING ERROR]', err);
    res.write(`data: ${JSON.stringify({ error: 'AI stream connection failed' })}\n\n`);
    res.end();
  }
}

async function analyzeVoiceSample(sampleText) {
  // Scrub PII/PHI sampleText before analysis
  const cleanSample = scrubPHI(sampleText);
  const prompt = `Analyze this mental health practitioner's writing sample and extract their voice profile. Return ONLY a JSON object, no markdown codeblocks:
{"sentence_length":"short description","formality":"short description","tone":"short description","vocab_register":"short description","client_reference":"short description","voice_instruction":"2 sentence instruction for an AI to replicate this exact voice"}

SAMPLE: ${cleanSample.substring(0, 1500)}`;

  if (isMockMode) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return MOCK_VOICE_PROFILE;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text().trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not extract JSON from response');
  } catch (err) {
    console.error('[GEMINI ANALYZER ERROR]', err);
    return MOCK_VOICE_PROFILE;
  }
}

module.exports = {
  generateText,
  generateStream,
  analyzeVoiceSample,
  scrubPHI, // Export for unit tests
  isMockMode: () => isMockMode
};