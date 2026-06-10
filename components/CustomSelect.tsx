'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  icon: LucideIcon;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function CustomSelect({ label, icon: Icon, value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="glass px-4 py-3 rounded-[1.2rem] flex justify-between items-center hover:bg-white/5 transition w-full text-left"
      >
        <span className="text-[12px] text-white/80 flex items-center gap-3">
          <Icon className="w-4 h-4 text-white/40" />
          {label}
        </span>
        <span className="text-[11px] text-white/60 flex items-center gap-1">
          {selectedOption?.label || value}
          <ChevronDown
            className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-[1.2rem] glass overflow-hidden shadow-2xl border border-white/10 max-h-60 overflow-y-auto animate-fade-in bg-zinc-900/95 backdrop-blur-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-3 text-left text-[12px] hover:bg-white/10 transition flex items-center justify-between ${
                option.value === value ? 'text-pink-300 font-semibold bg-white/5' : 'text-white/80'
              }`}
            >
              {option.label}
              {option.value === value && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
