import {test} from "vitest";
import assert from "node:assert/strict";
import {requiredAgentExpiry,coversStrategy} from "../lib/agent/coverage";
test("authorization covers the final weekly installment including execution grace",()=>{
 const required=requiredAgentExpiry({version:1,account:`0x${"1".repeat(40)}`,market:"spot",amount:50,budget:353.46,btcPercent:65,frequency:"weekly",startAt:"2026-09-19T16:14:00.000Z",status:"draft"});
 assert.equal(new Date(required).toISOString(),"2026-10-31T16:19:00.000Z");
 assert.equal(coversStrategy(required,required,required),true);
 assert.equal(coversStrategy(required-1,required,required),false);
 assert.equal(coversStrategy(required,required-1,required),false);
 assert.equal(coversStrategy(required,null,required),true);
});
