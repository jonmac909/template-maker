import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reel Template Extractor',
  description: 'Extract templates from any TikTok or Instagram reel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Base fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap"
          rel="stylesheet"
        />
        {/* Font library - Sans Serif */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Font library - Serif */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&family=Crimson+Text:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Font library - Display */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=Anton&family=Abril+Fatface&family=Righteous&family=Russo+One&display=swap"
          rel="stylesheet"
        />
        {/* Font library - Script/Handwriting */}
        <link
          href="https://fonts.googleapis.com/css2?family=Pacifico&family=Dancing+Script:wght@400;500;600;700&family=Great+Vibes&family=Satisfy&family=Sacramento&family=Tangerine:wght@400;700&family=Alex+Brush&family=Caveat:wght@400;500;600;700&family=Kalam:wght@400;700&family=Shadows+Into+Light&family=Patrick+Hand&family=Indie+Flower&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
