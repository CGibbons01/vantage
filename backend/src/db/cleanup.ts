import { createApplication } from "@specific-dev/framework";
import * as appSchema from './schema/schema.js';
import * as authSchema from './schema/auth-schema.js';

const schema = { ...appSchema, ...authSchema };

async function cleanup() {
  const app = await createApplication(schema);

  try {
    console.log('Starting data cleanup...');

    // Delete all rows from job_applications first (respects FK constraints)
    const deletedApplications = await app.db.delete(schema.jobApplications);
    console.log('✓ Deleted all rows from job_applications table');

    // Delete all rows from profiles
    const deletedProfiles = await app.db.delete(schema.profiles);
    console.log('✓ Deleted all rows from profiles table');

    console.log('\n✓ Cleanup complete! All data removed.');
    console.log('  - Table structures remain intact');
    console.log('  - Authentication tables (user, session, account, verification) unchanged');

    process.exit(0);
  } catch (error) {
    console.error('✗ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
