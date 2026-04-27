import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from '@modules/auth/auth.module';
import { BusinessModule } from '@modules/business/business.module';
import { TablesModule } from '@modules/tables/tables.module';
import { MenuModule } from '@modules/menu/menu.module';
import { StaffModule } from '@modules/staff/staff.module';
import { OrdersModule } from '@modules/orders/orders.module';
import { KitchenModule } from '@modules/kitchen/kitchen.module';
import { PaymentsModule } from '@modules/payments/payments.module';

import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@common/guards/tenant.guard';
import { TenantInterceptor } from '@common/interceptors/tenant.interceptor';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.get<string>(
          'NODE_ENV',
          'development',
        );
        const isProduction = environment === 'production';
        const logLevel = configService.get<string>(
          'LOG_LEVEL',
          isProduction ? 'info' : 'debug',
        );

        return {
          pinoHttp: {
            level: logLevel,
            genReqId: (req, res) => {
              const incomingRequestId = req.headers['x-request-id'];
              const requestId =
                typeof incomingRequestId === 'string'
                  ? incomingRequestId
                  : Array.isArray(incomingRequestId)
                    ? incomingRequestId[0]
                    : randomUUID();
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
              const user = (
                req as { user?: { sub?: string; businessId?: string } }
              ).user;
              return {
                context: 'HTTP',
                userId: user?.sub,
                businessId: user?.businessId,
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
      useClass: TenantGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
