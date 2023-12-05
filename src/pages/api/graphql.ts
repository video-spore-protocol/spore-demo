import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { createContext, createApolloServer } from 'spore-graphql';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import KeyvRedis from '@keyv/redis';
import Keyv, { Store } from 'keyv';
import { GraphQLRequestContext } from '@apollo/server';
import { MD5 } from 'crypto-js';
import { NextApiRequest, NextApiResponse } from 'next';

const RESPONSE_CACHE_ENABLED =
  process.env.NEXT_PUBLIC_RESPONSE_CACHE_ENABLED === 'true' && process.env.KV_URL;

export const config = {
  maxDuration: 300,
};

export const fetchCache = 'force-no-store';

const keyvRedis = new KeyvRedis(process.env.KV_URL!);

const store: Store<string> = {
  async get(key: string): Promise<string | undefined> {
    console.log('get', key);
    const val = await keyvRedis.get(key);
    return val as string | undefined;
  },
  async set(key: string, value: string, ttl?: number | undefined) {
    console.log('set', key, ttl);
    if (ttl) {
      return keyvRedis.set(key, value, ttl);
    }
    return keyvRedis.set(key, value);
  },
  async delete(key: string): Promise<boolean> {
    return keyvRedis.delete(key);
  },
  async clear(): Promise<void> {
    await keyvRedis.clear();
  },
};

const cache = new KeyvAdapter(new Keyv({ store }));

function generateCacheKey(requestContext: GraphQLRequestContext<Record<string, any>>) {
  const { request } = requestContext;
  const { query, variables } = request;
  return MD5(JSON.stringify({ query, variables })).toString();
}

export const server = createApolloServer({
  introspection: true,
  ...(RESPONSE_CACHE_ENABLED
    ? {
      cache,
      plugins: [
        ApolloServerPluginCacheControl({
          defaultMaxAge: 60 * 60 * 24 * 365,
          calculateHttpHeaders: false,
        }),
        responseCachePlugin({
          generateCacheKey,
          shouldReadFromCache: async (requestContext) => {
            return requestContext.request.http?.headers.get('Cache-Control') !== 'no-store';
          },
        }),
      ],
    }
    : {}),
});

export const context = createContext();

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  startServerAndCreateNextHandler(server, {
    context: async () => context,
  })(req, res);
};

export default handler;
