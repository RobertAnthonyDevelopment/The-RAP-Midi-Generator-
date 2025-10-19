export type Note = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type ChordType = 'Major' | 'Minor' | 'Diminished' | 'Augmented' | 'Major 7th' | 'Minor 7th' | 'Dominant 7th';

export type NoteDuration = 'Quarter Note' | 'Half Note' | 'Whole Note';

export interface ChordFormula {
    name: string;
    intervals: number[];
}

export interface Chord {
    rootNote: Note;
    chordType: ChordType;
    octave: number;
}
