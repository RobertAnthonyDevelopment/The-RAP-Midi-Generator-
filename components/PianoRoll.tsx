import React, { useState, useRef, useEffect } from 'react';
import { MIDIDAWClip, MelodyNote } from '../types';
import { TICKS_PER_QUARTER_NOTE, MIDI_TO_NOTE } from '../constants';

interface PianoRollProps {
    clip: MIDIDAWClip;
    onSave: (updatedNotes: MelodyNote[]) => void;
    onClose: () => void;
}

const pixelsPerTick = 0.1;
const noteHeight = 22;
const numKeys = 88;
const startNote = 21; // A0
const velocityPaneHeight = 100;

const getVelocityColor = (velocity: number) => {
    // Green (low) -> Yellow -> Red (high)
    const hue = (1 - velocity) * 120;
    return `hsl(${hue}, 90%, 50%)`;
};

export const PianoRoll: React.FC<PianoRollProps> = ({ clip, onSave, onClose }) => {
    const [notes, setNotes] = useState<MelodyNote[]>(() => JSON.parse(JSON.stringify(clip.notes)));
    const [selectedNote, setSelectedNote] = useState<MelodyNote | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const keyRef = useRef<HTMLDivElement>(null);
    const velocityRef = useRef<HTMLDivElement>(null);

    const handleNoteClick = (note: MelodyNote) => {
        setSelectedNote(note);
    };

    const handleGridDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!gridRef.current) return;
        const rect = gridRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + gridRef.current.scrollLeft;
        const y = e.clientY - rect.top + gridRef.current.scrollTop;

        const startTick = Math.floor(x / pixelsPerTick / TICKS_PER_QUARTER_NOTE) * TICKS_PER_QUARTER_NOTE;
        const midiNote = startNote + numKeys - 1 - Math.floor(y / noteHeight);
        
        const newNote: MelodyNote = {
            startTick,
            durationTicks: TICKS_PER_QUARTER_NOTE,
            midiNote,
            velocity: 0.8 // Default velocity
        };
        setNotes(prev => [...prev, newNote]);
    };

    const updateNoteVelocity = (noteToUpdate: MelodyNote, newVelocity: number) => {
        setNotes(prev => prev.map(n => n === noteToUpdate ? { ...n, velocity: Math.max(0.01, Math.min(1, newVelocity)) } : n));
        setSelectedNote(prev => prev === noteToUpdate ? { ...prev, velocity: Math.max(0.01, Math.min(1, newVelocity)) } : prev);
    };
    
    // Sync scrolling
    useEffect(() => {
        const grid = gridRef.current;
        const keys = keyRef.current;
        const velocity = velocityRef.current;
        if (!grid || !keys || !velocity) return;

        const handleGridScroll = () => {
            keys.scrollTop = grid.scrollTop;
            velocity.scrollLeft = grid.scrollLeft;
        };
        const handleVelocityScroll = () => {
            grid.scrollLeft = velocity.scrollLeft;
        }

        grid.addEventListener('scroll', handleGridScroll);
        velocity.addEventListener('scroll', handleVelocityScroll);
        return () => {
            grid.removeEventListener('scroll', handleGridScroll);
            velocity.removeEventListener('scroll', handleVelocityScroll);
        }
    }, []);

    return (
        <div className="w-[80vw] h-[70vh] bg-[#282828] text-white flex flex-col rounded-lg overflow-hidden border border-black">
            <header className="p-3 bg-[#3c3c3c] flex justify-between items-center border-b border-black">
                <h2 className="text-xl font-bold">Piano Roll - {clip.name}</h2>
                <div>
                    <button onClick={() => onSave(notes)} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md mr-2">Save</button>
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-md">Close</button>
                </div>
            </header>
            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="flex-grow flex overflow-hidden">
                    {/* Keyboard */}
                    <div ref={keyRef} className="w-24 bg-[#3c3c3c] flex-shrink-0 overflow-y-hidden">
                        <div style={{height: numKeys * noteHeight}}>
                            {[...Array(numKeys)].map((_, i) => {
                                const keyIndex = numKeys - 1 - i;
                                const midi = startNote + keyIndex;
                                const noteName = MIDI_TO_NOTE[midi % 12];
                                const isBlackKey = ['C#', 'D#', 'F#', 'G#', 'A#'].includes(noteName);
                                return (
                                    <div key={midi} style={{ height: `${noteHeight}px` }} className={`border-b border-black text-xs flex items-center justify-center ${isBlackKey ? 'bg-gray-700' : 'bg-gray-200 text-black'}`}>
                                        {noteName}{(Math.floor(midi / 12) - 1)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Grid */}
                    <div ref={gridRef} className="flex-grow relative overflow-auto" onDoubleClick={handleGridDoubleClick}>
                        <div className="relative" style={{ width: clip.durationTicks * pixelsPerTick, height: numKeys * noteHeight }}>
                            {/* Grid Lines */}
                            {[...Array(Math.floor(clip.durationTicks / TICKS_PER_QUARTER_NOTE))].map((_, i) => (
                                <div key={i} className={`absolute top-0 bottom-0 border-l ${ (i % 4 === 0) ? 'border-gray-600' : 'border-gray-800'}`} style={{ left: i * TICKS_PER_QUARTER_NOTE * pixelsPerTick }}></div>
                            ))}
                            {[...Array(numKeys)].map((_, i) => {
                                const midi = startNote + (numKeys - 1 - i);
                                const isBlackKey = ['C#', 'D#', 'F#', 'G#', 'A#'].includes(MIDI_TO_NOTE[midi % 12]);
                                return <div key={i} className={`absolute left-0 right-0 border-b ${isBlackKey ? 'border-gray-700/50' : 'border-gray-800'}`} style={{ top: i * noteHeight }}></div>
                            })}

                            {/* Notes */}
                            {notes.map((note, index) => (
                                <div
                                    key={`${note.startTick}-${note.midiNote}-${index}`}
                                    className={`absolute border rounded cursor-pointer hover:opacity-80 ${selectedNote === note ? 'ring-2 ring-white' : ''}`}
                                    style={{
                                        left: note.startTick * pixelsPerTick,
                                        top: (numKeys - 1 - (note.midiNote - startNote)) * noteHeight,
                                        width: note.durationTicks * pixelsPerTick,
                                        height: noteHeight,
                                        backgroundColor: getVelocityColor(note.velocity),
                                        borderColor: `hsl(${(1 - note.velocity) * 120}, 90%, 30%)`,
                                    }}
                                    onClick={() => handleNoteClick(note)}
                                ></div>
                            ))}
                        </div>
                    </div>
                </div>
                 {/* Velocity Pane */}
                 <div className="h-28 bg-[#3c3c3c] border-t-2 border-black flex-shrink-0 flex">
                     <div className="w-24 flex-shrink-0 text-xs text-gray-400 p-2">Velocity</div>
                     <div ref={velocityRef} className="flex-grow relative overflow-x-auto">
                        <div className="relative h-full" style={{ width: clip.durationTicks * pixelsPerTick }}>
                             {notes.map((note, index) => (
                                <div
                                    key={index}
                                    className="absolute bottom-0 w-2 group cursor-ns-resize"
                                    style={{ left: note.startTick * pixelsPerTick }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        const startY = e.clientY;
                                        const startVelocity = note.velocity;
                                        const onMouseMove = (moveEvent: MouseEvent) => {
                                            const deltaY = startY - moveEvent.clientY;
                                            const newVelocity = startVelocity + deltaY / velocityPaneHeight;
                                            updateNoteVelocity(note, newVelocity);
                                        };
                                        const onMouseUp = () => {
                                            document.removeEventListener('mousemove', onMouseMove);
                                            document.removeEventListener('mouseup', onMouseUp);
                                        };
                                        document.addEventListener('mousemove', onMouseMove);
                                        document.addEventListener('mouseup', onMouseUp);
                                    }}
                                >
                                    <div className="w-full h-full relative">
                                        <div 
                                            className="absolute bottom-0 w-full"
                                            style={{ 
                                                height: `${note.velocity * 100}%`, 
                                                backgroundColor: getVelocityColor(note.velocity)
                                            }}
                                        />
                                        <div 
                                            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white opacity-0 group-hover:opacity-100"
                                            style={{ backgroundColor: getVelocityColor(note.velocity) }}
                                        />
                                    </div>
                                </div>
                             ))}
                        </div>
                     </div>
                 </div>
            </div>
        </div>
    );
};