import {readConfig} from '../src/config.js';
import {createPool} from '../src/db.js';
import {checkCloudPermissions,validateCloudTarget} from '../src/cloud-database.js';

const databaseName=validateCloudTarget(process.env.CLOUD_DATABASE_NAME);
const config=readConfig();
if(decodeURIComponent(new URL(config.databaseUrl).pathname.slice(1))!==databaseName) throw Error('DATABASE_URL does not match CLOUD_DATABASE_NAME');
const pool=createPool(config.databaseUrl,config);
try {console.log(await checkCloudPermissions(pool,databaseName));}
catch(error) {console.error('Cloud isolation check failed:',error.code || 'PRIVILEGE_CHECK_FAILED');process.exitCode=1;}
finally {await pool.end();}
