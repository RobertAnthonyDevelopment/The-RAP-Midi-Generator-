import React, { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { SongSketchpad } from './components/SongSketchpad';
import { MidiChordGenerator } from './components/MidiChordGenerator';
import { DAW } from './components/DAW';
import { SongStructure, DAWProject, DAWTrack } from './types';
import { TICKS_PER_QUARTER_NOTE } from './constants';

type Tab = 'MIDI Generator' | 'Sketchpad' | 'DAW';

const initialDurationTicks = 64 * 4 * TICKS_PER_QUARTER_NOTE; // 64 bars

const initialDawProject: DAWProject = {
    bpm: 120,
    key: "C Major",
    timeSignature: "4/4",
    durationTicks: initialDurationTicks,
    loopRegion: {
        startTick: 0,
        endTick: 16 * 4 * TICKS_PER_QUARTER_NOTE, // Loop first 16 bars
        isEnabled: true,
    },
    tracks: [
        {
            id: 'track1', name: 'Melody Synth', trackType: 'midi', clips: [], volume: 1, pan: 0, isMuted: false, isSoloed: false, color: '#3b82f6', icon: '🎹',
            instrument: {
                type: 'synth',
                params: {
                    oscillator1: { type: 'sawtooth', detune: 0 },
                    oscillator2: { type: 'square', detune: -10 },
                    envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 },
                    filter: { type: 'lowpass', frequency: 5000, q: 1 }
                }
            },
            fx: { eq: { lowGain: 0, midGain: 0, highGain: 0 }, compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 5 } }
        },
        {
            id: 'track2', name: 'Drum Machine', trackType: 'midi', clips: [], volume: 1, pan: 0, isMuted: false, isSoloed: false, color: '#f97316', icon: '🥁',
            instrument: { type: 'sampler' },
            fx: { eq: { lowGain: 0, midGain: 0, highGain: 0 }, compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 5 } }
        },
        {
            id: 'track3', name: 'Vocal Recording', trackType: 'audio', clips: [], volume: 1, pan: 0, isMuted: false, isSoloed: false, color: '#14b8a6', icon: '🎤', isArmed: false,
            fx: { eq: { lowGain: 0, midGain: 0, highGain: 0 }, compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 5 } }
        }
    ]
};


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('DAW');
    const [project, setProject] = useState<DAWProject>(() => {
        try {
            const savedProject = localStorage.getItem('gemini-daw-project');
            if (savedProject) {
                // Note: AudioBuffers can't be serialized to JSON, so they will be lost.
                // A real app would use IndexedDB to store audio data.
                return JSON.parse(savedProject);
            }
        } catch (error) {
            console.error("Failed to load project from local storage", error);
        }
        return initialDawProject;
    });

    useEffect(() => {
        try {
            // A simplified persistence model. Ignores non-serializable data like AudioBuffers.
            const projectToSave = { ...project, tracks: project.tracks.map(t => ({...t, clips: []}))};
            localStorage.setItem('gemini-daw-project', JSON.stringify(projectToSave));
        } catch (error) {
            console.error("Failed to save project to local storage", error);
        }
    }, [project]);


    const handleExport = (song: SongStructure) => {
        console.log("Exporting song structure:", song);
        alert("Check the console for the exported song data! Integration with a real DAW would happen here.");
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'MIDI Generator':
                return <MidiChordGenerator />;
            case 'Sketchpad':
                return <SongSketchpad onExportToDAW={handleExport} />;
            case 'DAW':
                return <DAW initialProject={project} onProjectChange={setProject} />;
            default:
                return null;
        }
    }

    const TabButton: React.FC<{ tabName: Tab }> = ({ tabName }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 rounded-t-lg font-semibold transition ${activeTab === tabName ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800/50'}`}
        >
            {tabName}
        </button>
    );

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-700/50">
                <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <div className="flex items-center gap-4">
                        <Logo />
                        <h1 className="text-xl font-bold tracking-tight text-red-500">Gemini Music Studio</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://github.com/google-gemini/generative-ai-docs/tree/main/demos/music_maker" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white">
                            View on GitHub
                        </a>
                    </div>
                </nav>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="border-b border-gray-700/50 mb-6">
                    <div className="flex gap-2">
                        <TabButton tabName="DAW" />
                        <TabButton tabName="Sketchpad" />
                        <TabButton tabName="MIDI Generator" />
                    </div>
                </div>
                {renderContent()}
            </main>
        </div>
    );
};

export default App;