import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { REDIS } from './redis.constants';
import { RedisLock } from './redis-lock.service';

function createRedisClient(config: AppConfig): Redis {
  const logger = new Logger('Redis');
  const client = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });
  // ioredis reconnects on its own; without a listener every failed attempt is an unhandled event.
  client.on('error', (error: Error) => {
    logger.warn(`Redis connection error: ${error.message}`);
  });
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: createRedisClient,
    },
    RedisLock,
  ],
  exports: [REDIS, RedisLock],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
