import {it,expect,vi} from "vitest";
import {executionContext} from "../lib/ai/execution-context";
import {readStrategy} from "../lib/dca/runtime/store";
vi.mock("../lib/dca/runtime/store",()=>({readStrategy:vi.fn(),pauseRequested:()=>false}));
vi.mock("../lib/dca/runtime/engine",()=>({workerStatus:()=>({started:true,busy:false,error:false,lastTick:null})}));
vi.mock("../lib/agent/store",()=>({getAgent:()=>null}));
vi.mock("../lib/accounting/repository",()=>({accountingRepository:()=>({list:async()=>[]})}));
it("reads the server schedule and local timezone without assuming execution",async()=>{
 vi.mocked(readStrategy).mockReturnValue({id:"saved",status:"running",nextIndex:0,reservedUSDC:0,createdAt:"",updatedAt:"",runs:[],slippageBps:50,plan:{version:1,account:`0x${"1".repeat(40)}`,market:"spot",amount:50,budget:353.46,btcPercent:65,frequency:"weekly",startAt:"2026-09-19T16:14:00.000Z",status:"draft"}});
 const c=await executionContext(`0x${"1".repeat(40)}`,"Europe/Moscow");
 expect(c.strategy).toMatchObject({status:"running",nextScheduledAt:"2026-09-19T16:14:00.000Z",nextScheduledLocal:"19/09/2026, 19:14:00",totalSlots:7});
 expect((await executionContext("demo")).strategy).toBeNull();
});
it("distinguishes missing strategy from an unavailable balance",async()=>{
 vi.mocked(readStrategy).mockReturnValue(null);
 expect((await executionContext(`0x${"2".repeat(40)}`)).strategy).toBeNull();
});
