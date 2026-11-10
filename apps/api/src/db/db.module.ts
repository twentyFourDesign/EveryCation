import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { CONFIG, type Config } from '../config.js';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; services accept either. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: pg.Pool;
  readonly db: Db;
  constructor(@Inject(CONFIG) config: Config) {
    this.pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 20 });
    this.db = drizzle(this.pool, { schema, casing: 'snake_case' });
  }
  async onModuleDestroy() { await this.pool.end(); }
}

@Global()
@Module({ providers: [Database], exports: [Database] })
export class DbModule {}
