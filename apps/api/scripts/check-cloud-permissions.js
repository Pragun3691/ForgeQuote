import {readConfig} from '../src/config.js';
import {createPool} from '../src/db.js';
import {checkCloudPermissions,validateCloudTarget,validateCloudConnection} from '../src/cloud-database.js';

const databaseName=validateCloudTarget(process.env.CLOUD_DATABASE_NAME);
const config=readConfig();
validateCloudConnection(config);
const pool=createPool(config.databaseUrl,config);
try {console.log(await checkCloudPermissions(pool,databaseName));}
catch(error) {console.error('Cloud isolation check failed:',error.code || 'PRIVILEGE_CHECK_FAILED');process.exitCode=1;}
finally {await pool.end();}
