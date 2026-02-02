'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Crop, SlidersHorizontal, Type, Pencil, Eye } from 'lucide-react';

interface Slide {
  id: number;
  textOverlay: string;
  position: string;
  style: string;
  userImage?: string | null;
  textColor: string;
}

interface Template {
  id: string;
  type: 'carousel';
  slides: Slide[];
}

const SLIDE_COLORS = ['#E879F9', '#A78BFA', '#14B8A6', '#F472B6', '#FCD34D'];

export default function SlideEditor() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<'crop' | 'filter' | 'text'>('text');
  const [isEditingText, setIsEditingText] = useState(false);

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
        setSlides(data.slides.map((slide: any) => ({
          ...slide,
          textColor: '#FFFFFF'
        })));
        setLoading(false);
        return;
      }

      // Fallback to API
      const response = await fetch(`/api/template/${params.id}`);
      if (!response.ok) throw new Error('Template not found');

      const data = await response.json();
      setTemplate(data);
      setSlides(data.slides.map((slide: any) => ({
        ...slide,
        textColor: '#FFFFFF'
      })));
      localStorage.setItem(`template_${params.id}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentSlide = slides[currentSlideIndex];

  const handleTextChange = (newText: string) => {
    setSlides(slides.map((slide, idx) =>
      idx === currentSlideIndex
        ? { ...slide, textOverlay: newText }
        : slide
    ));
  };

  const handlePreview = () => {
    // Save updated slides to localStorage
    if (template) {
      const updatedTemplate = { ...template, slides };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push(`/preview/carousel/${params.id}`);
  };

  if (loading || !template || !currentSlide) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const slideColor = SLIDE_COLORS[currentSlideIndex % SLIDE_COLORS.length];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-14 px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-[18px] bg-white/20"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-base font-semibold text-white">Edit Slides</h2>
        <div className="w-9 h-9" />
      </div>

      {/* Carousel Preview */}
      <div className="flex items-center justify-center px-4 pt-5">
        <div
          className="w-[200px] h-[355px] rounded-xl relative overflow-hidden"
          style={{ backgroundColor: '#1A1A2E' }}
        >
          {/* Slide Image */}
          <div
            className="w-[223px] h-[386px] rounded-xl absolute -left-3 top-0"
            style={{ backgroundColor: slideColor }}
          />

          {/* EDITABLE TEXT OVERLAY - THE KEY FEATURE */}
          <div
            className={`absolute z-10 ${
              currentSlide.position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
              currentSlide.position === 'top' ? 'top-8 left-1/2 -translate-x-1/2' :
              'bottom-16 left-1/2 -translate-x-1/2'
            }`}
          >
            {isEditingText ? (
              <input
                type="text"
                value={currentSlide.textOverlay}
                onChange={(e) => handleTextChange(e.target.value)}
                onBlur={() => setIsEditingText(false)}
                autoFocus
                className="bg-transparent text-white text-lg font-bold text-center border-2 border-dashed border-[#14B8A6] rounded-lg px-4 py-2 focus:outline-none min-w-[150px]"
                style={{ color: currentSlide.textColor }}
              />
            ) : (
              <button
                onClick={() => setIsEditingText(true)}
                className="border-2 border-dashed border-[#14B8A6] px-4 py-2 rounded-lg bg-black/30 backdrop-blur-sm hover:border-[#2DD4BF] transition-colors"
              >
                <p
                  className="text-lg font-bold text-center whitespace-nowrap"
                  style={{ color: currentSlide.textColor }}
                >
                  {currentSlide.textOverlay}
                </p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slide Navigation Dots */}
      <div className="flex justify-center gap-1.5 py-4">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlideIndex(idx)}
            className={`rounded-[3px] transition-all ${
              idx === currentSlideIndex
                ? 'w-1.5 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Title Section */}
      <div className="flex items-center justify-between px-4 py-1">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-white">
            {slides.length} Must-See Spots
          </h3>
          <p className="text-[13px] text-white/50">
            {slides.length} slides • {slides.length} captions
          </p>
        </div>
        <button className="w-8 h-8 flex items-center justify-center rounded-2xl bg-white/20">
          <Pencil className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Tools Bar */}
      <div className="flex items-center justify-center gap-12 h-[70px] bg-[#1A1A2E] mt-4 px-8">
        <button
          onClick={() => setActiveTool('crop')}
          className="flex flex-col items-center gap-1.5"
        >
          <Crop className={`w-[26px] h-[26px] ${activeTool === 'crop' ? 'text-[#8B5CF6]' : 'text-white'}`} />
          <span className={`text-[11px] font-medium ${activeTool === 'crop' ? 'text-[#8B5CF6]' : 'text-white/50'}`}>
            Crop
          </span>
        </button>
        <button
          onClick={() => setActiveTool('filter')}
          className="flex flex-col items-center gap-1.5"
        >
          <SlidersHorizontal className={`w-[26px] h-[26px] ${activeTool === 'filter' ? 'text-[#8B5CF6]' : 'text-white'}`} />
          <span className={`text-[11px] font-medium ${activeTool === 'filter' ? 'text-[#8B5CF6]' : 'text-white/50'}`}>
            Filter
          </span>
        </button>
        <button
          onClick={() => setActiveTool('text')}
          className="flex flex-col items-center gap-1.5"
        >
          <Type className={`w-[26px] h-[26px] ${activeTool === 'text' ? 'text-[#8B5CF6]' : 'text-white'}`} />
          <span className={`text-[11px] font-semibold ${activeTool === 'text' ? 'text-[#8B5CF6]' : 'text-white/50'}`}>
            Text
          </span>
        </button>
      </div>

      {/* Slides Panel */}
      <div className="bg-black px-4 py-3">
        <div className="flex justify-center gap-2">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`w-16 h-[100px] rounded-lg transition-all ${
                idx === currentSlideIndex ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
              }`}
              style={{ backgroundColor: SLIDE_COLORS[idx % SLIDE_COLORS.length] }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="px-4 pt-4 pb-8">
        <button
          onClick={handlePreview}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-[26px] bg-[#8B5CF6]"
        >
          <Eye className="w-[18px] h-[18px] text-white" />
          <span className="text-[15px] font-semibold text-white">Preview</span>
        </button>
      </div>
    </div>
  );
}
