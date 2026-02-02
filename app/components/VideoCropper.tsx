'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface CropData {
  cropX: number;
  cropY: number;
  cropScale: number;
}

interface VideoCropperProps {
  videoUrl: string;
  initialCropData?: CropData;
  onSave: (cropData: CropData) => void;
  onCancel: () => void;
}

export default function VideoCropper({
  videoUrl,
  initialCropData,
  onSave,
  onCancel,
}: VideoCropperProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cropX, setCropX] = useState(initialCropData?.cropX ?? 0.5);
  const [cropY, setCropY] = useState(initialCropData?.cropY ?? 0.5);
  const [cropScale, setCropScale] = useState(initialCropData?.cropScale ?? 1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  // Get video dimensions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setVideoSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
      // Start video playing (muted) for preview
      video.currentTime = 1;
      video.play().catch(() => {});
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [videoUrl]);

  const handleZoom = (direction: 'in' | 'out') => {
    setCropScale((prev) => {
      const newScale = direction === 'in' ? prev + 0.1 : prev - 0.1;
      return Math.max(1, Math.min(3, newScale));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (cropScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - dragStart.x) / rect.width;
      const deltaY = (e.clientY - dragStart.y) / rect.height;

      // Invert delta because we're moving the view, not the crop
      setCropX((prev) => Math.max(0, Math.min(1, prev - deltaX * 0.5)));
      setCropY((prev) => Math.max(0, Math.min(1, prev - deltaY * 0.5)));

      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (cropScale <= 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const touch = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = (touch.clientX - dragStart.x) / rect.width;
      const deltaY = (touch.clientY - dragStart.y) / rect.height;

      setCropX((prev) => Math.max(0, Math.min(1, prev - deltaX * 0.5)));
      setCropY((prev) => Math.max(0, Math.min(1, prev - deltaY * 0.5)));

      setDragStart({ x: touch.clientX, y: touch.clientY });
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  const handleSave = () => {
    onSave({
      cropX: Number(cropX.toFixed(3)),
      cropY: Number(cropY.toFixed(3)),
      cropScale: Number(cropScale.toFixed(2)),
    });
  };

  const handleReset = () => {
    setCropX(0.5);
    setCropY(0.5);
    setCropScale(1);
  };

  // Calculate video transform for preview
  const getVideoTransform = () => {
    if (cropScale <= 1) {
      return 'scale(1) translate(0, 0)';
    }

    // Calculate offset to show the correct portion
    const offsetX = (cropX - 0.5) * 100 * (cropScale - 1);
    const offsetY = (cropY - 0.5) * 100 * (cropScale - 1);

    return `scale(${cropScale}) translate(${-offsetX}%, ${-offsetY}%)`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={onCancel}
          className="text-white/70 text-sm font-medium"
        >
          Cancel
        </button>
        <h3 className="text-white text-sm font-semibold">Crop & Zoom</h3>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-sm font-semibold"
        >
          <Check className="w-4 h-4" />
          Done
        </button>
      </div>

      {/* Video Preview with Crop Overlay */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div
          ref={containerRef}
          className="relative w-full max-w-[280px] aspect-[9/16] bg-[#1A1A2E] rounded-2xl overflow-hidden"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{ cursor: cropScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {/* Video */}
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover transition-transform"
            style={{ transform: getVideoTransform() }}
            playsInline
            muted
            loop
          />

          {/* 9:16 frame guide overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Rule of thirds grid */}
            <div className="absolute inset-0 border border-white/20">
              <div className="absolute w-full h-px bg-white/10 top-1/3" />
              <div className="absolute w-full h-px bg-white/10 top-2/3" />
              <div className="absolute h-full w-px bg-white/10 left-1/3" />
              <div className="absolute h-full w-px bg-white/10 left-2/3" />
            </div>

            {/* Corner markers */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/60" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/60" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/60" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/60" />
          </div>

          {/* Drag hint */}
          {cropScale > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded-md">
              <Move className="w-3 h-3 text-white/60" />
              <span className="text-white/60 text-[10px]">Drag to adjust</span>
            </div>
          )}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="px-4 pb-6">
        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => handleZoom('out')}
            disabled={cropScale <= 1}
            className="w-10 h-10 rounded-xl bg-[#2D2640] flex items-center justify-center disabled:opacity-30"
          >
            <ZoomOut className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 h-1 bg-[#2D2640] rounded-full relative">
            <div
              className="absolute left-0 top-0 h-full bg-[#8B5CF6] rounded-full"
              style={{ width: `${((cropScale - 1) / 2) * 100}%` }}
            />
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={cropScale}
              onChange={(e) => setCropScale(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>

          <button
            onClick={() => handleZoom('in')}
            disabled={cropScale >= 3}
            className="w-10 h-10 rounded-xl bg-[#2D2640] flex items-center justify-center disabled:opacity-30"
          >
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Zoom level indicator */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/40 text-xs">Zoom</span>
          <span className="text-white text-sm font-medium">
            {Math.round(cropScale * 100)}%
          </span>
        </div>

        {/* Reset button */}
        <button
          onClick={handleReset}
          className="w-full py-3 rounded-xl bg-[#2D2640] text-white/70 text-sm font-medium"
        >
          Reset to Fit
        </button>
      </div>
    </div>
  );
}
