import os from 'node:os'

function getAllowedDevOrigins() {
  const origins = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
  try {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.address) {
          origins.add(net.address)
        }
      }
    }
  } catch {
    // Fallback si os.networkInterfaces no está disponible
  }
  for (let i = 1; i < 255; i++) {
    origins.add(`192.168.0.${i}`)
    origins.add(`192.168.1.${i}`)
    origins.add(`192.168.100.${i}`)
  }
  return Array.from(origins)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig

