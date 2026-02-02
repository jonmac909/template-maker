'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, House, Plus, FileText, Play } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('templates');
  const router = useRouter();

  const handleExtract = async () => {
    const inputUrl = url.trim();
    if (!inputUrl) {
      setError('Please paste a TikTok URL');
      return;
    }

    console.log('Starting extraction for:', inputUrl);
    setLoading(true);
    setError(null);
    setStatus('Connecting...');

    try {
      const platform = inputUrl.includes('tiktok') ? 'tiktok' : 'instagram';
      console.log('Platform detected:', platform);
      setStatus('Extracting video info...');

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, platform }),
      });

      console.log('Response status:', response.status);
      setStatus('Processing response...');

      const text = await response.text();
      console.log('Response text length:', text.length);

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        throw new Error('Server returned invalid response');
      }

      if (!response.ok) {
        console.error('Response not ok:', data);
        throw new Error(data.error || 'Failed to extract template');
      }

      if (!data.templateId || !data.template) {
        console.error('Missing data:', { hasTemplateId: !!data.templateId, hasTemplate: !!data.template });
        throw new Error('Invalid response from server');
      }

      console.log('Template ID:', data.templateId);
      setStatus('Saving template...');

      // Store template in localStorage for persistence
      localStorage.setItem(`template_${data.templateId}`, JSON.stringify(data.template));
      console.log('Saved to localStorage');

      setStatus('Redirecting to editor...');
      // Go directly to editor (skip analyze page - CORS blocks video loading)
      const editorUrl = `/editor/reel/${data.templateId}`;
      console.log('Navigating to:', editorUrl);
      router.push(editorUrl);
    } catch (err) {
      console.error('Extract error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract. Please try again.';
      setError(errorMessage);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const templates = [
    {
      id: 1,
      title: 'Top 10 Cafes',
      meta: '10 clips • 5 captions',
      duration: '0:15',
      color: '#E879F9',
    },
    {
      id: 2,
      title: '5 Must-See Spots',
      meta: '5 photos • 3 captions',
      duration: '0:12',
      color: 'var(--accent-teal)',
    },
    {
      id: 3,
      title: 'Chiang Mai Itinerary',
      meta: '7 clips • 4 captions',
      duration: '0:30',
      color: '#A78BFA',
    },
    {
      id: 4,
      title: 'Street Food Tour',
      meta: '6 clips • 5 captions',
      duration: '0:18',
      color: 'var(--accent-pink)',
    },
  ];

  return (
    <div className="h-screen w-full flex flex-col bg-[var(--bg-page)]">
      {/* Nav Bar */}
      <div className="flex items-center justify-between h-14 px-6 pt-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          TemplateMaker
        </h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-[20px] bg-[var(--bg-card)]">
          <Settings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-6 px-6 pt-4 pb-3 overflow-y-auto">
        {/* Import from URL Card */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[20px] bg-[var(--accent-purple)] p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">📎 Import from URL</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                placeholder="Paste TikTok or Reel URL..."
                className="flex-1 bg-white rounded-[18px] px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button
                onClick={handleExtract}
                disabled={loading}
                className={`w-12 h-12 flex items-center justify-center rounded-[18px] bg-white transition-all ${
                  url.trim() ? 'hover:scale-105 active:scale-95' : 'opacity-50'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[#8B5CF6] text-xl font-bold">→</span>
                )}
              </button>
            </div>
            {loading && status && (
              <p className="text-white/70 text-xs mt-2">{status}</p>
            )}
            {error && (
              <p className="text-red-200 text-xs mt-1">{error}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[var(--bg-card)] rounded-[22px] p-1 flex h-11">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 rounded-[18px] flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-white text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('edits')}
            className={`flex-1 rounded-[18px] flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'edits'
                ? 'bg-white text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            My Edits
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`flex-1 rounded-[18px] flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'drafts'
                ? 'bg-white text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Drafts
          </button>
        </div>

        {/* Templates Grid */}
        <div className="flex flex-col gap-3">
          {/* Row 1 */}
          <div className="flex gap-3">
            {templates.slice(0, 2).map((template) => (
              <div key={template.id} className="flex-1 flex flex-col gap-2">
                <div
                  className="relative rounded-2xl h-[200px]"
                  style={{ backgroundColor: template.color }}
                >
                  {/* Play Button */}
                  <div className="absolute left-[10px] bottom-[46px] w-9 h-9 flex items-center justify-center rounded-[18px] bg-black/25">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                  {/* Duration */}
                  <div className="absolute right-[10px] bottom-[32px] px-2 py-1 rounded-lg bg-black/40">
                    <span className="text-white text-[11px] font-semibold">
                      {template.duration}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {template.title}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {template.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex gap-3">
            {templates.slice(2, 4).map((template) => (
              <div key={template.id} className="flex-1 flex flex-col gap-2">
                <div
                  className="relative rounded-2xl h-[200px]"
                  style={{ backgroundColor: template.color }}
                >
                  {/* Play Button */}
                  <div className="absolute left-[10px] bottom-[46px] w-9 h-9 flex items-center justify-center rounded-[18px] bg-black/25">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                  {/* Duration */}
                  <div className="absolute right-[10px] bottom-[32px] px-2 py-1 rounded-lg bg-black/40">
                    <span className="text-white text-[11px] font-semibold">
                      {template.duration}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {template.title}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {template.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="h-18 flex items-center justify-around px-8 pb-6 pt-3 bg-[#FAFAFA] border-t border-[#E4E4E7]">
        <button className="w-9 h-9 flex items-center justify-center">
          <House className="w-7 h-7" style={{ color: 'var(--accent-purple)' }} />
        </button>
        <button className="w-14 h-14 flex items-center justify-center rounded-[28px] bg-[var(--accent-purple)]">
          <Plus className="w-7 h-7 text-white" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center">
          <FileText className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>
    </div>
  );
}
