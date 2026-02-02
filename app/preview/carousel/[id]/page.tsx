'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ImageDown, Save, Pencil, CircleCheck } from 'lucide-react';

interface Slide {
  id: number;
  textOverlay: string;
  position: string;
  style: string;
  textColor?: string;
}

interface Template {
  id: string;
  type: 'carousel';
  slides: Slide[];
}

const SLIDE_COLORS = ['#E879F9', '#A78BFA', '#14B8A6', '#F472B6', '#FCD34D'];

export default function CarouselPreview() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
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
        setLoading(false);
        return;
      }

      // Fallback to API
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

  const handleExport = () => {
    alert('Exporting carousel images to Camera Roll...');
    // In production, this would generate and download the images
  };

  const handleSaveToLibrary = () => {
    alert('Saved to your library!');
    router.push('/');
  };

  const handleEditSlides = () => {
    router.push(`/slide-editor/carousel/${params.id}`);
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading preview...</p>
        </div>
      </div>
    );
  }

  const currentSlide = template.slides[currentSlideIndex];
  const slideColor = SLIDE_COLORS[currentSlideIndex % SLIDE_COLORS.length];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-14 px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          Preview
        </h2>
        <div className="w-[60px] h-6" />
      </div>

      {/* Carousel Container */}
      <div className="flex items-center justify-center h-[420px] px-4">
        <div
          className="w-[200px] h-[356px] rounded-xl relative overflow-hidden"
          style={{ backgroundColor: '#1A1A2E' }}
        >
          {/* Slide Image */}
          <div
            className="w-[200px] h-[280px] rounded-t-xl"
            style={{ backgroundColor: slideColor }}
          />

          {/* Slide Caption */}
          <div className="p-3 flex flex-col gap-1">
            <p className="text-white font-semibold text-sm">
              {currentSlide.textOverlay}
            </p>
            <p className="text-white/50 text-xs">
              Slide {currentSlideIndex + 1} of {template.slides.length}
            </p>
          </div>
        </div>
      </div>

      {/* Dots Container */}
      <div className="flex justify-center gap-2 py-2 px-4">
        {template.slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlideIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentSlideIndex
                ? 'bg-white'
                : 'bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Status Section */}
      <div className="flex flex-col items-center gap-4 h-[100px] px-4 py-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-[20px] bg-[#14B8A6]">
          <CircleCheck className="w-[18px] h-[18px] text-white" />
          <span className="text-sm font-semibold text-white">Carousel Ready!</span>
        </div>
        <p className="text-sm text-[#888888] text-center">
          Your {template.slides.length}-slide carousel is ready to share
        </p>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-8">
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6]"
        >
          <ImageDown className="w-5 h-5 text-white" />
          <span className="text-base font-semibold text-white">Save to Camera Roll</span>
        </button>

        {/* Save to Library Button */}
        <button
          onClick={handleSaveToLibrary}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-xl bg-[#1A1A2E]"
        >
          <Save className="w-5 h-5 text-white" />
          <span className="text-base font-medium text-white">Save to Library</span>
        </button>

        {/* Edit Slides Button */}
        <button
          onClick={handleEditSlides}
          className="w-full h-11 flex items-center justify-center gap-2"
        >
          <Pencil className="w-[18px] h-[18px] text-[#888888]" />
          <span className="text-sm text-[#888888]">Edit Slides</span>
        </button>
      </div>
    </div>
  );
}
