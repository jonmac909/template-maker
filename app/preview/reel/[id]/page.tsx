'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Save, CircleCheck, Play } from 'lucide-react';

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
  locations: Array<{
    locationId: number;
    locationName: string;
    scenes: Array<{
      id: number;
      duration: number;
    }>;
    totalDuration: number;
  }>;
}

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

  const handleExport = () => {
    alert('Opening export options for CapCut...');
  };

  const handleSaveToLibrary = () => {
    alert('Saved to your library!');
    router.push('/');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar - matching Fill Your Template */}
      <div className="flex items-center justify-between h-14 px-4 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-[18px] bg-white/20"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-base font-semibold text-white">Preview</h2>
        <div className="w-9" />
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div
          className="w-[180px] h-[320px] rounded-2xl relative overflow-hidden bg-[#1A1A2E] border border-[#8B5CF6]/30"
        >
          {/* Play Button */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Play className="w-6 h-6 text-white/70 ml-0.5" />
            </div>
            {/* Time Display */}
            <div className="px-3 py-1 bg-black/60 rounded-lg">
              <span className="text-white text-sm font-medium">{formatDuration(template.totalDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#14B8A6]">
          <CircleCheck className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold text-white">Video Ready!</span>
        </div>
        <p className="text-sm text-[#888888] text-center">
          Your template has been assembled with all<br />your media and captions
        </p>
      </div>

      {/* Bottom Buttons */}
      <div className="flex flex-col gap-3 px-6 pb-8">
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6]"
        >
          <Download className="w-5 h-5 text-white" />
          <span className="text-base font-semibold text-white">Export to CapCut</span>
        </button>

        {/* Save to Library Button */}
        <button
          onClick={handleSaveToLibrary}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#1A1A2E]"
        >
          <Save className="w-5 h-5 text-white" />
          <span className="text-base font-medium text-white">Save to Library</span>
        </button>
      </div>
    </div>
  );
}
