import React, { useState, useCallback } from 'react';
import { generateSynthParameters } from '../services/geminiService';
import { renderSynthFromParams } from '../utils/synthGenerator';
import { bufferToWav } from '../utils/audioGenerator';
import { Spinner } from './Spinner';

interface AISynthGeneratorProps {
    onApply: (audioBuffer: AudioBuffer, name: string) => void;
    onClose: () => void;
}

export const AISynthGenerator: React.FC<AISynthGeneratorProps> = ({ onApply, onClose }) => {
    const [prompt, setPrompt] = useState('A warm, analog synth pad');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedBuffer, setGeneratedBuffer] = useState<AudioBuffer | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedBuffer(null);
        setAudioUrl(null);
        try {
            const params = await generateSynthParameters(prompt);
            const buffer = await renderSynthFromParams(audioContext, params);
            setGeneratedBuffer(buffer);
            
            const wav = bufferToWav(buffer);
            setAudioUrl(URL.createObjectURL(wav));

        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setError(`Failed to generate sound: ${message}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, audioContext]);
    
    const handleApply = () => {
        if (generatedBuffer) {
            onApply(generatedBuffer, prompt);
        }
    };

    return (
        <div className="w-[40vw] bg-[#282828] text-white flex flex-col rounded-lg overflow-hidden border border-black">
             <header className="p-3 bg-[#3c3c3c] flex justify-between items-center border-b border-black">
                <h2 className="text-xl font-bold">AI Synthesizer</h2>
                 <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
            </header>
            <div className="p-4 space-y-4">
                 <div>
                    <label htmlFor="synth-prompt" className="block mb-1 text-sm font-medium text-gray-400">Describe the sound you want:</label>
                    <textarea
                        id="synth-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        placeholder="e.g., A sharp, percussive pluck sound"
                    />
                </div>
                 <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full flex justify-center bg-purple-.600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                    {isLoading ? <Spinner /> : 'Generate Sound'}
                </button>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                {audioUrl && (
                    <div className="space-y-3 pt-4">
                        <h4 className="font-semibold">Preview:</h4>
                        <audio controls src={audioUrl} className="w-full"></audio>
                        <button
                            onClick={handleApply}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Use this Sound
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};