'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { X, Sparkles, Clock, MapPin, Film, Type } from 'lucide-react';

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  hasEmoji: boolean;
  emoji?: string;
  position: 'top' | 'center' | 'bottom';
}

interface SceneInfo {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  textOverlay: string | null;
  textStyle?: TextStyle;
  description: string;
}

interface LocationGroup {
  locationId: number;
  locationName: string;
  scenes: SceneInfo[];
  totalDuration: number;
}

interface Template {
  id: string;
  platform: string;
  type: 'reel' | 'carousel';
  totalDuration?: number;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
  };
  locations?: LocationGroup[];
  slides?: Array<{
    id: number;
    textOverlay: string;
    position: string;
    style: string;
  }>;
}

const LOCATION_COLORS = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];

export default function TemplateBreakdown() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplate();
  }, [params.id]);

  const fetchTemplate = async () => {
    try {
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        setTemplate(JSON.parse(stored));
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/template/${params.id}`);
      if (!response.ok) throw new Error('Template not found');

      const data = await response.json();
      setTemplate(data);
      localStorage.setItem(`template_${params.id}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = () => {
    if (!template) return;

    if (template.type === 'reel') {
      router.push(`/editor/reel/${params.id}`);
    } else {
      router.push(`/editor/carousel/${params.id}`);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };

  // Count text overlays
  const countTextOverlays = (): number => {
    if (!template?.locations) return 0;
    return template.locations.reduce((sum, loc) =>
      sum + loc.scenes.filter(s => s.textOverlay).length, 0
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Template not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-[#8B5CF6] hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const isReel = template.type === 'reel';
  const locations = template.locations || [];
  const totalScenes = locations.reduce((sum, loc) => sum + loc.scenes.length, 0);
  const totalDuration = template.totalDuration || template.videoInfo?.duration || 0;
  const textOverlayCount = countTextOverlays();

  const title = template.videoInfo?.title?.slice(0, 50) || 'Video Template';
  const author = template.videoInfo?.author || 'Unknown';

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-12 px-4 pt-4">
        <button
          onClick={() => router.push('/')}
          className="w-9 h-9 flex items-center justify-center rounded-[18px] bg-white/20"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-[15px] font-semibold text-white">Template Preview</h2>
        <div className="w-9 h-9" />
      </div>

      {/* Preview Area */}
      <div className="flex items-center justify-center py-5 px-4">
        <div
          className="w-[200px] h-[355px] rounded-xl relative overflow-hidden"
          style={{
            backgroundColor: '#1A1A2E',
            backgroundImage: template.videoInfo?.thumbnail ? `url(${template.videoInfo.thumbnail})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Video Preview Overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
          {/* Duration Badge */}
          <div className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-xl bg-black/80">
            <span className="text-white text-[11px] font-semibold">{formatDuration(totalDuration)}</span>
          </div>
          {/* Scenes Badge */}
          <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-[#8B5CF6]">
            <span className="text-white text-[11px] font-semibold">{totalScenes} scenes</span>
          </div>
        </div>
      </div>

      {/* Template Info */}
      <div className="px-4 py-3">
        <p className="text-xs text-[#8B5CF6] font-medium mb-1">@{author}</p>
        <h1 className="text-lg font-bold text-white line-clamp-2">{title}</h1>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-white/50" />
            <span className="text-[13px] text-white/50">{formatDuration(totalDuration)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-white/50" />
            <span className="text-[13px] text-white/50">{locations.filter(l => l.locationId > 0 && l.locationName !== 'Outro').length} locations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Film className="w-4 h-4 text-white/50" />
            <span className="text-[13px] text-white/50">{totalScenes} scenes</span>
          </div>
          {textOverlayCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Type className="w-4 h-4 text-white/50" />
              <span className="text-[13px] text-white/50">{textOverlayCount} text overlays</span>
            </div>
          )}
        </div>
      </div>

      {/* Location/Scene Breakdown */}
      {isReel && locations.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Scene Breakdown</h3>
          <div className="space-y-3">
            {locations.map((location, locIdx) => (
              <div key={location.locationId} className="bg-[#1A1A2E] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: LOCATION_COLORS[locIdx % LOCATION_COLORS.length] }}
                    />
                    <span className="text-sm font-semibold text-white">{location.locationName}</span>
                  </div>
                  <span className="text-xs text-white/50">{location.totalDuration}s</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {location.scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="px-2 py-1 rounded-md text-[10px] text-white flex items-center gap-1"
                      style={{ backgroundColor: LOCATION_COLORS[locIdx % LOCATION_COLORS.length] + '40' }}
                    >
                      {scene.duration}s
                      {scene.textOverlay && <Type className="w-2.5 h-2.5" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Bottom Area - Use Template Button */}
      <div className="px-4 pt-4 pb-8">
        <button
          onClick={handleUseTemplate}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] bg-[#8B5CF6]"
        >
          <Sparkles className="w-[18px] h-[18px] text-white" />
          <span className="text-[15px] font-semibold text-white">Use This Template</span>
        </button>
      </div>
    </div>
  );
}
