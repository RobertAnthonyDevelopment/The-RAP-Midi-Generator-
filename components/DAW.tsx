import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DAWProject, DAWTrack, DAWClip, MIDIDAWClip, AudioDAWClip, MelodyNote } from '../types';
import { TimelineRuler } from './TimelineRuler';
import { TrackHeader } from './TrackHeader';
import { Inspector } from './Inspector';
import { Waveform } from './Waveform';
import { MidiNoteVisualizer } from './MidiNoteVisualizer';
import { Modal } from './Modal';
import { PianoRoll } from './PianoRoll';
import { Mixer } from './Mixer';
import { ChannelRack } from './ChannelRack';
import { AISynthGenerator } from './AISynthGenerator';
import { VirtualKeyboard } from './VirtualKeyboard';
import { LCDDisplay } from './LCDDisplay';
import { ExportModal } from './ExportModal';
import { Play, Stop, ToStart, Record, Mixer as MixerIcon, ChannelRackIcon, KeyboardIcon, Save, Load, ExportArrow } from './Icons';
import { TICKS_PER_QUARTER_NOTE } from '../constants';
import { patternToNotes } from '../utils/patternUtils';
import { saveProjectToFile } from '../utils/projectPersistence';
import { scheduleNotePlayback, renderMidiTrackToBuffer } from '../utils/audioPlayback';
import { bufferToWav } from '../utils/audioGenerator';
import { generateMultiTrackMidi } from '../utils/midiGenerator';


interface DAWProps {
    initialProject: DAWProject;
    onProjectChange: (project: DAWProject) => void;
    onLoadProjectRequest: (file: File) => void;
}

const pixelsPerTick = 0.05;
const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;

const ticksToSeconds = (ticks: number, bpm: number): number => {
    const secondsPerQuarter = 60 / bpm;
    const secondsPerTick = secondsPerQuarter / TICKS_PER_QUARTER_NOTE;
    return ticks * secondsPerTick;
};

const secondsToTicks = (seconds: number, bpm: number): number => {
    const secondsPerQuarter = 60 / bpm;
    const ticksPerSecond = TICKS_PER_QUARTER_NOTE / secondsPerQuarter;
    return seconds * ticksPerSecond;
}

export const DAW: React.FC<DAWProps> = ({ initialProject, onProjectChange, onLoadProjectRequest }) => {
    const [project, setProject] = useState<DAWProject>(initialProject);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(initialProject.tracks[0]?.id || null);
    const [playheadPosition, setPlayheadPosition] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    useEffect(() => {
        onProjectChange(project);
    }, [project, onProjectChange]);

    useEffect(() => {
        setProject(initialProject);
    }, [initialProject]);
    
    // UI State
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const timelineGridRef = useRef<HTMLDivElement>(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [modal, setModal] = useState<{ type: 'mixer' | 'piano-roll' | 'channel-rack' | 'ai-synth' | 'export', clip?: MIDIDAWClip, trackId?: string } | null>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, trackId: string, tick: number, clip?: DAWClip } | null>(null);

    const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
    const loadFileInputRef = useRef<HTMLInputElement>(null);

    // --- Audio Engine ---
    const audioContextRef = useRef<AudioContext>();
    const activeVKSourcesRef = useRef(new Map<string, any>());
    const activePlaybackSourcesRef = useRef(new Map<string, any>());
    const trackNodesRef = useRef(new Map<string, { gain: GainNode, panner: StereoPannerNode }>());
    const playbackTimeRef = useRef(0);
    const animationFrameIdRef = useRef<number>();
    
    // Initialize Audio Context and Track Nodes
    useEffect(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        
        const currentTrackIds = new Set(project.tracks.map(t => t.id));
        
        for (const trackId of trackNodesRef.current.keys()) {
            if (!currentTrackIds.has(trackId)) {
                trackNodesRef.current.get(trackId)?.gain.disconnect();
                trackNodesRef.current.delete(trackId);
            }
        }
        
        project.tracks.forEach(track => {
            let nodes = trackNodesRef.current.get(track.id);
            if (!nodes) {
                const gain = audioContext.createGain();
                const panner = audioContext.createStereoPanner();
                gain.connect(panner);
                panner.connect(audioContext.destination);
                nodes = { gain, panner };
                trackNodesRef.current.set(track.id, nodes);
            }
            
            const soloedTracks = project.tracks.filter(t => t.isSoloed);
            const isAudible = !track.isMuted && (soloedTracks.length === 0 || track.isSoloed);

            nodes.gain.gain.setValueAtTime(isAudible ? track.volume : 0, audioContext.currentTime);
            nodes.panner.pan.setValueAtTime(track.pan, audioContext.currentTime);
        });
        
    }, [project.tracks]);
    
    const playNote = useCallback((
        track: DAWTrack,
        note: MelodyNote,
        when: number,
    ) => {
        const audioContext = audioContextRef.current;
        const trackNodes = trackNodesRef.current.get(track.id);
        if (!audioContext || !trackNodes) return;

        const noteId = `play-${track.id}-${note.midiNote}-${when}`;
        const source = scheduleNotePlayback(audioContext, trackNodes.gain, project.bpm, track, note, when);
        if (source) activePlaybackSourcesRef.current.set(noteId, source);

    }, [project.bpm]);
    
    const stopPlayback = useCallback(() => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
        activePlaybackSourcesRef.current.forEach(source => {
            try {
                if (source.stop) source.stop(0);
            } catch(e) { /* ignore errors */ }
        });
        activePlaybackSourcesRef.current.clear();
    }, []);

    const startPlayback = useCallback((startFromTick: number) => {
        stopPlayback();
        const audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state === 'suspended') {
            audioContext?.resume();
        }
        if (!audioContext) return;

        const soloedTracks = project.tracks.filter(t => t.isSoloed);
        const audibleTracks = project.tracks.filter(t => !t.isMuted && (soloedTracks.length === 0 || t.isSoloed));
        
        const playbackStartTime = audioContext.currentTime;
        playbackTimeRef.current = playbackStartTime;

        const scheduleStartOffset = ticksToSeconds(startFromTick, project.bpm);

        audibleTracks.forEach(track => {
            track.clips.forEach(clip => {
                const notePlayTimeOffset = ticksToSeconds(clip.startTick, project.bpm);

                if(clip.type === 'midi') {
                    clip.notes.forEach(note => {
                        const noteStartInClipSec = ticksToSeconds(note.startTick, project.bpm);
                        const notePlayTime = playbackStartTime + notePlayTimeOffset + noteStartInClipSec - scheduleStartOffset;
                        if(notePlayTime >= playbackStartTime) {
                             playNote(track, note, notePlayTime);
                        }
                    });
                } else if(clip.type === 'audio' && clip.audioBuffer) {
                    const source = audioContext.createBufferSource();
                    source.buffer = clip.audioBuffer;
                    const trackNodes = trackNodesRef.current.get(track.id);
                    if(trackNodes) source.connect(trackNodes.gain);
                    const playTime = playbackStartTime + notePlayTimeOffset - scheduleStartOffset;
                    source.start(Math.max(playbackStartTime, playTime), Math.max(0, scheduleStartOffset - notePlayTimeOffset));
                    activePlaybackSourcesRef.current.set(`audio-${clip.id}`, source);
                }
            });
        });
        
        const animate = () => {
            const elapsedTime = audioContext.currentTime - playbackTimeRef.current;
            const elapsedTicks = (elapsedTime / (60 / project.bpm)) * TICKS_PER_QUARTER_NOTE;
            let newPosition = startFromTick + elapsedTicks;

            const { isEnabled, startTick, endTick } = project.loopRegion;
            if (isEnabled && newPosition >= endTick) {
                const loopDurationTicks = endTick - startTick;
                const overshoot = newPosition - endTick;
                newPosition = startTick + (overshoot % loopDurationTicks);
                startPlayback(startTick); // Reschedule for the next loop
                return; // Exit this animation frame, a new one will start
            }

            setPlayheadPosition(newPosition);
            animationFrameIdRef.current = requestAnimationFrame(animate);
        };
        animationFrameIdRef.current = requestAnimationFrame(animate);

    }, [project, stopPlayback, playNote]);


    const playVirtualKey = useCallback((midiNote: number) => {
        const track = selectedTrack;
        const audioContext = audioContextRef.current;
        if (!track) return;
        const trackNodes = trackNodesRef.current.get(track.id);
        if (!audioContext || !trackNodes) return;

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const noteId = `vk-${midiNote}`;
        if (activeVKSourcesRef.current.has(noteId)) return;
        
        const source = scheduleNotePlayback(audioContext, trackNodes.gain, project.bpm, track, { midiNote, startTick:0, durationTicks: 999999, velocity: 0.8 }, audioContext.currentTime);
        if (source) activeVKSourcesRef.current.set(noteId, source);

    }, [selectedTrack, project.bpm]);

    const stopVirtualKey = useCallback((midiNote: number) => {
        const noteId = `vk-${midiNote}`;
        const active = activeVKSourcesRef.current.get(noteId);
        if (active && active.stop) {
            active.stop();
        }
        activeVKSourcesRef.current.delete(noteId);
    }, []);

    // Close context menu on any click
    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollLeft(e.currentTarget.scrollLeft);
    };

    const updateProject = useCallback((updater: (prev: DAWProject) => DAWProject) => {
        setProject(updater);
    }, []);

    const handleBpmChange = (newBpm: number) => {
        updateProject(p => ({ ...p, bpm: newBpm }));
    };

    const handleKeyChange = (newKey: string) => {
        updateProject(p => ({ ...p, key: newKey }));
    };

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
            instrument: type === 'midi' ? { type: 'synth', params: { oscillator1: { type: 'sawtooth', detune: 0 }, oscillator2: { type: 'square', detune: -10 }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 }, filter: { type: 'lowpass', frequency: 5000, q: 1 } } } : undefined,
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
    
    const addClip = (trackId: string, tick: number) => {
        const track = project.tracks.find(t => t.id === trackId);
        if (!track || track.trackType !== 'midi') return;
        
        const newClip: MIDIDAWClip = {
            id: `clip${Date.now()}`,
            type: 'midi',
            name: `Clip ${track.clips.length + 1}`,
            notes: [],
            startTick: tick,
            durationTicks: 4 * TICKS_PER_QUARTER_NOTE * 4, // 4 bars
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
    
    const handleTransportPlay = () => {
        if(isPlaying) {
            setIsPlaying(false);
            stopPlayback();
        } else {
            setIsPlaying(true);
            startPlayback(playheadPosition);
        }
    };
    
    const handleTransportStop = () => {
         setIsPlaying(false);
         stopPlayback();
         setPlayheadPosition(project.loopRegion.isEnabled ? project.loopRegion.startTick : 0);
    };

    const handleContextMenu = (e: React.MouseEvent, track: DAWTrack, clip?: DAWClip) => {
        e.preventDefault();
        e.stopPropagation();
        if (!timelineGridRef.current) return;
        
        const rect = timelineGridRef.current.getBoundingClientRect();
        const scrollLeft = timelineGridRef.current.parentElement?.scrollLeft || 0;
        const relativeX = e.clientX - rect.left + scrollLeft;
        const tick = Math.floor(relativeX / pixelsPerTick);

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            trackId: track.id,
            tick,
            clip
        });
    };

    const handleCreateClip = () => {
        if (!contextMenu) return;
        addClip(contextMenu.trackId, Math.floor(contextMenu.tick / ticksPerBar) * ticksPerBar);
        setContextMenu(null);
    };

    const handleDuplicateClip = () => {
        if (!contextMenu || !contextMenu.clip) return;
        const { trackId, clip } = contextMenu;
        const track = project.tracks.find(t => t.id === trackId);
        if (!track) return;

        const newClip = {
            ...clip,
            id: `clip${Date.now()}`,
            startTick: clip.startTick + clip.durationTicks,
        };
        updateTrack(trackId, { clips: [...track.clips, newClip] });
        setContextMenu(null);
    };

    const handleDeleteClip = () => {
        if (!contextMenu || !contextMenu.clip) return;
        const { trackId, clip } = contextMenu;
        const track = project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const updatedClips = track.clips.filter(c => c.id !== clip.id);
        updateTrack(trackId, { clips: updatedClips });
        setContextMenu(null);
    };

    const handleOpenPianoRoll = () => {
        if (contextMenu?.clip?.type === 'midi') {
            setSelectedTrackId(contextMenu.trackId);
            setModal({ type: 'piano-roll', clip: contextMenu.clip as MIDIDAWClip });
        }
        setContextMenu(null);
    };
    
    const handleLoadProjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onLoadProjectRequest(e.target.files[0]);
        }
    };

    const handleBounceTrack = async (trackId: string) => {
        const trackToBounce = project.tracks.find(t => t.id === trackId);
        if (!trackToBounce || trackToBounce.trackType !== 'midi') {
            alert("Only MIDI tracks can be bounced.");
            return;
        }

        const midiClips = trackToBounce.clips.filter(c => c.type === 'midi') as MIDIDAWClip[];
        if (midiClips.length === 0) {
            alert("Track has no MIDI clips to bounce.");
            return;
        }

        try {
            const audioBuffer = await renderMidiTrackToBuffer(trackToBounce, midiClips, project.bpm);
            const newAudioTrack: DAWTrack = {
                id: `track${Date.now()}`,
                name: `${trackToBounce.name} (Bounce)`,
                trackType: 'audio',
                clips: [],
                volume: 1, pan: 0, isMuted: false, isSoloed: false,
                color: trackToBounce.color, icon: '🔊',
                fx: { eq: { lowGain: 0, midGain: 0, highGain: 0 }, compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 5 } }
            };
            const newAudioClip: AudioDAWClip = {
                id: `clip${Date.now()}`,
                type: 'audio',
                name: `${trackToBounce.name} Audio`,
                audioBuffer,
                startTick: 0,
                durationTicks: secondsToTicks(audioBuffer.duration, project.bpm),
                audioStartTime: 0
            };
            newAudioTrack.clips.push(newAudioClip);

            updateProject(p => ({
                ...p,
                tracks: [...p.tracks.map(t => t.id === trackId ? {...t, isMuted: true} : t), newAudioTrack]
            }));

        } catch (error) {
            console.error("Failed to bounce track:", error);
            alert(`Failed to bounce track: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleExport = async (settings: { trackId: string, format: 'midi' | 'wav' }[]) => {
        for (const { trackId, format } of settings) {
            const track = project.tracks.find(t => t.id === trackId);
            if (!track) continue;

            try {
                if (format === 'midi' && track.trackType === 'midi') {
                    const allNotes = (track.clips as MIDIDAWClip[]).flatMap(clip => 
                        clip.notes.map(note => ({ ...note, startTick: note.startTick + clip.startTick }))
                    );
                    const midiBlob = generateMultiTrackMidi({
                        bpm: project.bpm,
                        tracks: [{ notes: allNotes, channel: 0, velocity: 100 }]
                    });
                    const url = URL.createObjectURL(midiBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${track.name}.mid`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else if (format === 'wav') {
                     let buffer: AudioBuffer | null = null;
                     if (track.trackType === 'midi') {
                         buffer = await renderMidiTrackToBuffer(track, track.clips as MIDIDAWClip[], project.bpm);
                     } else {
                         // TODO: Render audio track with multiple clips
                         const audioClip = track.clips[0] as AudioDAWClip;
                         if (audioClip?.audioBuffer) buffer = audioClip.audioBuffer;
                     }
                     if (buffer) {
                         const wavBlob = bufferToWav(buffer);
                         const url = URL.createObjectURL(wavBlob);
                         const a = document.createElement('a');
                         a.href = url;
                         a.download = `${track.name}.wav`;
                         a.click();
                         URL.revokeObjectURL(url);
                     }
                }
            } catch(e) {
                console.error(`Failed to export track ${track.name}`, e);
                alert(`Could not export ${track.name}.`);
            }
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
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrackId(track.id);
                    if (clip.type === 'midi') setModal({type: 'piano-roll', clip})
                }}
                onContextMenu={(e) => handleContextMenu(e, track, clip)}
            >
                <div className="p-1 text-xs font-bold truncate select-none">{clip.name}</div>
                {clip.type === 'audio' && clip.audioBuffer && <Waveform audioBuffer={clip.audioBuffer} height={40} />}
                {clip.type === 'midi' && <MidiNoteVisualizer notes={clip.notes} durationTicks={clip.durationTicks} height={40} />}
             </div>
        )
    };
    
    return (
        <div className="flex flex-col h-[85vh] bg-[#3c3c3c] rounded-lg overflow-hidden">
            {contextMenu && (
                <ul 
                    className="fixed z-50 bg-gray-900 border border-gray-700 rounded-md shadow-lg py-1 w-48 text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.clip ? (
                        <>
                            {contextMenu.clip.type === 'midi' && <li onClick={handleOpenPianoRoll} className="px-3 py-1.5 hover:bg-red-600 cursor-pointer">Open in Piano Roll</li>}
                            <li onClick={handleDuplicateClip} className="px-3 py-1.5 hover:bg-red-600 cursor-pointer">Duplicate</li>
                            <li onClick={handleDeleteClip} className="px-3 py-1.5 hover:bg-red-600 cursor-pointer">Delete</li>
                        </>
                    ) : (
                        project.tracks.find(t => t.id === contextMenu.trackId)?.trackType === 'midi' &&
                        <li onClick={handleCreateClip} className="px-3 py-1.5 hover:bg-red-600 cursor-pointer">Create MIDI Clip</li>
                    )}
                </ul>
            )}
            
            <div className="flex flex-grow overflow-hidden">
                {modal && (
                    <Modal onClose={() => setModal(null)}>
                        {modal.type === 'mixer' && <Mixer tracks={project.tracks} updateTrack={updateTrack} />}
                        {modal.type === 'piano-roll' && modal.clip && selectedTrackId && 
                            <PianoRoll 
                                clip={modal.clip} 
                                onSave={(notes) => updateClip(selectedTrackId, modal.clip!.id, { notes })}
                                onClose={() => setModal(null)} 
                                onNoteOn={playVirtualKey} 
                                onNoteOff={stopVirtualKey} 
                            />
                        }
                        {modal.type === 'channel-rack' && modal.clip && <ChannelRack clip={modal.clip} onClose={() => setModal(null)} onSave={handleSaveChannelRack}/>}
                        {modal.type === 'export' && <ExportModal tracks={project.tracks} onClose={() => setModal(null)} onExport={handleExport} />}
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
                        <div className="flex items-center gap-2">
                             <button onClick={() => saveProjectToFile(project)} className="p-2 text-gray-300 hover:text-white" title="Save Project"><Save/></button>
                             <button onClick={() => loadFileInputRef.current?.click()} className="p-2 text-gray-300 hover:text-white" title="Load Project"><Load/></button>
                             <input type="file" accept=".json" ref={loadFileInputRef} onChange={handleLoadProjectChange} className="hidden" />
                             <button onClick={() => setModal({type: 'export'})} className="p-2 text-gray-300 hover:text-white" title="Export Stems"><ExportArrow/></button>
                        </div>
                        {/* Transport Controls */}
                        <div className="flex items-center gap-1 p-2 bg-black/30 rounded-lg">
                            <button onClick={handleTransportStop} className="p-2 text-gray-300 hover:text-white"><ToStart /></button>
                            <button onClick={handleTransportPlay} className="p-3 bg-red-600 hover:bg-red-500 rounded-full text-white">{isPlaying ? <Stop/> : <Play />}</button>
                            <button className="p-2 text-gray-300 hover:text-white"><Record /></button>
                        </div>
                        <LCDDisplay 
                            currentTimeInTicks={playheadPosition}
                            bpm={project.bpm}
                            timeSignature={project.timeSignature}
                            musicalKey={project.key}
                            onBpmChange={handleBpmChange}
                            onKeyChange={handleKeyChange}
                        />
                        <div className="flex-grow" />
                        <div className="flex items-center gap-2">
                            <button onClick={() => selectedTrack?.trackType === 'midi' && addClip(selectedTrackId!, playheadPosition)} className="p-2 text-gray-300 hover:text-white" title="Step Sequencer"><ChannelRackIcon/></button>
                            <button onClick={() => setIsKeyboardVisible(v => !v)} className={`p-2 rounded ${isKeyboardVisible ? 'bg-red-600/50 text-white' : 'text-gray-300 hover:text-white'}`} title="Virtual Keyboard"><KeyboardIcon/></button>
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
                        <div ref={timelineGridRef} className="relative" style={{width: project.durationTicks * pixelsPerTick, height: project.tracks.length * 80 }}>
                            {/* Track Lanes */}
                            {project.tracks.map((track, i) => (
                                <div 
                                    key={track.id}
                                    className={`h-20 border-b border-black/50 ${track.id === selectedTrackId ? 'bg-gray-700/30' : ''}`}
                                    onDoubleClick={(e) => {
                                        if (e.target === e.currentTarget && track.trackType === 'midi') {
                                            const tick = (e.nativeEvent.offsetX + scrollLeft) / pixelsPerTick;
                                            addClip(track.id, tick);
                                        }
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, track)}
                                >
                                    {track.clips.map(c => renderClip(c, track))}
                                </div>
                            ))}
                            {/* Playhead */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none" style={{ left: playheadPosition * pixelsPerTick }}></div>
                        </div>
                    </div>
                </div>

                {/* Inspector */}
                <Inspector 
                    selectedTrack={selectedTrack || null}
                    updateTrack={updateTrack}
                    onBounceTrack={handleBounceTrack}
                />
            </div>
            {isKeyboardVisible && (
                <VirtualKeyboard onNoteOn={playVirtualKey} onNoteOff={stopVirtualKey} />
            )}
        </div>
    );
};