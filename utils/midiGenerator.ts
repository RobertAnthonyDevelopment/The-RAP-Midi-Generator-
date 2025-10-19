import { MelodyNote, DrumNote } from '../types';

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

interface MidiTrack {
    notes: (MelodyNote | DrumNote)[];
    channel: number;
    velocity?: number;
}

interface MidiOptions {
    bpm: number;
    tracks: MidiTrack[];
}

export const generateMultiTrackMidi = (options: MidiOptions): Blob => {
    const { bpm, tracks } = options;
    const numTracks = tracks.length + 1; // +1 for tempo track

    // MThd chunk: Header
    const MThd = [
        ...writeStringToBytes('MThd'),
        0x00, 0x00, 0x00, 0x06, // Chunk length
        0x00, 0x01,             // Format 1: multi-track
        (numTracks >> 8) & 0xFF, numTracks & 0xFF,
        (TICKS_PER_QUARTER_NOTE >> 8) & 0xFF, TICKS_PER_QUARTER_NOTE & 0xFF
    ];

    // Track 0: Tempo Track
    let tempoTrackEvents: number[] = [];
    const microsecondsPerQuarter = Math.round(60000000 / bpm);
    tempoTrackEvents.push(0x00, 0xFF, 0x51, 0x03); // Delta 0, Set Tempo
    tempoTrackEvents.push((microsecondsPerQuarter >> 16) & 0xFF);
    tempoTrackEvents.push((microsecondsPerQuarter >> 8) & 0xFF);
    tempoTrackEvents.push(microsecondsPerQuarter & 0xFF);
    tempoTrackEvents.push(0x01, 0xFF, 0x2F, 0x00); // End of Track
    const tempoTrackChunk = createTrackChunk(tempoTrackEvents);

    let allChunks = [...MThd, ...tempoTrackChunk];

    // Data Tracks
    tracks.forEach(track => {
        let trackEvents: number[] = [];
        const timedEvents: { tick: number; message: number[] }[] = [];
        const velocity = track.velocity || 100;
        const noteOn = 0x90 + track.channel;
        const noteOff = 0x80 + track.channel;

        track.notes.forEach(note => {
            timedEvents.push({
                tick: note.startTick,
                message: [noteOn, note.midiNote, velocity]
            });
            timedEvents.push({
                tick: note.startTick + note.durationTicks,
                message: [noteOff, note.midiNote, 0x00]
            });
        });

        timedEvents.sort((a, b) => a.tick - b.tick);

        let lastTick = 0;
        timedEvents.forEach(event => {
            const deltaTime = event.tick - lastTick;
            trackEvents.push(...writeVariableLength(deltaTime));
            trackEvents.push(...event.message);
            lastTick = event.tick;
        });

        trackEvents.push(0x01, 0xFF, 0x2F, 0x00); // End of Track
        const trackChunk = createTrackChunk(trackEvents);
        allChunks.push(...trackChunk);
    });
    
    const midiData = new Uint8Array(allChunks);
    return new Blob([midiData], { type: 'audio/midi' });
};
