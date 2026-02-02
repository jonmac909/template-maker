'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Scissors, Type, Music, Eye } from 'lucide-react';

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  hasEmoji: boolean;
  emoji?: string;
  emojiPosition?: 'before' | 'after' | 'both';
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
}

interface TextOverlay {
  id: string;
  text: string;
  style: TextStyle;
  startTime: number;
  endTime: number;
  trackIndex: number;
}

interface TimelineClip {
  id: string;
  sceneId: number;
  locationId: number;
  locationName: string;
  color: string;
  startTime: number;
  duration: number;
  videoUrl?: string;
  thumbnail?: string;
  textOverlay?: string;
  textStyle?: TextStyle;
  muted: boolean;
}

interface Template {
  id: string;
  type: 'reel';
  totalDuration: number;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
    videoUrl: string;
  };
  locations: Array<{
    locationId: number;
    locationName: string;
    scenes: Array<{
      id: number;
      startTime: number;
      endTime: number;
      duration: number;
      textOverlay: string | null;
      textStyle?: TextStyle;
      thumbnail?: string;
      userVideo?: File | null;
      userThumbnail?: string;
      filled: boolean;
    }>;
    totalDuration: number;
  }>;
}

// Colors for scene cards - matching mockup
const SCENE_COLORS = ['#E879F9', '#A78BFA', '#34D399', '#F472B6', '#FCD34D', '#22D3EE', '#8B5CF6'];

type EditorTab = 'trim' | 'text' | 'audio';

export default function TimelineEditor() {
  const params = useParams();
  const router = useRouter();
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>('trim');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(15); // Default 15s like mockup

  // Selection state
  const [selectedClip, setSelectedClip] = useState<string | null>(null);

  useEffect(() => {
    loadTemplate();
  }, [params.id]);

  const loadTemplate = async () => {
    try {
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        const data: Template = JSON.parse(stored);
        setTemplate(data);
        initializeTimeline(data);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeTimeline = (data: Template) => {
    const timelineClips: TimelineClip[] = [];
    const overlays: TextOverlay[] = [];
    let currentStartTime = 0;

    data.locations.forEach((location, locIdx) => {
      const color = SCENE_COLORS[locIdx % SCENE_COLORS.length];

      location.scenes.forEach((scene) => {
        const clip: TimelineClip = {
          id: `clip-${location.locationId}-${scene.id}`,
          sceneId: scene.id,
          locationId: location.locationId,
          locationName: location.locationName,
          color,
          startTime: currentStartTime,
          duration: scene.duration,
          thumbnail: scene.filled ? scene.userThumbnail : undefined,
          textOverlay: scene.textOverlay || location.locationName,
          textStyle: scene.textStyle,
          muted: false,
        };
        timelineClips.push(clip);

        if (scene.textOverlay || location.locationName) {
          overlays.push({
            id: `text-${location.locationId}-${scene.id}`,
            text: scene.textOverlay || location.locationName,
            style: scene.textStyle || {
              fontFamily: 'Poppins',
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              hasEmoji: true,
              emoji: '📍',
              emojiPosition: 'before',
              position: 'bottom',
              alignment: 'left',
            },
            startTime: currentStartTime,
            endTime: currentStartTime + scene.duration,
            trackIndex: 0,
          });
        }

        currentStartTime += scene.duration;
      });
    });

    setClips(timelineClips);
    setTextOverlays(overlays);
    setTotalDuration(currentStartTime || 15);
  };

  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  const handlePreview = () => {
    if (template) {
      const updatedTemplate = {
        ...template,
        timelineData: {
          clips,
          textOverlays,
        },
        isEdit: true,
        isDraft: false,
        editedAt: new Date().toISOString(),
      };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push(`/preview/reel/${params.id}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate time markers (every 3 seconds)
  const generateTimeMarkers = () => {
    const markers = [];
    for (let t = 0; t <= totalDuration; t += 3) {
      markers.push(t);
    }
    return markers;
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const timeMarkers = generateTimeMarkers();
  const timelineWidth = Math.max(totalDuration * 35, 300); // pixels per second

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-center px-4 py-4 relative">
        <button
          onClick={() => router.back()}
          className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-semibold text-base">Edit Video</h1>
      </div>

      {/* Large Video Preview */}
      <div className="flex-1 flex justify-center items-center px-6 py-4">
        <div className="relative w-full max-w-[280px] aspect-[9/16] bg-[#1A1A2E] rounded-2xl overflow-hidden">
          {/* Play Button */}
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-7 h-7 text-white/70" />
              ) : (
                <Play className="w-7 h-7 text-white/70 ml-1" />
              )}
            </div>
          </button>

          {/* Time Display - Bottom Left */}
          <div className="absolute bottom-4 left-4 px-2.5 py-1 bg-black/60 rounded-lg">
            <span className="text-white text-sm font-medium">{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>

      {/* Toolbar - Trim, Text, Audio */}
      <div className="flex items-center justify-center gap-12 py-4 border-t border-white/10">
        <button
          onClick={() => setActiveTab('trim')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'trim' ? 'text-white' : 'text-white/40'}`}
        >
          <Scissors className="w-6 h-6" />
          <span className="text-xs">Trim</span>
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'text' ? 'text-white' : 'text-white/40'}`}
        >
          <Type className="w-6 h-6" />
          <span className="text-xs">Text</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'audio' ? 'text-white' : 'text-white/40'}`}
        >
          <Music className="w-6 h-6" />
          <span className="text-xs">Audio</span>
        </button>
      </div>

      {/* Timeline Section */}
      <div className="bg-[#0D0D1A] px-4 py-4">
        {/* Scrollable Timeline */}
        <div
          ref={timelineScrollRef}
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ width: timelineWidth, minWidth: '100%' }}>
            {/* Time Markers */}
            <div className="flex mb-3">
              {timeMarkers.map((t) => (
                <div
                  key={t}
                  className="text-white/40 text-xs"
                  style={{ width: `${100 / timeMarkers.length}%` }}
                >
                  {formatTime(t)}
                </div>
              ))}
            </div>

            {/* Scene Track - Colored Cards */}
            <div className="flex gap-1 mb-3">
              {clips.map((clip, idx) => (
                <button
                  key={clip.id}
                  onClick={() => {
                    setSelectedClip(clip.id);
                    setCurrentTime(clip.startTime);
                  }}
                  className={`h-14 rounded-xl transition-all ${
                    selectedClip === clip.id ? 'ring-2 ring-white' : ''
                  }`}
                  style={{
                    backgroundColor: clip.color,
                    flex: clip.duration,
                    minWidth: 50,
                  }}
                />
              ))}
            </div>

            {/* Audio Track */}
            <div className="flex items-center gap-2 mb-3">
              <Music className="w-4 h-4 text-white/30 flex-shrink-0" />
              <div className="flex-1 h-8 bg-[#1A1A2E] rounded-lg" />
            </div>

            {/* Text Track */}
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-white/30 flex-shrink-0" />
              <div className="flex-1 flex gap-1">
                {textOverlays.slice(0, 3).map((overlay, idx) => (
                  <div
                    key={overlay.id}
                    className="h-8 bg-[#8B5CF6] rounded-lg"
                    style={{
                      flex: overlay.endTime - overlay.startTime,
                      minWidth: 40,
                    }}
                  />
                ))}
                {/* Fill remaining space */}
                <div className="flex-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Button */}
      <div className="px-6 py-6">
        <button
          onClick={handlePreview}
          className="w-full h-14 flex items-center justify-center gap-2 rounded-full bg-[#8B5CF6] text-white font-semibold text-base"
        >
          <Eye className="w-5 h-5" />
          Preview
        </button>
      </div>
    </div>
  );
}
