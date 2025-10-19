import React, { useState, useCallback, useMemo } from 'react';
import { ProgressionSuggester } from './components/ProgressionSuggester';
import { MelodyGenerator } from './components/MelodyGenerator';
import { Chord, Note, ChordType, NoteDuration, MelodyNote, SongPart, DrumNote } from './types';
import { getMidiNotesForChord } from './utils/chordUtils';
import { generateMultiTrackMidi } from './utils/midiGenerator';
import { parseChordString } from './utils/chordParser';
import { renderChordStem, renderMelodyStem, renderDrumStem } from './utils/audioGenerator';
import { Spinner } from './components/Spinner';
import { NOTE_DURATIONS, CHORD_TYPES, DRUM_MIDI_MAP } from './constants';
import { generateSongStructure, generateDrumBeat } from './services/geminiService';


const App: React.FC = () => {
    const [songParts, setSongParts] = useState<SongPart[]>([]);
    const [drumPattern, setDrumPattern] = useState<DrumNote[] | null>(null);
    const [bpm, setBpm] = useState<number>(120);
    const [noteDuration, setNoteDuration] = useState<NoteDuration>('Whole Note');
    
    const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
    const [isGeneratingDrums, setIsGeneratingDrums] = useState(false);

    const [structurePrompt, setStructurePrompt] = useState('A melancholic pop song about rain');
    const [drumGenre, setDrumGenre] = useState('Hip Hop');

    // State for audio stems
    const [renderingStem, setRenderingStem] = useState<string | null>(null);
    const [stemUrls, setStemUrls] = useState<{ [key: string]: string }>({});
    const [renderError, setRenderError] = useState<string | null>(null);

    const ticksPerChord = useMemo(() => NOTE_DURATIONS[noteDuration], [noteDuration]);
    const totalTicks = useMemo(() => songParts.length * 4 * ticksPerChord, [songParts, ticksPerChord]);

    const handleGenerateStructure = useCallback(async () => {
        setIsGeneratingStructure(true);
        setSongParts([]);
        setDrumPattern(null);
        setStemUrls({});
        try {
            const structure = await generateSongStructure(structurePrompt);
            const newParts: SongPart[] = structure.map(part => {
                const parsedChords = part.chords
                    .map(chordStr => {
                        const parsed = parseChordString(chordStr);
                        if (!parsed) return null;
                        const matchedTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === parsed.type.toLowerCase()) as ChordType | undefined;
                        if (!matchedTypeKey) return null;
                        return { rootNote: parsed.root, chordType: matchedTypeKey, octave: 4 };
                    })
                    .filter((c): c is Chord => c !== null);

                return {
                    id: crypto.randomUUID(),
                    name: part.name,
                    chords: parsedChords,
                    melody: null,
                };
            });
            setSongParts(newParts);
        } catch (error) {
            console.error(error);
            setRenderError(error instanceof Error ? error.message : "Failed to generate structure");
        } finally {
            setIsGeneratingStructure(false);
        }
    }, [structurePrompt]);

    const handleGenerateDrums = useCallback(async () => {
        if (totalTicks === 0) {
            setRenderError("Please generate a song structure first.");
            return;
        }
        setIsGeneratingDrums(true);
        setDrumPattern(null);
        setStemUrls(prev => ({...prev, drums: undefined}));
        try {
            const pattern = await generateDrumBeat(drumGenre, totalTicks, bpm);
            setDrumPattern(pattern);
        } catch (error) {
            console.error(error);
            setRenderError(error instanceof Error ? error.message : "Failed to generate drums");
        } finally {
            setIsGeneratingDrums(false);
        }
    }, [drumGenre, totalTicks, bpm]);

    const handleSetMelodyForPart = (partId: string, melody: MelodyNote[]) => {
        setSongParts(parts => parts.map(p => p.id === partId ? { ...p, melody } : p));
        setStemUrls(prev => ({...prev, melody: undefined}));
    };
    
    // Flatten song parts into continuous arrays of notes for export
    const { flatChordNotes, flatMelodyNotes } = useMemo(() => {
        let flatChords: MelodyNote[] = [];
        let flatMelody: MelodyNote[] = [];
        let currentTick = 0;

        songParts.forEach(part => {
            part.chords.forEach(chord => {
                const midiNotes = getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave);
                midiNotes.forEach(note => {
                    flatChords.push({ midiNote: note, startTick: currentTick, durationTicks: ticksPerChord });
                });
                currentTick += ticksPerChord;
            });
            if (part.melody) {
                const partStartTick = (songParts.indexOf(part) * 4 * ticksPerChord);
                part.melody.forEach(note => {
                    flatMelody.push({ ...note, startTick: note.startTick + partStartTick });
                });
            }
        });
        return { flatChordNotes: flatChords, flatMelodyNotes: flatMelody };
    }, [songParts, ticksPerChord]);


    const handleGenerateStem = useCallback(async (stemType: 'chords' | 'melody' | 'drums') => {
        setRenderingStem(stemType);
        setRenderError(null);
        setStemUrls(prev => ({...prev, [stemType]: undefined}));

        try {
            let stemBlob: Blob | null = null;
            if (stemType === 'chords' && flatChordNotes.length > 0) {
                stemBlob = await renderChordStem(flatChordNotes, bpm);
            } else if (stemType === 'melody' && flatMelodyNotes.length > 0) {
                stemBlob = await renderMelodyStem(flatMelodyNotes, bpm);
            } else if (stemType === 'drums' && drumPattern) {
                stemBlob = await renderDrumStem(drumPattern, bpm);
            }
            
            if(stemBlob) {
               setStemUrls(prev => ({ ...prev, [stemType]: URL.createObjectURL(stemBlob) }));
            }
        } catch (error) {
            console.error(`Failed to render ${stemType} stem:`, error);
            setRenderError(error instanceof Error ? error.message : "An unknown error occurred during rendering.");
        } finally {
            setRenderingStem(null);
        }
    }, [flatChordNotes, flatMelodyNotes, drumPattern, bpm]);

    const handleDownloadMidi = (stemType: 'chords' | 'melody' | 'drums') => {
        let notes: (MelodyNote | DrumNote)[] = [];
        let channel = 0;
        let fileName = `${stemType}.mid`;

        if (stemType === 'chords') notes = flatChordNotes;
        if (stemType === 'melody') {
            notes = flatMelodyNotes;
            channel = 1;
        }
        if (stemType === 'drums') {
            notes = drumPattern || [];
            channel = 9;
        }
        
        if (notes.length === 0) return;

        const midiBlob = generateMultiTrackMidi({
            bpm,
            tracks: [{ notes, channel }]
        });
        
        const url = URL.createObjectURL(midiBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <header className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
              AI Song Sketchpad
            </h1>
            <p className="text-gray-400 mt-2">
              Generate full song structures, melodies, and drum beats with Gemini.
            </p>
          </header>
  
          <main className="space-y-8">
            {/* Step 1: Generate Structure */}
            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-4">
              <h2 className="text-2xl font-semibold text-gray-300">
                <span className="text-indigo-400 font-bold">Step 1:</span> Generate Song Structure
              </h2>
              <div className="flex gap-2">
                 <input
                    type="text"
                    value={structurePrompt}
                    onChange={(e) => setStructurePrompt(e.target.value)}
                    placeholder="e.g., A happy folk song about traveling"
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
                <button
                    onClick={handleGenerateStructure}
                    disabled={isGeneratingStructure}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105"
                >
                    {isGeneratingStructure ? <Spinner /> : 'Generate'}
                </button>
              </div>
            </div>

            {/* Step 2: Refine and Add Drums */}
            {songParts.length > 0 && (
                <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-6">
                    <h2 className="text-2xl font-semibold text-gray-300">
                        <span className="text-purple-400 font-bold">Step 2:</span> Refine Structure & Add Drums
                    </h2>
                    
                    {/* Song Structure Editor */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-gray-300">Song Structure</h3>
                        {songParts.map(part => (
                            <div key={part.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 space-y-3">
                                <h4 className="font-bold text-lg text-purple-300">{part.name}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {part.chords.map((c, i) => <span key={i} className="bg-gray-700 text-white py-1 px-3 rounded-full font-mono text-sm">{`${c.rootNote}${c.chordType.replace('Major', '').replace('Minor', 'm').replace('Dominant', '').replace(' 7th', '7').trim()}`}</span>)}
                                </div>
                                <MelodyGenerator
                                    chords={part.chords}
                                    bpm={bpm}
                                    ticksPerChord={ticksPerChord * 4} // The melody is for the whole part
                                    onMelodyGenerated={(melody) => handleSetMelodyForPart(part.id, melody)}
                                />
                                {part.melody && <p className="text-green-400 text-sm">✓ Melody generated for this part.</p>}
                            </div>
                        ))}
                    </div>

                    {/* Drum Machine */}
                    <div className="space-y-4 pt-4 border-t border-gray-700/50">
                        <h3 className="text-xl font-semibold text-gray-300">Drum Machine</h3>
                        <div className="flex gap-4 items-end">
                            <div className="flex-grow">
                                <label htmlFor="drum-genre" className="block mb-1 text-sm font-medium text-gray-400">Genre</label>
                                <select id="drum-genre" value={drumGenre} onChange={e => setDrumGenre(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition">
                                    <option>Hip Hop</option>
                                    <option>Rock</option>
                                    <option>Electronic</option>
                                    <option>Pop</option>
                                    <option>Funk</option>
                                </select>
                            </div>
                            <button
                                onClick={handleGenerateDrums}
                                disabled={isGeneratingDrums}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105"
                            >
                                {isGeneratingDrums ? <Spinner/> : 'Generate Drum Beat'}
                            </button>
                        </div>
                        {drumPattern && <p className="text-green-400 text-sm">✓ Drum pattern generated for the song.</p>}
                    </div>
                </div>
            )}

            {/* Step 3: Export Stems */}
             {songParts.length > 0 && (
                <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-4">
                    <h2 className="text-2xl font-semibold text-gray-300">
                        <span className="text-green-400 font-bold">Step 3:</span> Export Stems
                    </h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label htmlFor="bpm" className="mb-1 block text-sm font-medium text-gray-400">BPM (Beats Per Minute)</label>
                            <input type="number" id="bpm" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value))))} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-green-500 focus:outline-none" />
                        </div>
                        <div>
                            <label htmlFor="note-duration" className="mb-1 block text-sm font-medium text-gray-400">Duration Per Chord</label>
                            <select id="note-duration" value={noteDuration} onChange={(e) => setNoteDuration(e.target.value as NoteDuration)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-green-500 focus:outline-none transition">
                                {Object.keys(NOTE_DURATIONS).map((duration) => (<option key={duration} value={duration}>{duration}</option>))}
                            </select>
                        </div>
                    </div>
                    {renderError && <p className="text-red-400 text-sm mt-2">{renderError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        {['chords', 'melody', 'drums'].map(stemType => (
                            <div key={stemType} className="space-y-3 p-4 bg-gray-900/50 rounded-lg">
                                <h3 className="font-semibold text-lg text-gray-200 capitalize">{stemType} Stem</h3>
                                <button
                                    onClick={() => handleGenerateStem(stemType as any)}
                                    disabled={renderingStem !== null || (stemType === 'melody' && flatMelodyNotes.length === 0) || (stemType === 'drums' && !drumPattern)}
                                    className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-lg transition flex items-center justify-center"
                                >
                                    {renderingStem === stemType ? <><Spinner /> Rendering...</> : 'Generate Audio'}
                                </button>
                                {stemUrls[stemType] && (
                                    <div className="space-y-3 pt-2">
                                        <audio controls src={stemUrls[stemType]} className="w-full"></audio>
                                        <a href={stemUrls[stemType]} download={`${stemType}.wav`} className="block w-full text-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg transition">
                                            Download .WAV
                                        </a>
                                    </div>
                                )}
                                <button onClick={() => handleDownloadMidi(stemType as any)} 
                                    disabled={(stemType === 'melody' && flatMelodyNotes.length === 0) || (stemType === 'drums' && !drumPattern)}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition disabled:bg-gray-500 disabled:cursor-not-allowed">
                                    Download .MID
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

          </main>
        </div>
      </div>
    );
};

export default App;
