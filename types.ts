

// --- Music Theory ---
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

// --- Musical Data ---
export interface MelodyNote {
    midiNote: number;
    startTick: number;
    durationTicks: number;
    velocity: number; // 0.0 to 1.0
}

export interface DrumNote {
    midiNote: number;
    startTick: number;
    durationTicks: number;
}


// --- Song Structure ---
export interface SongPart {
    id: string;
    name: string;
    lengthBars: number;
    chords: Chord[];
    melody?: MelodyNote[];
    drums?: DrumNote[];
}

export interface SongStructure {
    key: string;
    bpm: number;
    parts: SongPart[];
}

// --- Synthesizer ---
export interface SynthOscillatorParams {
    type: 'sine' | 'square' | 'sawtooth' | 'triangle';
    detune: number; // in cents
}

export interface SynthEnvelopeParams {
    attack: number; // in seconds
    decay: number;  // in seconds
    sustain: number; // 0.0 to 1.0
    release: number; // in seconds
}

export interface SynthFilterParams {
    type: 'lowpass' | 'highpass' | 'bandpass';
    frequency: number; // in Hz
    q: number; // resonance
}

export interface SynthParams {
    oscillator1: SynthOscillatorParams;
    oscillator2: SynthOscillatorParams;
    envelope: SynthEnvelopeParams;
    filter: SynthFilterParams;
}

// --- DAW ---
export interface DAWProject {
    tracks: DAWTrack[];
    bpm: number;
    key: string;
    timeSignature: string;
    durationTicks: number;
    loopRegion: {
        startTick: number;
        endTick: number;
        isEnabled: boolean;
    };
}

export interface EQSettings {
    lowGain: number;
    midGain: number;
    highGain: number;
}

export interface CompressorSettings {
    threshold: number; // in dB
    ratio: number;
    attack: number; // in seconds
    release: number; // in seconds
    knee: number; // in dB
}

export interface AudioDAWClip {
    id: string;
    type: 'audio';
    name: string;
    audioBuffer: AudioBuffer;
    startTick: number;
    durationTicks: number;
    audioStartTime: number; // in seconds, offset into the buffer
}

export interface MIDIDAWClip {
    id:string;
    type: 'midi';
    name: string;
    notes: MelodyNote[];
    startTick: number;
    durationTicks: number;
    pattern?: { [key: number]: boolean[] }; // For step sequencer
    // FIX: Add optional velocity to MIDIDAWClip type
    velocity?: number;
}

export type DAWClip = AudioDAWClip | MIDIDAWClip;


export interface SamplerInstrument {
    type: 'sampler';
    sample?: {
        buffer: AudioBuffer;
        name: string;
    };
}

export interface SynthInstrument {
    type: 'synth';
    params: SynthParams;
}

export type DAWInstrument = SamplerInstrument | SynthInstrument;


export interface DAWTrack {
    id: string;
    name: string;
    trackType: 'audio' | 'midi';
    clips: DAWClip[];
    volume: number;
    pan: number;
    isMuted: boolean;
    isSoloed: boolean;
    color: string;
    icon: string;
    isArmed?: boolean;
    instrument?: DAWInstrument; // Optional: only for MIDI tracks
    fx: {
        eq: EQSettings;
        compressor: CompressorSettings;
    }
}