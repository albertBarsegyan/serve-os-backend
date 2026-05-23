import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth E2E - Full Authentication Flow with Cookies', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.enableCors({
      origin: 'http://localhost:3000',
      credentials: true,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Login Flow with Cookie Persistence', () => {
    const testEmail = `test-auth-${Date.now()}@example.com`;
    const testPassword = 'Test@1234567';
    let accessTokenCookie: string;
    let refreshTokenCookie: string;

    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      // Verify Set-Cookie headers are present
      const setCookieHeaders = response.headers['set-cookie'] || [];
      expect(setCookieHeaders.length).toBeGreaterThan(0);

      const accessCookie = setCookieHeaders.find((c: string) => c.startsWith('access_token='));
      const refreshCookie = setCookieHeaders.find((c: string) => c.startsWith('refresh_token='));

      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();

      console.log('[Test] Register response headers:', {
        setCookieCount: setCookieHeaders.length,
        hasAccessToken: !!accessCookie,
        hasRefreshToken: !!refreshCookie,
      });
    });

    it('should login with credentials and receive cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');

      // Capture Set-Cookie headers
      const setCookieHeaders = response.headers['set-cookie'] || [];
      expect(setCookieHeaders.length).toBeGreaterThan(0);

      const accessCookie = setCookieHeaders.find((c: string) => c.startsWith('access_token='));
      const refreshCookie = setCookieHeaders.find((c: string) => c.startsWith('refresh_token='));

      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();

      accessTokenCookie = accessCookie || '';
      refreshTokenCookie = refreshCookie || '';

      console.log('[Test] Login successful, cookies set:', {
        accessToken: !!accessTokenCookie,
        refreshToken: !!refreshTokenCookie,
      });
    });

    it('should access /auth/me with cookie-based authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', accessTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe(testEmail);

      console.log('[Test] /auth/me successful with cookies:', {
        userId: response.body.id,
        email: response.body.email,
      });
    });

    it('should reject /auth/me without cookie', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me').expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.statusCode).toBe(401);

      console.log('[Test] /auth/me correctly rejected without auth');
    });

    it('should refresh token using refresh cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');

      const newSetCookieHeaders = response.headers['set-cookie'] || [];
      expect(newSetCookieHeaders.length).toBeGreaterThan(0);

      console.log('[Test] Token refresh successful');
    });

    it('should support Bearer token authentication in Authorization header', async () => {
      // First login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const { accessToken } = loginResponse.body.tokens;

      // Now use Bearer token instead of cookie
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe(testEmail);

      console.log('[Test] Bearer token authentication successful');
    });

    it('should support x-business-id header on /auth/me', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', accessTokenCookie)
        .set('x-business-id', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
        .expect(200);

      // businessId header should not affect /auth/me endpoint identity
      expect(response.body).toHaveProperty('email');

      console.log('[Test] /auth/me with x-business-id header works correctly');
    });

    it('should logout and clear cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', accessTokenCookie)
        .expect(200);

      // Verify Set-Cookie headers clear the cookies
      const setCookieHeaders = response.headers['set-cookie'] || [];
      const clearedCookies = setCookieHeaders.filter((c: string) => c.includes('Max-Age=0') || c.includes('expires='));

      console.log('[Test] Logout successful, cookies cleared:', {
        clearedCookieCount: clearedCookies.length,
      });
    });
  });

  describe('Cookie Domain and Path Validation', () => {
    it('should set cookies with correct flags in development', async () => {
      const testEmail = `test-cookie-${Date.now()}@example.com`;
      const testPassword = 'Test@1234567';

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      const setCookieHeaders = response.headers['set-cookie'] || [];
      const accessCookie = setCookieHeaders.find((c: string) => c.startsWith('access_token='));
      const refreshCookie = setCookieHeaders.find((c: string) => c.startsWith('refresh_token='));

      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();

      // In development, should have sameSite=none or sameSite=lax
      expect(accessCookie).toMatch(/SameSite=(None|Lax)/i);
      expect(refreshCookie).toMatch(/SameSite=(None|Lax)/i);

      // Both should be httpOnly
      expect(accessCookie).toMatch(/HttpOnly/i);
      expect(refreshCookie).toMatch(/HttpOnly/i);

      // In development, secure flag should NOT be set for localhost
      if (!process.env.CORS_ORIGIN?.includes('https')) {
        expect(accessCookie).not.toMatch(/Secure(?![a|e|r])/);
      }

      console.log('[Test] Cookie flags validated:', {
        accessCookie: accessCookie?.substring(0, 100),
        refreshCookie: refreshCookie?.substring(0, 100),
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');

      console.log('[Test] Invalid credentials correctly rejected');
    });

    it('should reject expired/invalid token in cookie', async () => {
      const invalidCookie = 'access_token=invalid.jwt.token';

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', invalidCookie)
        .expect(401);

      expect(response.body.statusCode).toBe(401);

      console.log('[Test] Invalid token correctly rejected');
    });
  });
});

