import React from 'react';
import { CompressorSettings } from '../types';

interface CompressorProps {
    settings: CompressorSettings;
    onChange: (newSettings: Partial<CompressorSettings>) => void;
}

const Control: React.FC<{ label: string, value: number, unit: string, children: React.ReactNode }> = ({ label, value, unit, children }) => (
    <div className="flex flex-col items-center">
        {children}
        <div className="text-center mt-1">
            <div className="text-xs font-bold text-gray-300">{label}</div>
            <div className="text-xs text-gray-400">{value.toFixed(label === 'Ratio' ? 1 : 2)}{unit}</div>
        </div>
    </div>
);

export const Compressor: React.FC<CompressorProps> = ({ settings, onChange }) => {
    return (
        <div className="p-2 bg-black/20">
            <div className="grid grid-cols-2 gap-4">
                <Control label="Threshold" value={settings.threshold} unit=" dB">
                     <input
                        type="range" min={-100} max={0} step={0.1}
                        value={settings.threshold}
                        onChange={e => onChange({ threshold: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                </Control>
                 <Control label="Ratio" value={settings.ratio} unit=":1">
                     <input
                        type="range" min={1} max={20} step={0.1}
                        value={settings.ratio}
                        onChange={e => onChange({ ratio: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                </Control>
                 <Control label="Attack" value={settings.attack * 1000} unit=" ms">
                     <input
                        type="range" min={0} max={1} step={0.001}
                        value={settings.attack}
                        onChange={e => onChange({ attack: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                </Control>
                 <Control label="Release" value={settings.release * 1000} unit=" ms">
                     <input
                        type="range" min={0.01} max={1} step={0.001}
                        value={settings.release}
                        onChange={e => onChange({ release: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                </Control>
            </div>
        </div>
    );
};