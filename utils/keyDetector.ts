import { Chord, Note } from '../types';
import { getMidiNotesForChord } from './chordUtils';
import { MIDI_TO_NOTE, SCALES, NOTE_TO_MIDI_BASE } from '../constants';

export const detectKey = (chords: Chord[]): string => {
    if (!chords || chords.length === 0) {
        return 'N/A';
    }

    const allMidiNotes = chords.flatMap(chord =>
        getMidiNotesForChord(chord.rootNote, chord.chordType, chord.octave)
    );
    const uniqueNoteNumbers = [...new Set(allMidiNotes.map(note => note % 12))];

    if(uniqueNoteNumbers.length === 0) {
        return 'N/A';
    }

    let bestMatch = { key: 'N/A', score: 0 };

    for (const [key, scaleNotes] of Object.entries(SCALES)) {
        let currentScore = 0;
        uniqueNoteNumbers.forEach(noteNumber => {
            if (scaleNotes.includes(noteNumber)) {
                currentScore++;
            }
        });

        // Give a bonus if the root of the first chord is the tonic of the scale
        const firstChordRootNumber = NOTE_TO_MIDI_BASE[chords[0].rootNote];
        if (firstChordRootNumber === scaleNotes[0]) {
            currentScore += 1.5; // Stronger bonus for tonic match
        }

        if (currentScore > bestMatch.score) {
            bestMatch = { key, score: currentScore };
        }
    }

    // A simple threshold to avoid guessing on very ambiguous progressions
    if (bestMatch.score < uniqueNoteNumbers.length * 0.7) {
        return 'Ambiguous';
    }

    return bestMatch.key;
};
