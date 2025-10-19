import React from 'react';
import { MelodyNote } from '../types';

interface MidiNoteVisualizerProps {
    notes: MelodyNote[];
    durationTicks: number;
    height: number;
}

const minMidi = 21; // A0
const maxMidi = 108; // C8
const midiRange = maxMidi - minMidi;

export const MidiNoteVisualizer: React.FC<MidiNoteVisualizerProps> = React.memo(({ notes, durationTicks, height }) => {
    if (!notes || notes.length === 0) {
        return null;
    }

    return (
        <div className="w-full h-full relative overflow-hidden pointer-events-none">
            {notes.map((note, i) => {
                const yPos = ((maxMidi - note.midiNote) / midiRange) * height;
                const noteHeight = height / midiRange;

                return (
                    <div
                        key={i}
                        className="absolute bg-white/70 rounded-sm"
                        style={{
                            left: `${(note.startTick / durationTicks) * 100}%`,
                            width: `${(note.durationTicks / durationTicks) * 100}%`,
                            top: `${yPos}px`,
                            height: `${Math.max(1, noteHeight)}px`,
                        }}
                    />
                );
            })}
        </div>
    );
});