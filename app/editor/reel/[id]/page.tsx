'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Check, Video, Clock, ChevronDown, ChevronUp, Pencil, X, Type, Save, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { getFontNames, addFontsToLibrary, initializeFontLibrary, trackFontUsage, addCustomFont, loadGoogleFonts } from '../../../lib/fontLibrary';

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

interface ExtractedFonts {
  titleFont?: {
    style: 'script' | 'serif' | 'sans-serif' | 'display';
    weight: string;
    description: string;
  };
  locationFont?: {
    style: 'script' | 'serif' | 'sans-serif' | 'display';
    weight: string;
    description: string;
  };
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
  extractedFonts?: ExtractedFonts;
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

// Map extracted font style to actual font family
const mapFontStyleToFamily = (style?: string): string => {
  switch (style) {
    case 'script':
      return 'Dancing Script';
    case 'serif':
      return 'Playfair Display';
    case 'display':
      return 'Montserrat';
    case 'sans-serif':
    default:
      return 'Poppins';
  }
};

// Create TextStyle from extracted font info
const createStyleFromExtractedFont = (
  extractedFont?: { style: string; weight: string; description: string },
  isTitle: boolean = false
): TextStyle => {
  const fontFamily = mapFontStyleToFamily(extractedFont?.style);
  const fontWeight = extractedFont?.weight === 'bold' ? '700' : '600';

  return {
    fontFamily,
    fontSize: isTitle ? 24 : 22,
    fontWeight,
    color: '#FFFFFF',
    hasEmoji: !isTitle,
    emoji: '📍',
    emojiPosition: 'before',
    position: isTitle ? 'center' : 'bottom',
    alignment: isTitle ? 'center' : 'left',
  };
};

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
  const [editingTitle, setEditingTitle] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [titleTextStyle, setTitleTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [locationTextStyle, setLocationTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeStatus, setReanalyzeStatus] = useState('');

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

  // Extract hook text from video title (e.g., "10 Magical Places in Chiang Mai..." from full title)
  const extractHookFromTitle = (title: string): string | null => {
    if (!title) return null;

    // Remove trailing location list items (e.g., "1. The Blue Temple 2. The White Temple...")
    const cleanTitle = title
      .replace(/\s*\d+\.\s*[^0-9]+(?=\s*\d+\.|$)/g, '') // Remove numbered items
      .replace(/\s*[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis at end
      .trim();

    // If title starts with a number + text pattern, that's likely the hook
    const hookMatch = cleanTitle.match(/^(\d+\s+(?:Best|Top|Must|Magical|Dreamiest|Amazing|Beautiful|Hidden|Secret|Ultimate|Perfect|Stunning|Incredible)[^.!?]*)/i);
    if (hookMatch) {
      return hookMatch[1].trim();
    }

    // Otherwise use the first sentence or phrase (up to ~60 chars)
    const firstPart = cleanTitle.split(/[.!?]/)[0].trim();
    if (firstPart.length > 10 && firstPart.length <= 80) {
      return firstPart;
    }

    // Truncate if too long
    if (cleanTitle.length > 60) {
      return cleanTitle.slice(0, 60).trim() + '...';
    }

    return cleanTitle || null;
  };

  const initializeLocations = (data: Template) => {
    // Set video title from template
    const fullTitle = data.videoInfo?.title || 'Video Template';
    setVideoTitle(fullTitle);

    // Extract hook text from title as fallback for intro
    const hookFromTitle = extractHookFromTitle(fullTitle);

    // Create extracted font styles
    let titleStyle = DEFAULT_TEXT_STYLE;
    let locStyle = DEFAULT_TEXT_STYLE;

    // Set extracted font styles if available
    if (data.extractedFonts) {
      titleStyle = createStyleFromExtractedFont(data.extractedFonts.titleFont, true);
      locStyle = createStyleFromExtractedFont(data.extractedFonts.locationFont, false);
      setTitleTextStyle(titleStyle);
      setLocationTextStyle(locStyle);

      // Add extracted fonts to library for use in font picker
      const fontsToAdd: Array<{
        name: string;
        category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
        weights: string[];
        suggestedFor: string;
        source: string;
      }> = [];

      if (data.extractedFonts.titleFont) {
        const titleFontName = mapFontStyleToFamily(data.extractedFonts.titleFont.style);
        fontsToAdd.push({
          name: titleFontName,
          category: data.extractedFonts.titleFont.style === 'script' ? 'handwriting' : 'sans-serif',
          weights: ['400', '600', '700'],
          suggestedFor: 'titles, hooks',
          source: 'extracted',
        });
      }

      if (data.extractedFonts.locationFont) {
        const locFontName = mapFontStyleToFamily(data.extractedFonts.locationFont.style);
        fontsToAdd.push({
          name: locFontName,
          category: data.extractedFonts.locationFont.style === 'script' ? 'handwriting' : 'sans-serif',
          weights: ['400', '600', '700'],
          suggestedFor: 'locations',
          source: 'extracted',
        });
      }

      if (fontsToAdd.length > 0) {
        addFontsToLibrary(fontsToAdd);
        setFontLibrary(getFontNames());
        // Load the extracted fonts from Google Fonts
        loadGoogleFonts(fontsToAdd.map(f => f.name));
      }
    }

    if (data.locations) {
      setLocations(data.locations.map((loc, idx) => {
        const isIntro = loc.locationId === 0;
        return {
          ...loc,
          expanded: idx === 0,
          scenes: loc.scenes.map(scene => {
            // Apply extracted style if no style exists
            const sceneStyle = scene.textStyle || (isIntro ? titleStyle : locStyle);

            // For intro scenes: use existing text, or fallback to hook extracted from title
            let textOverlay = scene.textOverlay;
            if (isIntro && !textOverlay && hookFromTitle) {
              textOverlay = hookFromTitle;
            }

            return {
              ...scene,
              textOverlay,
              textStyle: sceneStyle,
              filled: false,
              userVideo: null,
              userThumbnail: undefined
            };
          })
        };
      }));
    }
  };

  // Save video title
  const saveVideoTitle = () => {
    if (template && videoTitle.trim()) {
      const updatedTemplate = {
        ...template,
        videoInfo: {
          ...template.videoInfo,
          title: videoTitle.trim(),
        }
      };
      setTemplate(updatedTemplate as Template);
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    setEditingTitle(false);
  };

  // Convert image URL to base64 by drawing to canvas (works even if URL expired for server)
  const imageUrlToBase64 = async (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
            resolve(base64);
          } catch (e) {
            console.error('Canvas toDataURL failed (CORS?):', e);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error('Image failed to load');
        resolve(null);
      };

      // Try loading - browser may have it cached
      img.src = url;

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  };

  // Re-analyze thumbnail to extract intro text and fonts
  const handleReanalyze = async () => {
    if (!template?.videoInfo?.thumbnail) {
      setReanalyzeStatus('No thumbnail available');
      setTimeout(() => setReanalyzeStatus(''), 3000);
      return;
    }

    setReanalyzing(true);
    setReanalyzeStatus('Converting thumbnail...');

    try {
      // Convert the displayed thumbnail to base64 client-side
      // This works because the browser has the image cached/displayed
      const thumbnailBase64 = await imageUrlToBase64(template.videoInfo.thumbnail);

      if (!thumbnailBase64) {
        setReanalyzeStatus('Could not capture thumbnail - try refreshing');
        setTimeout(() => setReanalyzeStatus(''), 4000);
        setReanalyzing(false);
        return;
      }

      console.log('Thumbnail converted to base64, length:', thumbnailBase64.length);
      setReanalyzeStatus('Sending to AI for analysis...');

      const response = await fetch('/api/analyze-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailBase64, // Send base64 directly instead of URL
          frames: [],
          videoInfo: {
            title: '', // Don't send title - we want Claude to READ the image
            author: template.videoInfo.author || 'Unknown',
            duration: template.videoInfo.duration || 30,
          },
          expectedLocations: locations.length || 5,
        }),
      });

      const result = await response.json();
      console.log('Full API response:', JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      setReanalyzeStatus('Reading text from image...');

      if (result.analysis) {
        const hookText = result.analysis.extractedText?.hookText;
        const extractedFonts = result.analysis.extractedFonts;

        console.log('Extracted hook text:', hookText);
        console.log('Extracted fonts:', extractedFonts);

        if (hookText || extractedFonts) {
          // Update intro scene with extracted hook text
          const updatedLocations = locations.map(loc => {
            if (loc.locationId === 0 && hookText) {
              return {
                ...loc,
                scenes: loc.scenes.map(scene => ({
                  ...scene,
                  textOverlay: hookText,
                  textStyle: extractedFonts?.titleFont
                    ? createStyleFromExtractedFont(extractedFonts.titleFont, true)
                    : scene.textStyle,
                })),
              };
            }
            return loc;
          });

          setLocations(updatedLocations);

          // Update font styles
          if (extractedFonts?.titleFont) {
            const newTitleStyle = createStyleFromExtractedFont(extractedFonts.titleFont, true);
            setTitleTextStyle(newTitleStyle);
            loadGoogleFonts([newTitleStyle.fontFamily]);
          }
          if (extractedFonts?.locationFont) {
            const newLocStyle = createStyleFromExtractedFont(extractedFonts.locationFont, false);
            setLocationTextStyle(newLocStyle);
            loadGoogleFonts([newLocStyle.fontFamily]);
          }

          // Save to localStorage
          const updatedTemplate = {
            ...template,
            locations: updatedLocations,
            extractedFonts,
            deepAnalyzed: true,
          };
          localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
          setTemplate(updatedTemplate as Template);

          setReanalyzeStatus(`Extracted: "${hookText?.slice(0, 30)}..."`);
        } else {
          setReanalyzeStatus('No text found in thumbnail');
        }
      }
    } catch (error) {
      console.error('Re-analysis failed:', error);
      setReanalyzeStatus('Analysis failed - try again');
    } finally {
      setReanalyzing(false);
      setTimeout(() => setReanalyzeStatus(''), 4000);
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
    // Use extracted style based on whether this is intro or location
    const isIntro = locationId === 0;
    const defaultStyle = isIntro ? titleTextStyle : locationTextStyle;
    setEditStyle(currentStyle || defaultStyle);
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
    router.push(`/timeline/reel/${params.id}`);
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
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {fontLibrary.map(font => (
                    <button
                      key={font}
                      onClick={() => setEditStyle({...editStyle, fontFamily: font})}
                      className={`flex flex-col items-center px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0 min-w-[70px] ${
                        editStyle.fontFamily === font
                          ? 'bg-[#8B5CF6] text-white ring-2 ring-white/30'
                          : 'bg-[#2D2640] text-white/80 hover:bg-[#3D3650]'
                      }`}
                    >
                      {/* Font preview sample */}
                      <span
                        className="text-lg leading-tight mb-0.5"
                        style={{ fontFamily: font }}
                      >
                        Abc
                      </span>
                      {/* Font name */}
                      <span className="text-[9px] text-white/50 truncate max-w-[60px]">
                        {font.split(' ')[0]}
                      </span>
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

      {/* Video Info - Editable Title */}
      <div className="px-4 py-3 border-b border-white/10">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="flex-1 bg-[#2D2640] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveVideoTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
            />
            <button
              onClick={saveVideoTitle}
              className="px-3 py-2 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold"
            >
              Save
            </button>
            <button
              onClick={() => setEditingTitle(false)}
              className="px-3 py-2 rounded-lg bg-white/10 text-white text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-2 group w-full text-left"
          >
            <p className="text-sm font-medium text-white line-clamp-1 flex-1">{videoTitle}</p>
            <Pencil className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
          </button>
        )}
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

                {/* Thumbnail preview and re-analyze for Intro */}
                {location.locationId === 0 && location.expanded && template?.videoInfo?.thumbnail && (
                  <div className="px-4 pb-3">
                    <div className="bg-[#2D2640] rounded-xl p-3">
                      <p className="text-xs text-white/50 mb-2">Original thumbnail - extract intro text from this:</p>
                      <div className="flex gap-3">
                        {/* Thumbnail preview */}
                        <div
                          className="w-24 h-32 rounded-lg bg-cover bg-center flex-shrink-0 border border-white/10"
                          style={{ backgroundImage: `url(${template.videoInfo.thumbnail})` }}
                        />
                        {/* Extract button and status */}
                        <div className="flex-1 flex flex-col justify-center">
                          <button
                            onClick={handleReanalyze}
                            disabled={reanalyzing}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#8B5CF6] hover:bg-[#7C4FE0] transition-colors disabled:opacity-50"
                          >
                            {reanalyzing ? (
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-white" />
                            )}
                            <span className="text-sm font-semibold text-white">
                              {reanalyzing ? 'Reading...' : 'Extract Text'}
                            </span>
                          </button>
                          {reanalyzeStatus && (
                            <p className="text-xs text-[#8B5CF6] mt-2 text-center">{reanalyzeStatus}</p>
                          )}
                          <p className="text-[10px] text-white/30 mt-2 text-center">
                            AI will read the text overlay from this image
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                              {location.locationId === 0 && scene.textOverlay
                                ? 'Hook shot with extracted intro text'
                                : scene.description}
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
                                <span className="text-[10px] text-white/40 flex-1 text-left truncate italic">
                                  {location.locationId === 0
                                    ? '✏️ Add your intro text (e.g., "10 Dreamiest Places...")'
                                    : 'Add text overlay...'}
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
