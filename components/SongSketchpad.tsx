import React, { useState, useCallback } from 'react';
import { SongStructure, SongPart, Chord, MelodyNote, DrumNote } from '../types';
import { ChordSelector } from './ChordSelector';
import { ProgressionSuggester } from './ProgressionSuggester';
import { MelodyGenerator } from './MelodyGenerator';
import { parseChordString } from '../utils/chordParser';
import { getMidiNotesForChord } from '../utils/chordUtils';
import { renderChordStem, renderMelodyStem, renderDrumStem, bufferToWav } from '../utils/audioGenerator';
import { detectKey } from '../utils/keyDetector';
import { DRUM_MIDI_MAP, TICKS_PER_QUARTER_NOTE } from '../constants';
import { Spinner } from './Spinner';

interface SongSketchpadProps {
  onExportToDAW: (song: SongStructure) => void;
}

const initialSongStructure: SongStructure = {
  key: 'C Major',
  bpm: 120,
  parts: [
    { id: 'part1', name: 'Verse', lengthBars: 8, chords: [] },
    { id: 'part2', name: 'Chorus', lengthBars: 8, chords: [] },
  ],
};

const PartEditor: React.FC<{
    part: SongPart;
    updatePart: (id: string, newPart: Partial<SongPart>) => void;
    removePart: (id: string) => void;
    bpm: number;
}> = ({ part, updatePart, removePart, bpm }) => {
    // State for the ChordSelector
    const [rootNote, setRootNote] = useState<any>('C');
    const [chordType, setChordType] = useState<any>('Major');
    const [octave, setOctave] = useState(3);

    const [stemUrls, setStemUrls] = useState<{ chords?: string, melody?: string, drums?: string }>({});
    const [isGenerating, setIsGenerating] = useState<{ [key: string]: boolean }>({});

    const handleAddChord = () => {
        const newChord: Chord = { rootNote, chordType, octave };
        updatePart(part.id, { chords: [...part.chords, newChord] });
    };
    
    const handleUseProgression = (progression: string[]) => {
        const newChords = progression.map(chordStr => {
            const parsed = parseChordString(chordStr);
            if (parsed) {
                return { rootNote: parsed.root as any, chordType: parsed.type as any, octave: 3 };
            }
            return null;
        }).filter((c): c is Chord => c !== null);
        updatePart(part.id, { chords: newChords });
    };

    const handleMelodyGenerated = (melody: MelodyNote[]) => {
        updatePart(part.id, { melody });
    };

     const handleGenerateDrums = () => {
        // Basic four-on-the-floor pattern
        const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;
        const drumPattern: DrumNote[] = [];
        for (let bar = 0; bar < part.lengthBars; bar++) {
            const barStartTick = bar * ticksPerBar;
            // Kick on every beat
            for (let beat = 0; beat < 4; beat++) {
                drumPattern.push({ midiNote: DRUM_MIDI_MAP.KICK, startTick: barStartTick + beat * TICKS_PER_QUARTER_NOTE, durationTicks: 100 });
            }
            // Snare on 2 and 4
            drumPattern.push({ midiNote: DRUM_MIDI_MAP.SNARE, startTick: barStartTick + 1 * TICKS_PER_QUARTER_NOTE, durationTicks: 100 });
            drumPattern.push({ midiNote: DRUM_MIDI_MAP.SNARE, startTick: barStartTick + 3 * TICKS_PER_QUARTER_NOTE, durationTicks: 100 });
            // Closed hats on every 8th note
            for (let eighth = 0; eighth < 8; eighth++) {
                drumPattern.push({ midiNote: DRUM_MIDI_MAP.CLOSED_HAT, startTick: barStartTick + eighth * (TICKS_PER_QUARTER_NOTE / 2), durationTicks: 50 });
            }
        }
        updatePart(part.id, { drums: drumPattern });
    };

    const generateStem = async (stemType: 'chords' | 'melody' | 'drums') => {
        setIsGenerating(prev => ({ ...prev, [stemType]: true }));
        try {
            let audioBuffer: AudioBuffer | null = null;
            if (stemType === 'chords' && part.chords.length > 0) {
                const ticksPerPart = part.lengthBars * 4 * TICKS_PER_QUARTER_NOTE;
                const ticksPerChord = ticksPerPart / part.chords.length;
                // FIX: Add velocity property to satisfy MelodyNote type
                const notes: MelodyNote[] = part.chords.flatMap((chord, i) => 
                    getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave).map(midiNote => ({
                        midiNote,
                        startTick: i * ticksPerChord,
                        durationTicks: ticksPerChord,
                        velocity: 0.8,
                    }))
                );
                audioBuffer = await renderChordStem(notes, bpm);
            } else if (stemType === 'melody' && part.melody) {
                audioBuffer = await renderMelodyStem(part.melody, bpm);
            } else if (stemType === 'drums' && part.drums) {
                audioBuffer = await renderDrumStem(part.drums, bpm);
            }

            if (audioBuffer) {
                const wavBlob = bufferToWav(audioBuffer);
                const url = URL.createObjectURL(wavBlob);
                setStemUrls(prev => ({ ...prev, [stemType]: url }));
            }
        } catch (e) {
            console.error(`Failed to generate ${stemType} stem`, e);
        } finally {
             setIsGenerating(prev => ({ ...prev, [stemType]: false }));
        }
    };
    
    const detectedKey = detectKey(part.chords);
    
    return (
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div className="flex justify-between items-center mb-4">
                <input 
                    type="text" 
                    value={part.name}
                    onChange={(e) => updatePart(part.id, { name: e.target.value })}
                    className="bg-transparent text-xl font-bold text-white focus:outline-none focus:bg-gray-700/50 rounded p-1"
                />
                <div className="flex items-center gap-2">
                     <input 
                        type="number"
                        value={part.lengthBars}
                        onChange={(e) => updatePart(part.id, { lengthBars: parseInt(e.target.value, 10) || 1 })}
                        className="w-16 bg-gray-700/50 p-1 rounded text-center"
                     />
                     <span>bars</span>
                    <button onClick={() => removePart(part.id)} className="text-red-500 hover:text-red-400 font-bold text-xl">&times;</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left side: Chords */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Chords</h3>
                    <div className="p-3 bg-black/30 rounded-md min-h-[80px]">
                       {part.chords.map((c, i) => <span key={i} className="inline-block bg-gray-700 text-white py-1 px-3 rounded-full text-sm font-medium mr-2 mb-2">{c.rootNote}{c.chordType}</span>)}
                    </div>
                    <ChordSelector 
                        rootNote={rootNote} setRootNote={setRootNote}
                        chordType={chordType} setChordType={setChordType}
                        octave={octave} setOctave={setOctave}
                        onAddChord={handleAddChord}
                    />
                     <ProgressionSuggester onUseProgression={handleUseProgression} />
                </div>
                {/* Right side: Melody & Drums */}
                <div className="space-y-4">
                     <h3 className="font-semibold text-lg">Melody & Drums</h3>
                     <div className="p-3 bg-black/30 rounded-md">
                        <MelodyGenerator
                            chords={part.chords}
                            bpm={bpm}
                            ticksPerPart={part.lengthBars * 4 * TICKS_PER_QUARTER_NOTE}
                            onMelodyGenerated={handleMelodyGenerated}
                            detectedKey={detectedKey}
                        />
                        {part.melody && <p className="text-sm text-green-400 mt-2">✓ Melody generated.</p>}
                     </div>
                     <div className="p-3 bg-black/30 rounded-md">
                        <button onClick={handleGenerateDrums} className="text-red-400 hover:text-red-300">Generate Basic Drum Beat</button>
                        {part.drums && <p className="text-sm text-green-400 mt-2">✓ Drum pattern generated.</p>}
                     </div>
                </div>
            </div>

            {/* Stems */}
            <div className="mt-6 border-t border-gray-700/50 pt-4 space-y-3">
                <h3 className="font-semibold text-lg">Stems</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['chords', 'melody', 'drums'].map(stemType => (
                         <div key={stemType} className="bg-gray-700/50 p-3 rounded-md">
                             <div className="flex justify-between items-center">
                                 <span className="capitalize font-medium">{stemType}</span>
                                 <button onClick={() => generateStem(stemType as any)} disabled={isGenerating[stemType]} className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md">{isGenerating[stemType] ? <Spinner /> : 'Render'}</button>
                             </div>
                             {stemUrls[stemType] && <audio controls src={stemUrls[stemType]} className="w-full mt-2 h-8" />}
                         </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export const SongSketchpad: React.FC<SongSketchpadProps> = ({ onExportToDAW }) => {
  const [song, setSong] = useState<SongStructure>(initialSongStructure);

  const updatePart = useCallback((id: string, newPart: Partial<SongPart>) => {
    setSong(prevSong => ({
      ...prevSong,
      parts: prevSong.parts.map(p => p.id === id ? { ...p, ...newPart } : p),
    }));
  }, []);

  const addPart = () => {
    const newPart: SongPart = {
        id: `part${Date.now()}`,
        name: 'New Part',
        lengthBars: 8,
        chords: []
    };
    setSong(prev => ({ ...prev, parts: [...prev.parts, newPart] }));
  };

  const removePart = (id: string) => {
    setSong(prev => ({...prev, parts: prev.parts.filter(p => p.id !== id)}));
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-4">
                <div>
                    <label htmlFor="bpm" className="text-sm font-medium text-gray-400">BPM</label>
                    <input 
                        type="number" 
                        id="bpm"
                        value={song.bpm}
                        onChange={e => setSong(s => ({...s, bpm: parseInt(e.target.value, 10)}))}
                        className="w-24 bg-gray-900/50 p-2 rounded text-lg font-bold text-center"
                    />
                </div>
                 <div>
                    <label htmlFor="key" className="text-sm font-medium text-gray-400">Key</label>
                    <input 
                        type="text" 
                        id="key"
                        value={song.key}
                        onChange={e => setSong(s => ({...s, key: e.target.value}))}
                        className="w-32 bg-gray-900/50 p-2 rounded text-lg font-bold text-center"
                    />
                </div>
            </div>
             <button
                onClick={() => onExportToDAW(song)}
                className="mt-4 sm:mt-0 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
            >
                Export to DAW
            </button>
        </div>

        {song.parts.map(part => (
            <PartEditor key={part.id} part={part} updatePart={updatePart} removePart={removePart} bpm={song.bpm} />
        ))}
        
        <button onClick={addPart} className="w-full border-2 border-dashed border-gray-600 hover:bg-gray-800/50 text-gray-400 font-bold py-4 px-4 rounded-lg transition">
            + Add Song Part
        </button>
    </div>
  );
};