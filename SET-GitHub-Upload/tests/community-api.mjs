import assert from 'node:assert/strict';

// Run against a local preview only; all fixtures use fresh anonymous identities.
const base=process.argv[2]||'http://127.0.0.1:4176';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local preview required');
const ids=Array.from({length:3},()=>crypto.randomUUID());
async function api(i,body){
  const response=await fetch(base+'/api/community',{headers:{'x-set-anonymous-id':ids[i],'content-type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  return {status:response.status,...await response.json()};
}
const people=await Promise.all(ids.map((_,i)=>api(i)));
const [a,b,c]=people.map(p=>p.profile.code);
assert(people.every(p=>p.status===200));
const action=(i,action,code)=>api(i,{action,code});
await action(0,'send-request',b);
await action(0,'send-request',b);
let state=await api(1);
assert.equal(state.requests.length,1,'duplicate send creates one request');
assert.equal(state.requests[0].code,a);
assert.equal(state.friends.length,0,'sending does not create a friendship');
assert.equal((await action(2,'accept-request',a)).status,409,'third party cannot accept');
await action(1,'decline-request',a);
assert.equal((await api(1)).requests.length,0);
assert.equal((await api(0)).friends.length,0);
await action(0,'send-request',b);
await action(2,'send-request',b);
state=await api(1);
assert.deepEqual(state.requests.map(r=>r.code),[c,a],'newest first');
await action(1,'accept-request',a);
state=await api(1);
assert.deepEqual(state.requests.map(r=>r.code),[c]);
assert(state.friends.some(f=>f.code===a));
assert((await api(0)).friends.some(f=>f.code===b),'reciprocal friendship');
await action(1,'accept-request',a);
await action(0,'send-request',b);
assert.equal((await api(1)).requests.length,1,'accepted pair cannot create a new request');
await action(1,'decline-request',c);
assert.equal((await api(1)).requests.length,0);
console.log('PASS: send, deduplication, recipient authorization, decline, chronological order, reciprocal acceptance, repeat acceptance, zero pending.');

if(process.argv[3]){
  // Optional UI fixtures target a known LOCAL preview profile.
  await api(0,{action:'update-name',name:'Alex Test'});
  await api(2,{action:'update-name',name:'Sam Test'});
  await action(0,'send-request',process.argv[3]);
  await action(2,'send-request',process.argv[3]);
  console.log('Local UI fixtures ready:',a,c);
}
