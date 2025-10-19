
import { NOTES, CHORD_TYPES } from '../constants';
import { Note, ChordType } from '../types';

export const parseChordString = (chordString: string): { root: Note; type: string } | null => {
    const trimmed = chordString.trim();

    // Find the longest matching note name (e.g., "C#" before "C")
    let rootNote: Note | null = null;
    if (NOTES.includes(trimmed.substring(0, 2) as Note)) {
        rootNote = trimmed.substring(0, 2) as Note;
    } else if (NOTES.includes(trimmed.substring(0, 1) as Note)) {
        rootNote = trimmed.substring(0, 1) as Note;
    }

    if (!rootNote) {
        return null;
    }

    let typeString = trimmed.substring(rootNote.length).trim();
    
    // Handle common abbreviations and naming conventions
    if (typeString.toLowerCase() === 'm' || typeString.toLowerCase() === 'min') {
        typeString = 'minor';
    } else if (typeString === '' || typeString.toLowerCase() === 'maj') {
        typeString = 'major';
    } else if (typeString.toLowerCase() === 'dim') {
        typeString = 'diminished';
    } else if (typeString.toLowerCase() === 'aug') {
        typeString = 'augmented';
    } else if (typeString === '7') {
        typeString = 'dominant 7th';
    } else if (typeString.toLowerCase() === 'maj7') {
        typeString = 'major 7th';
    } else if (typeString.toLowerCase() === 'min7' || typeString.toLowerCase() === 'm7') {
        typeString = 'minor 7th';
    }

    // Check if the parsed type exists in our constants
    const foundTypeKey = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === typeString.toLowerCase());

    if (!foundTypeKey) {
        // Fallback for types that might not have direct matches but are valid, like 'Major 7th'
        const directMatch = Object.keys(CHORD_TYPES).find(key => key.toLowerCase() === typeString.toLowerCase());
        if (!directMatch) {
            console.warn(`Could not find a direct match for chord type: "${typeString}"`);
            return { root: rootNote, type: typeString }; // Return with original type string if not found
        }
    }
    
    return { root: rootNote, type: typeString };
};
