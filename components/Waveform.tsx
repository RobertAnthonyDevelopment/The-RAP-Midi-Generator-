import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  audioBuffer: AudioBuffer;
  height: number;
}

const drawWaveform = (
    canvas: HTMLCanvasElement, 
    buffer: AudioBuffer,
    color: string
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;

        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }

        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
};


export const Waveform: React.FC<WaveformProps> = ({ audioBuffer, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && audioBuffer) {
        // Use ResizeObserver to handle canvas resizing gracefully
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width } = entry.contentRect;
                canvas.width = width;
                canvas.height = height; // Use passed height
                drawWaveform(canvas, audioBuffer, 'rgba(255, 255, 255, 0.5)');
            }
        });

        resizeObserver.observe(canvas);

        return () => resizeObserver.disconnect();
    }
  }, [audioBuffer, height]);

  return <canvas ref={canvasRef} height={height} className="w-full absolute inset-0 opacity-50 pointer-events-none" />;
};