import knex from 'knex';
import knexConfig from '../../../knexfile.js';
import { config } from '../../config/index.js';

const environment = config.NODE_ENV || 'development';
const dbConfig = knexConfig[environment] || knexConfig.development;

export const db = knex(dbConfig);

export async function testDbConnection() {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}
