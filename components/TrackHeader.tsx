import React from 'react';
import { DAWTrack } from '../types';
import * as Icons from './Icons';

interface TrackHeaderProps {
    track: DAWTrack;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: (trackId: string) => void;
    updateTrack: (trackId: string, newSettings: Partial<DAWTrack>) => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = React.memo(({
    track,
    isSelected,
    onSelect,
    onDelete,
    updateTrack
}) => {
    
    const handleUpdate = (key: keyof DAWTrack, value: any) => {
        updateTrack(track.id, { [key]: value });
    };

    return (
        <div 
            className={`h-20 border-b border-black p-2 flex flex-col justify-between cursor-pointer ${isSelected ? 'bg-red-500/30' : 'hover:bg-gray-700/40'}`}
            onClick={onSelect}
            style={{backgroundColor: isSelected ? `${track.color}40` : undefined }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{backgroundColor: track.color}}>{track.icon}</span>
                    <span className="font-bold w-full truncate text-sm">{track.name}</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(track.id); }} 
                    className="text-gray-500 hover:text-red-500 opacity-50 hover:opacity-100"
                    title="Delete Track"
                >
                    <Icons.Trash />
                </button>
            </div>
            <div className="flex items-center gap-1 text-xs">
                {track.trackType === 'audio' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleUpdate('isArmed', !track.isArmed); }} 
                        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${track.isArmed ? 'bg-red-500 border-red-300' : 'bg-gray-800 border-gray-600'}`} 
                        title="Record Arm"
                    >
                        <Icons.RecordArm />
                    </button>
                )}
                <div className="flex-grow" />
                <button onClick={(e) => { e.stopPropagation(); handleUpdate('isMuted', !track.isMuted); }} className="w-6 h-6">
                    <Icons.Mute isActive={track.isMuted} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleUpdate('isSoloed', !track.isSoloed); }} className="w-6 h-6">
                    <Icons.Solo isActive={track.isSoloed} />
                </button>
            </div>
        </div>
    );
});