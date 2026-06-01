import type { Response } from 'express';

export const setBusinessCookie = ({
  res,
  businessId,
  isProduction,
}: {
  res: Response;
  businessId: string;
  isProduction: boolean;
}) => {
  res.cookie('business_id', businessId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
};

export const clearBusinessCookie = (res: Response, isProduction: boolean) => {
  res.clearCookie('business_id', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  });
};
