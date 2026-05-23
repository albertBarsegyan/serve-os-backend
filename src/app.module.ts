import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from '@modules/auth/auth.module';
import { BusinessModule } from '@modules/business/business.module';
import { TablesModule } from '@modules/tables/tables.module';
import { MenuModule } from '@modules/menu/menu.module';
import { StaffModule } from '@modules/staff/staff.module';
import { OrdersModule } from '@modules/orders/orders.module';
import { KitchenModule } from '@modules/kitchen/kitchen.module';
import { PaymentsModule } from '@modules/payments/payments.module';

import { TenantModule } from '@common/tenant/tenant.module';

import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TenantMiddleware } from '@common/middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.get<string>('NODE_ENV', 'development');
        const isProduction = environment === 'production';
        const logLevel = configService.get<string>('LOG_LEVEL', isProduction ? 'info' : 'debug');

        return {
          pinoHttp: {
            level: logLevel,
            genReqId: (req, res) => {
              const incomingRequestId = req.headers['x-request-id'];
              let requestId: string;

              if (typeof incomingRequestId === 'string') {
                requestId = incomingRequestId;
              } else if (Array.isArray(incomingRequestId)) {
                requestId = incomingRequestId[0];
              } else {
                requestId = randomUUID();
              }

              res.setHeader('x-request-id', requestId);
              return requestId;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },
            customProps: (req) => {
              const user = (req as { user?: { id?: string } }).user;

              return {
                context: 'HTTP',
                userId: user?.id,
                businessId: (req as { businessId?: string | null }).businessId ?? null,
              };
            },
          },
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
        ssl: false,
      }),
      inject: [ConfigService],
    }),
    TenantModule,
    AuthModule,
    BusinessModule,
    TablesModule,
    MenuModule,
    StaffModule,
    OrdersModule,
    KitchenModule,
    PaymentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
