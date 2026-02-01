'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Template {
  id: string;
  platform: string;
  type: 'reel' | 'carousel';
  duration?: number;
  clips?: Array<{
    id: number;
    name: string;
    startTime: number;
    endTime: number;
    textOverlay?: string;
  }>;
  slides?: Array<{
    id: number;
    textOverlay: string;
    position: string;
    style: string;
  }>;
  music?: {
    name: string;
    duration: number;
  };
}

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
      const response = await fetch(`/api/template/${params.id}`);
      if (!response.ok) throw new Error('Template not found');

      const data = await response.json();
      setTemplate(data);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = () => {
    if (!template) return;

    // Navigate to the editor based on template type
    if (template.type === 'reel') {
      router.push(`/editor/reel/${params.id}`);
    } else {
      router.push(`/editor/carousel/${params.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Template not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-purple-500 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <button
          onClick={() => router.push('/')}
          className="text-red-500 font-medium"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Template Preview</h2>
        <div className="w-16"></div>
      </div>

      <div className="max-w-md mx-auto p-6">
        {/* Preview Area */}
        <div className="bg-black rounded-2xl aspect-[9/16] flex items-center justify-center mb-6 relative overflow-hidden">
          <div className="text-center text-white">
            <div className="text-4xl mb-2">📹</div>
            <p className="text-sm">Preview</p>
            <p className="text-xs opacity-70">9:16</p>
          </div>
        </div>

        {/* Template Info */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {template.type === 'reel' ? 'Top 10 Cafes' : '5 Must-See Spots'}
          </h1>
          <p className="text-gray-600">
            {template.type === 'reel'
              ? `${template.clips?.length} clips across ${template.duration}s`
              : `${template.slides?.length} slides`
            }
          </p>
        </div>

        {/* Color Palette */}
        <div className="flex gap-2 mb-6">
          <div className="w-10 h-10 rounded-lg bg-purple-400"></div>
          <div className="w-10 h-10 rounded-lg bg-pink-400"></div>
          <div className="w-10 h-10 rounded-lg bg-teal-400"></div>
          <div className="w-10 h-10 rounded-lg bg-yellow-400"></div>
          <div className="w-10 h-10 rounded-lg bg-blue-400"></div>
        </div>

        {/* Details */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {template.type === 'reel' ? 'Clips Detected' : 'Slides Detected'}
          </h3>
          <div className="space-y-3">
            {template.type === 'reel' ? (
              template.clips?.map((clip) => (
                <div key={clip.id} className="flex items-center gap-3">
                  <div className="w-16 h-28 bg-gray-300 rounded-lg flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-500">
                      {clip.startTime}s - {clip.endTime}s
                    </div>
                    <div className="text-sm text-gray-900">{clip.name}</div>
                    {clip.textOverlay && (
                      <div className="text-xs text-gray-600">Text: "{clip.textOverlay}"</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              template.slides?.map((slide) => (
                <div key={slide.id} className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-gray-300 rounded-lg flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">Slide {slide.id}</div>
                    <div className="text-xs text-gray-600">Text: "{slide.textOverlay}"</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {template.music && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3 bg-yellow-50 rounded-xl p-3">
                <span className="text-xl">🎵</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">Music</div>
                  <div className="text-xs text-gray-600">{template.music.name}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Use Template Button */}
        <button
          onClick={handleUseTemplate}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity"
        >
          Use This Template
        </button>
      </div>
    </div>
  );
}
