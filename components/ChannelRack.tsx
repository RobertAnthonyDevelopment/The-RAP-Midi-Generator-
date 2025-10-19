import React, { useState } from 'react';
import { MIDIDAWClip } from '../types';
import { MIDI_TO_NOTE } from '../constants';

interface ChannelRackProps {
    clip: MIDIDAWClip;
    onSave: (clipId: string, newPattern: { [key: number]: boolean[] }) => void;
    onClose: () => void;
}

const numSteps = 16;
const numKeys = 24; // Show 2 octaves
const startNote = 48; // C3

export const ChannelRack: React.FC<ChannelRackProps> = ({ clip, onSave, onClose }) => {
    const [pattern, setPattern] = useState<{ [key: number]: boolean[] }>(() => {
        // Initialize pattern from clip or create a new empty one
        return clip.pattern || {};
    });

    const toggleStep = (midiNote: number, step: number) => {
        setPattern(prev => {
            const newPattern = { ...prev };
            if (!newPattern[midiNote]) {
                newPattern[midiNote] = Array(numSteps).fill(false);
            }
            newPattern[midiNote][step] = !newPattern[midiNote][step];
            return newPattern;
        });
    };
    
    const handleSave = () => {
        onSave(clip.id, pattern);
        onClose();
    };

    return (
        <div className="w-[80vw] h-[70vh] bg-[#282828] text-white flex flex-col rounded-lg overflow-hidden border border-black">
            <header className="p-3 bg-[#3c3c3c] flex justify-between items-center border-b border-black">
                <h2 className="text-xl font-bold">Channel Rack - {clip.name}</h2>
                <div>
                    <button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md mr-2">Apply & Close</button>
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-md">Cancel</button>
                </div>
            </header>
            <div className="flex-grow flex overflow-hidden">
                {/* Keyboard / Note Labels */}
                <div className="w-24 bg-[#3c3c3c] flex-shrink-0 overflow-y-auto">
                    {[...Array(numKeys)].map((_, i) => {
                         const keyIndex = numKeys - 1 - i;
                        const midi = startNote + keyIndex;
                        const noteName = MIDI_TO_NOTE[midi % 12];
                        const isBlackKey = ['C#', 'D#', 'F#', 'G#', 'A#'].includes(noteName);
                        return (
                             <div key={midi} className={`h-8 border-b border-black text-xs flex items-center justify-center ${isBlackKey ? 'bg-gray-700' : 'bg-gray-200 text-black'}`}>
                                {noteName}{(Math.floor(midi / 12) - 1)}
                            </div>
                        );
                    })}
                </div>
                 {/* Grid */}
                 <div className="flex-grow relative overflow-auto">
                     <div className="grid" style={{gridTemplateColumns: `repeat(${numSteps}, 1fr)`}}>
                         {[...Array(numKeys)].map((_, i) => {
                             const keyIndex = numKeys - 1 - i;
                             const midiNote = startNote + keyIndex;
                             return (
                                <React.Fragment key={midiNote}>
                                     {[...Array(numSteps)].map((_, step) => (
                                        <div 
                                            key={step} 
                                            className={`h-8 border-b border-r border-black/50 cursor-pointer 
                                                ${(step % 4 === 0) ? 'bg-gray-900/50' : ''}
                                                ${pattern[midiNote]?.[step] ? 'bg-red-500' : ''}
                                                hover:bg-gray-600`}
                                            onClick={() => toggleStep(midiNote, step)}
                                        ></div>
                                    ))}
                                </React.Fragment>
                             );
                         })}
                     </div>
                 </div>
            </div>
        </div>
    );
};