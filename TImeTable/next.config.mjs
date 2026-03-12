/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['pdfjs-dist', 'tesseract.js'],
    webpack: (config) => {
        config.resolve.alias.canvas = false;
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
        };
        return config;
    },
};

export default nextConfig;
