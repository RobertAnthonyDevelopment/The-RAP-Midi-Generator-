import React, { useState, useCallback, useMemo } from 'react';
import { MelodyGenerator } from './MelodyGenerator';
import { Chord, MelodyNote, SongPart, DrumNote } from '../types';
import { generateMultiTrackMidi } from '../utils/midiGenerator';
import { parseChordString } from '../utils/chordParser';
import { renderChordStem, renderMelodyStem, renderDrumStem } from '../utils/audioGenerator';
import { Spinner } from './Spinner';
import { NOTE_DURATIONS, CHORD_TYPES } from '../constants';
import { generateSongStructure, generateDrumBeat, generateChordsForPart } from '../services/geminiService';
import { getMidiNotesForChord } from '../utils/chordUtils';
import { detectKey } from '../utils/keyDetector';

export const SongSketchpad: React.FC = () => {
    const [songParts, setSongParts] = useState<SongPart[]>([]);
    const [drumPattern, setDrumPattern] = useState<DrumNote[] | null>(null);
    const [bpm, setBpm] = useState<number>(120);
    
    const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
    const [isGeneratingDrums, setIsGeneratingDrums] = useState(false);
    const [regeneratingPartId, setRegeneratingPartId] = useState<string | null>(null);

    const [structurePrompt, setStructurePrompt] = useState('A melancholic pop song about rain');
    const [drumGenre, setDrumGenre] = useState('Hip Hop');

    const [renderingStem, setRenderingStem] = useState<string | null>(null);
    const [stemUrls, setStemUrls] = useState<{ [key: string]: string }>({});
    const [error, setError] = useState<string | null>(null);
    
    const ticksPerBar = useMemo(() => NOTE_DURATIONS['Whole Note'], []);
    const totalTicks = useMemo(() => songParts.reduce((total, part) => total + part.bars * ticksPerBar, 0), [songParts, ticksPerBar]);

    const handleGenerateStructure = useCallback(async () => {
        setIsGeneratingStructure(true);
        setError(null);
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
                        const matchedTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === parsed.type.toLowerCase()) as keyof typeof CHORD_TYPES | undefined;
                        if (!matchedTypeKey) return null;
                        return { rootNote: parsed.root, chordType: matchedTypeKey, octave: 4 };
                    })
                    .filter((c): c is Chord => c !== null);

                return {
                    id: crypto.randomUUID(),
                    name: part.name,
                    bars: part.bars,
                    chords: parsedChords,
                    melody: null,
                    key: detectKey(parsedChords),
                };
            });
            setSongParts(newParts);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to generate structure");
        } finally {
            setIsGeneratingStructure(false);
        }
    }, [structurePrompt]);

    const handleGenerateDrums = useCallback(async () => {
        if (totalTicks === 0) {
            setError("Please generate a song structure first.");
            return;
        }
        setIsGeneratingDrums(true);
        setError(null);
        setDrumPattern(null);
        setStemUrls(prev => ({...prev, drums: undefined}));
        try {
            const pattern = await generateDrumBeat(drumGenre, totalTicks, bpm);
            setDrumPattern(pattern);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to generate drums");
        } finally {
            setIsGeneratingDrums(false);
        }
    }, [drumGenre, totalTicks, bpm]);
    
    const handleRegenerateChords = useCallback(async (partId: string) => {
        const partToUpdate = songParts.find(p => p.id === partId);
        if (!partToUpdate) return;

        setRegeneratingPartId(partId);
        setError(null);

        try {
            const newChordStrings = await generateChordsForPart(
                `A new progression for the ${partToUpdate.name} section`, 
                partToUpdate.bars, 
                partToUpdate.key === 'N/A' || partToUpdate.key === 'Ambiguous' ? 'any key' : partToUpdate.key
            );
            const parsedChords = newChordStrings
                .map(chordStr => {
                    const parsed = parseChordString(chordStr);
                    if (!parsed) return null;
                    const matchedTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === parsed.type.toLowerCase()) as keyof typeof CHORD_TYPES | undefined;
                    if (!matchedTypeKey) return null;
                    return { rootNote: parsed.root, chordType: matchedTypeKey, octave: 4 };
                })
                .filter((c): c is Chord => c !== null);

            setSongParts(parts => parts.map(p => {
                if (p.id === partId) {
                    const updatedPart = { 
                        ...p, 
                        chords: parsedChords, 
                        melody: null, // Reset melody as chords changed
                        key: detectKey(parsedChords)
                    };
                    return updatedPart;
                }
                return p;
            }));
        } catch (e) {
            setError(e instanceof Error ? e.message : `Failed to regenerate chords for part.`);
        } finally {
            setRegeneratingPartId(null);
        }
    }, [songParts]);


    const handleSetMelodyForPart = (partId: string, melody: MelodyNote[]) => {
        setSongParts(parts => parts.map(p => p.id === partId ? { ...p, melody } : p));
        setStemUrls(prev => ({...prev, melody: undefined}));
    };

    const handleAddPart = () => {
        const newPart: SongPart = {
            id: crypto.randomUUID(),
            name: `New Part`,
            bars: 4,
            chords: [],
            melody: null,
            key: 'N/A'
        };
        setSongParts(prev => [...prev, newPart]);
    }

    const handleRemovePart = (partId: string) => {
        setSongParts(prev => prev.filter(p => p.id !== partId));
    }
    
    const { flatChordNotes, flatMelodyNotes } = useMemo(() => {
        let flatChords: MelodyNote[] = [];
        let flatMelody: MelodyNote[] = [];
        let currentTick = 0;

        songParts.forEach(part => {
            const partStartTick = currentTick;
            // Ensure chords match the bar count for accurate timing
            for(let i = 0; i < part.bars; i++) {
                const chord = part.chords[i % part.chords.length]; // Loop chords if not enough
                if(chord) {
                    const midiNotes = getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave);
                    midiNotes.forEach(note => {
                        flatChords.push({ midiNote: note, startTick: currentTick, durationTicks: ticksPerBar });
                    });
                }
                currentTick += ticksPerBar;
            }

            if (part.melody) {
                part.melody.forEach(note => {
                    flatMelody.push({ ...note, startTick: note.startTick + partStartTick });
                });
            }
        });
        return { flatChordNotes: flatChords, flatMelodyNotes: flatMelody };
    }, [songParts, ticksPerBar]);


    const handleGenerateStem = useCallback(async (stemType: 'chords' | 'melody' | 'drums') => {
        setRenderingStem(stemType);
        setError(null);
        setStemUrls(prev => ({...prev, [stemType]: undefined}));

        try {
            let stemBlob: Blob | null = null;
            if (stemType === 'chords' && flatChordNotes.length > 0) stemBlob = await renderChordStem(flatChordNotes, bpm);
            else if (stemType === 'melody' && flatMelodyNotes.length > 0) stemBlob = await renderMelodyStem(flatMelodyNotes, bpm);
            else if (stemType === 'drums' && drumPattern) stemBlob = await renderDrumStem(drumPattern, bpm);
            
            if(stemBlob) setStemUrls(prev => ({ ...prev, [stemType]: URL.createObjectURL(stemBlob) }));
            else throw new Error("No data to render.");
        } catch (e) {
            setError(e instanceof Error ? e.message : `Failed to render ${stemType} stem.`);
        } finally {
            setRenderingStem(null);
        }
    }, [flatChordNotes, flatMelodyNotes, drumPattern, bpm]);

    const handleDownloadMidi = (stemType: 'chords' | 'melody' | 'drums') => {
        let notes: (MelodyNote | DrumNote)[] = [];
        let channel = 0;
        let fileName = `${stemType}.mid`;

        if (stemType === 'chords') notes = flatChordNotes;
        if (stemType === 'melody') { notes = flatMelodyNotes; channel = 1; }
        if (stemType === 'drums') { notes = drumPattern || []; channel = 9; }
        
        if (notes.length === 0) return;

        const midiBlob = generateMultiTrackMidi({ bpm, tracks: [{ notes, channel }] });
        const url = URL.createObjectURL(midiBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
            <Section title="1: Generate Song Structure" color="red">
                <div className="flex gap-2">
                    <input type="text" value={structurePrompt} onChange={(e) => setStructurePrompt(e.target.value)} placeholder="e.g., A happy folk song about traveling" className="flex-grow bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-red-500 focus:outline-none transition"/>
                    <button onClick={handleGenerateStructure} disabled={isGeneratingStructure} className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105">
                        {isGeneratingStructure ? <Spinner /> : 'Generate'}
                    </button>
                </div>
            </Section>

            <Section title="2: Refine Structure & Add Instruments" color="red">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-gray-300">Song Structure</h3>
                        <button onClick={handleAddPart} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-lg text-sm transition">+ Add Part</button>
                    </div>
                    {songParts.map(part => (
                        <div key={part.id} className="p-4 bg-black/50 rounded-lg border border-gray-700/50 space-y-3">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <input type="text" value={part.name} onChange={(e) => setSongParts(parts => parts.map(p => p.id === part.id ? {...p, name: e.target.value} : p))} className="bg-transparent text-lg font-bold text-red-400 focus:outline-none focus:bg-gray-800 rounded px-1 -ml-1"/>
                                    <div className="text-xs text-gray-400 font-mono">Key: {part.key}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <label htmlFor={`bars-${part.id}`} className="text-xs text-gray-400">Bars:</label>
                                        <select
                                            id={`bars-${part.id}`}
                                            value={part.bars}
                                            onChange={(e) => setSongParts(parts => parts.map(p => p.id === part.id ? {...p, bars: parseInt(e.target.value), melody: null} : p))}
                                            className="bg-gray-800 border border-gray-700 rounded-md p-1 text-xs text-white focus:ring-1 focus:ring-red-500 focus:outline-none"
                                        >
                                            <option value="4">4</option>
                                            <option value="8">8</option>
                                            <option value="12">12</option>
                                            <option value="16">16</option>
                                        </select>
                                    </div>
                                    <button onClick={() => handleRemovePart(part.id)} className="text-gray-500 hover:text-red-500 text-xs font-bold transition">REMOVE</button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center min-h-[2.5rem]">
                                {part.chords.map((c, i) => <span key={i} className="bg-gray-700 text-white py-1 px-3 rounded-full font-mono text-sm">{`${c.rootNote}${c.chordType.replace('Major', '').replace('Minor', 'm').replace('Dominant', 'dom').replace(' 7th', '7').trim()}`}</span>)}
                                <button onClick={() => handleRegenerateChords(part.id)} disabled={regeneratingPartId === part.id} className="text-xs ml-auto text-red-400 hover:text-red-300 disabled:text-gray-500 font-semibold p-1 rounded transition">
                                  {regeneratingPartId === part.id ? <Spinner/> : 'Regenerate Chords'}
                                </button>
                            </div>
                            <MelodyGenerator chords={part.chords} bpm={bpm} ticksPerPart={part.bars * ticksPerBar} onMelodyGenerated={(melody) => handleSetMelodyForPart(part.id, melody)} detectedKey={part.key} />
                            {part.melody && <p className="text-green-400 text-xs mt-1">✓ Melody generated for this part.</p>}
                        </div>
                    ))}
                    {songParts.length === 0 && <p className="text-gray-500 text-center py-4">Generate a structure to begin editing.</p>}
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-700/50">
                    <h3 className="text-xl font-semibold text-gray-300">Drum Machine</h3>
                    <div className="flex gap-4 items-end">
                        <div className="flex-grow"><label htmlFor="drum-genre" className="block mb-1 text-sm font-medium text-gray-400">Genre</label><select id="drum-genre" value={drumGenre} onChange={e => setDrumGenre(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-red-500 focus:outline-none transition"><option>Hip Hop</option><option>Rock</option><option>Electronic</option><option>Pop</option><option>Funk</option></select></div>
                        <button onClick={handleGenerateDrums} disabled={isGeneratingDrums || songParts.length === 0} className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105">{isGeneratingDrums ? <Spinner/> : 'Generate Drum Beat'}</button>
                    </div>
                    {drumPattern && <p className="text-green-400 text-sm">✓ Drum pattern generated for the song.</p>}
                </div>
            </Section>

            <Section title="3: Export Stems" color="red">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div><label htmlFor="bpm" className="mb-1 block text-sm font-medium text-gray-400">BPM</label><input type="number" id="bpm" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value))))} className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-red-500 focus:outline-none" /></div>
                </div>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    {['chords', 'melody', 'drums'].map(stemType => (
                        <div key={stemType} className="space-y-3 p-4 bg-black/50 rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-200 capitalize">{stemType} Stem</h3>
                            <button onClick={() => handleGenerateStem(stemType as any)} disabled={renderingStem !== null || songParts.length === 0 || (stemType === 'melody' && flatMelodyNotes.length === 0) || (stemType === 'drums' && !drumPattern)} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-lg transition flex items-center justify-center">{renderingStem === stemType ? <><Spinner /> Rendering...</> : 'Generate Audio'}</button>
                            {stemUrls[stemType] && (<div className="space-y-3 pt-2"><audio controls src={stemUrls[stemType]} className="w-full h-10"></audio><a href={stemUrls[stemType]} download={`${stemType}.wav`} className="block w-full text-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg transition">Download .WAV</a></div>)}
                            <button onClick={() => handleDownloadMidi(stemType as any)} disabled={songParts.length === 0 || (stemType === 'melody' && flatMelodyNotes.length === 0) || (stemType === 'drums' && !drumPattern)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed">Download .MID</button>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
};

const Section: React.FC<{title: string; color: string; children: React.ReactNode}> = ({title, color, children}) => {
    const [step, ...rest] = title.split(':');
    return (
        <div className={`p-6 bg-gray-900/70 rounded-xl border border-gray-700/50 space-y-4`}>
            <h2 className="text-2xl font-semibold text-gray-300">
                <span className={`font-bold text-${color}-400`}>{step}:</span>{rest.join(':')}
            </h2>
            {children}
        </div>
    );
}