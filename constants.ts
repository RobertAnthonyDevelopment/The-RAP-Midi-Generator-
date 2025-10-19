import { Note, ChordType, ChordFormula, NoteDuration } from './types';

export const NOTES: Note[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const CHORD_TYPES: Record<ChordType, ChordFormula> = {
    'Major': { name: 'Major', intervals: [0, 4, 7] },
    'Minor': { name: 'Minor', intervals: [0, 3, 7] },
    'Diminished': { name: 'Diminished', intervals: [0, 3, 6] },
    'Augmented': { name: 'Augmented', intervals: [0, 4, 8] },
    'Major 7th': { name: 'Major 7th', intervals: [0, 4, 7, 11] },
    'Minor 7th': { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
    'Dominant 7th': { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
};

// MIDI note numbers for octave 0
export const NOTE_TO_MIDI_BASE: Record<Note, number> = {
    'C': 0,
    'C#': 1,
    'D': 2,
    'D#': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'G': 7,
    'G#': 8,
    'A': 9,
    'A#': 10,
    'B': 11,
};

export const TICKS_PER_QUARTER_NOTE = 256;

export const NOTE_DURATIONS: Record<NoteDuration, number> = {
    'Quarter Note': TICKS_PER_QUARTER_NOTE,
    'Half Note': TICKS_PER_QUARTER_NOTE * 2,
    'Whole Note': TICKS_PER_QUARTER_NOTE * 4,
};
