import type { Response } from 'express';

const DEFAULT_BUSINESS_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export const setBusinessCookie = ({
  res,
  businessId,
  isProduction,
  domain,
  maxAge = DEFAULT_BUSINESS_COOKIE_MAX_AGE,
}: {
  res: Response;
  businessId: string;
  isProduction: boolean;
  domain?: string;
  maxAge?: number;
}) => {
  // Purge a stale host-only cookie left over from before COOKIE_DOMAIN existed (or set by a
  // path that predates it) — otherwise it coexists with the domain-scoped cookie below instead
  // of being replaced, since the browser keys cookies by (name, domain, path).
  if (domain) {
    res.clearCookie('business_id', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
    });
  }

  res.cookie('business_id', businessId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge,
    path: '/',
    ...(domain ? { domain } : {}),
  });
};

export const clearBusinessCookie = (res: Response, isProduction: boolean, domain?: string) => {
  res.clearCookie('business_id', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    ...(domain ? { domain } : {}),
  });

  if (domain) {
    res.clearCookie('business_id', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
    });
  }
};
