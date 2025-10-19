import React, { useState } from 'react';
import { TICKS_PER_QUARTER_NOTE } from '../constants';

interface TimelineRulerProps {
    durationTicks: number;
    pixelsPerTick: number;
    scrollLeft: number;
    loopRegion: { startTick: number, endTick: number, isEnabled: boolean };
    onLoopRegionChange: (newRegion: { startTick: number, endTick: number, isEnabled: boolean }) => void;
}

const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;

export const TimelineRuler: React.FC<TimelineRulerProps> = React.memo(({ durationTicks, pixelsPerTick, scrollLeft, loopRegion, onLoopRegionChange }) => {
    const [dragging, setDragging] = useState<'start' | 'end' | 'bar' | null>(null);
    const totalWidth = durationTicks * pixelsPerTick;

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, part: 'start' | 'end' | 'bar') => {
        e.preventDefault();
        setDragging(part);
        const startX = e.clientX;
        const initialStart = loopRegion.startTick;
        const initialEnd = loopRegion.endTick;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaTicks = deltaX / pixelsPerTick;
            
            let newStart = initialStart;
            let newEnd = initialEnd;

            if (part === 'start') {
                newStart = Math.max(0, initialStart + deltaTicks);
                if (newStart >= newEnd) newStart = newEnd - TICKS_PER_QUARTER_NOTE;
            } else if (part === 'end') {
                newEnd = Math.min(durationTicks, initialEnd + deltaTicks);
                if (newEnd <= newStart) newEnd = newStart + TICKS_PER_QUARTER_NOTE;
            } else { // 'bar'
                const duration = initialEnd - initialStart;
                newStart = Math.max(0, initialStart + deltaTicks);
                newEnd = newStart + duration;
                if(newEnd > durationTicks) {
                    newEnd = durationTicks;
                    newStart = newEnd - duration;
                }
            }

            onLoopRegionChange({ ...loopRegion, startTick: newStart, endTick: newEnd });
        };

        const onMouseUp = () => {
            setDragging(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };


    const numBars = Math.ceil(durationTicks / ticksPerBar);
    const barMarkers = [];
    for (let i = 0; i <= numBars; i++) {
        const xPos = i * ticksPerBar * pixelsPerTick;
        barMarkers.push(
            <div key={`bar-${i}`} className="absolute top-0 h-full" style={{ left: xPos }}>
                <div className="w-px h-full bg-gray-600"></div>
                <span className="absolute top-0 left-1 text-xs text-gray-400">{i + 1}</span>
            </div>
        );
        for (let j = 1; j < 4; j++) {
             const beatXPos = (i * ticksPerBar + j * TICKS_PER_QUARTER_NOTE) * pixelsPerTick;
             if (beatXPos < totalWidth) {
                 barMarkers.push(
                    <div key={`beat-${i}-${j}`} className="absolute top-0 h-full" style={{ left: beatXPos }}>
                        <div className="w-px h-1/2 bg-gray-700"></div>
                    </div>
                 );
             }
        }
    }
    
    const loopLeft = loopRegion.startTick * pixelsPerTick;
    const loopWidth = (loopRegion.endTick - loopRegion.startTick) * pixelsPerTick;

    return (
        <div className="h-8 bg-gray-800 overflow-hidden border-b border-black">
            <div
                className="relative h-full"
                style={{
                    width: totalWidth,
                    transform: `translateX(-${scrollLeft}px)`
                }}
            >
                {barMarkers}
                {loopRegion.isEnabled && (
                     <div 
                        className="absolute top-0 h-full bg-yellow-400/30 border-x-2 border-yellow-400"
                        style={{ left: loopLeft, width: loopWidth }}
                        onMouseDown={(e) => handleMouseDown(e, 'bar')}
                     >
                        <div className="absolute left-0 top-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => handleMouseDown(e, 'start')}></div>
                        <div className="absolute right-0 top-0 w-2 h-full cursor-ew-resize" onMouseDown={(e) => handleMouseDown(e, 'end')}></div>
                    </div>
                )}
            </div>
        </div>
    );
});