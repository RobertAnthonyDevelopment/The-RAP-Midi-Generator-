import { GoogleGenAI, Type } from "@google/genai";
import { MelodyNote, DrumNote } from "../types";
import { DRUM_MIDI_MAP, TICKS_PER_QUARTER_NOTE } from '../constants';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Add missing suggestProgressions function to resolve import error.
export async function suggestProgressions(userInput: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a 4-chord progression that fits the following description: "${userInput}".`,
      config: {
        systemInstruction: "You are a helpful music theory assistant. Your goal is to generate chord progressions. You must return the output as a valid JSON array of 4 strings, where each string is a chord name (e.g., 'Cmaj7', 'Gm', 'F'). Do not provide any other text, explanation, or markdown formatting.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "An array of four chord names.",
          items: {
            type: Type.STRING,
            description: "A chord name."
          }
        },
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const progression = JSON.parse(jsonText);
    
    if (Array.isArray(progression) && progression.every(c => typeof c === 'string')) {
      return progression;
    } else {
      throw new Error("Invalid response format from API.");
    }

  } catch (error) {
    console.error("Error calling Gemini API for progression suggestion:", error);
    throw new Error("Could not fetch progression suggestion from the Gemini API.");
  }
}

export async function generateSongStructure(userInput: string): Promise<{ name: string; chords: string[] }[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a standard song structure (e.g., Verse, Chorus, Verse, Chorus, Bridge, Chorus) for a song about "${userInput}". For each part, create a unique 4-chord progression that fits the mood.`,
      config: {
        systemInstruction: "You are a helpful music theory assistant. Your goal is to generate song structures with chord progressions. You must return the output as a valid JSON array of objects. Each object should have a 'name' (string, e.g., 'Verse 1') and a 'chords' (array of 4 strings, e.g., ['C', 'G', 'Am', 'F']). Do not provide any other text, explanation, or markdown formatting.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "An array of song part objects.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The name of the song part, e.g., 'Verse 1' or 'Chorus'." },
              chords: {
                type: Type.ARRAY,
                description: "An array of four chord names.",
                items: { type: Type.STRING }
              }
            },
            required: ["name", "chords"]
          }
        },
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    const structure = JSON.parse(jsonText);
    
    if (Array.isArray(structure)) {
      return structure;
    } else {
      throw new Error("Invalid response format from API.");
    }

  } catch (error) {
    console.error("Error calling Gemini API for song structure:", error);
    throw new Error("Could not fetch song structure from the Gemini API.");
  }
}

export async function generateDrumBeat(
  genre: string,
  totalTicks: number,
  bpm: number,
): Promise<DrumNote[]> {
  const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;
  const numBars = Math.ceil(totalTicks / ticksPerBar);

  const prompt = `
    You are an expert drum machine programmer. Your task is to generate a repeating 4-bar drum loop that fits a specific genre and tempo, and then extend it to cover the total duration of a song.

    Parameters:
    - Genre: ${genre}
    - Tempo: ${bpm} BPM
    - Ticks per Quarter Note: ${TICKS_PER_QUARTER_NOTE}
    - Ticks per Bar: ${ticksPerBar}
    - Loop Duration: 4 bars (${ticksPerBar * 4} ticks)
    - Total Song Duration: ${totalTicks} ticks (${numBars} bars)

    Instructions:
    1. Create a 4-bar drum pattern that is characteristic of the "${genre}" genre.
    2. Use standard General MIDI drum mapping: Kick=${DRUM_MIDI_MAP.KICK}, Snare=${DRUM_MIDI_MAP.SNARE}, Closed Hi-Hat=${DRUM_MIDI_MAP.CLOSED_HAT}. You may also use Open Hi-Hat=${DRUM_MIDI_MAP.OPEN_HAT} and Crash=${DRUM_MIDI_MAP.CRASH} sparingly.
    3. The pattern should be exactly ${ticksPerBar * 4} ticks long.
    4. Repeat this 4-bar loop to fill the entire song duration of ${totalTicks} ticks.

    Output Format:
    Return a valid JSON array of drum note objects. Each object must have three integer properties:
    1. "midiNote": The MIDI note number for the drum sound.
    2. "startTick": The absolute start time of the drum hit in MIDI ticks from the beginning (0 to ${totalTicks - 1}).
    3. "durationTicks": For drums, this should typically be short, e.g., ${TICKS_PER_QUARTER_NOTE / 4} (a 16th note).
  `;
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert drum machine AI. You will generate drum patterns in a precise JSON format based on the user's requirements.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "An array of drum note objects.",
            items: {
              type: Type.OBJECT,
              properties: {
                midiNote: { type: Type.INTEGER },
                startTick: { type: Type.INTEGER },
                durationTicks: { type: Type.INTEGER }
              },
              required: ["midiNote", "startTick", "durationTicks"]
            }
          },
          temperature: 0.6,
        },
    });
    const jsonText = response.text.trim();
    const pattern = JSON.parse(jsonText);

    if (Array.isArray(pattern)) {
      return pattern;
    }
    throw new Error("Invalid drum pattern format from API.");
  } catch (error) {
    console.error("Error calling Gemini API for drum generation:", error);
    throw new Error("Could not generate drum pattern from the Gemini API.");
  }
}

export async function generateMelody(
  userInput: string,
  chordProgression: string[],
  bpm: number,
  ticksPerPart: number, // Note: this is now ticks for the whole part
  scale: string,
  rhythmComplexity: string,
  melodicContour: string,
): Promise<MelodyNote[]> {
  const prompt = `
    You are an expert music composition assistant. Your task is to generate a melody for a specific section of a song.

    Musical Context:
    - Chord Progression for this section: [${chordProgression.join(', ')}]
    - Tempo: ${bpm} BPM
    - Total duration of this section: ${ticksPerPart} MIDI ticks

    Melody Requirements:
    - User Description: "${userInput}"
    - Scale: Primarily use notes from the ${scale} scale.
    - Rhythm Complexity: ${rhythmComplexity}.
    - Melodic Contour: ${melodicContour}.

    Output Format:
    Return a valid JSON array of note objects. Each object must have three integer properties:
    1. "midiNote": MIDI note number (60-84 is a good range).
    2. "startTick": The start time of the note in MIDI ticks, relative to the beginning of this section (0 to ${ticksPerPart - 1}).
    3. "durationTicks": The duration of the note in MIDI ticks.

    Important: The sum of a note's startTick and durationTicks must not exceed ${ticksPerPart}. Notes must not overlap.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert music composer AI. You will generate melodies in a precise JSON format based on the user's detailed requirements.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "An array of melody note objects.",
          items: {
            type: Type.OBJECT,
            properties: {
              midiNote: { type: Type.INTEGER },
              startTick: { type: Type.INTEGER },
              durationTicks: { type: Type.INTEGER }
            },
            required: ["midiNote", "startTick", "durationTicks"]
          }
        },
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    const melody = JSON.parse(jsonText);

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
