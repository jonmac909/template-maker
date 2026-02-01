'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const detectPlatform = (url: string): 'tiktok' | 'instagram' | 'unknown' => {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    return 'unknown';
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    const platform = detectPlatform(url);
    if (platform === 'unknown') {
      setError('Please enter a valid TikTok or Instagram URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, platform }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract template');
      }

      const data = await response.json();

      // Navigate to template breakdown screen
      router.push(`/template/${data.templateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 text-gray-900">
            Reel Template Extractor
          </h1>
          <p className="text-gray-600 text-lg">
            Paste any TikTok or Instagram reel URL to extract its template with layers
          </p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Paste URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/..."
            className="w-full bg-white rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleExtract}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Extracting Template...' : 'Extract Template'}
        </button>

        <div className="mt-12">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">
            What you'll get:
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎬</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Video Layer</div>
                <div className="text-xs text-gray-600">All video clips with timing</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Text Layer</div>
                <div className="text-xs text-gray-600">Editable text with timing</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎵</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Music Layer</div>
                <div className="text-xs text-gray-600">Background audio track</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
