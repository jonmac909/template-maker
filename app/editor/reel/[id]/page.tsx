'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Clip {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  textOverlay?: string;
  userVideo?: File | null;
  filled: boolean;
}

interface Template {
  id: string;
  type: 'reel';
  duration: number;
  clips: Clip[];
  music?: {
    name: string;
    duration: number;
  };
}

export default function ReelEditor() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
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
      setClips(data.clips.map((clip: any) => ({ ...clip, filled: false, userVideo: null })));
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (clipId: number, file: File) => {
    setClips(clips.map(clip =>
      clip.id === clipId
        ? { ...clip, userVideo: file, filled: true }
        : clip
    ));
  };

  const handleCreateVideo = () => {
    const allFilled = clips.every(clip => clip.filled);

    if (!allFilled) {
      alert('Please fill all clips before creating the video');
      return;
    }

    // Navigate to timeline editor for fine-tuning
    router.push(`/timeline/reel/${params.id}`);
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-[#1F1B2D] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const filledCount = clips.filter(c => c.filled).length;
  const totalCount = clips.length;

  return (
    <div className="min-h-screen bg-[#1F1B2D] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <button
          onClick={() => router.back()}
          className="text-red-400 font-medium"
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Fill Your Template</h2>
          <p className="text-sm text-gray-400">{filledCount} / {totalCount} clips filled</p>
        </div>
        <div className="w-16"></div>
      </div>

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="bg-[#2D2640] rounded-xl p-6"
            >
              <div className="flex items-start gap-4">
                {/* Clip Number */}
                <div className="flex-shrink-0 w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                  {clip.id}
                </div>

                {/* Clip Info */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{clip.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {clip.startTime}s - {clip.endTime}s
                        {clip.textOverlay && ` • "${clip.textOverlay}"`}
                      </p>
                    </div>
                    {clip.filled && (
                      <span className="text-green-400">✓</span>
                    )}
                  </div>

                  {/* Upload Area */}
                  <div className="mt-4">
                    <label className="block">
                      <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        clip.filled
                          ? 'border-green-400 bg-green-900/20'
                          : 'border-gray-600 hover:border-purple-400 bg-gray-800/30'
                      }`}>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(clip.id, file);
                          }}
                        />
                        {clip.filled ? (
                          <>
                            <div className="text-green-400 mb-2">✓</div>
                            <p className="text-green-400 text-sm font-medium">
                              {clip.userVideo?.name || 'Video uploaded'}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Click to replace
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-400 text-3xl mb-2">📹</div>
                            <p className="text-gray-400 text-sm font-medium">
                              Upload your video
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Click to browse
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="p-6 border-t border-gray-700">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleCreateVideo}
            disabled={filledCount < totalCount}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {filledCount < totalCount
              ? `Fill ${totalCount - filledCount} more clip${totalCount - filledCount > 1 ? 's' : ''}`
              : '+ Create Video'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
