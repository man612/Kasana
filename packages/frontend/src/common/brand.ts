/**
 * Display branding is configured in frontend/branding.json.
 * Change the name there and run npm run branding:sync; internal IDs are stable.
 */
import branding from '../../branding.json';

export const APP_BRAND = {
  name: branding.name,
  tagline: '',
  description: branding.description,
} as const;
