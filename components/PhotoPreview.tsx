'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Trash2, Camera } from 'lucide-react';

interface PhotoPreviewProps {
  selectedFile: File | null;
  imageUrl?: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onError: (message: string, code: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function PhotoPreview({
  selectedFile,
  imageUrl,
  onFileSelect,
  onClear,
  onError,
  fileInputRef,
}: PhotoPreviewProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const validateAndSelectFile = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const minSize = 50 * 1024; // 50KB
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      onError('Unsupported image type. Only JPEG, PNG, and WebP are allowed.', 'INVALID_PARAMS');
      return;
    }

    if (file.size > maxSize) {
      onError('Max file size is 10MB', 'FILE_TOO_LARGE');
      return;
    }

    if (file.size < minSize) {
      onError('Image too small or dark (Min size is 50KB)', 'FILE_TOO_SMALL');
      return;
    }

    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Create local object URL for preview only when selectedFile/imageUrl changes
  const filePreviewUrl = React.useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile);
    }
    return imageUrl || null;
  }, [selectedFile, imageUrl]);

  // Cleanup object URL
  React.useEffect(() => {
    return () => {
      if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  if (filePreviewUrl) {
    const isRemote = !selectedFile;
    return (
      <div className="glass p-3 rounded-[1.5rem] flex items-center justify-between h-28 border border-white/20 relative group">
        <div className="flex items-center gap-3 w-full overflow-hidden">
          <Image
            src={filePreviewUrl}
            alt="Preview"
            width={80}
            height={80}
            className="rounded-[1rem] object-cover border border-white/10 shrink-0"
            loading="eager"
            unoptimized={filePreviewUrl.startsWith('blob:')}
          />
          <div className="flex flex-col min-w-0 pr-6">
            <span className="text-[12px] font-semibold text-white/90 truncate">
              {isRemote ? 'Original Design Photo' : selectedFile?.name}
            </span>
            <span className="text-[10px] text-white/50">
              {isRemote ? 'Reusing uploaded image' : `${((selectedFile?.size || 0) / 1024).toFixed(1)} KB`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 top-3 w-8 h-8 rounded-full bg-black/60 hover:bg-red-500/80 text-white/80 hover:text-white flex items-center justify-center transition border border-white/10"
          title="Remove photo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      className={`glass p-5 rounded-[1.5rem] flex flex-col items-center justify-center h-28 border-2 border-dashed cursor-pointer transition group select-none ${
        isDragActive
          ? 'border-pink-400 bg-pink-500/10'
          : 'border-white/20 hover:bg-white/5 hover:border-pink-300/50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleChange}
      />
      <Camera className="w-6 h-6 text-white/40 group-hover:text-white/80 transition mb-2" />
      <span className="text-[12px] text-white/70 font-medium">Click or Drop Photo Here</span>
      <span className="text-[9px] text-white/40 mt-1">JPEG, PNG, or WebP (50KB - 10MB)</span>
    </div>
  );
}

