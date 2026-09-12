import {it,expect} from "vitest";
import {Pool} from "pg";
import {readFileSync} from "node:fs";
import {PostgresAccountingRepository} from "../lib/accounting/repository";
it.skipIf(!process.env.TEST_DATABASE_URL)("uses the real PostgreSQL adapter idempotently",async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});const account=`0x${"9".repeat(40)}`;
 try{await pool.query(readFileSync("supabase/migrations/202609120001_accounting.sql","utf8"));const repo=new PostgresAccountingRepository(pool);await repo.put(account,"fills","test",{amount:"10"});await repo.put(account,"fills","test",{amount:"100"});expect(await repo.list(account,"fills")).toEqual([{amount:"10"}]);}
 finally{await pool.query("delete from public.dca_accounting where account=$1",[account]);await pool.end();}
});
