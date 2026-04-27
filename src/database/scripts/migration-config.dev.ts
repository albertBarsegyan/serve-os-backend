import { DataSource } from 'typeorm';
import { config } from 'dotenv';

const envFile = `.env.migration`;
config({ path: envFile });

export const AppDataSourceDev = new DataSource({
  type: 'postgres',
  host: process.env.MIGRATION_POSTGRES_HOST,
  port: parseInt(process.env.MIGRATION_POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: ['src/modules/**/entities/*.entity{.ts,.js}'],
  migrations: [
    'src/database/migrations/*{.ts,.js}',
    'src/database/migrations/*.sql',
  ],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: true,
  ssl: undefined,
  dropSchema: false,
  migrationsRun: false,
});
