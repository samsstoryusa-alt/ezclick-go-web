import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
// Server-issued opaque browser identities; no audio, transcript, or API key in this ledger.
export function publicBudget(file,globalLimit=1000){
 let state={day:'',total:0,browsers:{}};
 try{state=JSON.parse(readFileSync(file,'utf8'));if(!state.browsers||!Number.isInteger(state.total))throw Error('Invalid public budget');}catch(e){if(e.code!=='ENOENT')throw e;}
 const save=()=>{writeFileSync(file+'.tmp',JSON.stringify(state),{mode:0o600});renameSync(file+'.tmp',file);};
 function roll(now){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);if(state.day!==day){state.day=day;state.total=0;for(const [id,b] of Object.entries(state.browsers)){if(now-b.seen>30*86400000)delete state.browsers[id];else b.used=0;}save();}}
 return {
  identify(cookie,now,issue=false){roll(now);let id=(cookie||'').match(/(?:^|;\s*)weather_voice=([a-f0-9]{48})(?:;|$)/)?.[1];if(id&&state.browsers[id])return{id};if(!issue||Object.keys(state.browsers).length>=10000)return null;id=randomBytes(24).toString('hex');state.browsers[id]={used:0,seen:now};save();return{id,cookie:`weather_voice=${id}; Path=/voice-api; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`};},
  status(id,now){roll(now);return{dailyLimit:20,requestsUsed:state.browsers[id]?.used??0,resetTimezone:'America/New_York'};},
  reserve(id,now){roll(now);const b=state.browsers[id];if(!b)return'identity';if(b.used>=20)return'daily_limit';if(state.total>=globalLimit)return'global_limit';b.used++;b.seen=now;state.total++;save();return null;}
 };
}
