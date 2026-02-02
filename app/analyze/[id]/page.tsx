'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle, Film, Clock } from 'lucide-react';
import { detectScenes, DetectedScene } from '../../lib/sceneDetector';

interface Template {
  id: string;
  platform: string;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
    videoUrl: string;
  };
  locations?: Array<{
    locationId: number;
    locationName: string;
    scenes: Array<{
      id: number;
      startTime: number;
      endTime: number;
      duration: number;
      thumbnail?: string;
      description: string;
    }>;
    totalDuration: number;
  }>;
}

type AnalysisStatus = 'loading' | 'detecting' | 'complete' | 'error';

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('loading');
  const [progress, setProgress] = useState(0);
  const [detectedScenes, setDetectedScenes] = useState<DetectedScene[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSceneDetection = useCallback(async (videoUrl: string) => {
    setStatus('detecting');
    setProgress(0);

    try {
      const result = await detectScenes(videoUrl, {
        sampleInterval: 0.5,
        threshold: 0.25,
        minSceneDuration: 0.8,
        onProgress: (p) => setProgress(Math.round(p * 100))
      });

      setDetectedScenes(result.scenes);
      setStatus('complete');

      // Update template with detected scenes
      if (template) {
        const updatedTemplate = {
          ...template,
          needsSceneDetection: false,
          detectedScenes: result.scenes,
          locations: result.scenes.map((scene, idx) => ({
            locationId: idx,
            locationName: `Shot ${idx + 1}`,
            scenes: [{
              id: scene.id,
              startTime: scene.startTime,
              endTime: scene.endTime,
              duration: scene.duration,
              thumbnail: scene.thumbnail,
              description: scene.description,
              textOverlay: null
            }],
            totalDuration: scene.duration
          }))
        };

        localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
      }
    } catch (err) {
      console.error('Scene detection error:', err);
      setError('Failed to analyze video. The video may be blocked for cross-origin access.');
      setStatus('error');
    }
  }, [template, params.id]);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const stored = localStorage.getItem(`template_${params.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          setTemplate(data);

          if (data.videoInfo?.videoUrl) {
            await runSceneDetection(data.videoInfo.videoUrl);
          } else {
            setError('No video URL available for analysis');
            setStatus('error');
          }
        } else {
          setError('Template not found');
          setStatus('error');
        }
      } catch (err) {
        setError('Failed to load template');
        setStatus('error');
      }
    };

    loadTemplate();
  }, [params.id, runSceneDetection]);

  const handleContinue = () => {
    router.push(`/editor/reel/${params.id}`);
  };

  const handleSkip = () => {
    router.push(`/template/${params.id}`);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white text-center">Analyzing Video</h1>
        <p className="text-sm text-white/50 text-center mt-1">
          Detecting scene changes...
        </p>
      </div>

      {/* Status Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#8B5CF6] animate-spin mx-auto" />
            <p className="text-white/70 mt-4">Loading video...</p>
          </div>
        )}

        {status === 'detecting' && (
          <div className="text-center w-full max-w-xs">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#333"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#8B5CF6"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 2.51} 251`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                {progress}%
              </span>
            </div>
            <p className="text-white/70">Scanning for scene changes...</p>
            <p className="text-white/40 text-sm mt-2">This may take a moment</p>
          </div>
        )}

        {status === 'complete' && (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-[#14B8A6] mx-auto" />
            <h2 className="text-xl font-bold text-white mt-4">Analysis Complete!</h2>
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-white/70">{detectedScenes.length} scenes</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#14B8A6]" />
                <span className="text-white/70">
                  {template?.videoInfo?.duration || 0}s total
                </span>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white mt-4">Analysis Failed</h2>
            <p className="text-white/50 mt-2 max-w-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Scene Preview (when complete) */}
      {status === 'complete' && detectedScenes.length > 0 && (
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Detected Shots</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {detectedScenes.slice(0, 10).map((scene) => (
              <div key={scene.id} className="flex-shrink-0">
                <div
                  className="w-16 h-24 rounded-lg bg-cover bg-center border-2 border-[#8B5CF6]/30"
                  style={{ backgroundImage: `url(${scene.thumbnail})` }}
                />
                <p className="text-[10px] text-white/50 text-center mt-1">
                  {scene.duration}s
                </p>
              </div>
            ))}
            {detectedScenes.length > 10 && (
              <div className="flex-shrink-0 w-16 h-24 rounded-lg bg-[#1A1A2E] flex items-center justify-center">
                <span className="text-white/50 text-xs">+{detectedScenes.length - 10}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        {status === 'complete' && (
          <button
            onClick={handleContinue}
            className="w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] bg-[#8B5CF6]"
          >
            <span className="text-[15px] font-semibold text-white">
              Continue to Editor
            </span>
          </button>
        )}

        {status === 'error' && (
          <>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] bg-[#8B5CF6]"
            >
              <span className="text-[15px] font-semibold text-white">
                Try Again
              </span>
            </button>
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-white/40"
            >
              Skip analysis and use estimated structure
            </button>
          </>
        )}

        {(status === 'loading' || status === 'detecting') && (
          <button
            onClick={handleSkip}
            className="w-full text-center text-sm text-white/40"
          >
            Skip and use estimated structure
          </button>
        )}
      </div>
    </div>
  );
}
