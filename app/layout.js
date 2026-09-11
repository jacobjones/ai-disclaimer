import './globals.css'

export const metadata = {
  title: 'AI Disclaimer Tool',
  description: 'Browse and download images with AI disclaimer information',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
