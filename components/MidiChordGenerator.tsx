import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChordSelector } from './ChordSelector';
import { ProgressionSuggester } from './ProgressionSuggester';
import { Chord, MelodyNote, Note, ChordType } from '../types';
import { parseChordString } from '../utils/chordParser';
import { getMidiNotesForChord } from '../utils/chordUtils';
import { generateMultiTrackMidi } from '../utils/midiGenerator';
import { TICKS_PER_QUARTER_NOTE } from '../constants';
import { Spinner } from './Spinner';
import { Play, Stop } from './Icons';

export const MidiChordGenerator: React.FC = () => {
    const [chords, setChords] = useState<Chord[]>([]);
    const [bpm, setBpm] = useState(120);
    const [numBars, setNumBars] = useState(4);
    
    // State for ChordSelector
    const [rootNote, setRootNote] = useState<Note>('C');
    const [chordType, setChordType] = useState<ChordType>('Major');
    const [octave, setOctave] = useState(3);
    
    const [isGenerating, setIsGenerating] = useState(false);

    // New state for playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentChordIndex, setCurrentChordIndex] = useState<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const activeSourcesRef = useRef<AudioNode[]>([]);
    const playbackTimerRef = useRef<number | null>(null);

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

    const removeChord = (indexToRemove: number) => {
        setChords(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const stopAllNotes = () => {
        activeSourcesRef.current.forEach(source => {
            try {
                // OscillatorNodes don't have disconnect, but GainNodes do.
                // It's safer to just let them finish or stop them.
                if ('stop' in source) {
                    (source as OscillatorNode).stop();
                }
                source.disconnect();
            } catch(e) {
                // Ignore errors if already disconnected or stopped
            }
        });
        activeSourcesRef.current = [];
    };

    const playChord = (chord: Chord, duration: number = 1.5) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ac = audioContextRef.current;
        if (ac.state === 'suspended') {
            ac.resume();
        }

        stopAllNotes();

        const notes = getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave);
        const now = ac.currentTime;

        notes.forEach(midiNote => {
            const osc = ac.createOscillator();
            const gainNode = ac.createGain();

            osc.connect(gainNode);
            gainNode.connect(ac.destination);

            const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
            osc.frequency.setValueAtTime(freq, now);
            osc.type = 'sawtooth';

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            
            osc.start(now);
            osc.stop(now + duration);
            activeSourcesRef.current.push(gainNode, osc);
        });
    };
    
    const stopPlayback = useCallback(() => {
        setIsPlaying(false);
        setCurrentChordIndex(null);
        if (playbackTimerRef.current) {
            clearTimeout(playbackTimerRef.current);
            playbackTimerRef.current = null;
        }
        stopAllNotes();
    }, []);

    useEffect(() => {
        return () => {
            stopPlayback();
        };
    }, [stopPlayback]);

    const startPlayback = () => {
        if (chords.length === 0) return;
        setIsPlaying(true);
        let index = 0;
        
        const ticksPerPart = numBars * 4 * TICKS_PER_QUARTER_NOTE;
        const ticksPerChord = ticksPerPart / chords.length;
        const secondsPerTick = (60 / bpm) / TICKS_PER_QUARTER_NOTE;
        const secondsPerChord = ticksPerChord * secondsPerTick;

        const loop = () => {
            setCurrentChordIndex(index);
            playChord(chords[index], secondsPerChord);
            
            index = (index + 1) % chords.length;

            playbackTimerRef.current = window.setTimeout(loop, secondsPerChord * 1000);
        };
        
        loop();
    };

    const handlePlayToggle = () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            startPlayback();
        }
    };

    const handleDownloadMidi = () => {
        if (chords.length === 0) {
            alert("Please add some chords first.");
            return;
        }

        setIsGenerating(true);
        
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
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-lg">Chord Progression</h3>
                        <button 
                            onClick={handlePlayToggle} 
                            disabled={chords.length === 0}
                            className="flex items-center gap-2 bg-red-600/80 hover:bg-red-600 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            {isPlaying ? <Stop/> : <Play/>}
                            <span>{isPlaying ? 'Stop' : 'Play'}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 p-3 bg-black/30 rounded-md min-h-[120px] content-start">
                        {chords.map((c, i) => (
                             <div key={i} className="relative group">
                                <button 
                                    onClick={() => playChord(c)}
                                    className={`p-4 w-full h-full rounded-lg text-center font-bold transition-all duration-150 ${currentChordIndex === i ? 'bg-red-500 ring-2 ring-white scale-105' : 'bg-gray-700 hover:bg-gray-600'}`}
                                >
                                    {c.rootNote}{c.chordType}
                                </button>
                                <button onClick={() => removeChord(i)} className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove chord">
                                    &times;
                                </button>
                            </div>
                        ))}
                        {chords.length === 0 && <p className="col-span-4 text-gray-500 self-center text-center">Add some chords or use the suggester.</p>}
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
