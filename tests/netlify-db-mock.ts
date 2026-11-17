import {PGlite} from '@electric-sql/pglite';
export const testDatabase=new PGlite();
const pool={
 async query(sql:string,params:any[]=[]) { const r=await testDatabase.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??0}; },
 async connect(){return {...pool,release(){}};}
};
export function getDatabase(){return {pool};}
