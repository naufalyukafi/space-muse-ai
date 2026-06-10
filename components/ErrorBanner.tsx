'use client';

import React from 'react';
import {
  AlertCircle,
  Hourglass,
  ImageOff,
  Contrast,
  Sliders,
  Gauge,
  AlertTriangle,
  X
} from 'lucide-react';

interface ErrorBannerProps {
  error: {
    message: string;
    code: string;
  } | null;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  let title = 'An Error Occurred';
  let message = error.message;
  let IconComponent = AlertCircle;

  // Customize based on the API response error code
  switch (error.code) {
    case 'TIMEOUT':
      title = 'AI is Busy';
      message = 'Our AI service is currently overloaded. Please try again in a moment.';
      IconComponent = Hourglass;
      break;
    case 'EMPTY_RESPONSE':
      title = 'Image Processing Failed';
      message = 'AI could not generate a design for this image. Please ensure the room photo is bright and clear.';
      IconComponent = ImageOff;
      break;
    case 'FILE_TOO_LARGE':
      title = 'File Size Too Large';
      message = 'Maximum photo size is 10MB. Please use a lower resolution photo.';
      IconComponent = AlertCircle;
      break;
    case 'FILE_TOO_SMALL':
      title = 'Photo Size Too Small';
      message = 'Photo must be at least 50KB. Please upload a higher resolution or larger image.';
      IconComponent = AlertCircle;
      break;
    case 'INVALID_PARAMS':
      title = 'Invalid Parameters';
      message = 'Invalid category selection. Please select from the dropdown options.';
      IconComponent = Sliders;
      break;
    case 'NOTES_TOO_LONG':
      title = 'Notes Too Long';
      message = 'Notes must be 200 characters or less.';
      IconComponent = AlertCircle;
      break;
    case 'RATE_LIMIT_ERROR':
      title = 'Rate Limit Exceeded';
      message = 'You have made too many requests. Please wait a few seconds before trying again.';
      IconComponent = Gauge;
      break;
    case 'GENERATION_ERROR':
      title = 'AI Generation Failed';
      if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('API key') || error.message.includes('invalid authentication credentials')) {
        title = 'AI Authentication Issue';
        message = 'The AI service returned an authentication error. Please verify that the server has a valid GEMINI_API_KEY.';
      } else {
        message = 'We encountered an error generating your design. Please try again in a few moments.';
      }
      IconComponent = AlertTriangle;
      break;
    case 'DATABASE_ERROR':
      title = 'Database Error';
      message = 'Failed to save or fetch design data. Please try again in a moment.';
      IconComponent = AlertTriangle;
      break;
    case 'STORAGE_UPLOAD_ERROR':
      title = 'Upload Failed';
      message = 'Failed to upload image. Please check your internet connection and try again.';
      IconComponent = AlertTriangle;
      break;
    case 'CONNECTION_ERROR':
    case 'UNEXPECTED_ERROR':
      title = 'Connection Issue';
      message = 'A connection or server-side issue occurred. Please check your network and try again.';
      IconComponent = AlertTriangle;
      break;
    default:
      title = 'An Error Occurred';
      IconComponent = AlertCircle;
      break;
  }

  return (
    <div className="glass border-red-500/20 bg-red-950/20 text-white rounded-[1.2rem] p-4 relative flex gap-3 shadow-[0_4px_30px_rgba(239,68,68,0.15)] animate-slide-down border">
      <div className="text-red-400 shrink-0 mt-0.5">
        <IconComponent className="w-5 h-5" />
      </div>
      <div className="flex flex-col gap-0.5 pr-6">
        <h4 className="text-[12px] font-bold text-red-300 uppercase tracking-wider">
          {title}
        </h4>
        <p className="text-[11px] text-white/80 leading-relaxed">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 text-white/40 hover:text-white/80 transition"
        title="Dismiss warning"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
