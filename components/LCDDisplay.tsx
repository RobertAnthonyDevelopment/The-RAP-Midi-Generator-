import React, { useState, useEffect } from 'react';
import { TICKS_PER_QUARTER_NOTE, SCALES } from '../constants';

interface LCDDisplayProps {
    currentTimeInTicks: number;
    bpm: number;
    timeSignature: string;
    musicalKey: string;
    onBpmChange: (newBpm: number) => void;
    onKeyChange: (newKey: string) => void;
}

const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;
const ticksPerBeat = TICKS_PER_QUARTER_NOTE;

const formatTime = (totalTicks: number) => {
    const bar = Math.floor(totalTicks / ticksPerBar) + 1;
    const beat = Math.floor((totalTicks % ticksPerBar) / ticksPerBeat) + 1;
    const tick = Math.floor(totalTicks % ticksPerBeat);
    return `${String(bar).padStart(3, ' ')}.${String(beat)}.${String(tick).padStart(3, '0')}`;
};

const LCDSegment: React.FC<{label: string, value: string | number, className?: string}> = ({label, value, className}) => (
    <div className={`flex flex-col items-center justify-center px-3 ${className}`}>
        <span className="text-xs text-green-800 font-sans">{label}</span>
        <span className="text-2xl">{value}</span>
    </div>
);

const EditableBpmSegment: React.FC<{label: string, value: number, onCommit: (newValue: number) => void}> = ({label, value, onCommit}) => {
    const [internalValue, setInternalValue] = useState(value.toString());

    useEffect(() => {
        setInternalValue(value.toString());
    }, [value]);

    const handleBlur = () => {
        const numValue = parseFloat(internalValue);
        if (!isNaN(numValue) && numValue > 0) {
            onCommit(numValue);
        } else {
            setInternalValue(value.toString()); // revert
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            setInternalValue(value.toString());
            (e.target as HTMLInputElement).blur();
        }
    };
    
    return (
        <div className="flex flex-col items-center justify-center px-3">
            <label htmlFor="bpm-input" className="text-xs text-green-800 font-sans">{label}</label>
            <input
                id="bpm-input"
                type="number"
                value={internalValue}
                onChange={e => setInternalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="text-2xl bg-transparent text-center w-24 outline-none focus:ring-1 focus:ring-green-400 rounded"
            />
        </div>
    );
}

const KeySelectorSegment: React.FC<{label: string, value: string, onCommit: (newValue: string) => void}> = ({label, value, onCommit}) => {
    return (
        <div className="flex flex-col items-center justify-center px-3">
             <label htmlFor="key-select" className="text-xs text-green-800 font-sans">{label}</label>
             <select
                id="key-select"
                value={value}
                onChange={e => onCommit(e.target.value)}
                className="text-2xl bg-transparent text-center w-36 outline-none appearance-none focus:ring-1 focus:ring-green-400 rounded cursor-pointer"
             >
                {Object.keys(SCALES).map(scale => (
                    <option key={scale} value={scale} className="bg-[#1a2b1a] text-green-400 font-mono">
                        {scale}
                    </option>
                ))}
            </select>
        </div>
    )
}


export const LCDDisplay: React.FC<LCDDisplayProps> = ({ currentTimeInTicks, bpm, timeSignature, musicalKey, onBpmChange, onKeyChange }) => {
    return (
        <div className="flex-grow bg-[#1a2b1a] text-green-400 font-mono p-1 rounded-md border-2 border-black shadow-inner flex items-center justify-around">
            <LCDSegment label="Time" value={formatTime(currentTimeInTicks)} className="w-40" />
            <div className="w-px h-8 bg-black/50" />
            <EditableBpmSegment label="BPM" value={bpm} onCommit={onBpmChange} />
            <div className="w-px h-8 bg-black/50" />
            <KeySelectorSegment label="Key" value={musicalKey} onCommit={onKeyChange} />
            <div className="w-px h-8 bg-black/50" />
            <LCDSegment label="Time Sig" value={timeSignature} />
        </div>
    );
};