import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,openSync,fsyncSync,closeSync,rmdirSync,unlinkSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import type {RuntimeStrategy} from "./types";
export const directory = () => join(process.env.AGENT_DATA_DIR || "/app/.agent-data","strategies");
function path(account:string,suffix="json") {if(!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Invalid account");return join(directory(),`${account}.${suffix}`);}
export function writeStrategy(state:RuntimeStrategy) {
 mkdirSync(directory(),{recursive:true,mode:0o700});
 state.updatedAt=new Date().toISOString();
 const target=path(state.plan.account);const temp=`${target}.${randomUUID()}.tmp`;
 writeFileSync(temp,JSON.stringify(state),{flag:"wx",mode:0o600});const fd=openSync(temp,"r");try{fsyncSync(fd);}finally{closeSync(fd);}
 renameSync(temp,target);const d=openSync(directory(),"r");try{fsyncSync(d);}finally{closeSync(d);}
}
export function readStrategy(account:string):RuntimeStrategy|null {
 try {const value=JSON.parse(readFileSync(path(account),"utf8")) as RuntimeStrategy;if(value.plan.account!==account)throw new Error("Account mismatch");return value;}
 catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}
}
export function accounts() {try{return readdirSync(directory()).filter(f=>/^0x[0-9a-f]{40}\.json$/.test(f)).map(f=>f.slice(0,-5));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return [];throw e;}}
export function lockStrategy(account:string) {mkdirSync(directory(),{recursive:true,mode:0o700});const p=path(account,"lock");mkdirSync(p,{mode:0o700});return ()=>rmdirSync(p);}
export function requestPause(account:string) {mkdirSync(directory(),{recursive:true,mode:0o700});writeFileSync(path(account,"pause"),"pause",{mode:0o600});}
export const pauseRequested=(account:string)=>existsSync(path(account,"pause"));
export function clearPause(account:string){try{unlinkSync(path(account,"pause"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}}
export function archive(state:RuntimeStrategy){writeFileSync(join(directory(),`${state.plan.account}.${state.id}.archive`),JSON.stringify(state),{flag:"wx",mode:0o600});}

export function strategyHistory(account:string):RuntimeStrategy[]{
 const current=readStrategy(account);let files:string[];
 try{files=readdirSync(directory()).filter(f=>f.startsWith(`${account}.`)&&f.endsWith(".archive"));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return current?[current]:[];throw e;}
 return [...files.map(f=>JSON.parse(readFileSync(join(directory(),f),"utf8")) as RuntimeStrategy),...(current?[current]:[])];
}
