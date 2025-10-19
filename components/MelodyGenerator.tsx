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

type Scale = 'Major' | 'Minor' | 'Pentatonic' | 'Blues';
type RhythmComplexity = 'Simple' | 'Moderate' | 'Complex';
type MelodicContour = 'Any' | 'Ascending' | 'Descending' | 'Arpeggiated';

const Select = ({ label, value, onChange, options, id }) => (
    <div>
        <label htmlFor={id} className="block mb-1 text-xs font-medium text-gray-400">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-1 text-sm text-white focus:ring-1 focus:ring-teal-500 focus:outline-none transition"
        >
            {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
    </div>
);

export const MelodyGenerator: React.FC<MelodyGeneratorProps> = ({ chords, bpm, ticksPerChord, onMelodyGenerated }) => {
  const [prompt, setPrompt] = useState<string>('A simple, catchy melody');
  const [scale, setScale] = useState<Scale>('Major');
  const [rhythmComplexity, setRhythmComplexity] = useState<RhythmComplexity>('Moderate');
  const [melodicContour, setMelodicContour] = useState<MelodicContour>('Any');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (chords.length === 0) {
        setError('No chords in this part to generate a melody for.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    const chordProgressionStrings = chords.map(c => `${c.rootNote}${c.chordType}`);

    try {
      const result = await generateMelody(prompt, chordProgressionStrings, bpm, ticksPerChord, scale, rhythmComplexity, melodicContour);
      onMelodyGenerated(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to generate melody: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, chords, bpm, ticksPerChord, onMelodyGenerated, scale, rhythmComplexity, melodicContour]);

  return (
    <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-teal-400 hover:text-teal-300">Generate Melody...</summary>
        <div className="space-y-3 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select id="scale" label="Scale" value={scale} onChange={e => setScale(e.target.value as Scale)} options={['Major', 'Minor', 'Pentatonic', 'Blues']} />
                <Select id="rhythm-complexity" label="Rhythm" value={rhythmComplexity} onChange={e => setRhythmComplexity(e.target.value as RhythmComplexity)} options={['Simple', 'Moderate', 'Complex']} />
                <Select id="melodic-contour" label="Contour" value={melodicContour} onChange={e => setMelodicContour(e.target.value as MelodicContour)} options={['Any', 'Ascending', 'Descending', 'Arpeggiated']} />
            </div>

            <div>
                <label htmlFor="melody-prompt" className="block mb-1 text-xs font-medium text-gray-400">Description:</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        id="melody-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A slow, emotional piano line"
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-1.5 text-sm text-white focus:ring-1 focus:ring-teal-500 focus:outline-none transition"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || chords.length === 0}
                        className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-bold py-1 px-3 rounded-lg transition"
                    >
                        {isLoading ? <Spinner /> : 'Generate'}
                    </button>
                </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    </details>
  );
};
