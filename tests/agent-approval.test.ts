import {it,expect} from "vitest";
import {ExchangeClient} from "@nktkas/hyperliquid";
import {createWalletClient,custom} from "viem";
import {generatePrivateKey,privateKeyToAccount} from "viem/accounts";
it.each(["0x1","0xa4b1"])("signs an expiry-bearing agent approval on active chain %s without network access",async(chainId)=>{
 const signer=privateKeyToAccount(generatePrivateKey());
 let signed=false;
 const provider={async request({method,params}:{method:string;params?:unknown[]}){
  if(method==="eth_chainId")return chainId;
  if(method==="eth_accounts")return [signer.address];
  if(method==="eth_signTypedData_v4"){
   const data=JSON.parse((params as string[])[1]);
   expect(Number(data.domain.chainId)).toBe(Number(chainId));
   expect(data.message.agentName).toBe("dca-test valid_until 1793463540000");
   signed=true;return signer.signTypedData(data);
  }
  throw new Error(`Unexpected RPC ${method}`);
 }};
 const client=new ExchangeClient({signatureChainId:chainId as `0x${string}`,wallet:createWalletClient({account:signer.address,transport:custom(provider)}),transport:{isTestnet:false,async request<T>(_endpoint:"info"|"exchange",payload:unknown):Promise<T>{
  expect(signed).toBe(true);
  expect((payload as {action:{signatureChainId:string}}).action.signatureChainId).toBe(chainId);
  return {status:"ok",response:{type:"default"}} as T;
 }}});
 await client.approveAgent({agentAddress:"0x1111111111111111111111111111111111111111",agentName:"dca-test valid_until 1793463540000"});
});
