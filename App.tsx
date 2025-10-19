import React, { useState, useCallback, useMemo } from 'react';
import { ChordSelector } from './components/ChordSelector';
import { ProgressionSuggester } from './components/ProgressionSuggester';
import { MelodyGenerator } from './components/MelodyGenerator';
import { Chord, Note, ChordType, NoteDuration, MelodyNote } from './types';
import { getMidiNotesForChord } from './utils/chordUtils';
import { generateMidi } from './utils/midiGenerator';
import { parseChordString } from './utils/chordParser';
import { NOTE_DURATIONS, CHORD_TYPES } from './constants';

const App: React.FC = () => {
    const [progressionString, setProgressionString] = useState<string>('C G Am F');
    const [rootNote, setRootNote] = useState<Note>('C');
    const [chordType, setChordType] = useState<ChordType>('Major');
    const [octave, setOctave] = useState<number>(4);
    const [bpm, setBpm] = useState<number>(120);
    const [noteDuration, setNoteDuration] = useState<NoteDuration>('Whole Note');
    const [melody, setMelody] = useState<MelodyNote[] | null>(null);

    const parsedChords = useMemo((): Chord[] => {
        return progressionString
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(chordStr => {
                const parsed = parseChordString(chordStr);
                if (!parsed) return null;

                const matchedTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === parsed.type.toLowerCase()) as ChordType | undefined;
                if (!matchedTypeKey) return null;
                
                return { rootNote: parsed.root, chordType: matchedTypeKey, octave: 4 };
            })
            .filter((c): c is Chord => c !== null);
    }, [progressionString]);

    const handleAddChord = useCallback(() => {
        let typeAbbreviation = chordType.replace('Major', '').replace('Dominant', '').replace(' 7th', '7');
        if (chordType === 'Minor') typeAbbreviation = 'm';
        if (chordType === 'Minor 7th') typeAbbreviation = 'm7';
        
        const newChordString = `${rootNote}${typeAbbreviation}`;
        setProgressionString(prev => `${prev.trim()} ${newChordString}`.trim());
    }, [rootNote, chordType]);

    const handleRemoveChord = useCallback((index: number) => {
        const chordsArray = progressionString.trim().split(/\s+/).filter(Boolean);
        chordsArray.splice(index, 1);
        setProgressionString(chordsArray.join(' '));
    }, [progressionString]);

    const handleUseProgression = useCallback((progression: string[]) => {
        setProgressionString(progression.join(' '));
        setMelody(null); // Clear melody when progression changes
    }, []);
    
    const handleProgressionChange = (value: string) => {
        setProgressionString(value);
        setMelody(null); // Clear melody when progression changes
    }

    const handleGenerateMidi = useCallback(() => {
        if (parsedChords.length === 0) {
            alert("Your progression is empty or contains invalid chords.");
            return;
        }

        try {
            const midiNotes = parsedChords.map(chord => getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave));
            const ticksPerChord = NOTE_DURATIONS[noteDuration];
            const midiBlob = generateMidi(midiNotes, ticksPerChord, bpm, melody);
            
            const url = URL.createObjectURL(midiBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ai-music-composition.mid';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Failed to generate MIDI file:", error);
            alert(`An error occurred while generating the MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [parsedChords, noteDuration, bpm, melody]);
    
    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans">
        <div className="container mx-auto p-4 md:p-8 max-w-3xl">
          <header className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
              AI Music Generator
            </h1>
            <p className="text-gray-400 mt-2">
              Craft beautiful chord progressions and melodies with Gemini.
            </p>
          </header>
  
          <main className="space-y-8">
            {/* Step 1: Your Progression */}
            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-4">
              <h2 className="text-2xl font-semibold text-gray-300">
                <span className="text-indigo-400 font-bold">Step 1:</span> Your Chord Progression
              </h2>
              <textarea
                value={progressionString}
                onChange={(e) => handleProgressionChange(e.target.value)}
                placeholder="Enter chords, e.g., C G Am F"
                className="w-full min-h-[6rem] bg-gray-900/70 border border-gray-600 rounded-lg p-3 text-lg font-mono tracking-wider text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              />
              <div className="min-h-[3rem] flex flex-wrap gap-3 items-center">
                  {parsedChords.length === 0 && progressionString.trim() !== '' ? (
                    <p className="text-yellow-500">Could not parse chords. Try standard notation like 'C', 'Gm', 'F#m7'.</p>
                  ) : (
                    parsedChords.map((chord, index) => (
                      <div key={index} className="relative group bg-gray-700 text-white py-2 px-4 rounded-lg font-mono text-center transition-all duration-200">
                        <span>{`${chord.rootNote}${chord.chordType.replace('Major', '').replace('Minor', 'm').replace('Dominant', '').replace(' 7th', '7').trim()}`}</span>
                        <button
                          onClick={() => handleRemoveChord(index)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove chord ${index + 1}`}
                        >
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>
            </div>

             {/* Step 2: Chord Tools */}
             <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-6">
                <h2 className="text-2xl font-semibold text-gray-300">
                    <span className="text-purple-400 font-bold">Step 2:</span> Chord Tools
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <h3 className="text-xl font-semibold mb-3 text-indigo-400">Add Manually</h3>
                         <ChordSelector
                            rootNote={rootNote}
                            setRootNote={setRootNote}
                            chordType={chordType}
                            setChordType={setChordType}
                            octave={octave}
                            setOctave={setOctave}
                            onAddChord={handleAddChord}
                        />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-3 text-purple-400">Get AI Suggestions</h3>
                        <ProgressionSuggester onUseProgression={handleUseProgression} />
                    </div>
                </div>
            </div>

            {/* Step 3: Generate Melody */}
            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-4">
                 <h2 className="text-2xl font-semibold text-gray-300">
                    <span className="text-teal-400 font-bold">Step 3:</span> Generate Melody
                </h2>
                <MelodyGenerator
                    chords={parsedChords}
                    bpm={bpm}
                    ticksPerChord={NOTE_DURATIONS[noteDuration]}
                    onMelodyGenerated={setMelody}
                />
                {melody && (
                     <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                        <p className="text-green-400">Melody generated and will be included in the export.</p>
                        <button 
                            onClick={() => setMelody(null)}
                            className="text-sm bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md transition"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>
  
            {/* Step 4: Export */}
            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-4">
              <h2 className="text-2xl font-semibold text-gray-300">
                <span className="text-green-400 font-bold">Step 4:</span> Export to MIDI
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="bpm" className="mb-1 block text-sm font-medium text-gray-400">BPM (Beats Per Minute)</label>
                  <input
                    type="number"
                    id="bpm"
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value))))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="note-duration" className="mb-1 block text-sm font-medium text-gray-400">Duration Per Chord</label>
                  <select
                    id="note-duration"
                    value={noteDuration}
                    onChange={(e) => setNoteDuration(e.target.value as NoteDuration)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-green-500 focus:outline-none transition"
                  >
                    {Object.keys(NOTE_DURATIONS).map((duration) => (
                      <option key={duration} value={duration}>{duration}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerateMidi}
                disabled={parsedChords.length === 0}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500"
              >
                Download .MID File
              </button>
            </div>
          </main>
        </div>
      </div>
    );
};

export default App;