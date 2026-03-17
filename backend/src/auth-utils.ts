import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import type { App } from './index.js';
import * as authSchema from './db/schema/auth-schema.js';

export interface AuthSession {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Create a Bearer token authentication function
 * Reads Authorization header, validates token against session store
 */
export function createBearerAuth(app: App) {
  return async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<AuthSession | void> {
    try {
      // Read Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        app.logger.warn('No authorization header provided');
        return reply.status(401).send({ error: 'authentication token not found' });
      }

      // Extract Bearer token
      if (!authHeader.startsWith('Bearer ')) {
        app.logger.warn({ authHeader: authHeader.substring(0, 20) }, 'Invalid authorization header format');
        return reply.status(401).send({ error: 'authentication token not found' });
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      if (!token) {
        app.logger.warn('Bearer token is empty');
        return reply.status(401).send({ error: 'authentication token not found' });
      }

      // Query session table for valid, non-expired session
      const session = await app.db.query.session.findFirst({
        where: and(
          eq(authSchema.session.token, token),
          sql`${authSchema.session.expiresAt} > NOW()`
        ),
      });

      if (!session) {
        app.logger.warn({ tokenPrefix: token.substring(0, 10) }, 'Session not found or expired');
        return reply.status(401).send({ error: 'authentication token not found' });
      }

      // Get user associated with session
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, session.userId),
      });

      if (!user) {
        app.logger.warn({ sessionId: session.id }, 'User not found for session');
        return reply.status(401).send({ error: 'authentication token not found' });
      }

      app.logger.info({ userId: user.id }, 'Authentication successful');

      // Convert dates to ISO strings
      const createdAt = user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt);
      const updatedAt = user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt);

      // Return session with user info
      return {
        user: {
          id: String(user.id),
          name: String(user.name),
          email: String(user.email),
          emailVerified: Boolean(user.emailVerified),
          image: user.image ? String(user.image) : null,
          createdAt,
          updatedAt,
        },
        session: {
          id: String(session.id),
          token: String(session.token),
          expiresAt: session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt),
        },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Authentication error');
      return reply.status(401).send({ error: 'authentication token not found' });
    }
  };
}
