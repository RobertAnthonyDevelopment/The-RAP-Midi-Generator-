import React, { useState } from 'react';
import { ChordSelector } from './ChordSelector';
import { ProgressionSuggester } from './ProgressionSuggester';
import { MelodyGenerator } from './MelodyGenerator';
import { Chord, MelodyNote, Note, ChordType } from '../types';
import { parseChordString } from '../utils/chordParser';
import { getMidiNotesForChord } from '../utils/chordUtils';
import { renderChordStem, renderMelodyStem, bufferToWav } from '../utils/audioGenerator';
import { detectKey } from '../utils/keyDetector';
import { TICKS_PER_QUARTER_NOTE } from '../constants';
import { Spinner } from './Spinner';

export const ChordMelodyLab: React.FC = () => {
    const [chords, setChords] = useState<Chord[]>([]);
    const [melody, setMelody] = useState<MelodyNote[] | null>(null);
    const [bpm, setBpm] = useState(120);
    const [numBars, setNumBars] = useState(4);
    
    // State for ChordSelector
    const [rootNote, setRootNote] = useState<Note>('C');
    const [chordType, setChordType] = useState<ChordType>('Major');
    const [octave, setOctave] = useState(3);
    
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAddChord = () => {
        setChords(prev => [...prev, { rootNote, chordType, octave }]);
    };
    
    const handleUseProgression = (progression: string[]) => {
        const newChords = progression.map(chordStr => {
            const parsed = parseChordString(chordStr);
            if (parsed) {
                return { rootNote: parsed.root, chordType: parsed.type as ChordType, octave: 3 };
            }
            return null;
        }).filter((c): c is Chord => c !== null);
        setChords(newChords);
        setMelody(null); // Clear melody when chords change
    };
    
    const handleMelodyGenerated = (newMelody: MelodyNote[]) => {
        setMelody(newMelody);
    };
    
    const handleGenerateStem = async (type: 'chords' | 'melody' | 'combined') => {
        setIsLoading(true);
        setAudioUrl(null);
        try {
            let audioBuffer: AudioBuffer | null = null;
            const ticksPerPart = numBars * 4 * TICKS_PER_QUARTER_NOTE;
            
            if (type === 'chords' && chords.length > 0) {
                 const ticksPerChord = ticksPerPart / chords.length;
                 // FIX: Add velocity property to satisfy MelodyNote type
                 const notes: MelodyNote[] = chords.flatMap((chord, i) => 
                    getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave).map(midiNote => ({
                        midiNote,
                        startTick: i * ticksPerChord,
                        durationTicks: ticksPerChord,
                        velocity: 0.8,
                    }))
                );
                audioBuffer = await renderChordStem(notes, bpm);
            } else if (type === 'melody' && melody) {
                 audioBuffer = await renderMelodyStem(melody, bpm);
            }
            
            if (audioBuffer) {
                const wavBlob = bufferToWav(audioBuffer);
                const url = URL.createObjectURL(wavBlob);
                setAudioUrl(url);
            }

        } catch(e) {
            console.error("Failed to render audio", e);
        } finally {
            setIsLoading(false);
        }
    };
    
    const detectedKey = detectKey(chords);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Controls */}
            <div className="lg:col-span-1 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-6">
                <div>
                    <label htmlFor="bpm-lab" className="text-sm font-medium text-gray-400">BPM</label>
                    <input
                        type="number"
                        id="bpm-lab"
                        value={bpm}
                        onChange={e => setBpm(parseInt(e.target.value, 10))}
                        className="w-full bg-gray-900/50 p-2 rounded text-lg font-bold text-center mt-1"
                    />
                </div>
                 <ChordSelector
                    rootNote={rootNote} setRootNote={setRootNote}
                    chordType={chordType} setChordType={setChordType}
                    octave={octave} setOctave={setOctave}
                    onAddChord={handleAddChord}
                 />
                 <ProgressionSuggester onUseProgression={handleUseProgression} />
                 <button onClick={() => { setChords([]); setMelody(null); }} className="w-full text-center text-gray-400 hover:text-white text-sm">Clear Progression</button>
            </div>
            
            {/* Right Column: Results */}
            <div className="lg:col-span-2 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-6">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Chord Progression</h3>
                    <div className="p-3 bg-black/30 rounded-md min-h-[60px] flex flex-wrap gap-2 items-center">
                        {chords.map((c, i) => <span key={i} className="inline-block bg-gray-700 text-white py-1.5 px-3 rounded-full text-sm font-medium">{c.rootNote}{c.chordType}</span>)}
                        {chords.length === 0 && <p className="text-gray-500">Add some chords or suggest a progression.</p>}
                    </div>
                </div>
                
                <div>
                     <h3 className="font-semibold text-lg mb-2">Melody</h3>
                     <div className="p-3 bg-black/30 rounded-md">
                        <MelodyGenerator
                            chords={chords}
                            bpm={bpm}
                            ticksPerPart={numBars * 4 * TICKS_PER_QUARTER_NOTE}
                            onMelodyGenerated={handleMelodyGenerated}
                            detectedKey={detectedKey}
                        />
                         {melody && <p className="text-sm text-green-400 mt-2">✓ Melody generated. Press 'Render Melody' to hear it.</p>}
                     </div>
                </div>

                <div>
                    <h3 className="font-semibold text-lg mb-2">Preview</h3>
                    <div className="p-3 bg-black/30 rounded-md space-y-3">
                         <div className="flex flex-wrap gap-2">
                             <button onClick={() => handleGenerateStem('chords')} disabled={isLoading || chords.length === 0} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-bold py-2 px-4 rounded-lg transition">
                                 {isLoading ? <Spinner/> : 'Render Chords'}
                             </button>
                             <button onClick={() => handleGenerateStem('melody')} disabled={isLoading || !melody} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-bold py-2 px-4 rounded-lg transition">
                                  {isLoading ? <Spinner/> : 'Render Melody'}
                             </button>
                         </div>
                         {audioUrl && <audio controls autoPlay src={audioUrl} className="w-full h-10 mt-2" />}
                    </div>
                </div>
            </div>
        </div>
    );
};