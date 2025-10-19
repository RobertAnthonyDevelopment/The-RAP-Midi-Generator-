import { SynthParams } from '../types';

export const renderSynthFromParams = async (
    context: AudioContext,
    params: SynthParams
): Promise<AudioBuffer> => {
    const duration = params.envelope.attack + params.envelope.decay + params.envelope.release + 0.5; // Add buffer
    const offlineContext = new OfflineAudioContext(1, context.sampleRate * duration, context.sampleRate);
    
    const now = offlineContext.currentTime;

    // Oscillators
    const osc1 = offlineContext.createOscillator();
    osc1.type = params.oscillator1.type;
    osc1.detune.value = params.oscillator1.detune;

    const osc2 = offlineContext.createOscillator();
    osc2.type = params.oscillator2.type;
    osc2.detune.value = params.oscillator2.detune;

    // Filter
    const filter = offlineContext.createBiquadFilter();
    filter.type = params.filter.type;
    filter.frequency.value = params.filter.frequency;
    filter.Q.value = params.filter.q;

    // Gain for ADSR Envelope
    const gainNode = offlineContext.createGain();
    gainNode.gain.setValueAtTime(0, now);

    // Apply ADSR
    gainNode.gain.linearRampToValueAtTime(1.0, now + params.envelope.attack);
    gainNode.gain.exponentialRampToValueAtTime(params.envelope.sustain, now + params.envelope.attack + params.envelope.decay);

    // This is a simplified release. A note-off event would trigger the proper release.
    // For rendering a single sample, we'll hold sustain briefly then release.
    const holdTime = 0.5; // Let the sustain part play for a bit
    gainNode.gain.setValueAtTime(params.envelope.sustain, now + params.envelope.attack + params.envelope.decay + holdTime);
    gainNode.gain.linearRampToValueAtTime(0, now + params.envelope.attack + params.envelope.decay + holdTime + params.envelope.release);

    // Connect nodes: OSCs -> Filter -> Gain -> Destination
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(offlineContext.destination);

    // Start oscillators and stop them after duration
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);

    const renderedBuffer = await offlineContext.startRendering();
    return renderedBuffer;
};