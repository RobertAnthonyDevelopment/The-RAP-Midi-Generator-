import React, { useState, useCallback } from 'react';
import { suggestProgressions } from '../services/geminiService';
import { Spinner } from './Spinner';

interface ProgressionSuggesterProps {
  onUseProgression: (progression: string[]) => void;
}

export const ProgressionSuggester: React.FC<ProgressionSuggesterProps> = ({ onUseProgression }) => {
  const [prompt, setPrompt] = useState<string>('A heroic and uplifting progression');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for the progression.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const result = await suggestProgressions(prompt);
      setSuggestions(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to get suggestions: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="prompt" className="block mb-1 text-sm font-medium text-gray-400">Describe the mood or genre:</label>
        <div className="flex gap-2">
            <input
            type="text"
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Sad and cinematic"
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
            />
            <button
                onClick={handleSuggest}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500"
            >
                {isLoading ? <Spinner /> : 'Suggest'}
            </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {suggestions.length > 0 && (
        <div className="space-y-3 pt-4">
          <h4 className="text-lg font-medium text-gray-300">Suggested Progression:</h4>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
            {suggestions.map((chord, index) => (
              <span key={index} className="bg-gray-700 text-white py-1.5 px-3 rounded-full text-sm font-medium">
                {chord}
              </span>
            ))}
          </div>
          <button
            onClick={() => onUseProgression(suggestions)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500"
          >
            Use This Progression
          </button>
        </div>
      )}
    </div>
  );
};
