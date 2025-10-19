import React, { useState } from 'react';
import { DAWTrack } from '../types';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type ExportFormat = 'midi' | 'wav';
interface ExportSetting {
    trackId: string;
    trackName: string;
    format: ExportFormat;
    shouldExport: boolean;
}

interface ExportModalProps {
    tracks: DAWTrack[];
    onClose: () => void;
    onExport: (settings: { trackId: string, format: ExportFormat }[]) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({ tracks, onClose, onExport }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [settings, setSettings] = useState<ExportSetting[]>(() => 
        tracks.map(track => ({
            trackId: track.id,
            trackName: track.name,
            format: track.trackType === 'midi' ? 'midi' : 'wav',
            shouldExport: true,
        }))
    );

    const handleSettingChange = (trackId: string, newValues: Partial<ExportSetting>) => {
        setSettings(currentSettings =>
            currentSettings.map(s => s.trackId === trackId ? { ...s, ...newValues } : s)
        );
    };

    const handleExportClick = async () => {
        setIsExporting(true);
        const settingsToExport = settings
            .filter(s => s.shouldExport)
            .map(({ trackId, format }) => ({ trackId, format }));
        
        try {
            await onExport(settingsToExport);
        } catch (e) {
            console.error("Export failed", e);
        } finally {
            setIsExporting(false);
            onClose();
        }
    };

    return (
        <Modal onClose={onClose}>
            <div className="w-[40vw] bg-[#282828] text-white flex flex-col rounded-lg overflow-hidden border border-black">
                <header className="p-3 bg-[#3c3c3c] flex justify-between items-center border-b border-black">
                    <h2 className="text-xl font-bold">Export Stems</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </header>
                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {settings.map(setting => {
                        const track = tracks.find(t => t.id === setting.trackId);
                        if (!track) return null;
                        
                        return (
                            <div key={setting.trackId} className="flex items-center gap-4 p-2 bg-gray-800/50 rounded-md">
                                <input
                                    type="checkbox"
                                    checked={setting.shouldExport}
                                    onChange={e => handleSettingChange(setting.trackId, { shouldExport: e.target.checked })}
                                    className="w-5 h-5"
                                />
                                <span className="flex-grow font-semibold truncate">{setting.trackName}</span>
                                <select
                                    value={setting.format}
                                    onChange={e => handleSettingChange(setting.trackId, { format: e.target.value as ExportFormat })}
                                    className="bg-gray-700 p-1.5 rounded-md border border-gray-600"
                                    disabled={track.trackType === 'audio'}
                                >
                                    {track.trackType === 'midi' && <option value="midi">MIDI</option>}
                                    <option value="wav">WAV Audio</option>
                                </select>
                            </div>
                        );
                    })}
                </div>
                <footer className="p-3 bg-[#3c3c3c] border-t border-black flex justify-end">
                    <button
                        onClick={handleExportClick}
                        disabled={isExporting}
                        className="w-48 flex justify-center items-center bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-bold py-3 px-4 rounded-lg transition"
                    >
                        {isExporting ? <Spinner/> : `Export ${settings.filter(s => s.shouldExport).length} Tracks`}
                    </button>
                </footer>
            </div>
        </Modal>
    );
};