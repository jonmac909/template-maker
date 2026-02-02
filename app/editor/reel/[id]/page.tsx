'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Check, Video, Clock, ChevronDown, ChevronUp, Pencil, X, Type, Save, Plus } from 'lucide-react';
import { getFontNames, addFontsToLibrary, initializeFontLibrary, trackFontUsage, addCustomFont } from '../../../lib/fontLibrary';

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  textShadow?: string;
  hasEmoji: boolean;
  emoji?: string;
  emojiPosition?: 'before' | 'after' | 'both';
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
}

interface SceneInfo {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  textOverlay: string | null;
  textStyle?: TextStyle;
  description: string;
  thumbnail?: string;
  userVideo?: File | null;
  userThumbnail?: string;
  filled: boolean;
}

interface LocationGroup {
  locationId: number;
  locationName: string;
  scenes: SceneInfo[];
  totalDuration: number;
  expanded: boolean;
}

interface DetectedFont {
  name: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  weights: string[];
  suggestedFor: string;
  source: string;
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
    videoUrl: string;
  };
  locations: LocationGroup[];
  detectedFonts?: DetectedFont[];
  detectedScenes?: Array<{
    id: number;
    startTime: number;
    endTime: number;
    duration: number;
    thumbnail: string;
    description: string;
  }>;
}

const LOCATION_COLORS = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Poppins',
  fontSize: 22,
  fontWeight: '700',
  color: '#FFFFFF',
  hasEmoji: true,
  emoji: '📍',
  emojiPosition: 'before',
  position: 'bottom',
  alignment: 'left',
};

const FONT_SIZES = [16, 18, 20, 22, 24, 26, 28, 32];
const EMOJI_OPTIONS = ['📍', '☕', '🏔', '🛕', '🛍️', '🏛️', '✨', '🍜', '🎯', '👆', '❤️', '🔥'];

export default function ReelEditor() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [locations, setLocations] = useState<LocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLocation, setEditingLocation] = useState<number | null>(null);
  const [editingScene, setEditingScene] = useState<{locationId: number, sceneId: number} | null>(null);
  const [editText, setEditText] = useState('');
  const [editStyle, setEditStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [fontLibrary, setFontLibrary] = useState<string[]>([]);
  const [showAddFont, setShowAddFont] = useState(false);
  const [customFontName, setCustomFontName] = useState('');

  useEffect(() => {
    // Initialize font library
    initializeFontLibrary();
    setFontLibrary(getFontNames());
    fetchTemplate();
  }, [params.id]);

  // Add detected fonts from template to library
  useEffect(() => {
    if (template?.detectedFonts && template.detectedFonts.length > 0) {
      addFontsToLibrary(template.detectedFonts);
      setFontLibrary(getFontNames());
    }
  }, [template]);

  const fetchTemplate = async () => {
    try {
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        setTemplate(data);
        initializeLocations(data);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/template/${params.id}`);
      if (!response.ok) throw new Error('Template not found');

      const data = await response.json();
      setTemplate(data);
      initializeLocations(data);
      localStorage.setItem(`template_${params.id}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeLocations = (data: Template) => {
    if (data.locations) {
      setLocations(data.locations.map((loc, idx) => ({
        ...loc,
        expanded: idx === 0,
        scenes: loc.scenes.map(scene => ({
          ...scene,
          filled: false,
          userVideo: null,
          userThumbnail: undefined
        }))
      })));
    }
  };

  const toggleLocation = (locationId: number) => {
    setLocations(locations.map(loc =>
      loc.locationId === locationId
        ? { ...loc, expanded: !loc.expanded }
        : loc
    ));
  };

  const handleFileUpload = async (locationId: number, sceneId: number, file: File) => {
    const thumbnail = await generateThumbnail(file);

    setLocations(locations.map(loc =>
      loc.locationId === locationId
        ? {
            ...loc,
            scenes: loc.scenes.map(scene =>
              scene.id === sceneId
                ? { ...scene, userVideo: file, userThumbnail: thumbnail, filled: true }
                : scene
            )
          }
        : loc
    ));
  };

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadeddata = () => {
        canvas.width = 120;
        canvas.height = 160;
        video.currentTime = 0.5;
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, 120, 160);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        }
      };

      video.src = URL.createObjectURL(file);
    });
  };

  // Edit location name
  const startEditingLocation = (locationId: number, currentName: string) => {
    setEditingLocation(locationId);
    setEditText(currentName);
  };

  const saveLocationName = () => {
    if (editingLocation !== null) {
      setLocations(locations.map(loc =>
        loc.locationId === editingLocation
          ? { ...loc, locationName: editText }
          : loc
      ));
      setEditingLocation(null);
      setEditText('');
    }
  };

  // Edit scene text overlay
  const startEditingScene = (locationId: number, sceneId: number, currentText: string | null, currentStyle?: TextStyle) => {
    setEditingScene({ locationId, sceneId });
    setEditText(currentText || '');
    setEditStyle(currentStyle || DEFAULT_TEXT_STYLE);
    setShowStyleEditor(false);
  };

  const saveSceneText = () => {
    if (editingScene) {
      // Track font usage
      if (editStyle.fontFamily) {
        trackFontUsage(editStyle.fontFamily);
      }

      setLocations(locations.map(loc =>
        loc.locationId === editingScene.locationId
          ? {
              ...loc,
              scenes: loc.scenes.map(scene =>
                scene.id === editingScene.sceneId
                  ? { ...scene, textOverlay: editText || null, textStyle: editStyle }
                  : scene
              )
            }
          : loc
      ));
      setEditingScene(null);
      setEditText('');
      setEditStyle(DEFAULT_TEXT_STYLE);
      setShowStyleEditor(false);
    }
  };

  const handleAddCustomFont = () => {
    if (customFontName.trim()) {
      addCustomFont(customFontName.trim());
      setFontLibrary(getFontNames());
      setEditStyle({ ...editStyle, fontFamily: customFontName.trim() });
      setCustomFontName('');
      setShowAddFont(false);
    }
  };

  const handleCreateVideo = () => {
    if (template) {
      const updatedTemplate = { ...template, locations };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push(`/preview/reel/${params.id}`);
  };

  const handleSaveDraft = () => {
    if (template) {
      const updatedTemplate = { ...template, locations, isDraft: true };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push('/');
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const totalScenes = locations.reduce((sum, loc) => sum + loc.scenes.length, 0);
  const filledScenes = locations.reduce((sum, loc) =>
    sum + loc.scenes.filter(s => s.filled).length, 0
  );
  const videoTitle = template.videoInfo?.title?.slice(0, 40) || 'Video Template';

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Edit Location Name Modal */}
      {editingLocation !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A2E] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Edit Location Name</h3>
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setEditText('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Location name..."
              className="w-full bg-[#2D2640] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              autoFocus
            />
            <button
              onClick={saveLocationName}
              className="w-full mt-4 h-12 flex items-center justify-center rounded-xl bg-[#8B5CF6] text-white font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Text Overlay Editor Modal - Compact */}
      {editingScene !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A2E] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button
                onClick={() => {
                  setEditingScene(null);
                  setEditText('');
                  setEditStyle(DEFAULT_TEXT_STYLE);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <h3 className="text-sm font-semibold text-white">Text Overlay</h3>
              <button
                onClick={saveSceneText}
                className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Text Input with Preview */}
              <div className="bg-[#2D2640] rounded-xl p-3">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Enter text overlay..."
                  className="w-full bg-transparent text-white text-sm placeholder:text-white/30 focus:outline-none mb-2"
                  autoFocus
                />
                {/* Inline Preview */}
                <div className="bg-[#1A1A2E] rounded-lg p-3 min-h-[40px] flex items-center justify-center">
                  {editText ? (
                    <span
                      style={{
                        fontFamily: editStyle.fontFamily,
                        fontSize: Math.min(editStyle.fontSize, 18),
                        fontWeight: editStyle.fontWeight,
                        color: editStyle.color,
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                      }}
                    >
                      {editStyle.hasEmoji && editStyle.emoji && (editStyle.emojiPosition === 'before' || editStyle.emojiPosition === 'both') && (
                        <span className="mr-1">{editStyle.emoji}</span>
                      )}
                      {editText}
                      {editStyle.hasEmoji && editStyle.emoji && (editStyle.emojiPosition === 'after' || editStyle.emojiPosition === 'both') && (
                        <span className="ml-1">{editStyle.emoji}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-white/20 text-xs">Preview</span>
                  )}
                </div>
              </div>

              {/* Position - Compact */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 w-14">Position</span>
                <div className="flex gap-1 flex-1">
                  {(['top', 'center', 'bottom'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setEditStyle({...editStyle, position: pos})}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize ${
                        editStyle.position === pos
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#2D2640] text-white/60'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font - Horizontal Scroll */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/50">Font</span>
                  <button
                    onClick={() => setShowAddFont(!showAddFont)}
                    className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6]"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    Add
                  </button>
                </div>
                {showAddFont && (
                  <div className="flex gap-1.5 mb-1.5">
                    <input
                      type="text"
                      value={customFontName}
                      onChange={(e) => setCustomFontName(e.target.value)}
                      placeholder="Font name..."
                      className="flex-1 bg-[#2D2640] rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomFont()}
                    />
                    <button
                      onClick={handleAddCustomFont}
                      className="px-2 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs"
                    >
                      Add
                    </button>
                  </div>
                )}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {fontLibrary.map(font => (
                    <button
                      key={font}
                      onClick={() => setEditStyle({...editStyle, fontFamily: font})}
                      className={`px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                        editStyle.fontFamily === font
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#2D2640] text-white/60'
                      }`}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size & Color - Side by Side */}
              <div className="flex gap-3">
                {/* Size */}
                <div className="flex-1">
                  <span className="text-xs text-white/50 mb-1.5 block">Size</span>
                  <div className="flex gap-1 overflow-x-auto">
                    {FONT_SIZES.map(size => (
                      <button
                        key={size}
                        onClick={() => setEditStyle({...editStyle, fontSize: size})}
                        className={`w-8 h-8 rounded-lg text-xs font-medium flex-shrink-0 ${
                          editStyle.fontSize === size
                            ? 'bg-[#8B5CF6] text-white'
                            : 'bg-[#2D2640] text-white/60'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <span className="text-xs text-white/50 mb-1.5 block">Color</span>
                <div className="flex gap-2">
                  {['#FFFFFF', '#FFD700', '#FF6B6B', '#4ECDC4', '#8B5CF6', '#FF69B4', '#000000'].map(color => (
                    <button
                      key={color}
                      onClick={() => setEditStyle({...editStyle, color})}
                      className={`w-8 h-8 rounded-lg ${
                        editStyle.color === color ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1A1A2E]' : ''
                      } ${color === '#000000' ? 'border border-white/20' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Emoji - Compact */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/50">Emoji</span>
                  <button
                    onClick={() => setEditStyle({...editStyle, hasEmoji: !editStyle.hasEmoji})}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      editStyle.hasEmoji ? 'bg-[#8B5CF6]' : 'bg-[#2D2640]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      editStyle.hasEmoji ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {editStyle.hasEmoji && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {EMOJI_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setEditStyle({...editStyle, emoji})}
                          className={`w-8 h-8 rounded-lg text-base ${
                            editStyle.emoji === emoji
                              ? 'bg-[#8B5CF6]'
                              : 'bg-[#2D2640]'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {(['before', 'after', 'both'] as const).map(pos => (
                        <button
                          key={pos}
                          onClick={() => setEditStyle({...editStyle, emojiPosition: pos})}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize ${
                            editStyle.emojiPosition === pos
                              ? 'bg-[#8B5CF6] text-white'
                              : 'bg-[#2D2640] text-white/60'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between h-14 px-4 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-[18px] bg-white/20"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-white">Fill Your Template</h2>
          <p className="text-xs text-white/50">{filledScenes} / {totalScenes} scenes filled</p>
        </div>
        <button
          onClick={handleSaveDraft}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Save className="w-4 h-4 text-white" />
          <span className="text-xs font-medium text-white">Save</span>
        </button>
      </div>

      {/* Video Info */}
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-sm font-medium text-white line-clamp-1">{videoTitle}</p>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-white/50" />
            <span className="text-xs text-white/50">{template.totalDuration}s total</span>
          </div>
          <span className="text-xs text-white/50">•</span>
          <span className="text-xs text-white/50">{locations.length} locations</span>
        </div>
      </div>

      {/* Locations List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {locations.map((location, locIdx) => {
            const locationColor = LOCATION_COLORS[locIdx % LOCATION_COLORS.length];
            const filledInLocation = location.scenes.filter(s => s.filled).length;

            return (
              <div key={location.locationId} className="bg-[#1A1A2E] rounded-2xl overflow-hidden">
                {/* Location Header */}
                <div className="flex items-center justify-between p-4">
                  <button
                    onClick={() => toggleLocation(location.locationId)}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: locationColor }}
                    >
                      {location.locationId === 0 ? '▶' : location.locationId}
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-sm font-semibold text-white">{location.locationName}</h3>
                      <p className="text-xs text-white/50">
                        {location.scenes.length} scenes • {location.totalDuration}s
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Edit location name button */}
                    <button
                      onClick={() => startEditingLocation(location.locationId, location.locationName)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
                    >
                      <Pencil className="w-3.5 h-3.5 text-white/60" />
                    </button>

                    {filledInLocation === location.scenes.length && filledInLocation > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[#14B8A6] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {filledInLocation > 0 && filledInLocation < location.scenes.length && (
                      <span className="text-xs text-[#14B8A6]">{filledInLocation}/{location.scenes.length}</span>
                    )}

                    <button onClick={() => toggleLocation(location.locationId)}>
                      {location.expanded ? (
                        <ChevronUp className="w-5 h-5 text-white/50" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/50" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Scenes (Expanded) */}
                {location.expanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {location.scenes.map((scene, sceneIdx) => (
                      <div
                        key={scene.id}
                        className="bg-[#2D2640] rounded-xl p-3"
                      >
                        <div className="flex items-start gap-3">
                          {/* Scene Thumbnail / Upload */}
                          <label className="flex-shrink-0 cursor-pointer">
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(location.locationId, scene.id, file);
                              }}
                            />
                            <div
                              className="w-16 h-20 rounded-lg flex items-center justify-center overflow-hidden"
                              style={{
                                backgroundColor: scene.filled ? locationColor : '#333344',
                                backgroundImage: scene.userThumbnail ? `url(${scene.userThumbnail})` : scene.thumbnail ? `url(${scene.thumbnail})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            >
                              {scene.filled ? (
                                <Check className="w-6 h-6 text-white" />
                              ) : (
                                <Video className="w-5 h-5 text-white/30" />
                              )}
                            </div>
                          </label>

                          {/* Scene Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-xs font-semibold px-2 py-0.5 rounded"
                                  style={{ backgroundColor: locationColor + '30', color: locationColor }}
                                >
                                  {scene.duration}s
                                </span>
                                {scene.filled && (
                                  <span className="text-[#14B8A6] text-xs">Added</span>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-white/70 mb-2 line-clamp-2">
                              {scene.description}
                            </p>

                            {/* Editable Text Overlay */}
                            <button
                              onClick={() => startEditingScene(location.locationId, scene.id, scene.textOverlay, scene.textStyle)}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[#1A1A2E] border border-dashed border-white/20 hover:border-[#8B5CF6]/50 transition-colors"
                            >
                              {scene.textOverlay ? (
                                <span
                                  className="text-[11px] flex-1 text-left truncate"
                                  style={{
                                    fontFamily: scene.textStyle?.fontFamily || 'Poppins',
                                    color: scene.textStyle?.color || '#FFFFFF',
                                    fontWeight: scene.textStyle?.fontWeight || '600',
                                  }}
                                >
                                  {scene.textStyle?.hasEmoji && scene.textStyle?.emoji && (scene.textStyle?.emojiPosition === 'before' || scene.textStyle?.emojiPosition === 'both') && (
                                    <span className="mr-1">{scene.textStyle.emoji}</span>
                                  )}
                                  {scene.textOverlay}
                                  {scene.textStyle?.hasEmoji && scene.textStyle?.emoji && (scene.textStyle?.emojiPosition === 'after' || scene.textStyle?.emojiPosition === 'both') && (
                                    <span className="ml-1">{scene.textStyle.emoji}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[10px] text-white/40 flex-1 text-left truncate">
                                  Add text overlay...
                                </span>
                              )}
                              <Pencil className="w-3 h-3 text-white/40 flex-shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        <button
          onClick={handleCreateVideo}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] bg-[#8B5CF6]"
        >
          <Sparkles className="w-[18px] h-[18px] text-white" />
          <span className="text-[15px] font-semibold text-white">
            {filledScenes < totalScenes
              ? `Continue (${filledScenes}/${totalScenes} filled)`
              : 'Create Video'
            }
          </span>
        </button>

        <button
          onClick={handleCreateVideo}
          className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Skip to Preview
        </button>
      </div>
    </div>
  );
}
