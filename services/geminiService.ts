import { GoogleGenAI, Type } from "@google/genai";
import { MelodyNote, SynthParams } from "../types";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function suggestProgressions(prompt: string): Promise<string[]> {
  try {
    const systemInstruction = `You are a music theory expert AI. The user will describe a mood or genre, and your task is to suggest a 4-chord progression that fits the description. Respond ONLY with a JSON array of strings, where each string is a chord name (e.g., "C Major", "G7", "Am").`;

    const fullPrompt = `User description: "${prompt}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING, description: "A chord name, e.g., 'C Major' or 'Am'." },
          description: "An array of 4 chord names."
        },
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);
    
    if (Array.isArray(parsedResponse) && parsedResponse.every(item => typeof item === 'string')) {
        return parsedResponse;
    } else {
        throw new Error("Invalid response format from API. Expected a JSON array of strings.");
    }

  } catch (error) {
    console.error("Error calling Gemini API for progression suggestion:", error);
    throw new Error("The AI model could not suggest a progression.");
  }
}

export async function generateMelody(
    prompt: string,
    chords: string[],
    bpm: number,
    totalTicks: number,
    key: string,
    rhythm: string,
    contour: string
): Promise<MelodyNote[]> {
    try {
        const systemInstruction = `You are an expert AI melody composer. You will be given a chord progression, tempo, key, and other parameters. Your task is to generate a musical melody that fits these constraints. The melody should be returned as a JSON array of note objects. Each note object must have 'midiNote' (a number from 21-108), 'startTick' (a number representing the start time), and 'durationTicks' (a number representing the note length). The total duration of the melody must not exceed the provided 'totalTicks'. Make sure the generated notes are musically coherent and fit the provided chord progression and key.`;

        const fullPrompt = `
            User prompt: "${prompt}"
            Chord Progression: ${chords.join(' - ')}
            Key: ${key}
            BPM: ${bpm}
            Total Ticks available for the melody: ${totalTicks}
            Rhythm Complexity: ${rhythm}
            Melodic Contour: ${contour}

            Generate the melody as a JSON array of note objects.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    description: "An array of melody note objects.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            midiNote: { type: Type.NUMBER, description: "The MIDI note number (e.g., 60 for middle C)." },
                            startTick: { type: Type.NUMBER, description: "The tick on which the note starts." },
                            durationTicks: { type: Type.NUMBER, description: "The duration of the note in ticks." }
                        },
                        required: ["midiNote", "startTick", "durationTicks"]
                    }
                },
                temperature: 0.7,
            },
        });

        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        if (Array.isArray(parsedResponse)) {
            // Can add more validation here if needed
            return parsedResponse as MelodyNote[];
        } else {
            throw new Error("Invalid response format from API for melody generation.");
        }

    } catch (error) {
        console.error("Error calling Gemini API for melody generation:", error);
        throw new Error("The AI model could not generate a melody.");
    }
}


export async function generateSynthParameters(prompt: string): Promise<SynthParams> {
    try {
        const systemInstruction = `You are an expert synthesizer sound designer. The user will describe a sound. Your task is to generate the parameters for a subtractive synthesizer to create that sound. You must respond ONLY with a JSON object matching the provided schema. Ensure the values are within reasonable ranges for a typical synthesizer. For example, attack times should be short, frequencies should be within the audible range.`;

        const fullPrompt = `User sound description: "${prompt}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        oscillator1: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['sine', 'square', 'sawtooth', 'triangle'] },
                                detune: { type: Type.NUMBER, description: "Detuning in cents, from -100 to 100" }
                            }
                        },
                         oscillator2: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['sine', 'square', 'sawtooth', 'triangle'] },
                                detune: { type: Type.NUMBER, description: "Detuning in cents, from -100 to 100" }
                            }
                        },
                        envelope: {
                            type: Type.OBJECT,
                            properties: {
                                attack: { type: Type.NUMBER, description: "Attack time in seconds (e.g., 0.01 to 2)" },
                                decay: { type: Type.NUMBER, description: "Decay time in seconds (e.g., 0.01 to 2)" },
                                sustain: { type: Type.NUMBER, description: "Sustain level from 0.0 to 1.0" },
                                release: { type: Type.NUMBER, description: "Release time in seconds (e.g., 0.01 to 3)" }
                            }
                        },
                        filter: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['lowpass', 'highpass', 'bandpass'] },
                                frequency: { type: Type.NUMBER, description: "Filter cutoff frequency in Hz (e.g., 100 to 15000)" },
                                q: { type: Type.NUMBER, description: "Filter resonance or Q factor (e.g., 0.1 to 20)" }
                            }
                        }
                    },
                },
                temperature: 0.8,
            },
        });

        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);
        
        // Basic validation can be added here if needed
        return parsedResponse as SynthParams;

    } catch (error) {
        console.error("Error calling Gemini API for synth parameter generation:", error);
        throw new Error("The AI model could not generate synth parameters.");
    }
}