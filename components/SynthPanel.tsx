import React from 'react';
import { SynthParams, SynthOscillatorParams, SynthEnvelopeParams, SynthFilterParams } from '../types';

interface SynthPanelProps {
    params: SynthParams;
    onChange: (newParams: Partial<SynthParams>) => void;
}

const Control: React.FC<{ label: string, children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="text-xs text-gray-400">{label}</label>
        {children}
    </div>
);


export const SynthPanel: React.FC<SynthPanelProps> = ({ params, onChange }) => {

    const handleOscChange = (oscNum: 1 | 2, newOscParams: Partial<SynthOscillatorParams>) => {
        const key = `oscillator${oscNum}`;
        onChange({ [key]: { ...params[key], ...newOscParams } });
    };

    const handleFilterChange = (newFilterParams: Partial<SynthFilterParams>) => {
        onChange({ filter: { ...params.filter, ...newFilterParams } });
    };

    const handleEnvChange = (newEnvParams: Partial<SynthEnvelopeParams>) => {
        onChange({ envelope: { ...params.envelope, ...newEnvParams } });
    };

    return (
        <div className="space-y-4 text-sm">
            {/* Oscillators */}
            <div className="grid grid-cols-2 gap-3 p-2 bg-black/20 rounded">
                <div>
                    <h4 className="font-bold mb-1">OSC 1</h4>
                    <Control label="Shape">
                        <select value={params.oscillator1.type} onChange={e => handleOscChange(1, { type: e.target.value as any })} className="w-full bg-gray-800 p-1 rounded">
                            <option>sine</option><option>square</option><option>sawtooth</option><option>triangle</option>
                        </select>
                    </Control>
                     <Control label={`Detune: ${params.oscillator1.detune}c`}>
                        <input type="range" min={-100} max={100} value={params.oscillator1.detune} onChange={e => handleOscChange(1, { detune: parseInt(e.target.value) })} className="w-full" />
                    </Control>
                </div>
                 <div>
                    <h4 className="font-bold mb-1">OSC 2</h4>
                    <Control label="Shape">
                        <select value={params.oscillator2.type} onChange={e => handleOscChange(2, { type: e.target.value as any })} className="w-full bg-gray-800 p-1 rounded">
                            <option>sine</option><option>square</option><option>sawtooth</option><option>triangle</option>
                        </select>
                    </Control>
                     <Control label={`Detune: ${params.oscillator2.detune}c`}>
                        <input type="range" min={-100} max={100} value={params.oscillator2.detune} onChange={e => handleOscChange(2, { detune: parseInt(e.target.value) })} className="w-full" />
                    </Control>
                </div>
            </div>

            {/* Filter */}
             <div className="p-2 bg-black/20 rounded space-y-1">
                <h4 className="font-bold">Filter</h4>
                <div className="grid grid-cols-2 gap-3">
                    <Control label="Type">
                        <select value={params.filter.type} onChange={e => handleFilterChange({ type: e.target.value as any })} className="w-full bg-gray-800 p-1 rounded">
                            <option value="lowpass">Low Pass</option><option value="highpass">High Pass</option><option value="bandpass">Band Pass</option>
                        </select>
                    </Control>
                    <Control label={`Q: ${params.filter.q.toFixed(1)}`}>
                        <input type="range" min={0.1} max={20} step={0.1} value={params.filter.q} onChange={e => handleFilterChange({ q: parseFloat(e.target.value) })} className="w-full" />
                    </Control>
                </div>
                 <Control label={`Cutoff: ${params.filter.frequency} Hz`}>
                    <input type="range" min={20} max={20000} step={1} value={params.filter.frequency} onChange={e => handleFilterChange({ frequency: parseInt(e.target.value) })} className="w-full" />
                </Control>
            </div>

            {/* Envelope */}
             <div className="p-2 bg-black/20 rounded space-y-1">
                <h4 className="font-bold">Envelope (ADSR)</h4>
                <div className="grid grid-cols-2 gap-3">
                    <Control label={`A: ${params.envelope.attack.toFixed(2)}s`}>
                        <input type="range" min={0} max={2} step={0.01} value={params.envelope.attack} onChange={e => handleEnvChange({ attack: parseFloat(e.target.value) })} className="w-full" />
                    </Control>
                     <Control label={`D: ${params.envelope.decay.toFixed(2)}s`}>
                        <input type="range" min={0} max={2} step={0.01} value={params.envelope.decay} onChange={e => handleEnvChange({ decay: parseFloat(e.target.value) })} className="w-full" />
                    </Control>
                     <Control label={`S: ${params.envelope.sustain.toFixed(2)}`}>
                        <input type="range" min={0} max={1} step={0.01} value={params.envelope.sustain} onChange={e => handleEnvChange({ sustain: parseFloat(e.target.value) })} className="w-full" />
                    </Control>
                     <Control label={`R: ${params.envelope.release.toFixed(2)}s`}>
                        <input type="range" min={0} max={3} step={0.01} value={params.envelope.release} onChange={e => handleEnvChange({ release: parseFloat(e.target.value) })} className="w-full" />
                    </Control>
                </div>
            </div>
        </div>
    );
};