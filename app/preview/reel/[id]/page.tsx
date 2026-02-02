'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Save, CircleCheck, Play, Clock, MapPin, Film, Smartphone, FileVideo, Loader2, AlertCircle } from 'lucide-react';
import { getVideoBlob } from '../../../lib/videoStorage';
import { loadFFmpeg, renderFullVideo, downloadBlob, type RenderProgress } from '../../../lib/ffmpegService';

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  hasEmoji: boolean;
  emoji?: string;
  emojiPosition?: 'before' | 'after' | 'both';
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
}

interface TrimData {
  inTime: number;
  outTime: number;
  cropX: number;
  cropY: number;
  cropScale: number;
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
  locations: Array<{
    locationId: number;
    locationName: string;
    scenes: Array<{
      id: number;
      duration: number;
      textOverlay?: string | null;
      textStyle?: TextStyle;
      userVideoId?: string;
      filled?: boolean;
      trimData?: TrimData;
    }>;
    totalDuration: number;
  }>;
}

interface RenderState {
  status: 'idle' | 'loading' | 'rendering' | 'complete' | 'error';
  progress: RenderProgress | null;
  error?: string;
  videoUrl?: string;
}

export default function ReelPreview() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderState, setRenderState] = useState<RenderState>({
    status: 'idle',
    progress: null,
  });

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

  const handleExportFinalCut = () => {
    if (!template) return;

    const fps = 30;
    let currentFrame = 0;
    const clips: Array<{ name: string; startFrame: number; durationFrames: number; text: string }> = [];

    template.locations.forEach((loc) => {
      loc.scenes.forEach((scene) => {
        const effectiveDuration = scene.trimData
          ? scene.trimData.outTime - scene.trimData.inTime
          : scene.duration;
        const durationFrames = Math.round(effectiveDuration * fps);
        clips.push({
          name: loc.locationName,
          startFrame: currentFrame,
          durationFrames,
          text: loc.locationName,
        });
        currentFrame += durationFrames;
      });
    });

    const fcpxml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1080" height="1920"/>
    <effect id="r2" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>
  </resources>
  <library>
    <event name="Template Import">
      <project name="${template.videoInfo?.title || 'Untitled Template'}">
        <sequence format="r1" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${clips.map((clip, idx) => `            <gap name="Placeholder ${idx + 1} - ${clip.name}" offset="${clip.startFrame}/30s" duration="${clip.durationFrames}/30s" start="0s">
              <note>${clip.text} - Add your ${Number((clip.durationFrames / fps).toFixed(1))}s clip here</note>
            </gap>`).join('\n')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

    const blob = new Blob([fcpxml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${params.id}.fcpxml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDaVinci = () => {
    if (!template) return;

    const fps = 30;
    let currentFrame = 0;
    const clips: Array<{ name: string; startFrame: number; durationFrames: number }> = [];

    template.locations.forEach((loc) => {
      loc.scenes.forEach((scene) => {
        const effectiveDuration = scene.trimData
          ? scene.trimData.outTime - scene.trimData.inTime
          : scene.duration;
        const durationFrames = Math.round(effectiveDuration * fps);
        clips.push({
          name: loc.locationName,
          startFrame: currentFrame,
          durationFrames,
        });
        currentFrame += durationFrames;
      });
    });

    const fcpxml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1080" height="1920"/>
  </resources>
  <library>
    <event name="Template Import">
      <project name="${template.videoInfo?.title || 'Untitled Template'}">
        <sequence format="r1" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${clips.map((clip, idx) => `            <gap name="${clip.name} (${Number((clip.durationFrames / fps).toFixed(1))}s)" offset="${clip.startFrame}/30s" duration="${clip.durationFrames}/30s" start="0s"/>`).join('\n')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

    const blob = new Blob([fcpxml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${params.id}-davinci.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRenderVideo = async () => {
    if (!template) return;

    setRenderState({
      status: 'loading',
      progress: { stage: 'loading', percent: 0, message: 'Initializing...' },
    });

    try {
      // Load FFmpeg
      await loadFFmpeg((progress) => {
        setRenderState({ status: 'loading', progress });
      });

      setRenderState({
        status: 'rendering',
        progress: { stage: 'processing', percent: 0, message: 'Preparing clips...' },
      });

      // Collect all clips with their video data
      const clipsData: Array<{
        videoBlob: Blob;
        trimData?: TrimData;
        textOverlay?: string;
        textStyle?: TextStyle;
        duration: number;
      }> = [];

      for (const location of template.locations) {
        for (const scene of location.scenes) {
          if (scene.userVideoId) {
            const blob = await getVideoBlob(scene.userVideoId);
            if (blob) {
              clipsData.push({
                videoBlob: blob,
                trimData: scene.trimData,
                textOverlay: scene.textOverlay || location.locationName,
                textStyle: scene.textStyle,
                duration: scene.trimData
                  ? scene.trimData.outTime - scene.trimData.inTime
                  : scene.duration,
              });
            }
          }
        }
      }

      if (clipsData.length === 0) {
        setRenderState({
          status: 'error',
          progress: null,
          error: 'No video clips to render. Please add videos first.',
        });
        return;
      }

      // Render the full video
      const finalBlob = await renderFullVideo(clipsData, (progress) => {
        setRenderState({ status: 'rendering', progress });
      });

      // Create URL for preview/download
      const videoUrl = URL.createObjectURL(finalBlob);

      setRenderState({
        status: 'complete',
        progress: { stage: 'complete', percent: 100, message: 'Complete!' },
        videoUrl,
      });

    } catch (error) {
      console.error('Render failed:', error);
      setRenderState({
        status: 'error',
        progress: null,
        error: error instanceof Error ? error.message : 'Render failed',
      });
    }
  };

  const handleDownloadRenderedVideo = () => {
    if (renderState.videoUrl) {
      const title = template?.videoInfo?.title || 'video';
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').slice(0, 30);
      downloadBlob(
        new Blob([], { type: 'video/mp4' }), // This is just for the filename
        `${safeTitle}.mp4`
      );
      // Actually download from the URL
      const a = document.createElement('a');
      a.href = renderState.videoUrl;
      a.download = `${safeTitle}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSaveToMyEdits = () => {
    if (template) {
      const updatedTemplate = { ...template, isDraft: false, isEdit: true };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push('/');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
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

  const locations = template.locations || [];
  const totalScenes = locations.reduce((sum, loc) => sum + loc.scenes.length, 0);
  const filledScenes = locations.reduce((sum, loc) =>
    sum + loc.scenes.filter(s => s.filled || s.userVideoId).length, 0
  );
  const locationCount = locations.filter(l => l.locationId > 0 && l.locationName !== 'Outro').length;
  const title = template.videoInfo?.title || 'Untitled Video';

  // Calculate actual total duration based on trim data
  const actualDuration = locations.reduce((sum, loc) =>
    sum + loc.scenes.reduce((sceneSum, scene) =>
      sceneSum + (scene.trimData
        ? scene.trimData.outTime - scene.trimData.inTime
        : scene.duration
      ), 0
    ), 0
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
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
      <div className="flex justify-center px-4 pt-4 pb-6">
        <div
          className="w-full max-w-[320px] aspect-[9/16] rounded-2xl relative overflow-hidden bg-[#1A1A2E] border border-[#8B5CF6]/30"
          style={{
            backgroundImage: renderState.videoUrl
              ? undefined
              : template.videoInfo?.thumbnail
                ? `url(${template.videoInfo.thumbnail})`
                : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Show rendered video if available */}
          {renderState.videoUrl && (
            <video
              src={renderState.videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              controls
              playsInline
            />
          )}

          {/* Dark overlay for play button visibility */}
          {!renderState.videoUrl && template.videoInfo?.thumbnail && (
            <div className="absolute inset-0 bg-black/30" />
          )}

          {/* Centered Play Button (only when no video) */}
          {!renderState.videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-7 h-7 text-white ml-1" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Info */}
      <div className="px-6 pb-4">
        <p className="text-white font-medium text-sm text-center line-clamp-2 mb-3">
          {title.length > 60 ? title.slice(0, 60) + '...' : title}
        </p>

        <div className="flex items-center justify-center gap-5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-sm text-white/70">{formatDuration(actualDuration)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#14B8A6]" />
            <span className="text-sm text-white/70">{locationCount} locations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Film className="w-4 h-4 text-[#F472B6]" />
            <span className="text-sm text-white/70">{filledScenes}/{totalScenes} scenes</span>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="flex flex-col items-center gap-2 px-4 py-4">
        {renderState.status === 'idle' && filledScenes === totalScenes && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#14B8A6]">
              <CircleCheck className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white">Ready to Render!</span>
            </div>
            <p className="text-sm text-[#888888] text-center">
              All scenes have videos. Tap below to<br />render your final video.
            </p>
          </>
        )}

        {renderState.status === 'idle' && filledScenes < totalScenes && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F59E0B]">
              <AlertCircle className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white">Missing Videos</span>
            </div>
            <p className="text-sm text-[#888888] text-center">
              Add videos to all scenes to render<br />your final video.
            </p>
          </>
        )}

        {(renderState.status === 'loading' || renderState.status === 'rendering') && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#8B5CF6]">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span className="text-sm font-semibold text-white">
                {renderState.progress?.message || 'Processing...'}
              </span>
            </div>
            {renderState.progress && (
              <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8B5CF6] transition-all"
                  style={{ width: `${renderState.progress.percent}%` }}
                />
              </div>
            )}
            <p className="text-sm text-[#888888] text-center">
              {renderState.progress?.currentClip && renderState.progress?.totalClips
                ? `Processing clip ${renderState.progress.currentClip}/${renderState.progress.totalClips}`
                : 'This may take a minute...'}
            </p>
          </>
        )}

        {renderState.status === 'complete' && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#14B8A6]">
              <CircleCheck className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white">Video Ready!</span>
            </div>
            <p className="text-sm text-[#888888] text-center">
              Your video has been rendered.<br />Download it below.
            </p>
          </>
        )}

        {renderState.status === 'error' && (
          <>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#EF4444]">
              <AlertCircle className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white">Render Failed</span>
            </div>
            <p className="text-sm text-[#EF4444] text-center">
              {renderState.error || 'Something went wrong'}
            </p>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Bottom Buttons */}
      <div className="flex flex-col gap-3 px-6 pb-8">
        {/* Main action button */}
        {renderState.status === 'complete' ? (
          <button
            onClick={handleDownloadRenderedVideo}
            className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#14B8A6]"
          >
            <Download className="w-5 h-5 text-white" />
            <span className="text-base font-semibold text-white">Download Video</span>
          </button>
        ) : (
          <button
            onClick={handleRenderVideo}
            disabled={renderState.status === 'loading' || renderState.status === 'rendering' || filledScenes === 0}
            className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renderState.status === 'loading' || renderState.status === 'rendering' ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Smartphone className="w-5 h-5 text-white" />
            )}
            <span className="text-base font-semibold text-white">
              {renderState.status === 'loading' || renderState.status === 'rendering'
                ? 'Rendering...'
                : 'Render Video'}
            </span>
          </button>
        )}

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleExportFinalCut}
            className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-[#2D2640]"
          >
            <FileVideo className="w-4 h-4 text-white/80" />
            <span className="text-xs font-medium text-white/80">Final Cut</span>
          </button>
          <button
            onClick={handleExportDaVinci}
            className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-[#2D2640]"
          >
            <FileVideo className="w-4 h-4 text-white/80" />
            <span className="text-xs font-medium text-white/80">DaVinci</span>
          </button>
        </div>

        {/* Save to My Edits Button */}
        <button
          onClick={handleSaveToMyEdits}
          className="w-full h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-[#1A1A2E]"
        >
          <Save className="w-5 h-5 text-white/70" />
          <span className="text-base font-medium text-white/70">Save to My Edits</span>
        </button>
      </div>
    </div>
  );
}
