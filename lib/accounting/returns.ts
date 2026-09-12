import Decimal from "decimal.js";
export type LedgerFill={id:string;scope:string;quoteId:string;oid:number;time:number;symbol:string;quantity:string;price:string;fee:string;feeToken:string};
export function performance(fills:LedgerFill[],prices:Record<string,number>,now:number,complete=true){
 let invested=new Decimal(0);let weighted=new Decimal(0);const holdings:Record<string,Decimal>={};const cash:{time:number;amount:number}[]=[];const fees:Record<string,Decimal>={};const warnings:string[]=[];
 for(const f of fills){
  const size=new Decimal(f.quantity);const fee=new Decimal(f.fee);let cost=size.mul(f.price);let net=size;
  if(f.feeToken==="USDC")cost=cost.plus(fee);else if(f.feeToken===f.symbol)net=net.minus(fee);else{complete=false;warnings.push(`Unpriced fee token ${f.feeToken}`);}
  fees[f.feeToken]=(fees[f.feeToken]||new Decimal(0)).plus(fee);
  holdings[f.symbol]=(holdings[f.symbol]||new Decimal(0)).plus(net);invested=invested.plus(cost);
  weighted=weighted.plus(cost.mul(Math.max(0,now-f.time)/31536000000));cash.push({time:f.time,amount:cost.toNumber()});
 }
 let value=new Decimal(0);for(const [symbol,qty] of Object.entries(holdings)){if(!(prices[symbol]>0)){complete=false;warnings.push(`Missing price for ${symbol}`);}else value=value.plus(qty.mul(prices[symbol]));}
 const pnl=value.minus(invested);const first=cash.length?Math.min(...cash.map(c=>c.time)):null;const days=first===null?0:(now-first)/86400000;
 let apr:number|null=null;let xirr:number|null=null;
 // Avoid displaying extreme annualizations of minute-old fills.
 if(complete&&days>=1&&invested.gt(0)&&weighted.gt(0)){
  apr=pnl.div(weighted).toNumber()*100;
  if(value.gt(0)){
   const f=(logRate:number)=>cash.reduce((sum,c)=>sum+c.amount*Math.exp(logRate*(now-c.time)/31536000000),0)-value.toNumber();
   let lo=-30,hi=30;
   if(f(lo)<=0&&f(hi)>=0){for(let i=0;i<120;i++){const mid=(lo+hi)/2;if(f(mid)>0)hi=mid;else lo=mid;}const result=Math.expm1((lo+hi)/2)*100;if(Number.isFinite(result))xirr=result;}
  }
 }
 if(days<1)warnings.push("Annualized returns require at least 24 hours of history.");
 if(!complete)warnings.push("Incomplete execution/fee data: return percentages are withheld.");
 return {investedUSDC:invested.toFixed(),markedValueUSDC:value.toFixed(),pnlUSDC:complete?pnl.toFixed():null,roiPercent:complete&&invested.gt(0)?pnl.div(invested).mul(100).toNumber():null,aprPercent:apr,xirrPercent:xirr,days,complete,holdings:Object.fromEntries(Object.entries(holdings).map(([k,v])=>[k,v.toFixed()])),fees:Object.fromEntries(Object.entries(fees).map(([k,v])=>[k,v.toFixed()])),warnings};
}
