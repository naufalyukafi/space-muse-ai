'use client';

import React from 'react';
import { CloudUpload } from 'lucide-react';
import { Generation, GenerationCard } from './GenerationCard';

interface GalleryProps {
  generations: Generation[];
  activeId: string | null;
  onCardSelect: (gen: Generation) => void;
  onRedesignClick: (gen: Generation) => void;
  onUploadClick: () => void;
  isLoading?: boolean;
}

// Interactive sample designs matching frontend.html
export const SAMPLE_GENERATIONS: Generation[] = [
  {
    id: 'sample-industrial',
    original_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1000&auto=format&fit=crop', // clean empty bedroom/loft
    result_url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1000&auto=format&fit=crop', // industrial render
    room_type: 'bedroom',
    style: 'industrial',
    palette: 'bold',
    notes: 'Transform to Industrial style with exposed brick and black metal accents',
    status: 'completed',
    created_at: '',
  },
  {
    id: 'sample-office',
    original_url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1000&auto=format&fit=crop', // study room before
    result_url: 'https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?q=80&w=1000&auto=format&fit=crop', // cozy office space
    room_type: 'home_office',
    style: 'scandinavian',
    palette: 'neutral',
    notes: 'Add a minimalist workspace, light wood desk, and bookshelves',
    status: 'completed',
    created_at: '',
  },
  {
    id: 'sample-kids',
    original_url: 'https://images.unsplash.com/photo-1505693395321-883724634266?q=80&w=1000&auto=format&fit=crop', // standard bedroom before
    result_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop', // bright room after
    room_type: 'bedroom',
    style: 'bohemian',
    palette: 'warm',
    notes: 'Make it a kids bedroom with warm lighting and a cute rug',
    status: 'completed',
    created_at: '',
  },
];

export function Gallery({
  generations,
  activeId,
  onCardSelect,
  onRedesignClick,
  onUploadClick,
  isLoading = false,
}: GalleryProps) {
  if (isLoading) {
    return (
      <div className="h-full flex gap-3 w-full overflow-x-auto px-1 py-1 scrollbar-thin">
        {[1, 2, 3].map((i) => (
          <div
            key={`skeleton-${i}`}
            className="h-full w-[200px] flex-shrink-0 rounded-[1.5rem] border border-white/5 bg-white/[0.02] flex flex-col justify-end p-3 relative overflow-hidden"
          >
            <div className="shimmer"></div>
            <div className="h-3.5 bg-white/10 rounded w-3/4 mb-1.5 z-10"></div>
            <div className="h-2.5 bg-white/5 rounded w-1/2 z-10"></div>
          </div>
        ))}
        <div
          className="h-full w-[200px] flex-shrink-0 rounded-[1.5rem] overflow-hidden border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center p-2 text-center select-none opacity-40 pointer-events-none"
        >
          <CloudUpload className="w-6 h-6 text-white/20 mb-1" />
          <p className="text-[10px] font-bold text-white/30 leading-tight">Your Room's Turn!</p>
          <p className="text-[9px] text-white/20 mt-0.5">Loading...</p>
        </div>
      </div>
    );
  }

  const displayItems = generations.length > 0 ? generations : SAMPLE_GENERATIONS;

  return (
    <div className="h-full flex gap-3 w-full overflow-x-auto px-1 py-1 scrollbar-thin">
      {displayItems.map((item) => (
        <div key={item.id} className="h-full w-[200px] flex-shrink-0">
          <GenerationCard
            generation={item}
            isActive={activeId === item.id}
            onClick={() => onCardSelect(item)}
            onRedesign={(e) => {
              e.stopPropagation();
              onRedesignClick(item);
            }}
          />
        </div>
      ))}

      {/* Dotted Upload Card (Placeholder) */}
      <div
        onClick={onUploadClick}
        className="h-full w-[200px] flex-shrink-0 rounded-[1.5rem] overflow-hidden cursor-pointer hover:bg-white/10 transition border border-white/20 glass border-dashed flex flex-col items-center justify-center p-2 text-center select-none group"
      >
        <CloudUpload className="w-6 h-6 text-pink-300 drop-shadow-md mb-1 group-hover:scale-110 transition duration-300" />
        <p className="text-[10px] font-bold text-white leading-tight">Your Room's Turn!</p>
        <p className="text-[9px] text-white/40 mt-0.5">Upload photo now</p>
      </div>
    </div>
  );
}
