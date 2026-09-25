import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'puppeteer-extra', 
    'puppeteer-extra-plugin-stealth', 
    'puppeteer', 
    'puppeteer-core', 
    '@sparticuz/chromium'
  ],
};

export default withPWA(nextConfig);
