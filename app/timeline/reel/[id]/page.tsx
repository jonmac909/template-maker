'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Scissors, Type, Music, Eye, Download } from 'lucide-react';

// Format duration to 1 decimal place
const formatDuration = (duration: number): string => {
  return Number(duration.toFixed(1)).toString();
};

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
      const locationStartTime = currentStartTime;

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
        currentStartTime += scene.duration;
      });

      // Create ONE text overlay per LOCATION (not per scene)
      if (location.locationName) {
        overlays.push({
          id: `text-${location.locationId}`,
          text: location.locationName,
          style: {
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
          startTime: locationStartTime,
          endTime: currentStartTime, // End when location ends
          trackIndex: 0,
        });
      }
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

  // Export to CapCut template format
  const handleExportCapCut = () => {
    if (!template) return;

    // Build CapCut-compatible template structure
    const capCutTemplate = {
      name: template.videoInfo?.title || 'Untitled Template',
      duration: Number(totalDuration.toFixed(1)),
      tracks: {
        video: clips.map((clip, idx) => ({
          id: idx + 1,
          type: 'video_placeholder',
          start: Number(clip.startTime.toFixed(1)),
          duration: Number(clip.duration.toFixed(1)),
          locationId: clip.locationId,
          locationName: clip.locationName,
        })),
        text: textOverlays.map((overlay, idx) => ({
          id: idx + 1,
          type: 'text',
          content: overlay.text,
          start: Number(overlay.startTime.toFixed(1)),
          end: Number(overlay.endTime.toFixed(1)),
          duration: Number((overlay.endTime - overlay.startTime).toFixed(1)),
          style: {
            fontFamily: overlay.style.fontFamily,
            fontSize: overlay.style.fontSize,
            fontWeight: overlay.style.fontWeight,
            color: overlay.style.color,
            position: overlay.style.position,
            emoji: overlay.style.hasEmoji ? overlay.style.emoji : null,
          },
        })),
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        source: 'TemplateMaker',
        originalAuthor: template.videoInfo?.author || 'Unknown',
      },
    };

    // Download as JSON file
    const blob = new Blob([JSON.stringify(capCutTemplate, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capcut-template-${params.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header - matching Fill Your Template */}
      <div className="flex items-center justify-between h-14 px-4 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-[18px] bg-white/20"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-base font-semibold text-white">Edit Video</h1>
        <div className="w-9" />
      </div>

      {/* Video Preview - Constrained height */}
      <div className="flex-1 flex justify-center items-center px-8 py-2 min-h-0">
        <div className="relative h-full max-h-[45vh] aspect-[9/16] bg-[#1A1A2E] rounded-2xl overflow-hidden">
          {/* Play Button */}
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white/70" />
              ) : (
                <Play className="w-6 h-6 text-white/70 ml-0.5" />
              )}
            </div>
          </button>

          {/* Time Display - Bottom Left */}
          <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/60 rounded-md">
            <span className="text-white text-xs font-medium">{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>

      {/* Toolbar - Trim, Text, Audio */}
      <div className="flex items-center justify-center gap-10 py-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={() => setActiveTab('trim')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'trim' ? 'text-white' : 'text-white/40'}`}
        >
          <Scissors className="w-5 h-5" />
          <span className="text-[10px]">Trim</span>
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'text' ? 'text-white' : 'text-white/40'}`}
        >
          <Type className="w-5 h-5" />
          <span className="text-[10px]">Text</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex flex-col items-center gap-0.5 ${activeTab === 'audio' ? 'text-white' : 'text-white/40'}`}
        >
          <Music className="w-5 h-5" />
          <span className="text-[10px]">Audio</span>
        </button>
      </div>

      {/* Timeline Section */}
      <div className="bg-[#0D0D1A] px-4 py-3 flex-shrink-0">
        {/* Scrollable Timeline */}
        <div
          ref={timelineScrollRef}
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ width: timelineWidth, minWidth: '100%' }}>
            {/* Time Markers */}
            <div className="flex mb-2">
              {timeMarkers.map((t) => (
                <div
                  key={t}
                  className="text-white/40 text-[10px]"
                  style={{ width: `${100 / timeMarkers.length}%` }}
                >
                  {formatTime(t)}
                </div>
              ))}
            </div>

            {/* Scene Track - Colored Cards with Duration */}
            <div className="flex gap-1 mb-2">
              {clips.map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => {
                    setSelectedClip(clip.id);
                    setCurrentTime(clip.startTime);
                  }}
                  className={`h-12 rounded-xl transition-all flex items-center justify-center ${
                    selectedClip === clip.id ? 'ring-2 ring-white' : ''
                  }`}
                  style={{
                    backgroundColor: clip.color,
                    flex: clip.duration,
                    minWidth: 45,
                  }}
                >
                  <span className="text-[10px] font-semibold text-white/90">
                    {formatDuration(clip.duration)}s
                  </span>
                </button>
              ))}
            </div>

            {/* Audio Track */}
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <div className="flex-1 h-6 bg-[#1A1A2E] rounded-lg" />
            </div>

            {/* Text Track - Aligned with scene track */}
            <div className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <div className="flex-1 flex gap-1">
                {clips.map((clip, idx) => {
                  // Find if this clip starts a new location (show text bar)
                  const isFirstSceneOfLocation = idx === 0 || clips[idx - 1].locationId !== clip.locationId;
                  // Find all clips for this location to calculate total duration
                  const locationClips = clips.filter(c => c.locationId === clip.locationId);
                  const isLastOfLocation = idx === clips.length - 1 || clips[idx + 1].locationId !== clip.locationId;

                  if (isFirstSceneOfLocation) {
                    // Calculate total flex for this location
                    const locationDuration = locationClips.reduce((sum, c) => sum + c.duration, 0);
                    return (
                      <div
                        key={`text-${clip.locationId}`}
                        className="h-6 bg-[#8B5CF6] rounded-lg"
                        style={{
                          flex: locationDuration,
                          minWidth: 35,
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="px-5 py-4 flex-shrink-0 space-y-2">
        <button
          onClick={handlePreview}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-full bg-[#8B5CF6] text-white font-semibold text-sm"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={handleExportCapCut}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-[#2D2640] text-white/80 font-medium text-sm"
        >
          <Download className="w-4 h-4" />
          Export to CapCut
        </button>
      </div>
    </div>
  );
}
