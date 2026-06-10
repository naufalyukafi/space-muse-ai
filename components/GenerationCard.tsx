'use client';

import React from 'react';
import { RotateCw } from 'lucide-react';

export interface Generation {
  id: string;
  original_url: string;
  result_url: string;
  room_type: string;
  style: string;
  palette: string;
  notes: string | null;
  status: string;
  created_at: string;
}

interface GenerationCardProps {
  generation: Generation;
  isActive: boolean;
  onClick: () => void;
  onRedesign: (e: React.MouseEvent) => void;
}

const ROOM_LABELS: Record<string, string> = {
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  home_office: 'Home Office',
};

const STYLE_LABELS: Record<string, string> = {
  minimalist: 'Minimalist',
  japandi: 'Modern Japandi',
  industrial: 'Industrial',
  bohemian: 'Bohemian',
  scandinavian: 'Scandinavian',
};

export function GenerationCard({ generation, isActive, onClick, onRedesign }: GenerationCardProps) {
  const roomLabel = ROOM_LABELS[generation.room_type] || generation.room_type;
  const styleLabel = STYLE_LABELS[generation.style] || generation.style;

  return (
    <div
      onClick={onClick}
      className={`relative w-full h-full rounded-[1.5rem] overflow-hidden cursor-pointer hover:-translate-y-1 hover:z-20 transition-all duration-300 group select-none ${
        isActive
          ? 'ring-2 ring-pink-400 border-transparent shadow-[0_0_15px_rgba(244,114,182,0.4)] z-10'
          : 'border border-white/10 hover:border-white/30'
      }`}
    >
      {/* Background image (result) */}
      <img
        src={generation.result_url}
        alt={`${roomLabel} - ${styleLabel}`}
        className="w-full h-full object-cover group-hover:scale-110 transition duration-500 pointer-events-none"
      />

      {/* Info Overlay at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent z-10 flex flex-col justify-end">
        <p className="text-[11px] text-white font-semibold truncate leading-tight">
          {roomLabel} — {styleLabel}
        </p>
        {generation.notes && (
          <p className="text-[9px] text-white/50 truncate mt-0.5 italic">
            "{generation.notes}"
          </p>
        )}
      </div>

      {/* Redesign hover action button */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
        <button
          type="button"
          onClick={onRedesign}
          className="glass px-3 py-1.5 rounded-full text-[10px] font-bold text-white bg-pink-500/20 border-pink-400/30 hover:bg-pink-500/40 hover:scale-105 transition flex items-center gap-1.5 shadow-md"
          title="Use these options to redesign"
        >
          <RotateCw className="w-3 h-3" /> Redesign
        </button>
      </div>

      {/* Active state indicator dot */}
      {isActive && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-400 z-30 animate-pulse shadow-[0_0_8px_rgba(244,114,182,0.8)]"></div>
      )}
    </div>
  );
}
