
import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function suggestProgressions(userInput: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a 4-chord progression based on the following theme: "${userInput}".`,
      config: {
        systemInstruction: "You are a helpful music theory assistant. Your goal is to generate chord progressions based on user requests. You must return the output as a valid JSON array of strings, where each string is a chord name (e.g., 'C Major', 'G Minor', 'F# Diminished'). Do not provide any other text, explanation, or markdown formatting.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "A list of four chord names for a progression.",
          items: {
            type: Type.STRING,
            description: "A chord name, like 'C Major' or 'G# Minor'"
          }
        },
        temperature: 0.8,
        topP: 0.9,
      },
    });

    const jsonText = response.text.trim();
    const suggestions = JSON.parse(jsonText);

    if (Array.isArray(suggestions) && suggestions.every(item => typeof item === 'string')) {
      return suggestions.slice(0, 4); // Ensure we only return 4 chords
    } else {
      throw new Error("Invalid response format from API.");
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Could not fetch chord progressions from the Gemini API.");
  }
}
