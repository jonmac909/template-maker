// Font Library - Persists fonts across sessions

export interface FontItem {
  name: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  weights: string[];
  suggestedFor: string;
  source: string; // video URL or "default" or "manual"
  addedAt: string;
  usageCount: number;
}

const STORAGE_KEY = 'template_maker_fonts';

// Default fonts that are always available
const DEFAULT_FONTS: FontItem[] = [
  {
    name: 'Poppins',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700'],
    suggestedFor: 'locations, captions',
    source: 'default',
    addedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    name: 'Montserrat',
    category: 'sans-serif',
    weights: ['600', '700', '800', '900'],
    suggestedFor: 'titles, hooks',
    source: 'default',
    addedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    name: 'Inter',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700'],
    suggestedFor: 'numbered lists, clean text',
    source: 'default',
    addedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    name: 'Roboto',
    category: 'sans-serif',
    weights: ['400', '500', '700'],
    suggestedFor: 'general purpose',
    source: 'default',
    addedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    name: 'Open Sans',
    category: 'sans-serif',
    weights: ['400', '600', '700'],
    suggestedFor: 'readable text',
    source: 'default',
    addedAt: new Date().toISOString(),
    usageCount: 0,
  },
];

// Get all fonts from the library
export function getFontLibrary(): FontItem[] {
  if (typeof window === 'undefined') return DEFAULT_FONTS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize with defaults
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FONTS));
      return DEFAULT_FONTS;
    }
    return JSON.parse(stored);
  } catch {
    return DEFAULT_FONTS;
  }
}

// Add fonts to the library (merges, doesn't duplicate)
export function addFontsToLibrary(newFonts: Array<{
  name: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  weights: string[];
  suggestedFor: string;
  source: string;
}>): FontItem[] {
  if (typeof window === 'undefined') return DEFAULT_FONTS;

  const currentFonts = getFontLibrary();
  const fontNames = new Set(currentFonts.map(f => f.name.toLowerCase()));

  const fontsToAdd: FontItem[] = [];
  for (const font of newFonts) {
    if (!fontNames.has(font.name.toLowerCase())) {
      fontsToAdd.push({
        ...font,
        addedAt: new Date().toISOString(),
        usageCount: 0,
      });
      fontNames.add(font.name.toLowerCase());
    }
  }

  if (fontsToAdd.length > 0) {
    const updatedLibrary = [...currentFonts, ...fontsToAdd];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLibrary));
    return updatedLibrary;
  }

  return currentFonts;
}

// Increment usage count for a font
export function trackFontUsage(fontName: string): void {
  if (typeof window === 'undefined') return;

  const fonts = getFontLibrary();
  const updated = fonts.map(f =>
    f.name.toLowerCase() === fontName.toLowerCase()
      ? { ...f, usageCount: f.usageCount + 1 }
      : f
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Get font names sorted by usage (most used first)
export function getFontNames(): string[] {
  const fonts = getFontLibrary();
  return fonts
    .sort((a, b) => b.usageCount - a.usageCount)
    .map(f => f.name);
}

// Add a custom font manually
export function addCustomFont(name: string, category: FontItem['category'] = 'sans-serif'): FontItem[] {
  return addFontsToLibrary([{
    name,
    category,
    weights: ['400', '500', '600', '700'],
    suggestedFor: 'custom',
    source: 'manual',
  }]);
}

// Remove a font from the library (except defaults)
export function removeFont(fontName: string): FontItem[] {
  if (typeof window === 'undefined') return DEFAULT_FONTS;

  const fonts = getFontLibrary();
  const updated = fonts.filter(f =>
    f.source === 'default' || f.name.toLowerCase() !== fontName.toLowerCase()
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// Load Google Fonts dynamically
export function loadGoogleFonts(fontNames: string[]): void {
  if (typeof window === 'undefined') return;

  const fontsToLoad = fontNames.filter(name => {
    // Check if already loaded
    const existingLink = document.querySelector(`link[href*="${encodeURIComponent(name)}"]`);
    return !existingLink;
  });

  if (fontsToLoad.length === 0) return;

  const families = fontsToLoad.map(name => `${name}:wght@400;500;600;700;800`).join('&family=');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);
}

// Initialize - load all fonts from library
export function initializeFontLibrary(): void {
  const fonts = getFontLibrary();
  loadGoogleFonts(fonts.map(f => f.name));
}
