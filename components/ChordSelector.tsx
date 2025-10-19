import React from 'react';
import { Note, ChordType } from '../types';
import { NOTES, CHORD_TYPES } from '../constants';

interface ChordSelectorProps {
  rootNote: Note;
  setRootNote: (note: Note) => void;
  chordType: ChordType;
  setChordType: (type: ChordType) => void;
  octave: number;
  setOctave: (octave: number) => void;
  onAddChord: () => void;
}

const SelectInput = <T extends string>({ label, value, onChange, options }: { label: string, value: T, onChange: (value: T) => void, options: readonly T[] }) => (
  <div className="flex flex-col">
    <label htmlFor={label} className="mb-1 text-sm font-medium text-gray-400">{label}</label>
    <select
      id={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
    >
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);

const OctaveSelector: React.FC<{ octave: number, setOctave: (octave: number) => void }> = ({ octave, setOctave }) => (
    <div className="flex flex-col">
        <label htmlFor="octave" className="mb-1 text-sm font-medium text-gray-400">Octave</label>
        <div className="flex items-center gap-2">
            <button onClick={() => setOctave(Math.max(0, octave - 1))} className="bg-gray-700 hover:bg-gray-600 rounded-md p-2 w-10 transition">-</button>
            <input
                type="text"
                id="octave"
                readOnly
                value={octave}
                className="bg-gray-900 w-full text-center border border-gray-600 rounded-md p-2 text-white"
            />
            <button onClick={() => setOctave(Math.min(8, octave + 1))} className="bg-gray-700 hover:bg-gray-600 rounded-md p-2 w-10 transition">+</button>
        </div>
    </div>
);

export const ChordSelector: React.FC<ChordSelectorProps> = ({
  rootNote,
  setRootNote,
  chordType,
  setChordType,
  octave,
  setOctave,
  onAddChord
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectInput label="Root Note" value={rootNote} onChange={setRootNote} options={NOTES} />
        <SelectInput label="Chord Type" value={chordType} onChange={setChordType} options={Object.keys(CHORD_TYPES) as ChordType[]} />
      </div>
      <OctaveSelector octave={octave} setOctave={setOctave} />
      <button
        onClick={onAddChord}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
      >
        Add Chord
      </button>
    </div>
  );
};
