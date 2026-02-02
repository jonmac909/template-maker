'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface TrimData {
  inTime: number;
  outTime: number;
  cropX: number;
  cropY: number;
  cropScale: number;
}

interface VideoTrimmerProps {
  videoUrl: string;
  videoDuration: number;
  targetDuration: number;
  initialTrimData?: TrimData;
  onSave: (trimData: TrimData) => void;
  onCancel: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
};

export default function VideoTrimmer({
  videoUrl,
  videoDuration,
  targetDuration,
  initialTrimData,
  onSave,
  onCancel,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [inPoint, setInPoint] = useState(initialTrimData?.inTime ?? 0);
  const [outPoint, setOutPoint] = useState(
    initialTrimData?.outTime ?? Math.min(targetDuration, videoDuration)
  );
  const [dragging, setDragging] = useState<'in' | 'out' | 'playhead' | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  const selectedDuration = outPoint - inPoint;

  // Generate thumbnails for timeline
  useEffect(() => {
    const generateThumbnails = async () => {
      if (!videoUrl) return;

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 60;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const thumbCount = Math.min(10, Math.ceil(videoDuration));
      const thumbs: string[] = [];

      for (let i = 0; i < thumbCount; i++) {
        const time = (i / thumbCount) * videoDuration;
        video.currentTime = time;
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
        ctx.drawImage(video, 0, 0, 60, 80);
        thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
      }

      setThumbnails(thumbs);
    };

    generateThumbnails();
  }, [videoUrl, videoDuration]);

  // Update current time display
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Loop within trim range during playback
      if (video.currentTime >= outPoint) {
        video.currentTime = inPoint;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [inPoint, outPoint]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime < inPoint || video.currentTime >= outPoint) {
        video.currentTime = inPoint;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, inPoint, outPoint]);

  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    type: 'in' | 'out' | 'playhead'
  ) => {
    e.preventDefault();
    setDragging(type);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = (x / rect.width) * videoDuration;

      if (dragging === 'in') {
        const newIn = Math.max(0, Math.min(time, outPoint - 0.5));
        setInPoint(newIn);
        if (videoRef.current) {
          videoRef.current.currentTime = newIn;
        }
      } else if (dragging === 'out') {
        const newOut = Math.min(videoDuration, Math.max(time, inPoint + 0.5));
        setOutPoint(newOut);
        if (videoRef.current) {
          videoRef.current.currentTime = newOut;
        }
      } else if (dragging === 'playhead') {
        const clampedTime = Math.max(inPoint, Math.min(time, outPoint));
        if (videoRef.current) {
          videoRef.current.currentTime = clampedTime;
        }
      }
    },
    [dragging, videoDuration, inPoint, outPoint]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Frame-by-frame navigation
  const stepFrame = (direction: 'back' | 'forward') => {
    const video = videoRef.current;
    if (!video) return;

    const frameTime = 1 / 30; // Assuming 30fps
    const newTime = direction === 'forward'
      ? Math.min(video.currentTime + frameTime, outPoint)
      : Math.max(video.currentTime - frameTime, inPoint);

    video.currentTime = newTime;
  };

  // Set in/out at current position
  const setInAtCurrent = () => {
    const video = videoRef.current;
    if (!video) return;
    setInPoint(Math.min(video.currentTime, outPoint - 0.5));
  };

  const setOutAtCurrent = () => {
    const video = videoRef.current;
    if (!video) return;
    setOutPoint(Math.max(video.currentTime, inPoint + 0.5));
  };

  const handleSave = () => {
    onSave({
      inTime: Number(inPoint.toFixed(2)),
      outTime: Number(outPoint.toFixed(2)),
      cropX: initialTrimData?.cropX ?? 0,
      cropY: initialTrimData?.cropY ?? 0,
      cropScale: initialTrimData?.cropScale ?? 1,
    });
  };

  // Percentage positions for UI
  const inPercent = (inPoint / videoDuration) * 100;
  const outPercent = (outPoint / videoDuration) * 100;
  const playheadPercent = (currentTime / videoDuration) * 100;

  const isDurationMatch = Math.abs(selectedDuration - targetDuration) < 0.5;

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
        <div className="text-center">
          <h3 className="text-white text-sm font-semibold">Trim Clip</h3>
          <p className="text-white/50 text-xs">
            Target: {Number(targetDuration.toFixed(1))}s
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-sm font-semibold"
        >
          <Check className="w-4 h-4" />
          Done
        </button>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div className="relative w-full max-w-[280px] aspect-[9/16] bg-[#1A1A2E] rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Play button overlay */}
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </div>
          </button>

          {/* Current time display */}
          <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded-md">
            <span className="text-white text-xs font-mono">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Frame navigation */}
      <div className="flex items-center justify-center gap-6 py-2">
        <button
          onClick={() => stepFrame('back')}
          className="flex items-center gap-1 text-white/60 text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          Frame
        </button>
        <button
          onClick={setInAtCurrent}
          className="px-3 py-1.5 rounded-lg bg-[#2D2640] text-white/80 text-xs font-medium"
        >
          Set In
        </button>
        <button
          onClick={setOutAtCurrent}
          className="px-3 py-1.5 rounded-lg bg-[#2D2640] text-white/80 text-xs font-medium"
        >
          Set Out
        </button>
        <button
          onClick={() => stepFrame('forward')}
          className="flex items-center gap-1 text-white/60 text-xs"
        >
          Frame
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Duration indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        <span className={`text-sm font-semibold ${isDurationMatch ? 'text-[#14B8A6]' : 'text-[#F472B6]'}`}>
          {Number(selectedDuration.toFixed(1))}s selected
        </span>
        {!isDurationMatch && (
          <span className="text-white/40 text-xs">
            (need {Number(targetDuration.toFixed(1))}s)
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 pb-6">
        {/* Time display row */}
        <div className="flex justify-between text-[10px] text-white/40 mb-1 px-1">
          <span>{formatTime(inPoint)}</span>
          <span>{formatTime(outPoint)}</span>
        </div>

        {/* Timeline with thumbnails */}
        <div
          ref={timelineRef}
          className="relative h-16 bg-[#1A1A2E] rounded-xl overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (!timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = (x / rect.width) * videoDuration;
            const clampedTime = Math.max(inPoint, Math.min(time, outPoint));
            if (videoRef.current) {
              videoRef.current.currentTime = clampedTime;
            }
          }}
        >
          {/* Thumbnail strip */}
          <div className="absolute inset-0 flex">
            {thumbnails.map((thumb, i) => (
              <div
                key={i}
                className="flex-1 bg-cover bg-center"
                style={{ backgroundImage: `url(${thumb})` }}
              />
            ))}
          </div>

          {/* Dimmed areas outside trim */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/70"
            style={{ width: `${inPercent}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/70"
            style={{ width: `${100 - outPercent}%` }}
          />

          {/* Selected range highlight */}
          <div
            className="absolute top-0 bottom-0 border-2 border-[#8B5CF6] rounded-lg"
            style={{
              left: `${inPercent}%`,
              width: `${outPercent - inPercent}%`,
            }}
          />

          {/* In handle */}
          <div
            className="absolute top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-10"
            style={{ left: `calc(${inPercent}% - 8px)` }}
            onMouseDown={(e) => handleTimelineMouseDown(e, 'in')}
          >
            <div className="w-1 h-10 bg-[#8B5CF6] rounded-full" />
          </div>

          {/* Out handle */}
          <div
            className="absolute top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-10"
            style={{ left: `calc(${outPercent}% - 8px)` }}
            onMouseDown={(e) => handleTimelineMouseDown(e, 'out')}
          >
            <div className="w-1 h-10 bg-[#8B5CF6] rounded-full" />
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
          </div>
        </div>

        {/* Full duration label */}
        <div className="text-center text-[10px] text-white/30 mt-1">
          Total: {formatTime(videoDuration)}
        </div>
      </div>
    </div>
  );
}
