import React, { useState, useCallback } from 'react';
import { generateMelody } from '../services/geminiService';
import { Spinner } from './Spinner';
import { Chord, MelodyNote } from '../types';

interface MelodyGeneratorProps {
  chords: Chord[];
  bpm: number;
  ticksPerChord: number;
  onMelodyGenerated: (melody: MelodyNote[]) => void;
}

export const MelodyGenerator: React.FC<MelodyGeneratorProps> = ({ chords, bpm, ticksPerChord, onMelodyGenerated }) => {
  const [prompt, setPrompt] = useState<string>('A simple, catchy melody');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please describe the melody you want.');
      return;
    }
    if (chords.length === 0) {
        setError('Please create a chord progression first.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    const chordProgressionStrings = chords.map(c => `${c.rootNote}${c.chordType}`);

    try {
      const result = await generateMelody(prompt, chordProgressionStrings, bpm, ticksPerChord);
      onMelodyGenerated(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to generate melody: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, chords, bpm, ticksPerChord, onMelodyGenerated]);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="melody-prompt" className="block mb-1 text-sm font-medium text-gray-400">Describe the melody:</label>
        <div className="flex gap-2">
            <input
            type="text"
            id="melody-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A slow, emotional piano line"
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition"
            />
            <button
                onClick={handleGenerate}
                disabled={isLoading || chords.length === 0}
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500"
            >
                {isLoading ? <Spinner /> : 'Generate'}
            </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
};
