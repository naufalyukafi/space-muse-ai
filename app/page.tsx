'use client';

import React, { useState, useEffect, useCallback, useOptimistic, startTransition, useRef } from 'react';
import { ArrowLeftRight, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { GeneratorForm } from '@/components/GeneratorForm';
import { Gallery, SAMPLE_GENERATIONS } from '@/components/Gallery';
import { ComparisonSlider } from '@/components/ComparisonSlider';
import { ErrorBanner } from '@/components/ErrorBanner';
import type { Generation } from '@/components/GenerationCard';

const handleUploadPlaceholderClick = () => {
  // Directly trigger the click event on the hidden file input
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  if (fileInput) {
    fileInput.click();
  } else {
    // Fallback if the input is not loaded yet
    const uploadTitle = document.querySelector('h2.text-pink-300');
    if (uploadTitle) {
      uploadTitle.scrollIntoView({ behavior: 'smooth' });
    }
  }
};

export default function Home() {
  const { session, loading: authLoading } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [roomType, setRoomType] = useState('living_room');
  const [style, setStyle] = useState('minimalist');
  const [palette, setPalette] = useState('neutral');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Gallery & UI State
  const [generations, setGenerations] = useState<Generation[]>([]);

  const [optimisticGenerations, addOptimisticGeneration] = useOptimistic(
    generations,
    (state, newGen: Generation) => [newGen, ...state]
  );

  const [activeGen, setActiveGen] = useState<Generation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);

  // Fetch gallery items
  const fetchGallery = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoadingGallery(true);
      const res = await fetch('/api/gallery', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        setGenerations(json.data);

        // Default active image to the latest run if present and current is a sample/null
        if (json.data.length > 0) {
          setActiveGen((current) => {
            if (!current || current.id.startsWith('sample-')) {
              return json.data[0];
            }
            return current;
          });
        } else {
          setActiveGen((current) => current || SAMPLE_GENERATIONS[0]);
        }
      } else {
        setActiveGen((current) => current || SAMPLE_GENERATIONS[0]);
      }
    } catch (err) {
      console.error('Error fetching gallery:', err);
      setActiveGen((current) => current || SAMPLE_GENERATIONS[0]);
    } finally {
      setLoadingGallery(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!authLoading) {
      if (session) {
        fetchGallery();
      } else {
        setLoadingGallery(false);
        setActiveGen((current) => current || SAMPLE_GENERATIONS[0]);
      }
    }
  }, [authLoading, session, fetchGallery]);

  // Handle errors triggered by components
  const handleError = useCallback((message: string, code: string) => {
    setError({ message, code });
  }, []);

  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  // Form Submit (Generation Flow)
  const handleGenerate = useCallback(async () => {
    if (!session?.access_token || (!selectedFile && !imageUrl)) return;

    setIsGenerating(true);
    setProgressMessage('Submitting request...');
    handleClearError();

    const tempId = 'optimistic-gen-' + Date.now();
    let tempUrl = '';
    if (selectedFile) {
      tempUrl = URL.createObjectURL(selectedFile);
    } else if (imageUrl) {
      tempUrl = imageUrl;
    }

    const optimisticGen: Generation = {
      id: tempId,
      original_url: tempUrl,
      result_url: '',
      room_type: roomType,
      style: style,
      palette: palette,
      notes: notes.trim() || null,
      status: 'generating',
      created_at: new Date().toISOString()
    };

    startTransition(async () => {
      addOptimisticGeneration(optimisticGen);

      const formData = new FormData();
      if (selectedFile) {
        formData.append('room_photo', selectedFile);
      } else if (imageUrl) {
        formData.append('reuse_image_url', imageUrl);
      }
      formData.append('room_type', roomType);
      formData.append('style', style);
      formData.append('palette', palette);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok && !contentType.includes('text/event-stream')) {
          const json = await res.json();
          handleError(
            json.message || 'Failed to redesign room. Please try again.',
            json.code || 'GENERATION_ERROR'
          );
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('No stream reader found');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let successData = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.status === 'progress') {
                setProgressMessage(json.message);
              } else if (json.status === 'success') {
                successData = json.data;
              } else if (json.status === 'error') {
                throw { message: json.message, code: json.code || 'GENERATION_ERROR' };
              }
            } catch (parseErr) {
              if (parseErr && typeof parseErr === 'object' && 'code' in parseErr) {
                throw parseErr;
              }
              console.error('Failed to parse line:', line, parseErr);
            }
          }
        }

        if (successData) {
          const newGen: Generation = successData;

          // Add to front of local list and select
          setGenerations((prev) => [newGen, ...prev]);
          setActiveGen(newGen);

          // Reset form inputs (image & notes)
          setSelectedFile(null);
          setImageUrl(null);
          setNotes('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          throw { message: 'Unexpected end of stream', code: 'GENERATION_ERROR' };
        }

      } catch (err: any) {
        console.error('Unexpected generation error:', err);
        handleError(
          err.message || 'Server connection error. Please try again in a few moments.',
          err.code || 'CONNECTION_ERROR'
        );
      } finally {
        setIsGenerating(false);
        setProgressMessage('');
        if (selectedFile && tempUrl.startsWith('blob:')) {
          URL.revokeObjectURL(tempUrl);
        }
      }
    });
  }, [
    session?.access_token,
    selectedFile,
    imageUrl,
    roomType,
    style,
    palette,
    notes,
    handleClearError,
    handleError,
    addOptimisticGeneration
  ]);
  // Pre-fill form options on click Redesign
  const handleRedesign = useCallback((item: Generation) => {
    setRoomType(item.room_type);
    setStyle(item.style);
    setPalette(item.palette);
    setNotes(item.notes || '');
    setSelectedFile(null);
    setImageUrl(item.result_url);
    handleClearError();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleClearError]);

  const handleCardSelect = useCallback((item: Generation) => {
    setActiveGen(item);
  }, []);


  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#121214] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-[6rem] h-[6rem] rounded-full magic-sphere animate-pulse"></div>
          <span className="text-[13px] font-semibold text-white/55 tracking-wider uppercase animate-pulse">
            Initializing AI Session...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 gap-3 flex flex-col flex-1 min-h-0 lg:h-full lg:overflow-hidden relative">
      {/* Background glow meshes */}
      <div className="ambient-bg">
        <div className="top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-400/10"></div>
        <div className="top-[20%] right-[-10%] w-[30%] h-[50%] bg-teal-500/5"></div>
        <div className="bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-pink-500/10"></div>
        <div className="top-[20%] left-[30%] w-[40%] h-[40%] bg-orange-500/5"></div>
      </div>

      {/* Main Container */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 w-full overflow-y-auto lg:overflow-hidden scrollbar-thin">

        {/* Sidebar Form */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4 lg:overflow-y-auto pr-2 pb-2 lg:h-full scrollbar-thin">

          <div className="flex flex-col items-center mt-2 mb-2 shrink-0">
            <div className="w-[6rem] h-[6rem] rounded-full magic-sphere mb-3"></div>
            <h1 className="text-[1.1rem] font-bold mb-1 tracking-tight text-white">SPACE MUSE AI</h1>
            <p className="text-[10px] text-white/50 text-center px-4 leading-normal">
              Transform empty or old rooms into your dream design in seconds.
            </p>
          </div>

          {/* Form and error reports */}
          <div className="flex flex-col gap-4">
            <ErrorBanner error={error} onDismiss={handleClearError} />

            <GeneratorForm
              roomType={roomType}
              setRoomType={setRoomType}
              style={style}
              setStyle={setStyle}
              palette={palette}
              setPalette={setPalette}
              notes={notes}
              setNotes={setNotes}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              imageUrl={imageUrl}
              setImageUrl={setImageUrl}
              isGenerating={isGenerating}
              onSubmit={handleGenerate}
              onError={handleError}
              fileInputRef={fileInputRef}
            />
          </div>
        </aside>

        {/* Dashboard Visualizer Content */}
        <section className="flex-1 min-w-0 flex flex-col gap-4 min-h-[500px] lg:h-full pb-2 lg:overflow-hidden">

          {/* Dashboard Info Banner */}
          <div className="glass p-4 rounded-[1.5rem] flex flex-col sm:flex-row items-start sm:items-center justify-between border border-white/10 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-blue-500/5 shrink-0 gap-3">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-lg border border-white/10 shadow-inner">
                <Sparkles color="orange" />
              </div>
              <div className="pr-4">
                <h2 className="text-[14px] font-bold text-white mb-0.5">
                  Imagine Your Dream Room Come to Life!
                </h2>
                <p className="text-[12px] text-white/70 leading-relaxed">
                  Have an empty room or want a change of scenery? Upload your room photo, select a style, and our AI will redesign it instantly.{' '}
                  <strong className="text-white font-medium">Slide the image below to compare the transformation!</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Main Visualizer Area */}
          <div className="h-[350px] md:h-[450px] lg:flex-1 lg:min-h-0 flex flex-col">
            {isGenerating ? (
              <div className="flex-1 rounded-[2rem] glass border border-white/10 bg-black/30 flex flex-col items-center justify-center p-8 text-center min-h-[300px] relative overflow-hidden">
                <div className="shimmer"></div>

                {/* Visualizer split mockup */}
                <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/10 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#121214]/85 border border-white/15 flex items-center justify-center text-white/35 backdrop-blur-md">
                    <ArrowLeftRight className="w-4 h-4 text-pink-300 animate-pulse" />
                  </div>
                </div>

                <div className="z-10 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500/10 to-blue-500/10 flex items-center justify-center border border-white/10 shadow-lg">
                    <Loader2 className="w-6 h-6 text-pink-300 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white/85">
                      {progressMessage || 'Transforming your space...'}
                    </h3>
                    <p className="text-[11px] text-white/45 mt-1.5 max-w-[280px] leading-relaxed">
                      AI is generating your custom interior design. This usually takes 10-20 seconds.
                    </p>
                  </div>
                </div>
              </div>
            ) : loadingGallery ? (
              <div className="flex-1 rounded-[2rem] glass border border-white/10 bg-black/30 flex flex-col items-center justify-center p-8 text-center min-h-[300px] relative overflow-hidden">
                <div className="shimmer"></div>

                {/* Visualizer split mockup */}
                <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/10 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#121214]/85 border border-white/15 flex items-center justify-center text-white/35 backdrop-blur-md">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                </div>

                <div className="z-10 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500/10 to-blue-500/10 flex items-center justify-center border border-white/10 shadow-lg">
                    <Sparkles className="w-6 h-6 text-pink-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white/85">Synchronizing Your Space...</h3>
                    <p className="text-[11px] text-white/45 mt-1.5 max-w-[280px] leading-relaxed">
                      Loading your custom designs and room history from database.
                    </p>
                  </div>
                </div>
              </div>
            ) : activeGen ? (
              <ComparisonSlider
                originalUrl={activeGen.original_url}
                resultUrl={activeGen.result_url}
                titleOriginal="Original Room"
                titleResult={`AI Redesign (${activeGen.style})`}
                notes={activeGen.notes}
              />
            ) : (
              <div className="flex-1 rounded-[2rem] glass border border-white/15 bg-black/20 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                <Sparkles className="w-10 h-10 text-white/20 mb-3 animate-pulse" />
                <h3 className="text-[14px] font-semibold text-white/80">No active design selected</h3>
                <p className="text-[11px] text-white/45 mt-1 max-w-[280px]">
                  Select one of the designs in the gallery below or upload a new photo to start the visualization.
                </p>
              </div>
            )}
          </div>

          {/* Gallery Carousel Container */}
          <div className="h-[185px] shrink-0 overflow-hidden flex flex-col gap-1.5 bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-3">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none">
                {generations.length > 0 ? 'Your Design History' : 'Room Design Inspirations'}
              </h3>
              {loadingGallery && generations.length > 0 && (
                <span className="text-[9px] text-white/30 flex items-center gap-1.5 font-medium animate-pulse">
                  <Loader2 className="animate-spin w-3 h-3" /> Syncing...
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <Gallery
                generations={optimisticGenerations}
                activeId={activeGen?.id || null}
                onCardSelect={handleCardSelect}
                onRedesignClick={handleRedesign}
                onUploadClick={handleUploadPlaceholderClick}
                isLoading={loadingGallery}
              />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
