import { environment } from '../../environments/environment';

/**
 * Base for the Node/Express API. Relative in both dev (proxy.conf.json) and
 * prod (vercel.json rewrite) — single source of truth is environment.apiUrl.
 */
export const API_BASE_URL = environment.apiUrl;

/** Base for the FastAPI service (Google Places/Directions, weather, FX, countries). */
export const PY_API_BASE_URL = environment.pyApiUrl;

export const AUTH_STORAGE = {
  token: 'nets_auth_token',
  user: 'nets_auth_user',
};
