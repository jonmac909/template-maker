'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Slide {
  id: number;
  textOverlay: string;
  position: string;
  style: string;
  userImage?: File | null;
  textColor: string;
}

interface Template {
  id: string;
  type: 'carousel';
  slides: Slide[];
}

export default function SlideEditor() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
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
      setSlides(data.slides.map((slide: any) => ({
        ...slide,
        textColor: '#FFFFFF'
      })));
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

  const handleColorChange = (color: string) => {
    setSlides(slides.map((slide, idx) =>
      idx === currentSlideIndex
        ? { ...slide, textColor: color }
        : slide
    ));
  };

  const handlePreview = () => {
    // Navigate to preview screen
    router.push(`/preview/carousel/${params.id}`);
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-[#1F1B2D] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const colorOptions = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Black', value: '#000000' },
    { name: 'Purple', value: '#A78BFA' },
    { name: 'Pink', value: '#F472B6' },
    { name: 'Teal', value: '#2DD4BF' },
  ];

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
        <h2 className="text-xl font-bold text-white">Edit Slides</h2>
        <div className="w-16"></div>
      </div>

      {/* Slide Preview with Text Overlay */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          {/* Main Slide Preview */}
          <div className="bg-gray-800 rounded-2xl aspect-square relative overflow-hidden mb-6">
            {/* Background Image Placeholder */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <div className="text-6xl mb-2">🏔️</div>
                <p className="text-sm">[User's Image]</p>
              </div>
            </div>

            {/* EDITABLE TEXT OVERLAY - THE KEY FEATURE */}
            <div
              className={`absolute ${
                currentSlide.position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                currentSlide.position === 'top' ? 'top-8 left-1/2 -translate-x-1/2' :
                'bottom-8 left-1/2 -translate-x-1/2'
              }`}
            >
              <div
                className="border-2 border-dashed border-teal-400 px-6 py-3 rounded-lg bg-black/30 backdrop-blur-sm cursor-pointer hover:border-teal-300 transition-colors"
                onClick={() => {
                  const input = document.getElementById('text-input');
                  input?.focus();
                }}
              >
                <p
                  className={`text-2xl font-bold text-center whitespace-nowrap ${
                    currentSlide.style === 'bold' ? 'font-extrabold' : ''
                  }`}
                  style={{ color: currentSlide.textColor }}
                >
                  {currentSlide.textOverlay}
                </p>
              </div>
            </div>
          </div>

          {/* Slide Navigation Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`rounded-full transition-all ${
                  idx === currentSlideIndex
                    ? 'w-8 h-3 bg-white'
                    : 'w-3 h-3 bg-gray-600 hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          {/* Text Input */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Edit Text
            </label>
            <input
              id="text-input"
              type="text"
              value={currentSlide.textOverlay}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full bg-[#2D2640] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Enter your text..."
            />
          </div>

          {/* Color Palette */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Text Color
            </label>
            <div className="flex gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorChange(color.value)}
                  className={`w-12 h-12 rounded-lg transition-transform hover:scale-110 ${
                    currentSlide.textColor === color.value
                      ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-[#1F1B2D]'
                      : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Preview Button */}
          <button
            onClick={handlePreview}
            className="w-full bg-gradient-to-r from-teal-500 to-blue-500 text-white font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity"
          >
            Preview Carousel
          </button>
        </div>
      </div>

      {/* Helper Text */}
      <div className="p-6 border-t border-gray-700">
        <div className="max-w-lg mx-auto">
          <p className="text-center text-gray-500 text-sm">
            ⭐ Click the text box to edit • Use dots to switch slides • Choose colors below
          </p>
        </div>
      </div>
    </div>
  );
}
