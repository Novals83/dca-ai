import {Pool} from "pg";
import {readFileSync,readdirSync,existsSync} from "node:fs";
import {join} from "node:path";
if(!process.env.DATABASE_URL)throw new Error("Set DATABASE_URL in the server environment");
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const client=await pool.connect();
try{
 await client.query(readFileSync(new URL("../supabase/migrations/202609120001_accounting.sql",import.meta.url),"utf8"));
 const root=join(process.env.AGENT_DATA_DIR||"/app/.agent-data","accounting");let count=0;
 await client.query("begin");
 for(const account of existsSync(root)?readdirSync(root):[]){if(!/^0x[0-9a-f]{40}$/.test(account))continue;
  for(const kind of ["fills","snapshots","records","strategies"]){const dir=join(root,account,kind);if(!existsSync(dir))continue;
   for(const file of readdirSync(dir).filter(x=>x.endsWith(".json"))){const data=JSON.parse(readFileSync(join(dir,file),"utf8"));const id=kind==="fills"?data.id:kind==="snapshots"?String(Math.floor(Date.parse(data.asOf)/60000)):kind==="records"?`${data.quote.id}:${data.updatedAt}`:`${data.id}:${data.updatedAt}`;
    await client.query("insert into public.dca_accounting(account,kind,id,data) values($1,$2,$3,$4::jsonb) on conflict do nothing",[account,kind,id,JSON.stringify(data)]);count++;
   }
  }
 }
 await client.query("commit");console.log(`Accounting migration completed: ${count} records processed. Source files retained.`);
}catch(e){await client.query("rollback");throw e;}finally{client.release();await pool.end();}
