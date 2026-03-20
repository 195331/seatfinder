/**
 * app-params.js
 * 
 * Cleaned up — Base44 references removed.
 * Auth and app identity now handled by Supabase (see AuthContext.jsx).
 * 
 * This file is kept for compatibility in case any component imports it,
 * but it no longer drives authentication or server routing.
 */

export const appParams = {
  appId: 'seatfinder',
  serverUrl: null,   // No longer used — Supabase handles this
  token: null,       // No longer used — Supabase session handles auth tokens
  functionsVersion: null,
};
