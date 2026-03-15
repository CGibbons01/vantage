import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerApplicationRoutes } from './routes/applications.js';
import { registerAIRoutes } from './routes/ai.js';

// Set Adzuna credentials if not already set
process.env.ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '98619faa';
process.env.ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '2899cb384058f7a2a293c3ff47b84359';

const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Set up authentication with email/password and OAuth providers
app.withAuth();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerProfileRoutes(app, app.fastify);
registerJobRoutes(app, app.fastify);
registerApplicationRoutes(app, app.fastify);
registerAIRoutes(app, app.fastify);

await app.run();
app.logger.info('Application running');
