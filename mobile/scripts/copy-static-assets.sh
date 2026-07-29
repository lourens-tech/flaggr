#!/bin/sh
# Copies files into the Expo web export output (dist/) that aren't part of
# the app bundle itself: email assets, reward images, and standalone public
# pages (account deletion, privacy policy) needed for Play/App Store review
# links, since the web build has no per-screen deep links to point at.
set -e

cp assets/email/flagrr-logo-white-email.png dist/flagrr-logo-white-email.png
mkdir -p dist/rewards
cp assets/images/rewards/*.jpg dist/rewards/
cp static/delete-account.html dist/delete-account.html
cp static/privacy.html dist/privacy.html
