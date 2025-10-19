import { DAWTrack, MelodyNote, MIDIDAWClip, SamplerInstrument, SynthInstrument } from '../types';
import { TICKS_PER_QUARTER_NOTE } from '../constants';

const ticksToSeconds = (ticks: number, bpm: number): number => {
    const secondsPerQuarter = 60 / bpm;
    const secondsPerTick = secondsPerQuarter / TICKS_PER_QUARTER_NOTE;
    return ticks * secondsPerTick;
};

interface Stoppable {
    stop: (when?: number) => void;
}

const scheduleSynthPlayback = (
    context: BaseAudioContext,
    destination: AudioNode,
    instrument: SynthInstrument,
    note: MelodyNote,
    when: number,
): Stoppable | null => {
    const params = instrument.params;
    const freq = 440 * Math.pow(2, (note.midiNote - 69) / 12);
    const durationSec = ticksToSeconds(note.durationTicks, 120); // BPM doesn't affect duration here, just relative ticks

    const gainNode = context.createGain();
    gainNode.connect(destination);
    gainNode.gain.setValueAtTime(0, when);
    gainNode.gain.linearRampToValueAtTime(note.velocity, when + params.envelope.attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, params.envelope.sustain * note.velocity), when + params.envelope.attack + params.envelope.decay);
    
    const releaseStart = when + durationSec - params.envelope.release;
    gainNode.gain.setValueAtTime(params.envelope.sustain * note.velocity, Math.max(when, releaseStart));
    gainNode.gain.linearRampToValueAtTime(0, when + durationSec);

    const filter = context.createBiquadFilter();
    filter.type = params.filter.type;
    filter.frequency.setValueAtTime(params.filter.frequency, when);
    filter.Q.setValueAtTime(params.filter.q, when);
    
    const osc1 = context.createOscillator();
    osc1.type = params.oscillator1.type;
    osc1.frequency.value = freq;
    osc1.detune.value = params.oscillator1.detune;
    
    const osc2 = context.createOscillator();
    osc2.type = params.oscillator2.type;
    osc2.frequency.value = freq;
    osc2.detune.value = params.oscillator2.detune;
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    
    osc1.start(when);
    osc2.start(when);
    osc1.stop(when + durationSec);
    osc2.stop(when + durationSec);

    return {
        // FIX: Update function signature to match the Stoppable interface for better type consistency.
        stop: (when?: number) => {
            const now = context.currentTime;
            const releaseTime = params.envelope.release;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
            osc1.stop(now + releaseTime + 0.1);
            osc2.stop(now + releaseTime + 0.1);
        }
    }
};


const scheduleSamplerPlayback = (
    context: BaseAudioContext,
    destination: AudioNode,
    instrument: SamplerInstrument,
    note: MelodyNote,
    when: number,
): Stoppable | null => {
    if (!instrument.sample?.buffer) return null;
    const source = context.createBufferSource();
    source.buffer = instrument.sample.buffer;
    source.connect(destination);
    source.start(when);
    return source;
};


export const scheduleNotePlayback = (
    context: BaseAudioContext,
    destination: AudioNode,
    bpm: number,
    track: DAWTrack,
    note: MelodyNote,
    when: number,
): Stoppable | null => {
    const { instrument } = track;
    if (!instrument) return null;

    if (instrument.type === 'synth') {
       return scheduleSynthPlayback(context, destination, instrument, note, when);
    } else if (instrument.type === 'sampler') {
       return scheduleSamplerPlayback(context, destination, instrument, note, when);
    }
    return null;
}

export const renderMidiTrackToBuffer = async (track: DAWTrack, clips: MIDIDAWClip[], bpm: number): Promise<AudioBuffer> => {
    if (track.trackType !== 'midi' || !track.instrument) throw new Error("Not a valid MIDI track for rendering.");
    
    const allNotes = clips.flatMap(clip => 
        clip.notes.map(note => ({ ...note, startTick: note.startTick + clip.startTick }))
    );

    if (allNotes.length === 0) throw new Error("No notes to render.");

    let maxTick = 0;
    allNotes.forEach(note => {
        const endTick = note.startTick + note.durationTicks;
        if (endTick > maxTick) maxTick = endTick;
    });

    // Add tail for synth release
    const totalDurationSeconds = ticksToSeconds(maxTick, bpm) + (track.instrument.type === 'synth' ? track.instrument.params.envelope.release + 1 : 1);

    const context = new OfflineAudioContext(2, Math.ceil(44100 * totalDurationSeconds), 44100);

    const gainNode = context.createGain();
    gainNode.gain.value = track.volume;
    const pannerNode = context.createStereoPanner();
    pannerNode.pan.value = track.pan;
    gainNode.connect(pannerNode);
    pannerNode.connect(context.destination);

    allNotes.forEach(note => {
        const startTime = ticksToSeconds(note.startTick, bpm);
        scheduleNotePlayback(context, gainNode, bpm, track, note, startTime);
    });

    return await context.startRendering();
};