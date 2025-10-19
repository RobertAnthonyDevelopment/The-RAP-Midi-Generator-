import { useEffect, useRef } from "react";
import { DAWTrack } from "../types";

type TrackNodes = {
  gain: GainNode;
  panner: StereoPannerNode;
};

export function useAudioGraph(
  tracks: DAWTrack[],
  audioContextRef: React.MutableRefObject<AudioContext | undefined>
) {
  const nodesRef = useRef<Map<string, TrackNodes>>(new Map());

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    const ac = audioContextRef.current!;

    // prune deleted tracks
    const currentIds = new Set(tracks.map((t) => t.id));
    for (const [id, nodes] of nodesRef.current.entries()) {
      if (!currentIds.has(id)) {
        try {
          nodes.gain.disconnect();
          nodes.panner.disconnect();
        } catch {}
        nodesRef.current.delete(id);
      }
    }

    // ensure nodes for all tracks + keep params synced
    const anySolo = tracks.some((t) => t.isSoloed);
    for (const t of tracks) {
      let nodes = nodesRef.current.get(t.id);
      if (!nodes) {
        const gain = ac.createGain();
        const panner =
          ac.createStereoPanner?.() ??
          // very old Safari: fake panner that just passes through
          ({
            connect: (dest: any) => gain.connect(dest),
            disconnect: () => {},
            pan: { setValueAtTime: () => {} },
          } as unknown as StereoPannerNode);

        gain.connect(panner as unknown as AudioNode);
        (panner as unknown as AudioNode).connect(ac.destination);
        nodes = { gain, panner: panner as StereoPannerNode };
        nodesRef.current.set(t.id, nodes);
      }

      const audible = !t.isMuted && (!anySolo || t.isSoloed);
      nodes.gain.gain.setValueAtTime(audible ? t.volume : 0, ac.currentTime);
      if (nodes.panner.pan) {
        nodes.panner.pan.setValueAtTime(t.pan, ac.currentTime);
      }
    }
  }, [tracks, audioContextRef]);

  return nodesRef;
}
