import {mkdirSync,readFileSync,writeFileSync,readdirSync,linkSync,unlinkSync,openSync,fsyncSync,closeSync} from "node:fs";
import {join} from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {Pool} from "pg";
export interface AccountingRepository {
 put(account:string,kind:string,id:string,data:unknown):Promise<void>;
 list<T>(account:string,kind:string):Promise<T[]>;
}
function validate(account:string,kind:string){if(!/^0x[0-9a-f]{40}$/.test(account)||!['fills','snapshots','records','strategies'].includes(kind))throw new Error("Invalid accounting scope");}
export class FileAccountingRepository implements AccountingRepository {
 constructor(private root=join(process.env.AGENT_DATA_DIR||"/app/.agent-data","accounting")){}
 async put(account:string,kind:string,id:string,data:unknown){
  validate(account,kind);const d=join(this.root,account,kind);mkdirSync(d,{recursive:true,mode:0o700});
  const path=join(d,createHash("sha256").update(id).digest("hex")+".json");const temp=path+randomUUID()+".tmp";
  writeFileSync(temp,JSON.stringify(data),{flag:"wx",mode:0o600});const fd=openSync(temp,"r");try{fsyncSync(fd);}finally{closeSync(fd);}
  try{linkSync(temp,path);}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;}finally{unlinkSync(temp);}
  const dir=openSync(d,"r");try{fsyncSync(dir);}finally{closeSync(dir);}
 }
 async list<T>(account:string,kind:string):Promise<T[]>{validate(account,kind);const d=join(this.root,account,kind);try{return readdirSync(d).filter(f=>f.endsWith(".json")).map(f=>JSON.parse(readFileSync(join(d,f),"utf8")));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return [];throw e;}}
}
export class PostgresAccountingRepository implements AccountingRepository {
 constructor(private pool:Pool){}
 async put(account:string,kind:string,id:string,data:unknown){validate(account,kind);await this.pool.query('insert into public.dca_accounting (account,kind,id,data) values ($1,$2,$3,$4::jsonb) on conflict (account,kind,id) do nothing',[account,kind,id,JSON.stringify(data)]);}
 async list<T>(account:string,kind:string):Promise<T[]>{validate(account,kind);const r=await this.pool.query('select data from public.dca_accounting where account=$1 and kind=$2 order by created_at,id',[account,kind]);return r.rows.map(r=>r.data);}
}
let repository:AccountingRepository|undefined;
export function accountingRepository(){
 if(!repository){if(process.env.ACCOUNTING_STORAGE==="postgres"){
  if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required for PostgreSQL accounting");
  repository=new PostgresAccountingRepository(new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000}));
 }else repository=new FileAccountingRepository();}
 return repository;
}
