// Sentry's Metro config adds debug IDs to the bundle so crash stack traces
// from store builds and over-the-air updates map back to readable source.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
