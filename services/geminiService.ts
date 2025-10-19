import { GoogleGenAI, Type } from "@google/genai";
import { MelodyNote } from "../types";

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


export async function generateMelody(
  userInput: string,
  chordProgression: string[],
  bpm: number,
  ticksPerChord: number
): Promise<MelodyNote[]> {
  const totalTicks = chordProgression.length * ticksPerChord;
  const prompt = `
    You are a music composition assistant.
    Given the chord progression: [${chordProgression.join(', ')}].
    The tempo is ${bpm} BPM.
    Each chord lasts for ${ticksPerChord} MIDI ticks.
    The total duration of the progression is ${totalTicks} ticks.

    Generate a melody that fits this musical context and matches the following description: "${userInput}".

    The melody should be returned as a valid JSON array of note objects. Each object must have three integer properties:
    1. "midiNote": The MIDI note number (from 0-127). A reasonable range would be 60-84 (C4 to C6).
    2. "startTick": The absolute start time of the note in MIDI ticks from the beginning (must be between 0 and ${totalTicks - 1}).
    3. "durationTicks": The duration of the note in MIDI ticks.

    Ensure the melody is rhythmically interesting and harmonically compatible with the chords. The sum of a note's startTick and durationTicks should not exceed the total duration of ${totalTicks}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert music composer AI. You will generate melodies in a precise JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "An array of melody note objects.",
          items: {
            type: Type.OBJECT,
            properties: {
              midiNote: {
                type: Type.INTEGER,
                description: "MIDI note number (0-127)."
              },
              startTick: {
                type: Type.INTEGER,
                description: "Start time in MIDI ticks."
              },
              durationTicks: {
                type: Type.INTEGER,
                description: "Duration in MIDI ticks."
              }
            },
            required: ["midiNote", "startTick", "durationTicks"]
          }
        },
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const melody = JSON.parse(jsonText);

    // Basic validation
    if (Array.isArray(melody) && melody.every(n =>
      typeof n.midiNote === 'number' &&
      typeof n.startTick === 'number' &&
      typeof n.durationTicks === 'number'
    )) {
      return melody;
    } else {
      throw new Error("Invalid melody data format from API.");
    }

  } catch (error) {
    console.error("Error calling Gemini API for melody generation:", error);
    throw new Error("Could not generate melody from the Gemini API.");
  }
}
