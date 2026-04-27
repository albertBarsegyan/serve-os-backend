import { DataSource } from 'typeorm';

export const AppDataSourceProd = new DataSource({
  type: 'postgres',
  host: process.env.MIGRATION_POSTGRES_HOST,
  port: parseInt(process.env.MIGRATION_POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  migrations: [
    'dist/database/migrations/*.js',
    'src/database/migrations/*.sql',
  ],
  entities: ['dist/modules/**/entities/*.entity.js'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: false,
  ssl: false,
  migrationsRun: true,
  dropSchema: false,
});
