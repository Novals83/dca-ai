import {expect,it} from "vitest";
import {ExchangeClient} from "@nktkas/hyperliquid";
import {generatePrivateKey,privateKeyToAccount} from "viem/accounts";
it("signs an order with the real SDK and an ephemeral local key without browser RPC",async()=>{
 let submitted:unknown;
 const exchange=new ExchangeClient({wallet:privateKeyToAccount(generatePrivateKey()),transport:{isTestnet:false,async request<T>(_endpoint:"info"|"exchange",payload:unknown):Promise<T>{
   submitted=payload;
   return {status:"ok",response:{type:"order",data:{statuses:[{error:"Offline test; no order sent"}]}}} as T;
 }}});
 await expect(exchange.order({orders:[{a:10142,b:true,p:"100000",s:"0.0004",r:false,t:{limit:{tif:"Ioc"}},c:`0x${"a".repeat(32)}`}],grouping:"na"},{expiresAfter:Date.now()+60000})).rejects.toThrow();
 expect(submitted).toMatchObject({action:{type:"order"},signature:{r:expect.stringMatching(/^0x[0-9a-f]{64}$/),s:expect.stringMatching(/^0x[0-9a-f]{64}$/)}});
});
