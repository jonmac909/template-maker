'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Save, CircleCheck, Play, Clock, MapPin, Film, Smartphone, FileVideo } from 'lucide-react';

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

  const handleExportCapCut = () => {
    if (!template) return;

    // Build CapCut-compatible template structure
    const capCutTemplate = {
      name: template.videoInfo?.title || 'Untitled Template',
      duration: Number(template.totalDuration.toFixed(1)),
      tracks: {
        video: template.locations.flatMap((loc, locIdx) =>
          loc.scenes.map((scene, sceneIdx) => ({
            id: `${locIdx}-${sceneIdx}`,
            type: 'video_placeholder',
            duration: Number(scene.duration.toFixed(1)),
            locationId: loc.locationId,
            locationName: loc.locationName,
          }))
        ),
        text: template.locations.map((loc) => ({
          id: `text-${loc.locationId}`,
          type: 'text',
          content: loc.locationName,
          duration: Number(loc.totalDuration.toFixed(1)),
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

  const handleExportFinalCut = () => {
    if (!template) return;

    // Calculate total duration in frames (assuming 30fps)
    const fps = 30;
    const totalFrames = Math.round(template.totalDuration * fps);

    // Build clips data
    let currentFrame = 0;
    const clips: Array<{ name: string; startFrame: number; durationFrames: number; text: string }> = [];

    template.locations.forEach((loc) => {
      loc.scenes.forEach((scene) => {
        const durationFrames = Math.round(scene.duration * fps);
        clips.push({
          name: loc.locationName,
          startFrame: currentFrame,
          durationFrames,
          text: loc.locationName,
        });
        currentFrame += durationFrames;
      });
    });

    // Generate FCPXML
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

    // Download as FCPXML file
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

  const handleDownloadToPhone = () => {
    alert('Merging videos and downloading to your phone library...');
    // In production: merge all video clips, add text overlays, and trigger download
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

  const locations = template.locations || [];
  const totalScenes = locations.reduce((sum, loc) => sum + loc.scenes.length, 0);
  const locationCount = locations.filter(l => l.locationId > 0 && l.locationName !== 'Outro').length;
  const title = template.videoInfo?.title || 'Untitled Video';

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

      {/* Video Preview - Larger */}
      <div className="flex justify-center px-6 pt-4 pb-6">
        <div
          className="w-[220px] h-[390px] rounded-2xl relative overflow-hidden bg-[#1A1A2E] border border-[#8B5CF6]/30"
          style={{
            backgroundImage: template.videoInfo?.thumbnail ? `url(${template.videoInfo.thumbnail})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Dark overlay for play button visibility */}
          {template.videoInfo?.thumbnail && (
            <div className="absolute inset-0 bg-black/30" />
          )}

          {/* Centered Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-7 h-7 text-white ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Video Info */}
      <div className="px-6 pb-4">
        {/* Title */}
        <p className="text-white font-medium text-sm text-center line-clamp-2 mb-3">
          {title.length > 60 ? title.slice(0, 60) + '...' : title}
        </p>

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-sm text-white/70">{formatDuration(template.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#14B8A6]" />
            <span className="text-sm text-white/70">{locationCount} locations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Film className="w-4 h-4 text-[#F472B6]" />
            <span className="text-sm text-white/70">{totalScenes} scenes</span>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="flex flex-col items-center gap-2 px-4 py-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#14B8A6]">
          <CircleCheck className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold text-white">Video Ready!</span>
        </div>
        <p className="text-sm text-[#888888] text-center">
          Your template has been assembled with all<br />your media and captions
        </p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Buttons */}
      <div className="flex flex-col gap-3 px-6 pb-8">
        {/* Download to Phone Button */}
        <button
          onClick={handleDownloadToPhone}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6]"
        >
          <Smartphone className="w-5 h-5 text-white" />
          <span className="text-base font-semibold text-white">Download to Phone</span>
        </button>

        {/* Export to CapCut Button */}
        <button
          onClick={handleExportCapCut}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#2D2640]"
        >
          <Download className="w-5 h-5 text-white" />
          <span className="text-base font-medium text-white">Export to CapCut</span>
        </button>

        {/* Export to Final Cut Pro Button */}
        <button
          onClick={handleExportFinalCut}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#2D2640]"
        >
          <FileVideo className="w-5 h-5 text-white" />
          <span className="text-base font-medium text-white">Export to Final Cut Pro</span>
        </button>

        {/* Save to Library Button */}
        <button
          onClick={handleSaveToLibrary}
          className="w-full h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-[#1A1A2E]"
        >
          <Save className="w-5 h-5 text-white/70" />
          <span className="text-base font-medium text-white/70">Save to Library</span>
        </button>
      </div>
    </div>
  );
}
