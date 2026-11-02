import { readConfig } from '../src/config.js';
import { readMaintenanceUrl } from '../src/maintenance.js';
import { createPool } from '../src/db.js';
import { prepareCloudDatabase,validateCloudTarget } from '../src/cloud-database.js';

// Refuses the preserved local databases before creating any connection.
const databaseName=validateCloudTarget(process.env.CLOUD_DATABASE_NAME);
const config=readConfig();
if(decodeURIComponent(new URL(config.databaseUrl).pathname.slice(1))!==databaseName) throw Error('DATABASE_URL does not match CLOUD_DATABASE_NAME');
const runtimeRoleName=decodeURIComponent(new URL(config.databaseUrl).username);
const pool=createPool(readMaintenanceUrl(),config);
try {console.log(await prepareCloudDatabase(pool,{databaseName,runtimeRoleName}));}
catch(error) {console.error('Cloud preparation failed:',error.code || 'PREFLIGHT_OR_DATABASE_ERROR');process.exitCode=1;}
finally {await pool.end();}
