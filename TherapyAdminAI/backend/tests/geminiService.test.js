const test = require('node:test');
const assert = require('node:assert');

// Set dummy API key so the GoogleGenerativeAI client does not fail to instantiate
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'dummy-test-key';

const geminiService = require('../src/services/geminiService');

test('Gemini Service', async (t) => {
  // Store original model to restore later
  const originalModel = geminiService.model;

  t.afterEach(() => {
    geminiService.model = originalModel;
  });

  await t.test('calibrateVoice should extract and parse clinician voice profile JSON', async () => {
    // Mock the model's generateContent method
    geminiService.model = {
      generateContent: async (prompt) => {
        return {
          response: {
            text: () => `
              Some introductory text from Gemini.
              \`\`\`json
              {
                "tone": "empathetic and supportive",
                "formality": 0.6,
                "sentence_structure": "conversational and friendly",
                "preferred_terms": ["mindfulness", "coping strategies", "growth"]
              }
              \`\`\`
              Some trailing notes.
            `
          }
        };
      }
    };

    const docsText = "Sample documents from therapist...";
    const profile = await geminiService.calibrateVoice(docsText);

    assert.strictEqual(profile.tone, "empathetic and supportive");
    assert.strictEqual(profile.formality, 0.6);
    assert.strictEqual(profile.sentence_structure, "conversational and friendly");
    assert.deepEqual(profile.preferred_terms, ["mindfulness", "coping strategies", "growth"]);
  });

  await t.test('calibrateVoice should throw error if output has no parsable JSON', async () => {
    geminiService.model = {
      generateContent: async (prompt) => {
        return {
          response: {
            text: () => "This is just plain text with no JSON object inside."
          }
        };
      }
    };

    await assert.rejects(
      async () => {
        await geminiService.calibrateVoice("Some input text");
      },
      /Could not parse voice profile from Gemini response/
    );
  });

  await t.test('generateDocument should formulate prompt and return output text', async () => {
    let capturedPrompt = '';
    geminiService.model = {
      generateContent: async (prompt) => {
        capturedPrompt = prompt;
        return {
          response: {
            text: () => "Generated Markdown Document Content"
          }
        };
      }
    };

    const voiceProfile = {
      tone: "warm",
      formality: 0.5,
      sentence_structure: "direct",
      preferred_terms: ["goals", "growth"]
    };

    const context = { diagnosis_focus: "Anxiety" };
    const result = await geminiService.generateDocument('Intake Packet', context, voiceProfile);

    assert.strictEqual(result, "Generated Markdown Document Content");
    assert.ok(capturedPrompt.includes("Tone: warm"));
    assert.ok(capturedPrompt.includes("Formality: 0.5"));
    assert.ok(capturedPrompt.includes("Sentence Structure: direct"));
    assert.ok(capturedPrompt.includes("Preferred Terms: goals, growth"));
    assert.ok(capturedPrompt.includes("Intake Packet"));
  });

  await t.test('generateDocument should handle null voice profile by using a professional default', async () => {
    let capturedPrompt = '';
    geminiService.model = {
      generateContent: async (prompt) => {
        capturedPrompt = prompt;
        return {
          response: {
            text: () => "Default Clinical Document"
          }
        };
      }
    };

    const result = await geminiService.generateDocument('Intake Packet', { focus: 'anxiety' }, null);

    assert.strictEqual(result, "Default Clinical Document");
    assert.ok(capturedPrompt.includes("Use a professional and empathetic clinical tone."));
  });
});
