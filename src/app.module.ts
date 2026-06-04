import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

// ── Modules ───────────────────────────────────────────────────────────────────
import { AuthModule } from '@modules/auth/auth.module';
import { BusinessModule } from '@modules/business/business.module';
import { KitchenModule } from '@modules/kitchen/kitchen.module';
import { MenuModule } from '@modules/menu/menu.module';
import { ModifiersModule } from '@modules/modifiers/modifiers.module';
import { OrdersModule } from '@modules/orders/orders.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { StaffModule } from '@modules/staff/staff.module';
import { TableSessionsModule } from '@modules/table-sessions/table-sessions.module';
import { TablesModule } from '@modules/tables/tables.module';
import { TenantModule } from '@common/tenant/tenant.module';
import { UsersModule } from '@modules/users/users.module';

// ── Guards / Filters / Middleware ─────────────────────────────────────────────
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TenantMiddleware } from '@common/middleware/tenant.middleware';

// ── Types ─────────────────────────────────────────────────────────────────────
import { AuthenticatedRequest } from '@common/types/authenticated-request.type';
import { IncomingMessage, ServerResponse } from 'node:http';

// ── Constants ─────────────────────────────────────────────────────────────────
const FEATURE_MODULES = [
  AuthModule,
  BusinessModule,
  KitchenModule,
  MenuModule,
  ModifiersModule,
  OrdersModule,
  PaymentsModule,
  StaffModule,
  TableSessionsModule,
  TablesModule,
  TenantModule,
  UsersModule,
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveRequestId(req: AuthenticatedRequest, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id = Array.isArray(incoming) ? incoming[0] : (incoming ?? randomUUID());
  res.setHeader('x-request-id', id);
  return id;
}

function resolveLogContext(req: AuthenticatedRequest): Record<string, unknown> {
  const payload = req.user;
  const staffId = payload?.type === 'staff' ? payload.staffId : null;
  const principalId = payload?.type === 'owner' ? payload.userId : staffId;

  return {
    context: 'HTTP',
    principalType: payload?.type ?? null,
    principalId,
    businessId: payload?.type === 'staff' ? payload.businessId : req?.businessId,
  };
}

@Module({
  imports: [
    // ── Config ───────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Logger ───────────────────────────────────────────────────────────────
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        const level: string = config.get<string>('LOG_LEVEL', isProd ? 'info' : 'debug');
        return {
          pinoHttp: {
            level,
            genReqId: resolveRequestId,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            // colorize status codes and method
            customSuccessMessage: (req: IncomingMessage, res: ServerResponse) =>
              `${req.method} ${req.url} → ${res.statusCode}`,
            customErrorMessage: (req: IncomingMessage, res: ServerResponse, err: Error) =>
              `${req.method} ${req.url} → ${res.statusCode} (${err.message})`,
            // shape what gets logged
            serializers: {
              req: (req: IncomingMessage) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                rawHeaders: req.rawHeaders,
                // omit headers noise, add only what's useful
                ua: req.headers['user-agent'],
              }),
              res: (res: ServerResponse) => ({
                statusCode: res.statusCode,
              }),
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    // color status codes: green 2xx, yellow 3xx, red 4xx/5xx
                    customColors: 'info:green,warn:yellow,error:red,debug:blue',
                    messageFormat: '{msg} {req.method} {req.url} {res.statusCode}ms',
                  },
                },
            customProps: resolveLogContext,
          },
        };
      },
    }),

    // ── Database ─────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST'),
        port: config.get<number>('POSTGRES_PORT'),
        username: config.get('POSTGRES_USER'),
        password: config.get('POSTGRES_PASSWORD'),
        database: config.get('POSTGRES_DB'),
        autoLoadEntities: true,
        synchronize: false,
        logging: !config.get('NODE_ENV') || config.get('NODE_ENV') === 'development',
        ssl: false,
      }),
    }),

    ...FEATURE_MODULES,
  ],

  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1st: authenticate
    { provide: APP_GUARD, useClass: RolesGuard }, // 2nd: authorize
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
