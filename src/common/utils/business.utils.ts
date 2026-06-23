import type { Response } from 'express';

export const setBusinessCookie = ({
  res,
  businessId,
  isProduction,
  domain,
}: {
  res: Response;
  businessId: string;
  isProduction: boolean;
  domain?: string;
}) => {
  res.cookie('business_id', businessId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
};
