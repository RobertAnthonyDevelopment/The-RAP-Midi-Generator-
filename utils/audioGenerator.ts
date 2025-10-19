import { MelodyNote, DrumNote } from '../types';
import { TICKS_PER_QUARTER_NOTE, DRUM_MIDI_MAP } from '../constants';

// --- Helper Functions ---

const midiToFrequency = (midiNote: number): number => {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
};

const ticksToSeconds = (ticks: number, bpm: number): number => {
    const secondsPerQuarter = 60 / bpm;
    const secondsPerTick = secondsPerQuarter / TICKS_PER_QUARTER_NOTE;
    return ticks * secondsPerTick;
};

const bufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    let pos = 0;

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, pos, 'RIFF'); pos += 4;
    view.setUint32(pos, 36 + buffer.length * numOfChan * 2, true); pos += 4;
    writeString(view, pos, 'WAVE'); pos += 4;
    writeString(view, pos, 'fmt '); pos += 4;
    view.setUint32(pos, 16, true); pos += 4;
    view.setUint16(pos, 1, true); pos += 2;
    view.setUint16(pos, numOfChan, true); pos += 2;
    view.setUint32(pos, buffer.sampleRate, true); pos += 4;
    view.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4;
    view.setUint16(pos, numOfChan * 2, true); pos += 2;
    view.setUint16(pos, 16, true); pos += 2;
    writeString(view, pos, 'data'); pos += 4;
    view.setUint32(pos, buffer.length * numOfChan * 2, true); pos += 4;

    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    for (let i = 0; i < buffer.length; i++) {
        for (let j = 0; j < numOfChan; j++) {
            let sample = Math.max(-1, Math.min(1, channels[j][i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
    }
    return new Blob([view], { type: 'audio/wav' });
};


// --- Synth Node Creation ---

const createSynthNode = (context: BaseAudioContext, frequency: number, startTime: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.1);
};

// --- Drum Synthesis ---

const createKick = (context: BaseAudioContext, startTime: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);

    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(0.001, startTime + 0.15);
    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
    
    osc.start(startTime);
    osc.stop(startTime + 0.2);
};

const createSnare = (context: BaseAudioContext, startTime: number) => {
    const noise = context.createBufferSource();
    const bufferSize = context.sampleRate;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    
    const gain = context.createGain();
    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(context.destination);

    noise.start(startTime);
    noise.stop(startTime + 0.1);
};

const createHiHat = (context: BaseAudioContext, startTime: number, duration = 0.05) => {
    const noise = context.createBufferSource();
    const bufferSize = context.sampleRate;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 7000;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(context.destination);
    
    noise.start(startTime);
    noise.stop(startTime + duration);
};

// --- Stem Rendering Functions ---

const renderNotesToStem = async (notes: MelodyNote[], bpm: number, nodeCreator: typeof createSynthNode): Promise<Blob> => {
     if (notes.length === 0) throw new Error("No notes to render.");
    const lastNote = notes.reduce((prev, current) => (prev.startTick + prev.durationTicks > current.startTick + current.durationTicks) ? prev : current);
    const totalDurationSeconds = ticksToSeconds(lastNote.startTick + lastNote.durationTicks, bpm) + 0.2;
    const sampleRate = 44100;
    const context = new OfflineAudioContext(1, Math.ceil(sampleRate * totalDurationSeconds), sampleRate);

    notes.forEach(note => {
        const freq = midiToFrequency(note.midiNote);
        const startTime = ticksToSeconds(note.startTick, bpm);
        const duration = ticksToSeconds(note.durationTicks, bpm);
        nodeCreator(context, freq, startTime, duration);
    });

    const renderedBuffer = await context.startRendering();
    return bufferToWav(renderedBuffer);
}

export const renderChordStem = (chords: MelodyNote[], bpm: number) => renderNotesToStem(chords, bpm, createSynthNode);
export const renderMelodyStem = (melody: MelodyNote[], bpm: number) => renderNotesToStem(melody, bpm, createSynthNode);

export const renderDrumStem = async (
    drumPattern: DrumNote[],
    bpm: number
): Promise<Blob> => {
    if (drumPattern.length === 0) throw new Error("Drum pattern is empty.");

    const lastHit = drumPattern.reduce((prev, current) => (prev.startTick > current.startTick) ? prev : current);
    const totalDurationSeconds = ticksToSeconds(lastHit.startTick + lastHit.durationTicks, bpm) + 0.2;
    const sampleRate = 44100;
    const context = new OfflineAudioContext(1, Math.ceil(sampleRate * totalDurationSeconds), sampleRate);

    drumPattern.forEach(hit => {
        const startTime = ticksToSeconds(hit.startTick, bpm);
        switch (hit.midiNote) {
            case DRUM_MIDI_MAP.KICK:
                createKick(context, startTime);
                break;
            case DRUM_MIDI_MAP.SNARE:
                createSnare(context, startTime);
                break;
            case DRUM_MIDI_MAP.CLOSED_HAT:
                createHiHat(context, startTime, 0.05);
                break;
            case DRUM_MIDI_MAP.OPEN_HAT:
                createHiHat(context, startTime, 0.2);
                break;
            default:
                // For other drum sounds, use a short hi-hat as a placeholder
                createHiHat(context, startTime, 0.05);
                break;
        }
    });

    const renderedBuffer = await context.startRendering();
    return bufferToWav(renderedBuffer);
};
