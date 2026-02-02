'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { X, Sparkles, Clock, MapPin, Film, Type, Check, Loader2 } from 'lucide-react';
import { extractVideoFrames, generateFrameTimestamps, isBrowser } from '../../lib/videoFrameExtractor';

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
  isDraft?: boolean;
  isEdit?: boolean;
  deepAnalyzed?: boolean;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
    videoUrl?: string;
  };
  locations?: LocationGroup[];
  slides?: Array<{
    id: number;
    textOverlay: string;
    position: string;
    style: string;
  }>;
  extractedFonts?: {
    titleFont?: { style: string; weight: string; description: string };
    locationFont?: { style: string; weight: string; description: string };
  };
}

const LOCATION_COLORS = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];

export default function TemplateBreakdown() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  useEffect(() => {
    fetchTemplate();
  }, [params.id]);

  // Auto-trigger deep analysis when template loads if not yet analyzed
  useEffect(() => {
    if (template && !template.deepAnalyzed && template.videoInfo?.videoUrl && !deepAnalyzing) {
      // Auto-start deep analysis to extract actual text from video frames
      handleDeepAnalyze();
    }
  }, [template?.id, template?.deepAnalyzed]);

  // Auto-save when deep analysis completes
  useEffect(() => {
    if (template?.deepAnalyzed && template?.isDraft) {
      // Auto-save the template after deep analysis
      const savedTemplate = {
        ...template,
        isDraft: false,
        isEdit: false,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(savedTemplate));
      setTemplate(savedTemplate);
    }
  }, [template?.deepAnalyzed]);

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

      // Validate the template has required data before saving
      if (!data.locations || data.locations.length === 0) {
        console.error('API returned invalid template - missing locations');
        throw new Error('Invalid template data');
      }

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

  const handleSaveTemplate = () => {
    if (!template) return;

    // Remove draft status and save as permanent template
    const savedTemplate = {
      ...template,
      isDraft: false,
      isEdit: false,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`template_${params.id}`, JSON.stringify(savedTemplate));
    setTemplate(savedTemplate);
    setSaved(true);

    // Reset saved indicator after 2 seconds
    setTimeout(() => setSaved(false), 2000);
  };

  // Helper to fetch thumbnail as base64 from browser (avoids CORS issues)
  const fetchThumbnailAsBase64 = async (thumbnailUrl: string): Promise<string | null> => {
    if (!thumbnailUrl || !isBrowser()) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            console.log('Thumbnail fetched as base64, size:', base64.length);
            resolve(base64);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.error('Failed to convert thumbnail to base64:', e);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.log('Failed to load thumbnail image');
        resolve(null);
      };

      // Try loading the image
      img.src = thumbnailUrl;

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  };

  const handleDeepAnalyze = async () => {
    if (!template || !isBrowser()) return;

    const videoUrl = template.videoInfo?.videoUrl;
    const thumbnailUrl = template.videoInfo?.thumbnail;

    if (!videoUrl && !thumbnailUrl) {
      setAnalysisStatus('No video or thumbnail available for analysis');
      setTimeout(() => setAnalysisStatus(''), 3000);
      return;
    }

    setDeepAnalyzing(true);
    setAnalysisStatus('Loading thumbnail...');

    try {
      const duration = template.totalDuration || template.videoInfo?.duration || 30;

      // FIRST: Try to get thumbnail as base64 from browser (this is the key fix!)
      let thumbnailBase64: string | null = null;
      if (thumbnailUrl) {
        console.log('Fetching thumbnail from browser:', thumbnailUrl.substring(0, 80));
        thumbnailBase64 = await fetchThumbnailAsBase64(thumbnailUrl);
        if (thumbnailBase64) {
          console.log('Thumbnail captured successfully!');
          setAnalysisStatus('Thumbnail captured! Extracting video frames...');
        }
      }

      // Generate timestamps for frame extraction
      const timestamps = generateFrameTimestamps(duration, {
        introFrameAt: 0.5,
        numLocationFrames: Math.min(template.locations?.length || 5, 8),
        outroFrameAt: 1,
      });

      setAnalysisStatus(`Extracting ${timestamps.length} frames...`);

      // Extract frames from video (if available)
      let frames: { timestamp: number; base64: string }[] = [];
      if (videoUrl) {
        try {
          const extractedFrames = await extractVideoFrames(videoUrl, timestamps, {
            maxWidth: 720,
            quality: 0.85,
            timeout: 45000,
          });
          frames = extractedFrames.map(f => ({ timestamp: f.timestamp, base64: f.base64 }));
        } catch (e) {
          console.log('Video frame extraction failed, using thumbnail only:', e);
        }
      }

      // We need at least thumbnail OR frames
      if (!thumbnailBase64 && frames.length === 0) {
        throw new Error('Could not extract thumbnail or frames');
      }

      const frameCount = frames.length + (thumbnailBase64 ? 1 : 0);
      setAnalysisStatus(`Analyzing ${frameCount} images with AI...`);

      // Send thumbnail + frames to API for analysis
      const response = await fetch('/api/analyze-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailBase64, // NEW: Include thumbnail from browser!
          frames,
          videoInfo: {
            title: template.videoInfo?.title || 'Unknown',
            author: template.videoInfo?.author || 'Unknown',
            duration,
          },
          expectedLocations: template.locations?.length || 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis API failed');
      }

      const result = await response.json();
      setAnalysisStatus('Updating template with analyzed data...');

      // Update template with deep analysis results
      if (result.analysis) {
        const updatedLocations = template.locations?.map((loc, idx) => {
          const analysisLoc = result.analysis.locations?.[idx];
          if (analysisLoc && loc.locationId === 0) {
            // Update intro with extracted hook text
            return {
              ...loc,
              scenes: loc.scenes.map(scene => ({
                ...scene,
                textOverlay: result.analysis.extractedText?.hookText || scene.textOverlay,
              })),
            };
          }
          if (analysisLoc && analysisLoc.textOverlay) {
            return {
              ...loc,
              locationName: analysisLoc.locationName || loc.locationName,
              scenes: loc.scenes.map(scene => ({
                ...scene,
                textOverlay: analysisLoc.textOverlay || scene.textOverlay,
              })),
            };
          }
          return loc;
        });

        const updatedTemplate = {
          ...template,
          deepAnalyzed: true,
          locations: updatedLocations,
          extractedFonts: result.analysis.extractedFonts,
          // IMPORTANT: Preserve draft status
          isDraft: template.isDraft,
          isEdit: template.isEdit,
        };

        localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
        setTemplate(updatedTemplate);
        setAnalysisStatus('Deep analysis complete!');
      }
    } catch (error) {
      console.error('Deep analysis failed:', error);
      setAnalysisStatus(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeepAnalyzing(false);
      setTimeout(() => setAnalysisStatus(''), 4000);
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

      {/* Bottom Area - Buttons */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        {/* Analysis Status - shown during auto deep analysis */}
        {(deepAnalyzing || analysisStatus) && (
          <div className="text-center py-3 px-4 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30">
            <div className="flex items-center justify-center gap-2">
              {deepAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6]" />}
              <p className="text-sm text-[#8B5CF6]">{analysisStatus || 'Analyzing video...'}</p>
            </div>
          </div>
        )}

        {/* Use Template Button */}
        <button
          onClick={handleUseTemplate}
          disabled={deepAnalyzing}
          className={`w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] transition-all ${
            deepAnalyzing
              ? 'bg-[#8B5CF6]/50 cursor-not-allowed'
              : 'bg-[#8B5CF6]'
          }`}
        >
          <Sparkles className="w-[18px] h-[18px] text-white" />
          <span className="text-[15px] font-semibold text-white">
            {deepAnalyzing ? 'Analyzing...' : 'Use This Template'}
          </span>
        </button>
      </div>
    </div>
  );
}
