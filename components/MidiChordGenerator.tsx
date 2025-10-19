import React, { useState } from 'react';
import { ChordSelector } from './ChordSelector';
import { ProgressionSuggester } from './ProgressionSuggester';
import { Chord, MelodyNote, Note, ChordType } from '../types';
import { parseChordString } from '../utils/chordParser';
import { getMidiNotesForChord } from '../utils/chordUtils';
import { generateMultiTrackMidi } from '../utils/midiGenerator';
import { TICKS_PER_QUARTER_NOTE } from '../constants';
import { Spinner } from './Spinner';

export const MidiChordGenerator: React.FC = () => {
    const [chords, setChords] = useState<Chord[]>([]);
    const [bpm, setBpm] = useState(120);
    const [numBars, setNumBars] = useState(4);
    
    // State for ChordSelector
    const [rootNote, setRootNote] = useState<Note>('C');
    const [chordType, setChordType] = useState<ChordType>('Major');
    const [octave, setOctave] = useState(3);
    
    const [isGenerating, setIsGenerating] = useState(false);

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
    };
    
    const handleDownloadMidi = () => {
        if (chords.length === 0) {
            alert("Please add some chords first.");
            return;
        }

        setIsGenerating(true);
        
        // Use a timeout to allow the UI to update to show the spinner
        setTimeout(() => {
            try {
                const ticksPerPart = numBars * 4 * TICKS_PER_QUARTER_NOTE;
                const ticksPerChord = ticksPerPart / chords.length;

                const chordNotes: MelodyNote[] = chords.flatMap((chord, i) => 
                    getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave).map(midiNote => ({
                        midiNote,
                        startTick: i * ticksPerChord,
                        durationTicks: ticksPerChord,
                        velocity: 0.8,
                    }))
                );
                
                const midiBlob = generateMultiTrackMidi({
                    bpm,
                    tracks: [{ notes: chordNotes, channel: 0, velocity: 100 }]
                });

                const url = URL.createObjectURL(midiBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chords_${bpm}bpm.mid`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

            } catch(e) {
                console.error("Failed to generate MIDI", e);
                alert("An error occurred while generating the MIDI file.");
            } finally {
                setIsGenerating(false);
            }
        }, 50);
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Controls */}
            <div className="lg:col-span-1 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="bpm-gen" className="text-sm font-medium text-gray-400">BPM</label>
                        <input
                            type="number"
                            id="bpm-gen"
                            value={bpm}
                            onChange={e => setBpm(parseInt(e.target.value, 10) || 120)}
                            className="w-full bg-gray-900/50 p-2 rounded text-lg font-bold text-center mt-1"
                        />
                    </div>
                     <div>
                        <label htmlFor="bars-gen" className="text-sm font-medium text-gray-400">Bars</label>
                        <input
                            type="number"
                            id="bars-gen"
                            value={numBars}
                            onChange={e => setNumBars(parseInt(e.target.value, 10) || 4)}
                            className="w-full bg-gray-900/50 p-2 rounded text-lg font-bold text-center mt-1"
                        />
                    </div>
                </div>
                 <ChordSelector
                    rootNote={rootNote} setRootNote={setRootNote}
                    chordType={chordType} setChordType={setChordType}
                    octave={octave} setOctave={setOctave}
                    onAddChord={handleAddChord}
                 />
                 <ProgressionSuggester onUseProgression={handleUseProgression} />
                 <button onClick={() => setChords([])} className="w-full text-center text-gray-400 hover:text-white text-sm">Clear Progression</button>
            </div>
            
            {/* Right Column: Results */}
            <div className="lg:col-span-2 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-6 flex flex-col">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Chord Progression</h3>
                    <div className="p-3 bg-black/30 rounded-md min-h-[60px] flex flex-wrap gap-2 items-center">
                        {chords.map((c, i) => <span key={i} className="inline-block bg-gray-700 text-white py-1.5 px-3 rounded-full text-sm font-medium">{c.rootNote}{c.chordType}</span>)}
                        {chords.length === 0 && <p className="text-gray-500">Add some chords or use the suggester.</p>}
                    </div>
                </div>
                
                <div className="flex-grow"></div>

                <div>
                    <button 
                        onClick={handleDownloadMidi} 
                        disabled={isGenerating || chords.length === 0} 
                        className="w-full flex justify-center items-center bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-bold py-3 px-4 rounded-lg transition"
                    >
                        {isGenerating ? <Spinner/> : 'Download MIDI File'}
                    </button>
                </div>
            </div>
        </div>
    );
};