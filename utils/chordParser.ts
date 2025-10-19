import { NOTES, CHORD_TYPES } from '../constants';
import { Note } from '../types';

const FLATS_TO_SHARPS: { [key: string]: Note } = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
};

export const parseChordString = (chordString: string): { root: Note; type: string } | null => {
    const trimmed = chordString.trim();
    if (!trimmed) {
        return null;
    }

    // Identify root note (e.g., "C#", "Ab", "F")
    let rootNoteString: string;
    if (trimmed.length > 1 && (trimmed[1] === '#' || trimmed[1] === 'b')) {
        rootNoteString = trimmed.substring(0, 2);
    } else {
        rootNoteString = trimmed.substring(0, 1);
    }

    // Convert flat to sharp if necessary and validate it's a known note in our system
    const rootNote: Note | undefined = FLATS_TO_SHARPS[rootNoteString] || (NOTES.includes(rootNoteString as Note) ? rootNoteString as Note : undefined);

    if (!rootNote) {
        // Not a valid root note we can handle
        return null;
    }

    let typeString = trimmed.substring(rootNoteString.length).trim();
    const lcType = typeString.toLowerCase();
    
    // Normalize common chord quality names and abbreviations
    if (lcType === 'm' || lcType === 'min' || lcType === 'minor') {
        typeString = 'minor';
    } else if (lcType === '' || lcType === 'maj' || lcType === 'major') {
        typeString = 'major';
    } else if (lcType === 'dim' || lcType === 'diminished') {
        typeString = 'diminished';
    } else if (lcType === 'aug' || lcType === 'augmented') {
        typeString = 'augmented';
    } else if (lcType === '7') {
        typeString = 'dominant 7th';
    } else if (lcType === 'maj7' || lcType === 'major 7th') {
        typeString = 'major 7th';
    } else if (lcType === 'm7' || lcType === 'min7' || lcType === 'minor 7th') {
        typeString = 'minor 7th';
    }

    // Check if the normalized type string corresponds to a known chord type
    const foundTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === typeString.toLowerCase());

    if (!foundTypeKey) {
        // If we can't identify the chord quality, we consider the chord invalid.
        console.warn(`Could not interpret chord: "${chordString}" (unrecognized type: "${typeString}")`);
        return null;
    }
    
    // Return the successfully parsed root and the normalized type string
    return { root: rootNote, type: typeString };
};
