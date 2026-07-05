// A display token is a request path segment (/public/display/:token), so pino's
// header-only `redact.paths` can't reach it, and neither can anything else that logs
// `request.url` verbatim. Every logging site that captures a request URL must run it
// through this first — otherwise the token ends up in plaintext log output.
const DISPLAY_TOKEN_URL_PATTERN = /(\/public\/display\/)[^/?#]+/i;

export function maskDisplayTokenInUrl(url: string | undefined | null): string {
  if (!url) return '';
  return url.replace(DISPLAY_TOKEN_URL_PATTERN, '$1[MASKED]');
}
