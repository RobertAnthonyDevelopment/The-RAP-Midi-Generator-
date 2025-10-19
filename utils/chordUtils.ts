
import { Note, ChordType } from '../types';
import { NOTE_TO_MIDI_BASE, CHORD_TYPES, NOTES } from '../constants';

export const getMidiNotesForChord = (rootNote: Note, chordType: ChordType, octave: number): number[] => {
    const rootMidi = NOTE_TO_MIDI_BASE[rootNote] + (octave + 1) * 12;
    const formula = CHORD_TYPES[chordType];

    if (!formula) {
        throw new Error(`Unknown chord type: ${chordType}`);
    }

    return formula.intervals.map(interval => rootMidi + interval);
};
