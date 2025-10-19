import { MelodyNote } from '../types';

export const patternToNotes = (
    pattern: { [midiNote: number]: boolean[] },
    steps: number,
    clipDurationTicks: number
): MelodyNote[] => {
    const notes: MelodyNote[] = [];
    const ticksPerStep = clipDurationTicks / steps;

    for (const midiNoteStr in pattern) {
        const midiNote = parseInt(midiNoteStr, 10);
        const sequence = pattern[midiNote];

        sequence.forEach((isActive, stepIndex) => {
            if (isActive) {
                // FIX: Add velocity to satisfy MelodyNote type
                notes.push({
                    midiNote,
                    startTick: stepIndex * ticksPerStep,
                    durationTicks: ticksPerStep, // Duration of one step
                    velocity: 0.8,
                });
            }
        });
    }

    return notes;
};