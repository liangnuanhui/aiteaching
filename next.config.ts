import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable experimental features for Cloudflare
  experimental: {
    // Runtime configuration for Cloudflare Workers
  },

  // Ensure compatibility with Cloudflare Pages
  images: {
    // Disable image optimization for Cloudflare (use Cloudflare Image Resizing)
    unoptimized: true,
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }

    // Fix for Cloudflare Workers: exclude Node.js built-in modules
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      // Polyfill or exclude async_hooks for edge runtime
      async_hooks: false,
    };

    // Development only: Ignore database and upload files to prevent HMR
    // This fixes the mobile upload page auto-refresh issue caused by
    // file changes triggering webpack watch events
    // IMPORTANT: Apply to both client and server compilers
    if (dev) {
      // Enhanced ignore patterns for better performance
      const ignoredPatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        // Critical: Ignore all database files
        '**/prisma/**',
        // Critical: Ignore upload directory completely
        '**/uploads/**',
        // Also ignore backup and log files
        '**/*.log',
        '**/*.tmp',
        '**/*.backup',
      ];

      // Apply to webpack watcher
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ignoredPatterns,
        // Do not poll files (improves performance)
        poll: false,
        // Wait before rebuilding (reduces unnecessary rebuilds)
        aggregateTimeout: 300,
      };

      // Also configure snapshot to exclude these directories
      // This ensures Next.js doesn't invalidate the cache due to file changes
      if (!config.snapshot) {
        config.snapshot = {};
      }
      // Use a simple approach - just ensure node_modules is managed
      config.snapshot.managedPaths = [
        ...(config.snapshot.managedPaths || []),
        /^(?:.+?[\\/]node_modules[\\/])/,
      ];

      // Debug logging (optional)
      if (typeof process !== 'undefined' && process.env.DEBUG_WEBPACK) {
        console.log(`[webpack] Configuring ${isServer ? 'server' : 'client'} compiler`);
        console.log(`[webpack] Ignored patterns:`, ignoredPatterns);
      }
    }

    return config;
  },
};

export default nextConfig;
