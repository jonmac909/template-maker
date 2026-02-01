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
      <body>{children}</body>
    </html>
  )
}
