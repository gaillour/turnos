import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'turnia — Demo de reservas por WhatsApp',
  description: 'Maqueta interactiva de un asistente de WhatsApp para reservar turnos.',
  generator: 'turnia',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined') {
                    if (!window.crypto) window.crypto = {};
                    if (!window.crypto.randomUUID) {
                      window.crypto.randomUUID = function() {
                        if (window.crypto.getRandomValues) {
                          return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, function(c) {
                            return (+c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16);
                          });
                        }
                        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                          return v.toString(16);
                        });
                      };
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
