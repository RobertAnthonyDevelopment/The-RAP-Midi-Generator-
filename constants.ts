// FIX: Import type definitions from the refactored types.ts file to resolve circular dependencies.
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
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
};

export const MIDI_TO_NOTE: Record<number, Note> = {
    0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F', 6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B',
}

export const TICKS_PER_QUARTER_NOTE = 256;

export const NOTE_DURATIONS: Record<NoteDuration, number> = {
    'Quarter Note': TICKS_PER_QUARTER_NOTE,
    'Half Note': TICKS_PER_QUARTER_NOTE * 2,
    'Whole Note': TICKS_PER_QUARTER_NOTE * 4,
};

export const DRUM_MIDI_MAP = {
    KICK: 36, SNARE: 38, CLOSED_HAT: 42, OPEN_HAT: 46, CRASH: 49, RIDE: 51, TOM_HI: 50, TOM_MID: 47, TOM_LOW: 43,
} as const;

export const SCALES: Record<string, number[]> = {
    'C Major': [0, 2, 4, 5, 7, 9, 11],
    'C# Major': [1, 3, 5, 6, 8, 10, 0],
    'D Major': [2, 4, 6, 7, 9, 11, 1],
    'D# Major': [3, 5, 7, 8, 10, 0, 2],
    'E Major': [4, 6, 8, 9, 11, 1, 3],
    'F Major': [5, 7, 9, 10, 0, 2, 4],
    'F# Major': [6, 8, 10, 11, 1, 3, 5],
    'G Major': [7, 9, 11, 0, 2, 4, 6],
    'G# Major': [8, 10, 0, 1, 3, 5, 7],
    'A Major': [9, 11, 1, 2, 4, 6, 8],
    'A# Major': [10, 0, 2, 3, 5, 7, 9],
    'B Major': [11, 1, 3, 4, 6, 8, 10],
    'C Minor': [0, 2, 3, 5, 7, 8, 10],
    'C# Minor': [1, 3, 4, 6, 8, 9, 11],
    'D Minor': [2, 4, 5, 7, 9, 10, 0],
    'D# Minor': [3, 5, 6, 8, 10, 11, 1],
    'E Minor': [4, 6, 7, 9, 11, 0, 2],
    'F Minor': [5, 7, 8, 10, 0, 1, 3],
    'F# Minor': [6, 8, 9, 11, 1, 2, 4],
    'G Minor': [7, 9, 10, 0, 2, 3, 5],
    'G# Minor': [8, 10, 11, 1, 3, 4, 6],
    'A Minor': [9, 11, 0, 2, 4, 5, 7],
    'A# Minor': [10, 0, 1, 3, 5, 6, 8],
    'B Minor': [11, 1, 2, 4, 6, 7, 9],
};
