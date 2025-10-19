import React from 'react';
import { EQSettings } from '../types';

interface EQProps {
    settings: EQSettings;
    onChange: (newSettings: Partial<EQSettings>) => void;
}

const Knob: React.FC<{ label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void }> = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col items-center w-full">
        <label className="text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full"
        />
        <span className="text-xs mt-1 bg-black/30 px-1 rounded">{value.toFixed(1)} dB</span>
    </div>
);

// Simplified response function for visualization
const getResponse = (freq: number, settings: EQSettings) => {
    const lowFreq = 250;
    const midFreq = 1000;
    const highFreq = 4000;

    const s = (f) => Math.log2(f / 100); // Scale frequency for better plotting

    const lowShelf = settings.lowGain / (1 + Math.pow(freq / lowFreq, 2));
    const midPeak = settings.midGain * Math.exp(-Math.pow((s(freq) - s(midFreq)), 2) / (2 * 0.5 * 0.5));
    const highShelf = settings.highGain / (1 + Math.pow(highFreq / freq, 2));
    
    return lowShelf + midPeak + highShelf;
};


export const EQ: React.FC<EQProps> = ({ settings, onChange }) => {
    const width = 200;
    const height = 100;
    const minDb = -24;
    const maxDb = 24;

    const points: string[] = [];
    const numPoints = 50;
    for (let i = 0; i <= numPoints; i++) {
        const percent = i / numPoints;
        const freq = 20 * Math.pow(1000, percent); // Logarithmic scale from 20Hz to 20kHz
        const db = getResponse(freq, settings);
        
        const x = percent * width;
        const y = height - ((db - minDb) / (maxDb - minDb)) * height;
        points.push(`${x},${y}`);
    }
    const pathData = "M " + points.join(" L ");

    return (
        <div className="p-2 bg-black/20 space-y-2">
            <div className="bg-black/40 rounded-md p-2 relative h-28">
                 <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    {/* Grid */}
                    <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="#555" strokeWidth="0.5" />
                    <line x1={width * 0.25} y1={0} x2={width * 0.25} y2={height} stroke="#444" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1={width * 0.5} y1={0} x2={width * 0.5} y2={height} stroke="#444" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1={width * 0.75} y1={0} x2={width * 0.75} y2={height} stroke="#444" strokeWidth="0.5" strokeDasharray="2" />
                    
                    <path d={pathData} stroke="#ef4444" strokeWidth="2" fill="none" />
                </svg>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <Knob label="Low" value={settings.lowGain} min={-24} max={24} step={0.1} onChange={v => onChange({ lowGain: v })} />
                <Knob label="Mid" value={settings.midGain} min={-24} max={24} step={0.1} onChange={v => onChange({ midGain: v })} />
                <Knob label="High" value={settings.highGain} min={-24} max={24} step={0.1} onChange={v => onChange({ highGain: v })} />
            </div>
        </div>
    );
};