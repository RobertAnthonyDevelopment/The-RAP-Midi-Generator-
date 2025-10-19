import React from 'react';
import { TICKS_PER_QUARTER_NOTE } from '../constants';

interface LCDDisplayProps {
    currentTimeInTicks: number;
    bpm: number;
    timeSignature: string;
    musicalKey: string;
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
)

export const LCDDisplay: React.FC<LCDDisplayProps> = ({ currentTimeInTicks, bpm, timeSignature, musicalKey }) => {
    return (
        <div className="flex-grow bg-[#1a2b1a] text-green-400 font-mono p-1 rounded-md border-2 border-black shadow-inner flex items-center justify-around">
            <LCDSegment label="Time" value={formatTime(currentTimeInTicks)} className="w-40" />
            <div className="w-px h-8 bg-black/50" />
            <LCDSegment label="BPM" value={bpm.toFixed(2)} />
            <div className="w-px h-8 bg-black/50" />
            <LCDSegment label="Key" value={musicalKey} />
            <div className="w-px h-8 bg-black/50" />
            <LCDSegment label="Time Sig" value={timeSignature} />
        </div>
    );
};