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
    // In production, this would generate a CapCut-compatible project file
  };

  const handleSaveToLibrary = () => {
    alert('Saved to your library!');
    router.push('/');
  };

  const handleEdit = () => {
    router.push(`/editor/reel/${params.id}`);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading preview...</p>
        </div>
      </div>
    );
  }

  const locations = template.locations || [];
  const totalScenes = locations.reduce((sum, loc) => sum + loc.scenes.length, 0);
  const locationCount = locations.filter(l => l.locationId > 0 && l.locationName !== 'Outro').length;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-14 px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h2 className="text-lg font-semibold text-white">Preview</h2>
        <div className="w-[60px] h-6" />
      </div>

      {/* Video Preview */}
      <div className="flex items-center justify-center h-[420px] px-4">
        <div
          className="w-[200px] h-[356px] rounded-xl relative overflow-hidden"
          style={{
            backgroundColor: '#1A1A2E',
            backgroundImage: template.videoInfo?.thumbnail ? `url(${template.videoInfo.thumbnail})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Play Button Overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>

          {/* Duration Badge */}
          <div className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-xl bg-black/80">
            <span className="text-white text-[11px] font-semibold">{formatDuration(template.totalDuration)}</span>
          </div>

          {/* Scenes Badge */}
          <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-[#8B5CF6]">
            <span className="text-white text-[11px] font-semibold">{totalScenes} scenes</span>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="flex flex-col items-center gap-4 px-4 py-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-[20px] bg-[#8B5CF6]">
          <CircleCheck className="w-[18px] h-[18px] text-white" />
          <span className="text-sm font-semibold text-white">Template Ready!</span>
        </div>
        <p className="text-sm text-[#888888] text-center">
          Your {locationCount}-location video template is ready to use
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-center gap-6 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#8B5CF6]" />
          <span className="text-sm text-white/70">{formatDuration(template.totalDuration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#14B8A6]" />
          <span className="text-sm text-white/70">{locationCount} locations</span>
        </div>
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[#F472B6]" />
          <span className="text-sm text-white/70">{totalScenes} scenes</span>
        </div>
      </div>

      {/* Timeline Preview */}
      <div className="px-4 py-3">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {locations.map((location, locIdx) => (
            <div
              key={location.locationId}
              className="flex-shrink-0 px-3 py-2 rounded-lg"
              style={{ backgroundColor: LOCATION_COLORS[locIdx % LOCATION_COLORS.length] + '30' }}
            >
              <p className="text-[10px] font-medium text-white/70">{location.locationName}</p>
              <p className="text-[10px] text-white/40">{location.totalDuration}s</p>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Section */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-8">
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6]"
        >
          <Download className="w-5 h-5 text-white" />
          <span className="text-base font-semibold text-white">Export to CapCut</span>
        </button>

        {/* Save to Library Button */}
        <button
          onClick={handleSaveToLibrary}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-[#1A1A2E]"
        >
          <Save className="w-5 h-5 text-white" />
          <span className="text-base font-medium text-white">Save to Library</span>
        </button>

        {/* Edit Button */}
        <button
          onClick={handleEdit}
          className="w-full h-11 flex items-center justify-center gap-2"
        >
          <Pencil className="w-[18px] h-[18px] text-[#888888]" />
          <span className="text-sm text-[#888888]">Edit Scenes</span>
        </button>
      </div>
    </div>
  );
}
