import 'dotenv/config';

export default {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'school_db',
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true
    },
    pool: {
      min: 2,
      max: 20,
      afterCreate: (conn, done) => {
        conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
      }
    },
    migrations: {
      directory: './src/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/seeds'
    }
  },
  test: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.TEST_DB_NAME || 'school_db',
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true
    },
    pool: {
      min: 2,
      max: 10,
      afterCreate: (conn, done) => {
        conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
      }
    },
    migrations: {
      directory: './src/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/seeds'
    }
  },
  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      timezone: 'Z',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      dateStrings: true
    },
    pool: {
      min: 5,
      max: 30,
      afterCreate: (conn, done) => {
        conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
      }
    },
    migrations: {
      directory: './src/migrations',
      tableName: 'knex_migrations'
    }
  }
};
