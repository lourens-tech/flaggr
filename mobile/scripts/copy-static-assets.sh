#!/bin/sh
# Copies files into the Expo web export output (dist/) that aren't part of
# the app bundle itself: email assets, reward images, standalone public
# pages (account deletion, privacy policy) needed for Play/App Store review
# links, and the PWA manifest/service-worker/icons that let course-admin and
# super-admin users install the web app as a desktop app (Chrome/Edge
# "Install app") — since the web build has no per-screen deep links to point
# at and Expo's Metro web export doesn't generate a PWA manifest on its own.
set -e

cp assets/email/flagrr-logo-white-email.png dist/flagrr-logo-white-email.png
mkdir -p dist/rewards
cp assets/images/rewards/*.jpg dist/rewards/
cp static/delete-account.html dist/delete-account.html
cp static/privacy.html dist/privacy.html
cp static/support.html dist/support.html

cp static/manifest.json dist/manifest.json
cp static/sw.js dist/sw.js
cp assets/pwa-icon-192.png dist/pwa-icon-192.png
cp assets/playstore-icon-512.png dist/pwa-icon-512.png

# Expo's generated index.html has no manifest link, theme-color, or service
# worker registration — inject them post-export rather than fighting Metro's
# web export for a custom HTML template.
sed -i \
  -e 's@<link rel="icon" href="/favicon.ico"/>@<link rel="icon" href="/favicon.ico"/><link rel="manifest" href="/manifest.json"/><link rel="apple-touch-icon" href="/pwa-icon-192.png"/><meta name="theme-color" content="#1F4234"/>@' \
  -e 's@</body>@<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js")})}</script></body>@' \
  dist/index.html
