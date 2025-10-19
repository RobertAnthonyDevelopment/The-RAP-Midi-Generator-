// This utility generates a simple, single-track MIDI file for a sequence of chords.

const writeStringToBytes = (str: string) => str.split('').map(char => char.charCodeAt(0));

// Variable-length quantity encoding for delta-times
const writeVariableLength = (value: number): number[] => {
    let buffer = value & 0x7F;
    const bytes = [];
    while ((value >>= 7) > 0) {
        buffer <<= 8;
        buffer |= 0x80 | (value & 0x7F);
    }
    while (true) {
        bytes.push(buffer & 0xFF);
        if (buffer & 0x80) {
            buffer >>= 8;
        } else {
            break;
        }
    }
    // The bytes are generated in the correct big-endian order for MIDI.
    // The previous .reverse() call was incorrect and has been removed.
    return bytes;
};

const TICKS_PER_QUARTER_NOTE = 256;

export const generateMidi = (chords: number[][], ticksPerChord: number, bpm: number, velocity: number = 100): Blob => {
    // MThd chunk: Header
    const MThd = [
        ...writeStringToBytes('MThd'),
        0x00, 0x00, 0x00, 0x06, // Chunk length (always 6)
        0x00, 0x00,             // Format 0: single-track
        0x00, 0x01,             // Number of tracks: 1
        (TICKS_PER_QUARTER_NOTE >> 8) & 0xFF, TICKS_PER_QUARTER_NOTE & 0xFF
    ];

    // MTrk chunk: Track events
    let trackEvents: number[] = [];

    // Set Tempo Meta Event
    const microsecondsPerQuarter = Math.round(60000000 / bpm);
    trackEvents.push(0x00); // Delta-time 0
    trackEvents.push(0xFF, 0x51, 0x03); // Meta event, set tempo, length 3
    trackEvents.push((microsecondsPerQuarter >> 16) & 0xFF);
    trackEvents.push((microsecondsPerQuarter >> 8) & 0xFF);
    trackEvents.push(microsecondsPerQuarter & 0xFF);
    
    // This logic builds the track sequentially, ensuring correct timing.
    // For each chord, turn on its notes, wait for the duration, then turn them off.
    chords.forEach((notesOfChord) => {
        // TURN ON all notes for the current chord.
        // These events happen with a delta-time of 0 relative to the previous event
        // (which is the note-off of the last chord).
        notesOfChord.forEach(note => {
            trackEvents.push(0x00); // delta-time 0 from previous event
            trackEvents.push(0x90, note, velocity); // Note On event
        });
        
        // WAIT for the chord duration, then TURN OFF the notes.
        // We attach the delta-time for the duration to the *first* note-off event.
        // All subsequent notes in the same chord are turned off at the same time (delta-time 0).
        notesOfChord.forEach((note, noteIndex) => {
            const deltaTime = (noteIndex === 0) ? ticksPerChord : 0;
            trackEvents.push(...writeVariableLength(deltaTime));
            trackEvents.push(0x80, note, 0x00); // Note Off event
        });
    });

    // End of Track event
    trackEvents.push(0x01); // Delta-time of 1 tick before ending
    trackEvents.push(0xFF, 0x2F, 0x00); // End of Track meta event

    const trackLength = trackEvents.length;
    const MTrk = [
        ...writeStringToBytes('MTrk'),
        (trackLength >> 24) & 0xFF,
        (trackLength >> 16) & 0xFF,
        (trackLength >> 8) & 0xFF,
        trackLength & 0xFF,
        ...trackEvents
    ];

    const midiData = new Uint8Array([...MThd, ...MTrk]);
    return new Blob([midiData], { type: 'audio/midi' });
};