import { MelodyNote } from '../types';

const writeStringToBytes = (str: string) => str.split('').map(char => char.charCodeAt(0));

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
    return bytes;
};

const TICKS_PER_QUARTER_NOTE = 256;

const createTrackChunk = (trackEvents: number[]): number[] => {
    const trackLength = trackEvents.length;
    return [
        ...writeStringToBytes('MTrk'),
        (trackLength >> 24) & 0xFF,
        (trackLength >> 16) & 0xFF,
        (trackLength >> 8) & 0xFF,
        trackLength & 0xFF,
        ...trackEvents
    ];
};

export const generateMidi = (
    chords: number[][], 
    ticksPerChord: number, 
    bpm: number, 
    melody: MelodyNote[] | null,
    velocity: number = 100
): Blob => {
    const numTracks = melody ? 2 : 1;
    
    // MThd chunk: Header
    const MThd = [
        ...writeStringToBytes('MThd'),
        0x00, 0x00, 0x00, 0x06, // Chunk length
        0x00, 0x01,             // Format 1: multi-track
        0x00, numTracks,        // Number of tracks
        (TICKS_PER_QUARTER_NOTE >> 8) & 0xFF, TICKS_PER_QUARTER_NOTE & 0xFF
    ];

    // Track 1: Chords & Tempo
    let chordTrackEvents: number[] = [];
    const microsecondsPerQuarter = Math.round(60000000 / bpm);
    chordTrackEvents.push(0x00); // Delta-time 0
    chordTrackEvents.push(0xFF, 0x51, 0x03); // Meta event, set tempo
    chordTrackEvents.push((microsecondsPerQuarter >> 16) & 0xFF);
    chordTrackEvents.push((microsecondsPerQuarter >> 8) & 0xFF);
    chordTrackEvents.push(microsecondsPerQuarter & 0xFF);
    
    chords.forEach((notesOfChord) => {
        notesOfChord.forEach(note => {
            chordTrackEvents.push(0x00);
            chordTrackEvents.push(0x90, note, velocity); // Note On (channel 0)
        });
        notesOfChord.forEach((note, noteIndex) => {
            const deltaTime = (noteIndex === 0) ? ticksPerChord : 0;
            chordTrackEvents.push(...writeVariableLength(deltaTime));
            chordTrackEvents.push(0x80, note, 0x00); // Note Off (channel 0)
        });
    });

    chordTrackEvents.push(0x01, 0xFF, 0x2F, 0x00); // End of Track
    const chordTrackChunk = createTrackChunk(chordTrackEvents);

    let allChunks = [...MThd, ...chordTrackChunk];

    // Track 2: Melody (if it exists)
    if (melody) {
        let melodyTrackEvents: number[] = [];
        const timedEvents: { tick: number; message: number[] }[] = [];

        melody.forEach(note => {
            timedEvents.push({
                tick: note.startTick,
                message: [0x91, note.midiNote, velocity + 10] // Note On (channel 1)
            });
            timedEvents.push({
                tick: note.startTick + note.durationTicks,
                message: [0x81, note.midiNote, 0x00] // Note Off (channel 1)
            });
        });

        timedEvents.sort((a, b) => a.tick - b.tick);

        let lastTick = 0;
        timedEvents.forEach(event => {
            const deltaTime = event.tick - lastTick;
            melodyTrackEvents.push(...writeVariableLength(deltaTime));
            melodyTrackEvents.push(...event.message);
            lastTick = event.tick;
        });

        melodyTrackEvents.push(0x01, 0xFF, 0x2F, 0x00); // End of Track
        const melodyTrackChunk = createTrackChunk(melodyTrackEvents);
        allChunks.push(...melodyTrackChunk);
    }
    
    const midiData = new Uint8Array(allChunks);
    return new Blob([midiData], { type: 'audio/midi' });
};
