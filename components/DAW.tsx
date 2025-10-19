import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DAWProject, DAWTrack, DAWClip, MIDIDAWClip, AudioDAWClip, MelodyNote } from '../types';
import { TimelineRuler } from './TimelineRuler';
import { TrackHeader } from './TrackHeader';
import { Inspector } from './Inspector';
import { Waveform } from './Waveform';
import { Modal } from './Modal';
import { PianoRoll } from './PianoRoll';
import { Mixer } from './Mixer';
import { ChannelRack } from './ChannelRack';
import { AISynthGenerator } from './AISynthGenerator';
import { VirtualKeyboard } from './VirtualKeyboard';
import { LCDDisplay } from './LCDDisplay';
import { Play, Stop, ToStart, Record, Mixer as MixerIcon, ChannelRackIcon, KeyboardIcon } from './Icons';
import { TICKS_PER_QUARTER_NOTE } from '../constants';
import { patternToNotes } from '../utils/patternUtils';

interface DAWProps {
    initialProject: DAWProject;
    onProjectChange: (project: DAWProject) => void;
}

const pixelsPerTick = 0.05;

export const DAW: React.FC<DAWProps> = ({ initialProject, onProjectChange }) => {
    const [project, setProject] = useState<DAWProject>(initialProject);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(initialProject.tracks[0]?.id || null);
    const [playheadPosition, setPlayheadPosition] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    useEffect(() => {
        onProjectChange(project);
    }, [project, onProjectChange]);
    
    // UI State
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [modal, setModal] = useState<{ type: 'mixer' | 'piano-roll' | 'channel-rack' | 'ai-synth', clip?: MIDIDAWClip, trackId?: string } | null>(null);

    const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
    
    useEffect(() => {
        let animationFrameId: number;
        if (isPlaying) {
            const loop = () => {
                setPlayheadPosition(prev => {
                    const nextPos = prev + 10;
                    const { isEnabled, startTick, endTick } = project.loopRegion;
                    if (isEnabled && nextPos >= endTick) {
                        return startTick;
                    }
                    return nextPos % project.durationTicks;
                });
                animationFrameId = requestAnimationFrame(loop);
            };
            animationFrameId = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, project.durationTicks, project.loopRegion]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollLeft(e.currentTarget.scrollLeft);
    };

    const updateProject = useCallback((updater: (prev: DAWProject) => DAWProject) => {
        setProject(updater);
    }, []);

    const updateTrack = useCallback((trackId: string, newSettings: Partial<DAWTrack>) => {
        updateProject(p => ({
            ...p,
            tracks: p.tracks.map(t => t.id === trackId ? { ...t, ...newSettings } : t)
        }));
    }, [updateProject]);

    const addTrack = (type: 'audio' | 'midi') => {
        const newTrack: DAWTrack = {
            id: `track${Date.now()}`,
            name: type === 'midi' ? 'New MIDI Track' : 'New Audio Track',
            trackType: type,
            clips: [],
            volume: 1, pan: 0, isMuted: false, isSoloed: false,
            color: '#8b5cf6', icon: type === 'midi' ? '🎵' : '🎤',
            instrument: type === 'midi' ? { type: 'sampler' } : undefined,
            fx: { eq: { lowGain: 0, midGain: 0, highGain: 0 }, compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 5 } }
        };
        updateProject(p => ({...p, tracks: [...p.tracks, newTrack]}));
    };
    
    const deleteTrack = (trackId: string) => {
        updateProject(p => ({...p, tracks: p.tracks.filter(t => t.id !== trackId)}));
        if (selectedTrackId === trackId) {
            setSelectedTrackId(null);
        }
    };
    
    const addClip = (trackId: string) => {
        const track = project.tracks.find(t => t.id === trackId);
        if (!track || track.trackType !== 'midi') return;
        
        const newClip: MIDIDAWClip = {
            id: `clip${Date.now()}`,
            type: 'midi',
            name: `Clip ${track.clips.length + 1}`,
            notes: [],
            startTick: 0,
            durationTicks: 4 * TICKS_PER_QUARTER_NOTE * 4, // 4 bars
            velocity: 0.8,
        };
        updateTrack(trackId, { clips: [...track.clips, newClip] });
    };

    const updateClip = (trackId: string, clipId: string, newClipData: Partial<DAWClip>) => {
        const track = project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const updatedClips = track.clips.map(c => c.id === clipId ? { ...c, ...newClipData } : c);
        updateTrack(trackId, { clips: updatedClips });
    }
    
    const handleSavePianoRoll = (updatedNotes: MelodyNote[]) => {
        if (modal?.type === 'piano-roll' && modal.clip && selectedTrackId) {
            updateClip(selectedTrackId, modal.clip.id, { notes: updatedNotes });
        }
        setModal(null);
    };

    const handleSaveChannelRack = (clipId: string, pattern: { [key: number]: boolean[] }) => {
        const clip = selectedTrack?.clips.find(c => c.id === clipId) as MIDIDAWClip;
        if (clip && selectedTrackId) {
            const notes = patternToNotes(pattern, 16, clip.durationTicks);
            updateClip(selectedTrackId, clipId, { pattern, notes });
        }
    };
    
    const renderClip = (clip: DAWClip, track: DAWTrack) => {
        const style = {
            left: clip.startTick * pixelsPerTick,
            width: clip.durationTicks * pixelsPerTick,
            backgroundColor: track.color + 'A0',
            borderColor: track.color
        };
        
        return (
             <div 
                key={clip.id} 
                className="absolute h-16 top-2 rounded-lg border-2 overflow-hidden cursor-pointer" 
                style={style}
                onDoubleClick={() => {
                    if (clip.type === 'midi') setModal({type: 'piano-roll', clip})
                }}
            >
                <div className="p-1 text-xs font-bold truncate">{clip.name}</div>
                {clip.type === 'audio' && <Waveform audioBuffer={clip.audioBuffer} height={40} />}
             </div>
        )
    };
    
    return (
        <div className="flex h-[85vh] bg-[#3c3c3c] rounded-lg overflow-hidden">
            {modal && (
                <Modal onClose={() => setModal(null)}>
                    {modal.type === 'mixer' && <Mixer tracks={project.tracks} updateTrack={updateTrack} />}
                    {modal.type === 'piano-roll' && modal.clip && <PianoRoll clip={modal.clip} onSave={handleSavePianoRoll} onClose={() => setModal(null)} />}
                    {modal.type === 'channel-rack' && modal.clip && <ChannelRack clip={modal.clip} onClose={() => setModal(null)} onSave={handleSaveChannelRack}/>}
                </Modal>
            )}

            {/* Track Headers */}
            <div className="w-56 bg-[#282828] flex-shrink-0 border-r-2 border-black flex flex-col">
                <div className="p-2 h-20 border-b-2 border-black flex items-center justify-between">
                    <div className="space-x-1">
                        <button onClick={() => addTrack('midi')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Add MIDI Track">+</button>
                        <button onClick={() => addTrack('audio')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Add Audio Track">A</button>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {project.tracks.map(track => (
                        <TrackHeader key={track.id} track={track} isSelected={track.id === selectedTrackId} onSelect={() => setSelectedTrackId(track.id)} onDelete={deleteTrack} updateTrack={updateTrack} />
                    ))}
                </div>
            </div>

            {/* Timeline */}
            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="h-20 bg-[#282828] border-b-2 border-black p-2 flex items-center gap-4">
                     {/* Transport Controls */}
                     <div className="flex items-center gap-1 p-2 bg-black/30 rounded-lg">
                        <button onClick={() => setPlayheadPosition(project.loopRegion.isEnabled ? project.loopRegion.startTick : 0)} className="p-2 text-gray-300 hover:text-white"><ToStart /></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="p-3 bg-red-600 hover:bg-red-500 rounded-full text-white">{isPlaying ? <Stop/> : <Play />}</button>
                        <button className="p-2 text-gray-300 hover:text-white"><Record /></button>
                     </div>
                     <LCDDisplay 
                        currentTimeInTicks={playheadPosition}
                        bpm={project.bpm}
                        timeSignature={project.timeSignature}
                        musicalKey={project.key}
                     />
                     <div className="flex-grow" />
                     <div className="flex items-center gap-2">
                        <button onClick={() => {}} className="p-2 text-gray-300 hover:text-white" title="Step Sequencer"><ChannelRackIcon/></button>
                        <button onClick={() => {}} className="p-2 text-gray-300 hover:text-white" title="Virtual Keyboard"><KeyboardIcon/></button>
                        <button onClick={() => setModal({type: 'mixer'})} className="p-2 text-gray-300 hover:text-white" title="Mixer"><MixerIcon /></button>
                     </div>
                </div>
                <div className="flex-grow overflow-auto" ref={timelineContainerRef} onScroll={handleScroll}>
                    <TimelineRuler 
                        durationTicks={project.durationTicks}
                        pixelsPerTick={pixelsPerTick} 
                        scrollLeft={scrollLeft}
                        loopRegion={project.loopRegion}
                        onLoopRegionChange={(newRegion) => updateProject(p => ({...p, loopRegion: newRegion}))}
                    />
                    <div className="relative" style={{width: project.durationTicks * pixelsPerTick, height: project.tracks.length * 80 }}>
                        {/* Track Lanes */}
                        {project.tracks.map((track, i) => (
                            <div 
                                key={track.id}
                                className={`h-20 border-b border-black/50 ${track.id === selectedTrackId ? 'bg-gray-700/30' : ''}`}
                                onDoubleClick={() => addClip(track.id)}
                            >
                                {track.clips.map(c => renderClip(c, track))}
                            </div>
                        ))}
                         {/* Playhead */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: playheadPosition * pixelsPerTick }}></div>
                    </div>
                </div>
            </div>

            {/* Inspector */}
            <Inspector 
                selectedTrack={selectedTrack || null}
                updateTrack={updateTrack}
            />
        </div>
    );
};