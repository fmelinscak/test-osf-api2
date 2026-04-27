/**
 * config.js — OSF Submission App configuration
 *
 * Replace the two placeholder values below with your own settings.
 * All other values point to the standard public OSF infrastructure and
 * should not need to change unless you are using a private OSF deployment.
 *
 * See README.md for step-by-step setup instructions.
 */
const CONFIG = {
  // ── Required ─────────────────────────────────────────────────────────────

  /** OSF project/node GUID — the 5-character code in the project URL.
   *  e.g. https://osf.io/abc12/ → 'abc12'                               */
  OSF_PROJECT_ID: 'YOUR_PROJECT_ID',

  /** Client ID of the OAuth2 application registered at
   *  https://accounts.osf.io/oauth2/applications/
   *  This value is intentionally public; do NOT put the client secret here. */
  OSF_CLIENT_ID: 'YOUR_CLIENT_ID',

  // ── OSF service endpoints (do not change for the main osf.io instance) ──

  /** CAS / OAuth2 authorisation endpoint */
  OSF_AUTH_URL: 'https://accounts.osf.io/oauth2/authorize',

  /** JSON-API endpoint */
  OSF_API_URL: 'https://api.osf.io/v2',

  /** WaterButler file-service endpoint */
  OSF_FILES_URL: 'https://files.osf.io/v1',

  /** OAuth2 scopes — full_write is required to upload files */
  OSF_SCOPES: 'osf.full_write',
};
