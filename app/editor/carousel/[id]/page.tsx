'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

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
      const response = await fetch(`/api/template/${params.id}`);
      if (!response.ok) throw new Error('Template not found');

      const data = await response.json();
      setTemplate(data);
      setSlides(data.slides.map((slide: any) => ({ ...slide, filled: false, userImage: null })));
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
    const allFilled = slides.every(slide => slide.filled);

    if (!allFilled) {
      alert('Please fill all slides before creating the carousel');
      return;
    }

    // Navigate to slide editor for text overlay editing
    router.push(`/slide-editor/carousel/${params.id}`);
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

  const filledCount = slides.filter(s => s.filled).length;
  const totalCount = slides.length;

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
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Fill Your Carousel</h2>
          <p className="text-sm text-gray-400">{filledCount} / {totalCount} slides filled</p>
        </div>
        <div className="w-16"></div>
      </div>

      {/* Slides List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="bg-[#2D2640] rounded-xl p-6"
            >
              <div className="flex items-start gap-4">
                {/* Slide Number */}
                <div className="flex-shrink-0 w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold">
                  {slide.id}
                </div>

                {/* Slide Info */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">Slide {slide.id}</h3>
                      <p className="text-gray-400 text-sm">
                        Text: "{slide.textOverlay}"
                      </p>
                    </div>
                    {slide.filled && (
                      <span className="text-green-400">✓</span>
                    )}
                  </div>

                  {/* Upload Area */}
                  <div className="mt-4">
                    <label className="block">
                      <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        slide.filled
                          ? 'border-green-400 bg-green-900/20'
                          : 'border-gray-600 hover:border-teal-400 bg-gray-800/30'
                      }`}>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(slide.id, file);
                          }}
                        />
                        {slide.filled ? (
                          <>
                            <div className="text-green-400 mb-2">✓</div>
                            <p className="text-green-400 text-sm font-medium">
                              {slide.userImage?.name || 'Image uploaded'}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Click to replace
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-400 text-3xl mb-2">📸</div>
                            <p className="text-gray-400 text-sm font-medium">
                              Upload your image
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              Click to browse
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="p-6 border-t border-gray-700">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleCreateCarousel}
            disabled={filledCount < totalCount}
            className="w-full bg-gradient-to-r from-teal-500 to-blue-500 text-white font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {filledCount < totalCount
              ? `Fill ${totalCount - filledCount} more slide${totalCount - filledCount > 1 ? 's' : ''}`
              : '+ Edit Text & Create Carousel'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
