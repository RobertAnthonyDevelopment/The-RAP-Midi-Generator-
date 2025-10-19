import React from 'react';

interface VirtualKeyboardProps {
    onNoteOn: (midiNote: number) => void;
    onNoteOff: (midiNote: number) => void;
}

const keys = [
    { note: 'C', midi: 60, type: 'white' },
    { note: 'C#', midi: 61, type: 'black' },
    { note: 'D', midi: 62, type: 'white' },
    { note: 'D#', midi: 63, type: 'black' },
    { note: 'E', midi: 64, type: 'white' },
    { note: 'F', midi: 65, type: 'white' },
    { note: 'F#', midi: 66, type: 'black' },
    { note: 'G', midi: 67, type: 'white' },
    { note: 'G#', midi: 68, type: 'black' },
    { note: 'A', midi: 69, type: 'white' },
    { note: 'A#', midi: 70, type: 'black' },
    { note: 'B', midi: 71, type: 'white' },
    { note: 'C', midi: 72, type: 'white' },
];

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onNoteOn, onNoteOff }) => {
    return (
        <div className="w-full h-24 bg-[#3c3c3c] flex-shrink-0 flex justify-center p-2 border-t border-black">
            <div className="relative h-full aspect-[14/3]">
                 {keys.filter(k => k.type === 'white').map((key, i) => (
                    <div
                        key={key.midi}
                        onMouseDown={() => onNoteOn(key.midi)}
                        onMouseUp={() => onNoteOff(key.midi)}
                        onMouseLeave={() => onNoteOff(key.midi)}
                        className="absolute h-full w-[12.5%] border border-gray-900 rounded-b bg-gray-200 active:bg-red-400"
                        style={{ left: `${i * 12.5}%` }}
                    ></div>
                ))}
                 {keys.filter(k => k.type === 'black').map((key) => {
                    const whiteKeyIndex = keys.filter(k => k.type === 'white').findIndex(wk => wk.midi === key.midi -1);
                    return (
                        <div
                            key={key.midi}
                            onMouseDown={(e) => {e.stopPropagation(); onNoteOn(key.midi)}}
                            onMouseUp={(e) => {e.stopPropagation(); onNoteOff(key.midi)}}
                            onMouseLeave={(e) => {e.stopPropagation(); onNoteOff(key.midi)}}
                            className="absolute h-1/2 w-[8%] border border-black rounded-b bg-black active:bg-red-500 z-10"
                            style={{ left: `${(whiteKeyIndex + 1) * 12.5 - 4}%` }}
                        ></div>
                    );
                 })}
            </div>
        </div>
    );
};