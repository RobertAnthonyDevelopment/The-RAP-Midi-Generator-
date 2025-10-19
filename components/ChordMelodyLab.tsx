import React, { useState, useCallback, useMemo } from 'react';
import { ProgressionSuggester } from './ProgressionSuggester';
import { MelodyGenerator } from './MelodyGenerator';
import { Chord, MelodyNote } from '../types';
import { generateMultiTrackMidi } from '../utils/midiGenerator';
import { parseChordString } from '../utils/chordParser';
import { renderChordStem, renderMelodyStem } from '../utils/audioGenerator';
import { CHORD_TYPES, NOTE_DURATIONS } from '../constants';
import { getMidiNotesForChord } from '../utils/chordUtils';
import { detectKey } from '../utils/keyDetector';
import { Spinner } from './Spinner';

export const ChordMelodyLab: React.FC = () => {
    const [labChords, setLabChords] = useState<Chord[]>([]);
    const [labMelody, setLabMelody] = useState<MelodyNote[] | null>(null);
    const [bpm, setBpm] = useState<number>(120);

    const [renderingStem, setRenderingStem] = useState<string | null>(null);
    const [stemUrls, setStemUrls] = useState<{ [key: string]: string }>({});
    const [error, setError] = useState<string | null>(null);

    const detectedKey = useMemo(() => detectKey(labChords), [labChords]);
    const ticksPerChord = useMemo(() => NOTE_DURATIONS['Whole Note'], []);

    const handleUseProgression = (progression: string[]) => {
        const parsedChords = progression
            .map(chordStr => {
                const parsed = parseChordString(chordStr);
                if (!parsed) return null;
                const matchedTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === parsed.type.toLowerCase()) as keyof typeof CHORD_TYPES | undefined;
                if (!matchedTypeKey) return null;
                return { rootNote: parsed.root, chordType: matchedTypeKey, octave: 4 };
            })
            .filter((c): c is Chord => c !== null);
        setLabChords(parsedChords);
        setLabMelody(null); // Reset melody when chords change
        setStemUrls({}); // Reset audio
    };

    const flatChordNotes = useMemo(() => {
        let notes: MelodyNote[] = [];
        let currentTick = 0;
        labChords.forEach(chord => {
            const midiNotes = getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave);
            midiNotes.forEach(note => {
                notes.push({ midiNote: note, startTick: currentTick, durationTicks: ticksPerChord });
            });
            currentTick += ticksPerChord;
        });
        return notes;
    }, [labChords, ticksPerChord]);


    const handleGenerateStem = useCallback(async (stemType: 'chords' | 'melody') => {
        setRenderingStem(stemType);
        setError(null);
        setStemUrls(prev => ({ ...prev, [stemType]: undefined }));

        try {
            let stemBlob: Blob | null = null;
            if (stemType === 'chords' && flatChordNotes.length > 0) {
                stemBlob = await renderChordStem(flatChordNotes, bpm);
            } else if (stemType === 'melody' && labMelody && labMelody.length > 0) {
                stemBlob = await renderMelodyStem(labMelody, bpm);
            }

            if (stemBlob) {
                setStemUrls(prev => ({ ...prev, [stemType]: URL.createObjectURL(stemBlob) }));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : `Failed to render ${stemType} stem.`);
        } finally {
            setRenderingStem(null);
        }
    }, [flatChordNotes, labMelody, bpm]);

    const handleDownloadMidi = (stemType: 'chords' | 'melody') => {
        let notes: MelodyNote[] = [];
        let channel = 0;

        if (stemType === 'chords') notes = flatChordNotes;
        if (stemType === 'melody') { notes = labMelody || []; channel = 1; }

        if (notes.length === 0) return;

        const midiBlob = generateMultiTrackMidi({ bpm, tracks: [{ notes, channel }] });
        const url = URL.createObjectURL(midiBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab_${stemType}.mid`;
        a.click();
        URL.revokeObjectURL(url);
    };


    return (
        <div className="space-y-8">
            <Section title="1. Generate a Chord Progression">
                <ProgressionSuggester onUseProgression={handleUseProgression} />
            </Section>

            {labChords.length > 0 && (
                <>
                    <Section title="2. Generate a Melody">
                        <div className="p-4 bg-black/50 rounded-lg border border-gray-700/50 space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-lg text-red-400">Chord Progression</h4>
                                <div className="text-sm text-gray-400 font-mono">Key: {detectedKey}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {labChords.map((c, i) => <span key={i} className="bg-gray-700 text-white py-1 px-3 rounded-full font-mono text-sm">{`${c.rootNote}${c.chordType.replace('Major', '').replace('Minor', 'm').trim()}`}</span>)}
                            </div>
                            <MelodyGenerator
                                chords={labChords}
                                bpm={bpm}
                                ticksPerPart={labChords.length * ticksPerChord}
                                onMelodyGenerated={setLabMelody}
                                detectedKey={detectedKey}
                            />
                            {labMelody && <p className="text-green-400 text-sm">✓ Melody generated.</p>}
                        </div>
                    </Section>

                    <Section title="3. Export Audio & MIDI">
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            {['chords', 'melody'].map(stemType => (
                                <div key={stemType} className="space-y-3 p-4 bg-black/50 rounded-lg">
                                    <h3 className="font-semibold text-lg text-gray-200 capitalize">{stemType}</h3>
                                    <button onClick={() => handleGenerateStem(stemType as any)} disabled={renderingStem !== null || (stemType === 'melody' && !labMelody)} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-lg transition flex items-center justify-center">{renderingStem === stemType ? <><Spinner /> Rendering...</> : 'Generate Audio'}</button>
                                    {stemUrls[stemType] && (<div className="space-y-3 pt-2"><audio controls src={stemUrls[stemType]} className="w-full h-10"></audio><a href={stemUrls[stemType]} download={`lab_${stemType}.wav`} className="block w-full text-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg transition">Download .WAV</a></div>)}
                                    <button onClick={() => handleDownloadMidi(stemType as any)} disabled={(stemType === 'melody' && !labMelody)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed">Download .MID</button>
                                </div>
                            ))}
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
};

const Section: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
    <div className="p-6 bg-gray-900/70 rounded-xl border border-gray-700/50 space-y-4">
        <h2 className="text-2xl font-semibold text-gray-300">{title}</h2>
        {children}
    </div>
);
