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
import { Play, Stop, ToStart, Record, Mixer as MixerIcon, ChannelRackIcon, KeyboardIcon } from './Icons';
import { TICKS_PER_QUARTER_NOTE } from '../constants';
import { patternToNotes } from '../utils/patternUtils';

interface DAWProps {
    initialProject: DAWProject;
    onProjectChange: (project: DAWProject) => void;
}

const pixelsPerTick = 0.05;
const ticksPerBar = TICKS_PER_QUARTER_NOTE * 4;

const ticksToSeconds = (ticks: number, bpm: number): number => {
    const secondsPerQuarter = 60 / bpm;
    const secondsPerTick = secondsPerQuarter / TICKS_PER_QUARTER_NOTE;
    return ticks * secondsPerTick;
};

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
    const timelineGridRef = useRef<HTMLDivElement>(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [modal, setModal] = useState<{ type: 'mixer' | 'piano-roll' | 'channel-rack' | 'ai-synth', clip?: MIDIDAWClip, trackId?: string } | null>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, trackId: string, tick: number, clip?: DAWClip } | null>(null);

    const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);

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
        const { instrument } = track;
        if (!audioContext || !trackNodes || !instrument) return;

        const durationSec = ticksToSeconds(note.durationTicks, project.bpm);
        const noteId = `play-${track.id}-${note.midiNote}-${when}`;
        
        if (instrument.type === 'synth') {
            const params = instrument.params;
            const freq = 440 * Math.pow(2, (note.midiNote - 69) / 12);
            
            const gainNode = audioContext.createGain();
            gainNode.connect(trackNodes.gain);
            gainNode.gain.setValueAtTime(0, when);
            gainNode.gain.linearRampToValueAtTime(note.velocity, when + params.envelope.attack);
            gainNode.gain.exponentialRampToValueAtTime(params.envelope.sustain * note.velocity, when + params.envelope.attack + params.envelope.decay);
            gainNode.gain.setValueAtTime(params.envelope.sustain * note.velocity, when + durationSec - params.envelope.release);
            gainNode.gain.linearRampToValueAtTime(0, when + durationSec);

            const filter = audioContext.createBiquadFilter();
            filter.type = params.filter.type;
            filter.frequency.setValueAtTime(params.filter.frequency, when);
            filter.Q.setValueAtTime(params.filter.q, when);
            
            const osc1 = audioContext.createOscillator();
            osc1.type = params.oscillator1.type;
            osc1.frequency.value = freq;
            osc1.detune.value = params.oscillator1.detune;
            
            const osc2 = audioContext.createOscillator();
            osc2.type = params.oscillator2.type;
            osc2.frequency.value = freq;
            osc2.detune.value = params.oscillator2.detune;
            
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            
            osc1.start(when);
            osc2.start(when);
            osc1.stop(when + durationSec);
            osc2.stop(when + durationSec);
            
            activePlaybackSourcesRef.current.set(noteId, { osc1, osc2, gainNode });
        } else if (instrument.type === 'sampler' && instrument.sample) {
            const source = audioContext.createBufferSource();
            source.buffer = instrument.sample.buffer;
            source.connect(trackNodes.gain);
            source.start(when);
            activePlaybackSourcesRef.current.set(noteId, source);
        }

    }, [project.bpm]);
    
    const stopPlayback = useCallback(() => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
        activePlaybackSourcesRef.current.forEach(source => {
            try {
                if (source.stop) { // For BufferSource
                    source.stop(0);
                } else if (source.osc1) { // For Synth
                    source.osc1.stop(0);
                    source.osc2.stop(0);
                }
            } catch(e) { /* ignore errors from stopping already stopped sources */ }
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
                if(clip.type === 'midi') {
                    clip.notes.forEach(note => {
                        const noteStartInTicks = clip.startTick + note.startTick;
                        const notePlayTime = playbackStartTime + ticksToSeconds(noteStartInTicks, project.bpm) - scheduleStartOffset;
                        if(notePlayTime >= playbackStartTime) {
                             playNote(track, note, notePlayTime);
                        }
                    });
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
        const { instrument } = track;
        if (!audioContext || !trackNodes || !instrument) return;

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const noteId = `vk-${midiNote}`;
        if (activeVKSourcesRef.current.has(noteId)) return;
        
        if (instrument.type === 'synth') {
            const now = audioContext.currentTime;
            const params = instrument.params;
            const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

            const gainNode = audioContext.createGain();
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.8, now + params.envelope.attack);
            gainNode.gain.exponentialRampToValueAtTime(params.envelope.sustain * 0.8, now + params.envelope.attack + params.envelope.decay);
            
            const filter = audioContext.createBiquadFilter();
            filter.type = params.filter.type;
            filter.frequency.setValueAtTime(params.filter.frequency, now);
            filter.Q.setValueAtTime(params.filter.q, now);
            
            const osc1 = audioContext.createOscillator();
            osc1.type = params.oscillator1.type;
            osc1.frequency.value = freq;
            osc1.detune.value = params.oscillator1.detune;
            
            const osc2 = audioContext.createOscillator();
            osc2.type = params.oscillator2.type;
            osc2.frequency.value = freq;
            osc2.detune.value = params.oscillator2.detune;
            
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(trackNodes.gain);

            osc1.start(now);
            osc2.start(now);

            activeVKSourcesRef.current.set(noteId, { gainNode, osc1, osc2 });

        } else if (instrument.type === 'sampler' && instrument.sample) {
            const source = audioContext.createBufferSource();
            source.buffer = instrument.sample.buffer;
            source.connect(trackNodes.gain);
            source.start();
        }
    }, [selectedTrack]);

    const stopVirtualKey = useCallback((midiNote: number) => {
        const track = selectedTrack;
        const audioContext = audioContextRef.current;
        const noteId = `vk-${midiNote}`;
        const active = activeVKSourcesRef.current.get(noteId);
        
        if (!audioContext || !active || !track?.instrument || track.instrument.type !== 'synth') return;

        const { gainNode, osc1, osc2 } = active;
        const now = audioContext.currentTime;
        const releaseTime = track.instrument.params.envelope.release;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
        
        osc1.stop(now + releaseTime + 0.1);
        osc2.stop(now + releaseTime + 0.1);

        activeVKSourcesRef.current.delete(noteId);
    }, [selectedTrack]);

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
                {clip.type === 'audio' && <Waveform audioBuffer={clip.audioBuffer} height={40} />}
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
                            <button onClick={handleTransportStop} className="p-2 text-gray-300 hover:text-white"><ToStart /></button>
                            <button onClick={handleTransportPlay} className="p-3 bg-red-600 hover:bg-red-500 rounded-full text-white">{isPlaying ? <Stop/> : <Play />}</button>
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
                                        if (e.target === e.currentTarget) {
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
                />
            </div>
            {isKeyboardVisible && (
                <VirtualKeyboard onNoteOn={playVirtualKey} onNoteOff={stopVirtualKey} />
            )}
        </div>
    );
};