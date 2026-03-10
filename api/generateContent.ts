import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Stable Server-Owned Model
const TARGET_MODEL = 'gemini-2.5-flash-lite'; 

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method Enforcement
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Request Validation
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  // 3. Secret Retrieval
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server key not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // 4. Structured Generation
    const result = await ai.models.generateContent({
      model: TARGET_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'string', enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
                  slot: { type: 'string', enum: ["breakfast", "lunch", "dinner"] },
                  recipeId: { type: 'string' }
                },
                required: ["day", "slot", "recipeId"]
              }
            },
            summary: {
              type: 'object',
              properties: {
                estimatedPlannedCostGBP: { type: 'number' },
                estimatedPlannedCalories: { type: 'number' },
                estimatedPlannedProteinG: { type: 'number' },
                pantryIngredientsUsed: { type: 'array', items: { type: 'string' } },
                plannerNote: { type: 'string' }
              }
            }
          },
          required: ["assignments"]
        }
      }
    });

    // 5. Response Shaping
    const text = result.response.text();
    if (!text) throw new Error('Empty AI response');
    
    return res.status(200).json(JSON.parse(text));

  } catch (error: any) {
    console.error('[API ERROR]', error.message);
    // Generic error to avoid leaking prompts/secrets
    return res.status(500).json({ error: 'Failed to generate meal plan' });
  }
}
