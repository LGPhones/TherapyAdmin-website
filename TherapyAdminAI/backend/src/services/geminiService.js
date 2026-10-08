const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Service to handle all interactions with Gemini Pro.
 */
class GeminiService {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  }

  /**
   * Extracts a voice profile from clinical documents.
   */
  async calibrateVoice(documentsText) {
    const prompt = `
      You are an expert linguistic analyst specializing in clinical documentation for mental health.
      Analyze the following reference documents written by a therapist.
      Extract their unique "Clinician Voice" profile.
      
      Return a JSON object with exactly these fields:
      - tone (string: describe the emotional quality, e.g., "warm and empathetic", "strictly clinical")
      - formality (number: 0.0 to 1.0, where 1.0 is highly formal)
      - sentence_structure (string: e.g., "concise and direct", "complex and narrative")
      - preferred_terms (array of strings: specific clinical or professional words they use frequently)

      Reference Documents:
      ${documentsText}
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Attempt to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Could not parse voice profile from Gemini response");
    } catch (error) {
      console.error("Gemini Calibration Error:", error);
      throw error;
    }
  }

  /**
   * Generates a document using the clinician's voice profile.
   */
  async generateDocument(type, context, voiceProfile) {
    const voiceContext = voiceProfile ? `
      Use the following Clinician Voice Profile for this document:
      - Tone: ${voiceProfile.tone}
      - Formality: ${voiceProfile.formality}
      - Sentence Structure: ${voiceProfile.sentence_structure}
      - Preferred Terms: ${voiceProfile.preferred_terms?.join(', ')}
    ` : "Use a professional and empathetic clinical tone.";

    const prompt = `
      ${voiceContext}

      Task: Generate a ${type} for a mental health practice.
      
      Parameters/Context:
      ${JSON.stringify(context, null, 2)}

      Requirements:
      - Do NOT include real patient names; use placeholders like [CLIENT_NAME].
      - Ensure the output is formatted as clear Markdown.
      - Maintain strict clinical professionalism and HIPAA-compliant language.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini Generation Error:", error);
      throw error;
    }
  }
}

module.exports = new GeminiService();
