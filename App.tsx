import React, { useState } from 'react';
import { SongSketchpad } from './components/SongSketchpad';
import { ChordMelodyLab } from './components/ChordMelodyLab';
import { Logo } from './components/Logo';

type Tab = 'sketchpad' | 'lab';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('sketchpad');

    return (
        <div className="bg-black text-gray-200 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-6">
                    <div className="flex items-center gap-4">
                        <Logo />
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">AI Song Sketchpad</h1>
                            <p className="text-sm text-gray-400">Powered by Gemini & Robert Anthony Productions</p>
                        </div>
                    </div>
                    <nav className="flex items-center p-1 bg-gray-900 rounded-lg border border-gray-700/50">
                        <TabButton
                            label="AI Song Sketchpad"
                            isActive={activeTab === 'sketchpad'}
                            onClick={() => setActiveTab('sketchpad')}
                        />
                        <TabButton
                            label="Chord & Melody Lab"
                            isActive={activeTab === 'lab'}
                            onClick={() => setActiveTab('lab')}
                        />
                    </nav>
                </header>

                <main>
                    {activeTab === 'sketchpad' && <SongSketchpad />}
                    {activeTab === 'lab' && <ChordMelodyLab />}
                </main>

                <footer className="text-center mt-12 text-xs text-gray-600">
                    <p>&copy; {new Date().getFullYear()} Robert Anthony Productions. All Rights Reserved.</p>
                </footer>
            </div>
        </div>
    );
};

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
            isActive
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-300 hover:bg-gray-800/60'
        }`}
    >
        {label}
    </button>
);


export default App;
