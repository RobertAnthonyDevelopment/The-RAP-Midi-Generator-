

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
import { useAudioGraph } from '../hooks/useAudioGraph';


interface DAWProps {
    initialProject: DAWProject;
    onProjectChange: (project: DAWProject) => void;
    onLoadProjectRequest: (file: File) => void;
}

const pixelsPerTick = 0.05;
const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;
const trackHeight = 80; // in pixels

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
    const trackHeadersRef = useRef<HTMLDivElement>(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [modal, setModal] = useState<{ type: 'mixer' | 'piano-roll' | 'channel-rack' | 'ai-synth' | 'export', clip?: MIDIDAWClip, trackId?: string } | null>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, trackId: string, tick: number, clip?: DAWClip } | null>(null);
    const [dragInfo, setDragInfo] = useState<{ clip: DAWClip, originalTrackId: string, grabOffsetX: number } | null>(null);
    const dragGhostRef = useRef<HTMLDivElement>(null);

    const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
    const loadFileInputRef = useRef<HTMLInputElement>(null);

    // --- Audio Engine ---
    const audioContextRef = useRef<AudioContext>();
    const activeVKSourcesRef = useRef(new Map<string, any>());
    const activePlaybackSourcesRef = useRef(new Map<string, any>());
    const trackNodesRef = useAudioGraph(project.tracks, audioContextRef);
    const playbackTimeRef = useRef(0);
    const animationFrameIdRef = useRef<number>();

    const getLaneUnderPointer = (clientX: number, clientY: number): HTMLElement | null => {
        const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
        return el ? (el.closest('[data-track-id]') as HTMLElement | null) : null;
    };

    const getTrackIdUnderPointer = (clientX: number, clientY: number): string | null => {
        return getLaneUnderPointer(clientX, clientY)?.dataset.trackId ?? null;
    };
    
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

    }, [project.bpm, trackNodesRef]);
    
    const stopPlayback = useCallback(() => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
        activePlaybackSourcesRef.current.forEach(source => {
            try {
                // FIX: The stop() method requires one argument. Passing 0 stops playback immediately.
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

    }, [project, stopPlayback, playNote, trackNodesRef]);


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

    }, [selectedTrack, project.bpm, trackNodesRef]);

    const stopVirtualKey = useCallback((midiNote: number) => {
        const noteId = `vk-${midiNote}`;
        const active = activeVKSourcesRef.current.get(noteId);
        if (active && active.stop) {
            // FIX: The stop() method requires one argument. Passing 0 stops playback immediately.
            active.stop(0);
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
        const { scrollLeft, scrollTop } = e.currentTarget;
        setScrollLeft(scrollLeft);
        setScrollTop(scrollTop);
        if (trackHeadersRef.current) {
            trackHeadersRef.current.scrollTop = scrollTop;
        }
    };
    
    const handleBpmChange = (newBpm: number) => {
        setProject(p => ({ ...p, bpm: newBpm }));
    };

    const handleKeyChange = (newKey: string) => {
        setProject(p => ({ ...p, key: newKey }));
    };

    const updateTrack = useCallback((trackId: string, newSettings: Partial<DAWTrack>) => {
        setProject(p => ({
            ...p,
            tracks: p.tracks.map(t => t.id === trackId ? { ...t, ...newSettings } : t)
        }));
    }, []);

    const addTrack = (type: 'audio' | 'synth' | 'drum') => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        
        const baseTrack = {
            id: `track${Date.now()}`,
            clips: [],
            volume: 1, pan: 0, isMuted: false, isSoloed: false,
            fx: { eq: { lowGain: 0, midGain: 0, highGain: 0 }, compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 5 } }
        };
        
        let newTrack: DAWTrack;
    
        if (type === 'audio') {
            newTrack = {
                ...baseTrack,
                name: 'Audio Track',
                trackType: 'audio',
                color: '#14b8a6', icon: '🎤',
            };
        } else if (type === 'synth') {
            newTrack = {
                ...baseTrack,
                name: 'Synth Track',
                trackType: 'midi',
                color: '#3b82f6', icon: '🎹',
                instrument: { type: 'synth', params: { oscillator1: { type: 'sawtooth', detune: 0 }, oscillator2: { type: 'square', detune: -10 }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 }, filter: { type: 'lowpass', frequency: 5000, q: 1 } } },
            };
        } else { // drum
            newTrack = {
                ...baseTrack,
                name: 'Drum Track',
                trackType: 'midi',
                color: '#f97316', icon: '🥁',
                instrument: { type: 'sampler' },
            };
        }
    
        setProject(p => ({...p, tracks: [...p.tracks, newTrack]}));
        setSelectedTrackId(newTrack.id);
    };
    
    const deleteTrack = (trackId: string) => {
        setProject(p => ({...p, tracks: p.tracks.filter(t => t.id !== trackId)}));
        if (selectedTrackId === trackId) {
            setSelectedTrackId(project.tracks[0]?.id || null);
        }
    };
    
    const addClip = useCallback((trackId: string, tick: number) => {
        setProject(p => {
            const track = p.tracks.find(t => t.id === trackId);
            if (!track || track.trackType !== 'midi') return p;

            const newClip: MIDIDAWClip = {
                id: `clip${Date.now()}`,
                type: 'midi',
                name: `Clip ${track.clips.length + 1}`,
                notes: [],
                startTick: tick,
                durationTicks: 4 * TICKS_PER_QUARTER_NOTE * 4, // 4 bars
            };

            const newTracks = p.tracks.map(t =>
                t.id === trackId
                    ? { ...t, clips: [...t.clips, newClip] }
                    : t
            );
            return { ...p, tracks: newTracks };
        });
    }, []);

    const updateClip = useCallback((trackId: string, clipId: string, newClipData: Partial<DAWClip>) => {
        setProject(p => ({
            ...p,
            tracks: p.tracks.map(track => {
                if (track.id === trackId) {
                    return {
                        ...track,
                        clips: track.clips.map(clip =>
                            clip.id === clipId ? { ...clip, ...newClipData } : clip
                        )
                    };
                }
                return track;
            })
        }));
    }, []);
    
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

        // Select the track on right-click to ensure consistent state
        setSelectedTrackId(track.id);
        
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

    const handleDuplicateClip = () => {
        if (!contextMenu || !contextMenu.clip) return;
        const { trackId, clip } = contextMenu;
        const track = project.tracks.find(t => t.id === trackId);
        if (!track) return;
        
        // FIX: The issue with spreading a discriminated union ('clip') is resolved by explicitly constructing the new clip object.
        // This avoids TypeScript widening the 'type' property to 'midi' | 'audio', which caused assignment errors.
        if (clip.type === 'midi') {
            const newClip: MIDIDAWClip = {
                id: `clip${Date.now()}`,
                type: 'midi',
                name: clip.name,
                notes: clip.notes,
                startTick: clip.startTick + clip.durationTicks,
                durationTicks: clip.durationTicks,
                pattern: clip.pattern,
                velocity: clip.velocity
             };
            updateTrack(trackId, { clips: [...track.clips, newClip] });
        } else if (clip.type === 'audio') {
            const newClip: AudioDAWClip = {
                id: `clip${Date.now()}`,
                type: 'audio',
                name: clip.name,
                audioBuffer: clip.audioBuffer,
                startTick: clip.startTick + clip.durationTicks,
                durationTicks: clip.durationTicks,
                audioStartTime: clip.audioStartTime
            };
            updateTrack(trackId, { clips: [...track.clips, newClip] });
        }

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

            setProject(p => {
                const updatedTracks = p.tracks.map(t => {
                    if (t.id === trackId) {
                        return { ...t, isMuted: true };
                    }
                    return t;
                });
                return {
                    ...p,
                    tracks: [...updatedTracks, newAudioTrack]
                };
            });

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
    
    // --- Clip Drag and Drop ---
    const handleClipMouseDown = (e: React.MouseEvent, clip: DAWClip, trackId: string) => {
        if (e.button !== 0) return; // Only drag with left click
        e.preventDefault();
        e.stopPropagation();

        const clipElement = e.currentTarget as HTMLDivElement;
        const rect = clipElement.getBoundingClientRect();
        
        setDragInfo({
            clip,
            originalTrackId: trackId,
            grabOffsetX: e.clientX - rect.left,
        });
    };

    useEffect(() => {
        if (!dragInfo) return;

        const timelineGrid = timelineGridRef.current;
        const ghost = dragGhostRef.current;
        if (!timelineGrid || !ghost) return;

        const timelineRect = timelineGrid.getBoundingClientRect();

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();

            const newTop = e.clientY - timelineRect.top - (trackHeight / 2) + timelineGrid.parentElement!.scrollTop;
            const newLeft = e.clientX - timelineRect.left - dragInfo.grabOffsetX + timelineGrid.parentElement!.scrollLeft;

            ghost.style.transform = `translate(${newLeft}px, ${newTop}px)`;
            ghost.style.display = 'block';

            // Clear old highlights
            timelineGrid.querySelectorAll('[data-track-id]').forEach(el => {
              el.classList.remove('drop-target-valid', 'drop-target-invalid');
            });

            // Figure out which lane we're over, then highlight it
            const targetTrackId = getTrackIdUnderPointer(e.clientX, e.clientY);
            const targetTrack = project.tracks.find(t => t.id === targetTrackId);

            if (targetTrack) {
              const lane = timelineGrid.querySelector<HTMLElement>(`[data-track-id="${targetTrack.id}"]`);
              if (lane) {
                // FIX: Check if clip type matches track type for valid drop target
                lane.classList.add(targetTrack.trackType === dragInfo.clip.type ? 'drop-target-valid' : 'drop-target-invalid');
              }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            const snapTicks = TICKS_PER_QUARTER_NOTE / 4; // 16th note snap
            const newX = e.clientX - timelineRect.left - dragInfo.grabOffsetX + timelineGrid.parentElement!.scrollLeft;
            const newStartTick = Math.max(0, Math.round(newX / pixelsPerTick / snapTicks) * snapTicks);

            const targetTrackId = getTrackIdUnderPointer(e.clientX, e.clientY);

            setProject(p => {
                const targetTrack = p.tracks.find(t => t.id === targetTrackId);
                const { clip, originalTrackId } = dragInfo!;
            
                if (!targetTrack || clip.type !== targetTrack.trackType) {
                    return p;
                }
            
                let movedClip: DAWClip;
                // FIX: Create a new clip object based on its type to maintain type safety.
                if (clip.type === 'midi') {
                    movedClip = { ...clip, startTick: newStartTick };
                } else {
                    movedClip = { ...clip, startTick: newStartTick };
                }
            
                const newTracks = p.tracks.map(t => {
                    if (t.id === targetTrack.id) {
                        const clips = t.id === originalTrackId
                            ? t.clips.map(c => (c.id === clip.id ? movedClip : c))
                            : [...t.clips, movedClip];
                        return { ...t, clips };
                    }
                    if (t.id === originalTrackId) {
                        return { ...t, clips: t.clips.filter(c => c.id !== clip.id) };
                    }
                    return t;
                });
            
                return { ...p, tracks: newTracks };
            });

            // remove highlights
            timelineGrid.querySelectorAll('[data-track-id]').forEach(el => {
              el.classList.remove('drop-target-valid', 'drop-target-invalid');
            });
            
            ghost.style.display = 'none';
            setDragInfo(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp, { once: true });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragInfo, project.tracks]);

    const renderClip = (clip: DAWClip, track: DAWTrack) => {
        const style = {
            left: clip.startTick * pixelsPerTick,
            width: clip.durationTicks * pixelsPerTick,
            backgroundColor: track.color + 'A0',
            borderColor: track.color,
            visibility: dragInfo?.clip.id === clip.id ? ('hidden' as const) : ('visible' as const),
        };
        
        return (
             <div 
                key={clip.id} 
                data-clip-id={clip.id}
                className="absolute h-16 top-2 rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing" 
                style={style}
                onMouseDown={(e) => handleClipMouseDown(e, clip, track.id)}
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
             <style>{`
                .drop-target-valid { background-color: rgba(74, 222, 128, 0.2) !important; }
                .drop-target-invalid { background-color: rgba(239, 68, 68, 0.2) !important; }
            `}</style>
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
                        <li onClick={() => {
                            if (!contextMenu) return;
                            addClip(contextMenu.trackId, Math.floor(contextMenu.tick / ticksPerBar) * ticksPerBar);
                            setContextMenu(null);
                        }} className="px-3 py-1.5 hover:bg-red-600 cursor-pointer">Create MIDI Clip</li>
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
                            <button onClick={() => addTrack('synth')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Add Synth Track">🎹</button>
                            <button onClick={() => addTrack('drum')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Add Drum Track">🥁</button>
                            <button onClick={() => addTrack('audio')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Add Audio Track">🎤</button>
                        </div>
                    </div>
                    <div ref={trackHeadersRef} className="flex-grow overflow-hidden">
                        <div>
                            {project.tracks.map(track => (
                                <TrackHeader key={track.id} track={track} isSelected={track.id === selectedTrackId} onSelect={() => setSelectedTrackId(track.id)} onDelete={deleteTrack} updateTrack={updateTrack} />
                            ))}
                        </div>
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
                    <TimelineRuler 
                        durationTicks={project.durationTicks}
                        pixelsPerTick={pixelsPerTick} 
                        scrollLeft={scrollLeft}
                        loopRegion={project.loopRegion}
                        onLoopRegionChange={(newRegion) => setProject(p => ({...p, loopRegion: newRegion}))}
                    />
                    <div className="flex-grow overflow-auto" ref={timelineContainerRef} onScroll={handleScroll}>
                        <div ref={timelineGridRef} className="relative" style={{width: project.durationTicks * pixelsPerTick, height: project.tracks.length * trackHeight }}>
                            {/* Track Lanes */}
                            {project.tracks.map((track) => (
                                <div
                                  key={track.id}
                                  data-track-id={track.id}
                                  className={`relative h-20 border-b border-black transition-colors duration-200 ${
                                    track.id === selectedTrackId ? 'bg-gray-700/30' : ''
                                  }`}
                                  style={{ height: trackHeight }}
                                  onDoubleClick={(e) => {
                                    // only create when double-clicking the empty lane of a MIDI track
                                    if (e.target !== e.currentTarget || track.trackType !== 'midi') return;

                                    const laneRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const scroller = timelineGridRef.current?.parentElement;
                                    const scrollLeft = scroller?.scrollLeft ?? 0;

                                    const x = e.clientX - laneRect.left + scrollLeft; // viewport→lane X
                                    const tick = x / pixelsPerTick;
                                    addClip(track.id, tick);
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, track)}
                                >
                                  {track.clips.map(c => renderClip(c, track))}
                                </div>
                            ))}
                             {/* Drag Ghost */}
                             {dragInfo && (
                                <div
                                    ref={dragGhostRef}
                                    className="absolute h-16 top-0 rounded-lg border-2 overflow-hidden pointer-events-none z-20"
                                    style={{
                                        display: 'none',
                                        width: dragInfo.clip.durationTicks * pixelsPerTick,
                                        backgroundColor: project.tracks.find(t => t.id === dragInfo.originalTrackId)?.color + 'A0',
                                        borderColor: project.tracks.find(t => t.id === dragInfo.originalTrackId)?.color,
                                    }}
                                >
                                    <div className="p-1 text-xs font-bold truncate select-none">{dragInfo.clip.name}</div>
                                </div>
                            )}
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
