'use client';

import React from 'react';
import { Home, Layers, Palette, Loader2, Sparkles } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { PhotoPreview } from './PhotoPreview';

const ROOM_OPTIONS = [
  { value: 'living_room', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'home_office', label: 'Home Office' },
];

const STYLE_OPTIONS = [
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'japandi', label: 'Modern Japandi' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'bohemian', label: 'Bohemian' },
  { value: 'scandinavian', label: 'Scandinavian' },
];

const PALETTE_OPTIONS = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'warm', label: 'Warm Earth' },
  { value: 'cool', label: 'Cool Tones' },
  { value: 'bold', label: 'Bold Statement' },
];

interface GeneratorFormProps {
  roomType: string;
  setRoomType: (val: string) => void;
  style: string;
  setStyle: (val: string) => void;
  palette: string;
  setPalette: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  imageUrl: string | null;
  setImageUrl: (val: string | null) => void;
  isGenerating: boolean;
  onSubmit: () => void;
  onError: (message: string, code: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function GeneratorForm({
  roomType,
  setRoomType,
  style,
  setStyle,
  palette,
  setPalette,
  notes,
  setNotes,
  selectedFile,
  setSelectedFile,
  imageUrl,
  setImageUrl,
  isGenerating,
  onSubmit,
  onError,
  fileInputRef,
}: GeneratorFormProps) {
  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 200) {
      setNotes(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;

    if (!selectedFile && !imageUrl) {
      onError('Please upload your room photo first.', 'INVALID_PARAMS');
      return;
    }

    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* 1. Image Upload */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[12px] font-semibold text-white/90 uppercase tracking-wider text-pink-300">
          <span className="font-bold mr-1">1.</span> Upload Your Room
        </h2>
        <PhotoPreview
          selectedFile={selectedFile}
          imageUrl={imageUrl}
          onFileSelect={(file) => {
            setSelectedFile(file);
            setImageUrl(null);
          }}
          onClear={() => {
            setSelectedFile(null);
            setImageUrl(null);
          }}
          onError={onError}
          fileInputRef={fileInputRef}
        />
      </div>

      {/* 2. Choose Options */}
      <div className="flex flex-col gap-2 mt-1">
        <h2 className="text-[12px] font-semibold text-white/90 uppercase tracking-wider text-blue-300">
          <span className="font-bold mr-1">2.</span> Select Style
        </h2>

        <div className="flex flex-col gap-2.5">
          <CustomSelect
            label="Room Type"
            icon={Home}
            value={roomType}
            options={ROOM_OPTIONS}
            onChange={setRoomType}
          />

          <CustomSelect
            label="Style"
            icon={Layers}
            value={style}
            options={STYLE_OPTIONS}
            onChange={setStyle}
          />

          <CustomSelect
            label="Color Palette"
            icon={Palette}
            value={palette}
            options={PALETTE_OPTIONS}
            onChange={setPalette}
          />
        </div>
      </div>

      {/* 3. Notes Area */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex justify-between items-center">
          <label htmlFor="notes" className="text-[12px] font-semibold text-white/90 uppercase tracking-wider text-purple-300 cursor-pointer">
            <span className="font-bold mr-1">3.</span> What do you want to add?
          </label>
          <span className="text-[9px] text-white/40 font-mono">
            {notes.length}/200
          </span>
        </div>
        <div className="glass p-3 rounded-[1.2rem] flex flex-col h-24 relative group border border-white/5 focus-within:border-purple-300/40 transition">
          <textarea
            id="notes"
            value={notes}
            onChange={handleNotesChange}
            disabled={isGenerating}
            placeholder="Example: Add a grey fluffy rug, place a Monstera plant in the corner, and mount a TV on the wall..."
            className="bg-transparent w-full resize-none outline-none text-[12px] text-white/95 h-full placeholder-white/30"
          />
        </div>
      </div>

      {/* Submit Action Button */}
      <button
        type="submit"
        disabled={isGenerating}
        className={`mt-2 btn-generate w-full py-4 rounded-[1.5rem] text-[13px] font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)] text-black cursor-pointer select-none active:scale-[0.98] transition-transform duration-150 ${
          isGenerating ? 'opacity-80 cursor-not-allowed scale-[0.98]' : 'hover:scale-[1.01]'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="animate-spin w-4 h-4" />
            Redesigning Your Room...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Visualize Now
          </>
        )}
      </button>
    </form>
  );
}
