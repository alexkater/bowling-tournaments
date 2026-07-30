/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Disable image optimization — no Sharp/image optimizer in the container.
  // If you need optimized images, install sharp (apk add sharp) and remove this.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
