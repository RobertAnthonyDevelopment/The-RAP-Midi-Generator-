import React, { useState } from 'react';
import { DAWTrack, DAWInstrument, SynthParams } from '../types';
import { EQ } from './EQ';
import { Compressor } from './Compressor';
import { SynthPanel } from './SynthPanel';
import { Modal } from './Modal';
import { AISynthGenerator } from './AISynthGenerator';
import * as Icons from './Icons';

interface InspectorProps {
    selectedTrack: DAWTrack | null;
    updateTrack: (trackId: string, newSettings: Partial<DAWTrack>) => void;
    onBounceTrack: (trackId: string) => void;
}

const trackIcons = ['🎵', '🎤', '🎸', '🎹', '🥁', '🎻', '🎷', '🎧'];
const trackColors = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'
];

export const Inspector: React.FC<InspectorProps> = ({ selectedTrack, updateTrack, onBounceTrack }) => {
    const [isAISynthOpen, setIsAISynthOpen] = useState(false);
    
    if (!selectedTrack) {
        return (
            <div className="w-72 bg-[#282828] border-l-2 border-black flex-shrink-0 p-4 text-gray-500">
                <p>Select a track to inspect its properties.</p>
            </div>
        );
    }
    
    // FIX: Cache instrument in a const to help TypeScript with type narrowing.
    const instrument = selectedTrack.instrument;

    const handleUpdate = (key: keyof DAWTrack, value: any) => {
        updateTrack(selectedTrack.id, { [key]: value });
    };

    const handleFXUpdate = (fxType: 'eq' | 'compressor', newSettings: any) => {
        updateTrack(selectedTrack.id, { 
            fx: {
                ...selectedTrack.fx,
                [fxType]: {
                    ...selectedTrack.fx[fxType],
                    ...newSettings
                }
            }
        });
    }
    
    const handleInstrumentUpdate = (newInstrument: DAWInstrument) => {
        updateTrack(selectedTrack.id, { instrument: newInstrument });
    }

    const handleLoadSample = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = async (e) => {
                if (e.target?.result instanceof ArrayBuffer) {
                    try {
                        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                        handleInstrumentUpdate({
                            type: 'sampler',
                            sample: { buffer: audioBuffer, name: file.name }
                        });
                    } catch (error) {
                        console.error("Error decoding audio file:", error);
                        alert("Failed to load audio file. Please choose a valid format.");
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const handleApplyAISynth = (audioBuffer: AudioBuffer, name: string) => {
        handleInstrumentUpdate({
            type: 'sampler',
            sample: { buffer: audioBuffer, name: name }
        });
        setIsAISynthOpen(false);
    };

    return (
        <div className="w-72 bg-[#282828] border-l-2 border-black flex-shrink-0 overflow-y-auto">
            {isAISynthOpen && (
                 <Modal onClose={() => setIsAISynthOpen(false)}>
                    <AISynthGenerator onApply={handleApplyAISynth} onClose={() => setIsAISynthOpen(false)} />
                 </Modal>
            )}

            <div className="p-4 border-b border-black/50 space-y-3 bg-[#3c3c3c]">
                <h3 className="text-lg font-bold">Inspector</h3>
                <input
                    type="text"
                    value={selectedTrack.name}
                    onChange={(e) => handleUpdate('name', e.target.value)}
                    className="w-full bg-gray-800/50 p-1.5 rounded-md border border-gray-600"
                />
            </div>
            
            {/* Instrument Section for MIDI tracks */}
            {selectedTrack.trackType === 'midi' && (
                <div className="p-2 space-y-2 border-b border-black/50">
                    <div className="flex justify-end">
                         <button 
                            onClick={() => onBounceTrack(selectedTrack!.id)}
                            className="text-xs flex items-center gap-1 bg-blue-800/50 hover:bg-blue-700/50 text-blue-300 font-semibold py-1 px-2 rounded-md"
                            title="Render this MIDI track to a new audio track"
                        >
                            <Icons.Export />
                            Bounce to Audio
                        </button>
                    </div>
                    {instrument && (
                         <details className="bg-gray-800/40 rounded" open>
                            <summary className="p-2 cursor-pointer font-semibold">Instrument</summary>
                            <div className="p-2 bg-black/20 space-y-3">
                                <select 
                                    value={instrument.type} 
                                    onChange={e => {
                                        const newType = e.target.value as 'sampler' | 'synth';
                                        if(newType === 'sampler') handleInstrumentUpdate({ type: 'sampler' });
                                        else handleInstrumentUpdate({ type: 'synth', params: {
                                            oscillator1: { type: 'sawtooth', detune: 0 },
                                            oscillator2: { type: 'square', detune: -10 },
                                            envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 },
                                            filter: { type: 'lowpass', frequency: 5000, q: 1 }
                                        } as SynthParams});
                                    }} 
                                    className="w-full bg-gray-700 p-1.5 rounded-md border border-gray-600"
                                >
                                    <option value="sampler">Sampler</option>
                                    <option value="synth">Synthesizer</option>
                                </select>
                                
                                {instrument.type === 'sampler' && (
                                    <div className="space-y-2 text-sm">
                                        <p className="p-2 bg-black/30 rounded truncate text-gray-300">
                                        Sample: {instrument.sample?.name || 'None Loaded'}
                                        </p>
                                        <div className="flex gap-2">
                                            <label className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg cursor-pointer">
                                                Load Sample
                                                <input type="file" accept="audio/*" className="hidden" onChange={handleLoadSample} />
                                            </label>
                                            <button onClick={() => setIsAISynthOpen(true)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg">AI Gen</button>
                                        </div>
                                    </div>
                                )}

                                {instrument.type === 'synth' && (
                                    <SynthPanel 
                                        params={instrument.params}
                                        onChange={newParams => handleInstrumentUpdate({
                                            type: 'synth',
                                            params: { ...instrument.params, ...newParams }
                                        })}
                                    />
                                )}
                            </div>
                        </details>
                    )}
                </div>
            )}


            {/* Inserts / FX */}
            <div className="p-2 space-y-2">
                <details className="bg-gray-800/40 rounded" open>
                    <summary className="p-2 cursor-pointer font-semibold">EQ</summary>
                    <EQ settings={selectedTrack.fx.eq} onChange={(newSettings) => handleFXUpdate('eq', newSettings)} />
                </details>
                <details className="bg-gray-800/40 rounded" open>
                    <summary className="p-2 cursor-pointer font-semibold">Compressor</summary>
                    <Compressor settings={selectedTrack.fx.compressor} onChange={(newSettings) => handleFXUpdate('compressor', newSettings)} />
                </details>
            </div>
        </div>
    );
};