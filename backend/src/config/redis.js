const Redis = require('ioredis');

let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

async function initRedis() {
  const r = getRedis();
  await r.ping();
  console.log('Redis connected');
}

module.exports = { getRedis, initRedis };
