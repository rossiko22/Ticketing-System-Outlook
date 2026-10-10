// Requires a running app and a separate test browser on CDP port 9223.
// Creates a synthetic ticket and test session, intercepts sends, and removes only its own records.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {pool} from '../src/config/database.ts';
import {env} from '../src/config/env.ts';
import {graphConfig} from '../src/config/graph.ts';
const id=randomUUID(),sid=randomUUID(); let ws; let sequence=0; const pending=new Map(); const sends=[];
function command(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;}
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw new Error(`UI condition timed out: ${expression}`);}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
try{
 const config=graphConfig();const {rows}=await pool.query('SELECT user_id FROM users WHERE lower(email)=$1 AND is_active',[config.ownerEmail]);const user=rows[0].user_id;
 await pool.query("INSERT INTO emails(email_id,mailbox,graph_id,subject,sender_name,sender_address,body_text,received_at) VALUES ($1,$2,$3,'Workflow verification message','Verification','test@example.invalid','Synthetic message for UI verification. No real mail will be sent.',NOW())",[id,config.mailbox,`test-${id}`]);
 const expiry=new Date(Date.now()+3600000);await pool.query('INSERT INTO sessions(sid,sess,expire) VALUES ($1,$2,$3)',[sid,JSON.stringify({userId:user,cookie:{originalMaxAge:3600000,expires:expiry.toISOString(),secure:false,httpOnly:true,path:'/',sameSite:'lax'}}),expiry]);
 const tabs=await(await fetch('http://127.0.0.1:9223/json/list')).json();const tab=tabs.find(t=>t.url.startsWith('http://localhost:3000'));
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=async event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);if(item){clearTimeout(item.timer);pending.delete(data.id);data.error?item.reject(new Error(data.error.message)):item.resolve(data.result);}}else if(data.method==='Fetch.requestPaused'){
  const {requestId,request}=data.params;
  sends.push(JSON.parse(request.postData));
  await command('Fetch.fulfillRequest',{requestId,responseCode:202,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{"accepted":true}').toString('base64')});
 }};
 const signature=createHmac('sha256',env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/,'');
 await command('Network.setCookie',{name:'session',value:encodeURIComponent(`s:${sid}.${signature}`),url:'http://localhost:3000',httpOnly:true,sameSite:'Lax'});
 await command('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3000/emails/*/send',requestStage:'Request'}]});
 await command('Page.navigate',{url:'http://localhost:3000/app.html'});
 await waitFor('document.querySelectorAll("ticket-card").length>0');
 assert.equal(await evaluate('document.querySelectorAll("[data-action=sync-mailbox]").length'),1);
 await evaluate('document.querySelector("#mail-search").value="Workflow verification message";document.querySelector("#mail-filters").requestSubmit()');
 await waitFor('document.querySelectorAll("ticket-card").length===1');
 await click('ticket-card button');await waitFor('!!document.querySelector("#assign-summary")');
 assert.equal(await evaluate('!!document.querySelector(".ticket-toolbar #assign-summary")'),true);
 assert.equal(await evaluate('document.querySelectorAll("[data-action=archive-ticket],[data-action=delete-ticket],#sync-outlook").length'),0);
 await click('#assign-summary');await click('#assign-me');
 await waitFor('document.querySelector("#detail-status")?.textContent==="In progress"');
 await click('#finish-ticket');await waitFor('document.querySelector("#detail-status")?.textContent==="Finished"');
 await evaluate(`document.querySelector('#ticket-status').value='finished';document.querySelector('#closed-filter').value=${JSON.stringify(user)};document.querySelector('#mail-filters').requestSubmit()`);
 await waitFor('document.querySelectorAll("ticket-card").length===1 && document.querySelector("#mail-feedback").textContent.includes("1 emails")');
 assert.match(await evaluate('document.querySelector("ticket-card").textContent'),/Closed by/);
 await click('#reopen-ticket');await waitFor('document.querySelector("#detail-status")?.textContent==="In progress"');
 await waitFor('document.querySelectorAll("ticket-card").length===0');
 await evaluate('document.querySelector("#mail-filters").reset()');await waitFor('document.querySelectorAll("ticket-card").length>0');
 await click('[data-compose=reply]');await evaluate('document.querySelector("#compose-panel textarea").value="Test reply";document.querySelector("#compose-panel form").requestSubmit()');
 await waitFor('document.querySelector("#mail-feedback").textContent.includes("accepted by Outlook")');
 assert.equal(sends[0].action,'reply');assert.equal(sends[0].comment,'Test reply');
 await click('[data-compose=forward]');await evaluate('document.querySelector("#compose-panel input").value="test@example.invalid";document.querySelector("#compose-panel textarea").value="Test forward";document.querySelector("#compose-panel form").requestSubmit()');
 await waitFor('document.querySelector("#mail-feedback").textContent.includes("accepted by Outlook") && !document.querySelector("#compose-panel textarea")');
 assert.equal(sends[1].action,'forward');assert.deepEqual(sends[1].recipients,['test@example.invalid']);
 await command('Page.navigate',{url:'http://localhost:3000/settings.html'});
 await waitFor('document.querySelector("#token-form") && !document.querySelector("#token-form").hidden');
 assert.equal(await evaluate('document.querySelector("#outlook-token").value'),'');
 await click('[data-action=logout]');await waitFor('location.pathname==="/index.html"');
 assert.equal(await evaluate('fetch("/auth/me").then(r=>r.status)'),401);
 console.log('Browser checks passed: profile, one sidebar sync, toolbar assignment, finish/reopen, closed-by filtering, reply/forward forms, token settings and logout. Outbound requests were intercepted; no mail was sent.');
}finally{
 if(ws){ws.close();}
 await pool.query('DELETE FROM email_outgoing WHERE email_id=$1',[id]);
 await pool.query('DELETE FROM email_activity WHERE email_id=$1',[id]);
 await pool.query('DELETE FROM emails WHERE email_id=$1',[id]);
 await pool.query('DELETE FROM sessions WHERE sid=$1',[sid]);
 await pool.end();
}
