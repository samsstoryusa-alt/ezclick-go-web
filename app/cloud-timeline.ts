export function cloudHistory(dimension:string,now=Date.now()){
 const times=[...new Set(dimension.split(',').map(s=>Date.parse(s.trim())).filter(Number.isFinite))].sort((a,b)=>a-b);
 const latest=times.at(-1);
 if(latest===undefined||now-latest>90*60000||latest>now+10*60000)throw Error('Satellite observations are delayed');
 const selected=[latest];
 for(let i=times.length-2;i>=0;i--)if(times[i]>=latest-60*60000&&selected.at(-1)!-times[i]>=10*60000)selected.push(times[i]);
 return selected.reverse();
}
export function cloudPosition(elapsed:number,count:number){
 if(count<2)return {a:0,b:0,mix:0};
 // Hold latest, then restart; never blend backwards across the loop boundary.
 const phase=(elapsed%((count-1)*1800+2200))/1800;
 const a=Math.min(count-1,Math.floor(phase)),b=Math.min(count-1,a+1);
 return {a,b,mix:a===b?0:phase-a};
}
