import assert from 'node:assert/strict';
const base=process.env.SMOKE_URL||'http://localhost:3000';
const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await fetch(base)).status,200);
assert.equal((await fetch(base+'/app')).status,200);
const status=await (await fetch(base+'/api/status')).json();assert.equal(status.trading,false);
assert.equal((await post('/api/hyperliquid/portfolio',{address:'invalid'})).status,400);
const market=await (await fetch(base+'/api/hyperliquid/market')).json();assert.ok(market.BTC>0&&market.HYPE>0);assert.equal(market.source,'live');
const address='0xdca1000000000000000000000000000000000001';
const response=await post('/api/hyperliquid/portfolio',{address});
assert.equal(response.status,200);const p=await response.json();assert.equal(p.source,'live');assert.ok(Number.isFinite(p.accountValue));
if(!status.aiConfigured){
 const chat=await (await post('/api/copilot',{account:'demo',message:'Simulate $50/day'})).json();assert.equal(chat.provider,'local');assert.equal(chat.preview.contributionAmount,50);
 assert.equal((await post('/api/live/session',{sdp:'test-offer'})).status,503);
}
console.log('PASS: landing, dashboard, validation, live BTC/HYPE prices, live account normalization, calculator fallback and voice-unavailable response.');
console.log('Live model calls were not made by this smoke test.');
