'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Save, Pencil, CircleCheck, Clock, MapPin, Film } from 'lucide-react';

interface SceneInfo {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  textOverlay: string | null;
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
  type: 'reel';
  totalDuration: number;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
  };
  locations: LocationGroup[];
  music?: {
    name: string;
    hasMusic?: boolean;
  };
  style?: {
    transitions: string;
    textStyle: string;
    colorPalette: string[];
  };
}

const LOCATION_COLORS = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];

export default function ReelPreview() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplate();
  }, [params.id]);

  const fetchTemplate = async () => {
    try {
      // First try localStorage
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        setTemplate(JSON.parse(stored));
        setLoading(false);
        return;
      }

      // Fallback to API
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

  const handleExport = () => {
    alert('Opening export options for CapCut...');
  };

  const handleSaveToLibrary = () => {
    alert('Saved to your library!');
    router.push('/');
  };

  const handleEditTimeline = () => {
    router.push(`/timeline/reel/${params.id}`);
  };

  const handleEditSlots = () => {
    router.push(`/editor/reel/${params.id}`);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !template) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Loading preview...</p>
        </div>
      </div>
    );
  }

  const locations = template.locations || [];
  const totalScenes = locations.reduce((sum, loc) => sum + loc.scenes.length, 0);
  const locationCount = locations.filter(l => l.locationId > 0 && l.locationName !== 'Outro').length;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h2 className="text-sm font-semibold text-white">Preview</h2>
        <div className="w-9" />
      </div>

      {/* Video Preview - Constrained height */}
      <div className="flex items-center justify-center px-6 py-2 flex-shrink-0">
        <div
          className="w-[160px] h-[285px] rounded-xl relative overflow-hidden"
          style={{
            backgroundColor: '#1A1A2E',
            backgroundImage: template.videoInfo?.thumbnail ? `url(${template.videoInfo.thumbnail})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Play Button Overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
            </div>
          </div>

          {/* Duration Badge */}
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/80">
            <span className="text-white text-[10px] font-semibold">{formatDuration(template.totalDuration)}</span>
          </div>

          {/* Scenes Badge */}
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-[#8B5CF6]">
            <span className="text-white text-[10px] font-semibold">{totalScenes} scenes</span>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="flex flex-col items-center gap-2 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14B8A6]">
          <CircleCheck className="w-4 h-4 text-white" />
          <span className="text-xs font-semibold text-white">Video Ready!</span>
        </div>
        <p className="text-xs text-[#888888] text-center">
          Your template has been assembled
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span className="text-xs text-white/70">{formatDuration(template.totalDuration)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#14B8A6]" />
          <span className="text-xs text-white/70">{locationCount} locations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-[#F472B6]" />
          <span className="text-xs text-white/70">{totalScenes} scenes</span>
        </div>
      </div>

      {/* Timeline Preview */}
      <div className="px-4 py-2 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {locations.map((location, locIdx) => (
            <div
              key={location.locationId}
              className="flex-shrink-0 px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: LOCATION_COLORS[locIdx % LOCATION_COLORS.length] + '30' }}
            >
              <p className="text-[9px] font-medium text-white/70">{location.locationName}</p>
              <p className="text-[9px] text-white/40">{location.totalDuration}s</p>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Bottom Section */}
      <div className="flex flex-col gap-2 px-4 pt-2 pb-5 flex-shrink-0">
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6]"
        >
          <Download className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Export to CapCut</span>
        </button>

        {/* Save to Library Button */}
        <button
          onClick={handleSaveToLibrary}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#1A1A2E]"
        >
          <Save className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-white">Save to Library</span>
        </button>

        {/* Edit Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleEditTimeline}
            className="flex-1 h-9 flex items-center justify-center gap-1.5"
          >
            <Film className="w-4 h-4 text-[#888888]" />
            <span className="text-xs text-[#888888]">Edit Timeline</span>
          </button>
          <button
            onClick={handleEditSlots}
            className="flex-1 h-9 flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-4 h-4 text-[#888888]" />
            <span className="text-xs text-[#888888]">Edit Slots</span>
          </button>
        </div>
      </div>
    </div>
  );
}
