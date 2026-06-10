'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Image, Sparkles, Download, ArrowLeftRight, MousePointer } from 'lucide-react';

interface ComparisonSliderProps {
  originalUrl: string;
  resultUrl: string;
  titleOriginal?: string;
  titleResult?: string;
  notes?: string | null;
}

export function ComparisonSlider({
  originalUrl,
  resultUrl,
  titleOriginal = 'Original Room',
  titleResult = 'AI Redesign',
  notes
}: ComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 to 100)
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set initial width
    setContainerWidth(containerRef.current.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Fetch the image as a blob and download it to force download instead of opening in a new tab
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `spacemuse-redesign-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download image:', err);
      // Fallback: open in new tab
      window.open(resultUrl, '_blank');
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
      className="relative w-full flex-1 rounded-[2rem] overflow-hidden shadow-2xl flex border border-white/10 bg-black/40 group select-none cursor-ew-resize min-h-[300px]"
    >
      {/* Before Image (Original) - Left side, clipped dynamically */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden z-10 border-r border-white/30"
        style={{ width: `${sliderPosition}%` }}
      >
        {/* Label */}
        <div className="absolute top-5 left-5 glass bg-black/40 px-4 py-2 rounded-full text-[12px] font-medium z-20 text-white/90 flex items-center gap-2 backdrop-blur-md whitespace-nowrap">
          <Image className="w-4 h-4" /> {titleOriginal}
        </div>

        {/* Force image to remain at container's full size, not clipped size */}
        <div className="absolute inset-y-0 left-0 w-full h-full" style={{ width: containerWidth ? `${containerWidth}px` : '100%' }}>
          <img
            src={originalUrl}
            alt="Original Room"
            className="w-full h-full object-cover grayscale-[10%] brightness-75 pointer-events-none"
          />
        </div>
      </div>

      {/* After Image (Redesigned) - Background, full width */}
      <div className="absolute inset-0 w-full h-full">
        {/* Label */}
        <div className="absolute top-5 right-16 glass bg-white/20 px-4 py-2 rounded-full text-[12px] font-bold z-20 text-white flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/40 backdrop-blur-md whitespace-nowrap max-w-[calc(100%-180px)] truncate">
          <Sparkles className="w-4 h-4 text-pink-300" /> {titleResult?.toUpperCase()}
        </div>

        {/* Action Buttons (Top Right) */}
        <div className="absolute top-5 right-5 flex gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            onClick={handleDownload}
            className="w-10 h-10 rounded-full glass bg-black/40 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/30 transition shadow-lg cursor-pointer"
            title="Download Design"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        <img
          src={resultUrl}
          alt="Redesigned Room"
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>

      {/* Drag Handle */}
      <div
        className="absolute inset-y-0 z-20 w-[2px] bg-white pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.4)] text-black cursor-ew-resize group-hover:scale-110 transition-transform">
          <ArrowLeftRight className="w-5 h-5" />
        </div>
      </div>

      {/* Slide Instructions Hint (Center Bottom) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass px-6 py-3 rounded-full flex gap-3 items-center border border-white/20 shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[12px] font-medium text-white/90 pointer-events-none">
        <MousePointer className="w-4 h-4 text-pink-300" /> Drag the slider to compare!
      </div>
    </div>
  );
}
