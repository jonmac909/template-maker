'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Check, Camera } from 'lucide-react';

interface Slide {
  id: number;
  textOverlay: string;
  position: string;
  style: string;
  userImage?: File | null;
  filled: boolean;
}

interface Template {
  id: string;
  type: 'carousel';
  slides: Slide[];
}

const SLIDE_COLORS = ['#E879F9', '#A78BFA', '#14B8A6', '#F472B6', '#FCD34D'];

export default function CarouselEditor() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplate();
  }, [params.id]);

  const fetchTemplate = async () => {
    try {
      // First try localStorage
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        setTemplate(data);
        setSlides(data.slides.map((slide: any) => ({ ...slide, filled: false, userImage: null })));
        setLoading(false);
        return;
      }

      // Fallback to API
      const response = await fetch(`/api/template/${params.id}`);
      if (!response.ok) throw new Error('Template not found');

      const data = await response.json();
      setTemplate(data);
      setSlides(data.slides.map((slide: any) => ({ ...slide, filled: false, userImage: null })));
      localStorage.setItem(`template_${params.id}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (slideId: number, file: File) => {
    setSlides(slides.map(slide =>
      slide.id === slideId
        ? { ...slide, userImage: file, filled: true }
        : slide
    ));
  };

  const handleCreateCarousel = () => {
    // Navigate to slide editor for text overlay editing
    router.push(`/slide-editor/carousel/${params.id}`);
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const filledCount = slides.filter(s => s.filled).length;
  const totalCount = slides.length;

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
        <div className="text-center">
          <h2 className="text-base font-semibold text-white">Fill Your Carousel</h2>
        </div>
        <div className="w-9 h-9" />
      </div>

      {/* Slides List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-3">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`rounded-2xl p-3 bg-[#1A1A2E] ${
                !slide.filled ? 'border border-white/20' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div
                  className="flex-shrink-0 w-[72px] h-24 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: slide.filled ? SLIDE_COLORS[idx % SLIDE_COLORS.length] : '#333344' }}
                >
                  {slide.filled ? (
                    <Check className="w-8 h-8 text-white" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Camera className="w-6 h-6 text-white/50" />
                      <span className="text-[10px] text-white/30">Add</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Slide {slide.id}</h3>
                      <p className="text-xs text-white/50 mt-0.5">
                        Text: "{slide.textOverlay}"
                      </p>
                    </div>
                    {slide.filled && (
                      <span className="text-[#14B8A6] text-sm">✓</span>
                    )}
                  </div>

                  {/* Upload Button */}
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(slide.id, file);
                      }}
                    />
                    <div className={`border-2 border-dashed rounded-lg py-3 px-4 text-center cursor-pointer transition-colors ${
                      slide.filled
                        ? 'border-[#14B8A6] bg-[#14B8A6]/10'
                        : 'border-white/20 hover:border-[#14B8A6]/50'
                    }`}>
                      <p className={`text-xs font-medium ${slide.filled ? 'text-[#14B8A6]' : 'text-white/50'}`}>
                        {slide.filled ? 'Image uploaded • Tap to replace' : 'Upload your image'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        <button
          onClick={handleCreateCarousel}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] bg-[#8B5CF6]"
        >
          <Sparkles className="w-[18px] h-[18px] text-white" />
          <span className="text-[15px] font-semibold text-white">
            {filledCount < totalCount
              ? `Continue (${filledCount}/${totalCount} filled)`
              : 'Create Carousel'
            }
          </span>
        </button>

        {/* Skip link for demo/testing */}
        <button
          onClick={handleCreateCarousel}
          className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Skip to Edit Text →
        </button>
      </div>
    </div>
  );
}
