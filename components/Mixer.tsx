import React from 'react';
import { DAWTrack } from '../types';

interface MixerProps {
    tracks: DAWTrack[];
    updateTrack: (trackId: string, newSettings: Partial<DAWTrack>) => void;
}

const ChannelStrip: React.FC<{ track: DAWTrack, onUpdate: (id: string, newSettings: Partial<DAWTrack>) => void }> = ({ track, onUpdate }) => {
    return (
        <div className="flex flex-col items-center p-2 border-r border-black h-full w-24 bg-[#3c3c3c]">
            <div className="text-xs font-bold truncate w-full text-center mb-2 h-8">{track.name}</div>
            <div className="flex-grow flex items-center justify-center bg-black/30 rounded-md p-1">
                <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={track.volume}
                    onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
                    className="w-16 h-48"
                    // FIX: Cast 'bt-lr' to 'any' to satisfy TypeScript's CSSProperties type for writingMode.
                    // This value is required for vertical sliders in Firefox.
                    style={{ writingMode: 'bt-lr' as any }}
                />
            </div>
            <div className="w-full mt-2">
                 <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={track.pan}
                    onChange={(e) => onUpdate(track.id, { pan: parseFloat(e.target.value) })}
                    className="w-full"
                />
                <div className="text-center text-xs text-gray-400 mt-1">Pan</div>
            </div>
            <div className="flex gap-1 mt-2">
                 <button onClick={() => onUpdate(track.id, { isMuted: !track.isMuted })} className={`w-8 h-8 rounded text-xs ${track.isMuted ? 'bg-yellow-500 text-black' : 'bg-gray-600'}`}>M</button>
                 <button onClick={() => onUpdate(track.id, { isSoloed: !track.isSoloed })} className={`w-8 h-8 rounded text-xs ${track.isSoloed ? 'bg-blue-500 text-white' : 'bg-gray-600'}`}>S</button>
            </div>
        </div>
    );
}

export const Mixer: React.FC<MixerProps> = ({ tracks, updateTrack }) => {
    return (
        <div className="w-[80vw] h-[60vh] bg-[#282828] text-white flex flex-col rounded-lg overflow-hidden border border-black">
             <header className="p-3 bg-[#3c3c3c] border-b border-black">
                <h2 className="text-xl font-bold">Mixer</h2>
            </header>
            <div className="flex-grow flex overflow-x-auto">
                {tracks.map(track => (
                    <ChannelStrip key={track.id} track={track} onUpdate={updateTrack} />
                ))}
            </div>
        </div>
    );
};