import { resolveBrand } from '../config/brand'

// Read each key explicitly: passing import.meta.env as a whole makes Vite inline every VITE_* var.
export const BRAND = resolveBrand({
  VITE_BRAND_NAME: import.meta.env.VITE_BRAND_NAME,
  VITE_BRAND_DOMAIN: import.meta.env.VITE_BRAND_DOMAIN,
  VITE_LEGACY_DOMAIN: import.meta.env.VITE_LEGACY_DOMAIN,
  VITE_BRAND_TAGLINE: import.meta.env.VITE_BRAND_TAGLINE,
  VITE_BRAND_DESCRIPTION: import.meta.env.VITE_BRAND_DESCRIPTION,
  VITE_BRAND_PREVIEW_TAGLINE: import.meta.env.VITE_BRAND_PREVIEW_TAGLINE,
  VITE_SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
})
