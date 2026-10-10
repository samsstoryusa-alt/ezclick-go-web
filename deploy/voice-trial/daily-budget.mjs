import {readFileSync,writeFileSync,renameSync} from 'node:fs';

// Local pilot: one tester, persisted independently of browser sessions. Production
// must supply an authenticated account ledger instead of this local file.
export function dailyBudget(file=null,zone='America/New_York',limit=20){
 let state={day:'',used:0};
 if(file){try{state=JSON.parse(readFileSync(file,'utf8'));if(typeof state.day!=='string'||!Number.isInteger(state.used)||state.used<0)throw Error('Invalid usage ledger');}catch(error){if(error.code!=='ENOENT')throw error;}}
 const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 return {
  status(now){return {dailyLimit:Number.isFinite(limit)?limit:null,requestsUsed:state.day===day(now)?state.used:0,resetTimezone:zone};},
  reserve(now){const used=state.day===day(now)?state.used:0;if(used>=limit)return false;const next={day:day(now),used:used+1};if(file){writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(file+'.tmp',file);}state=next;return true;}
 };
}
