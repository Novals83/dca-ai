import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {it,expect} from "vitest";
import {FileAccountingRepository} from "../lib/accounting/repository";
it("stores immutable accounting events idempotently and separates accounts",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"accounting-test-"));try{const repo=new FileAccountingRepository(dir);const a=`0x${"1".repeat(40)}`;await repo.put(a,"fills","one",{fee:"0.1"});await repo.put(a,"fills","one",{fee:"999"});expect(await repo.list(a,"fills")).toEqual([{fee:"0.1"}]);expect(await repo.list(`0x${"2".repeat(40)}`,"fills")).toEqual([]);}finally{rmSync(dir,{recursive:true,force:true});}
});
