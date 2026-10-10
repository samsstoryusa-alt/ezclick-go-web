export type VoiceDeparture={date:string;time:string;leaveNow:boolean;notice:string;instant?:string};
export type StructuredDeparture={departure_mode?:'now'|'scheduled'|'keep'|null;departure_date?:string|null;departure_time?:string|null;departure_timezone?:string|null};
export const emptyVoiceDeparture:VoiceDeparture={date:'',time:'',leaveNow:false,notice:''};
const pad=(n:number)=>String(n).padStart(2,'0');
const dateText=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export function savedVoiceDeparture(instant:string,now=new Date()):VoiceDeparture{
 const date=new Date(instant);
 return Number.isFinite(date.getTime())&&date>now?{date:dateText(date),time:`${pad(date.getHours())}:${pad(date.getMinutes())}`,leaveNow:false,notice:'',instant:date.toISOString()}:{...emptyVoiceDeparture};
}
// Model output is structured data, never another natural-language parser input.
export function structuredVoiceDeparture(draft:StructuredDeparture,previous:VoiceDeparture|null=null,savedInstant:string|null=null,clock=new Date(),deviceZone=Intl.DateTimeFormat().resolvedOptions().timeZone):VoiceDeparture{
 if(draft.departure_mode==='now')return{...emptyVoiceDeparture,leaveNow:true};
 if(draft.departure_mode==='keep')return previous?{...previous}:savedInstant===''?{...emptyVoiceDeparture,leaveNow:true}:savedInstant?savedVoiceDeparture(savedInstant,clock):{...emptyVoiceDeparture};
 if(draft.departure_mode!=='scheduled')return{...emptyVoiceDeparture};
 const value:VoiceDeparture={date:typeof draft.departure_date==='string'?draft.departure_date:'',time:typeof draft.departure_time==='string'?draft.departure_time:'',leaveNow:false,notice:''};

 const zone=draft.departure_timezone||deviceZone;
 let formatter:Intl.DateTimeFormat;
 try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}catch{return{...value,notice:'timezone'};}
 if(!value.date||!value.time)return value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!/^\d{2}:\d{2}$/.test(value.time))return{...value,notice:'invalid'};
 const wall=Date.parse(value.date+'T'+value.time+':00Z');
 if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,16)!==value.date+'T'+value.time)return{...value,notice:'invalid'};
 const zonedWall=(ms:number)=>{
  const parts=Object.fromEntries(formatter.formatToParts(ms).map(part=>[part.type,part.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
 };
 // Collect offsets on both sides of a possible clock change, then round-trip.
 const candidates=new Set<number>();
 for(let hours=-36;hours<=36;hours+=6){const probe=wall+hours*3600000;const candidate=wall-(zonedWall(probe)-probe);if(zonedWall(candidate)===wall)candidates.add(candidate);}
 if(candidates.size!==1)return{...value,notice:candidates.size?'ambiguous':'invalid'};
 value.instant=new Date([...candidates][0]).toISOString();
 return value;
}
// Conservative local interpretation: unsupported or ambiguous expressions ask
// for confirmation instead of silently picking a day or an AM/PM meaning.
export function applyVoiceDeparture(phrase:string,previous:VoiceDeparture,clock=new Date()):VoiceDeparture{
 let text=phrase.toLowerCase().replace(/ё/g,'е').replace(/a\.m\./g,'am').replace(/p\.m\./g,'pm').trim();
 if(!text)return previous;
 if(/^(?:сейчас|прямо сейчас|now|right now|leave now)[.! ]*$/.test(text))return{date:'',time:'',leaveNow:true,notice:''};
 let date=previous.date,time=previous.time,notice='';
 const offset=/послезавтра|day after tomorrow/.test(text)?2:/завтра|tomorrow/.test(text)?1:/сегодня|today/.test(text)?0:null;
 if(offset!==null){const day=new Date(clock);day.setDate(day.getDate()+offset);date=dateText(day);text=text.replace(/послезавтра|day after tomorrow|завтра|tomorrow|сегодня|today/g,' ');}
 const iso=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
 if(iso){const d=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]),12);date=dateText(d)===iso[0]?iso[0]:'';text=text.replace(iso[0],' ');if(!date)notice='Уточните дату выезда.';}
 else if(/понедельник|вторник|сред[ау]|четверг|пятниц|суббот|воскресень|недел|январ|феврал|март|апрел|мая|июн|июл|август|сентябр|октябр|ноябр|декабр|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|january|february|march|april|june|july|august|september|october|november|december|\d+[/.]\d+/.test(text)){date='';notice='Уточните дату выезда в поле ниже.';}
 const words:Record<string,number>={'двенадцать':12,'одиннадцать':11,'десять':10,'девять':9,'восемь':8,'семь':7,'шесть':6,'пять':5,'четыре':4,'три':3,'два':2,'один':1,'двенадцати':12,'одиннадцати':11,'девяти':9,'восьми':8,'семи':7,'шести':6,'пяти':5,'четырех':4,'трех':3,'двух':2,'час':1,'twelve':12,'eleven':11,'ten':10,'nine':9,'eight':8,'seven':7,'six':6,'five':5,'four':4,'three':3,'two':2,'one':1};
 for(const [word,value] of Object.entries(words))text=text.replace(new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`,'gu'),String(value));
 const unsupported=/половин|четверт|без\s|через|in\s+\d+\s+hours|half|quarter|\d+\s+\d+|минут|minutes/.test(text);
 const matches=[...text.matchAll(/(?<!\d)(\d{1,2})(?::([0-5]\d))?(?![\d:])/g)];
 const am=/утра|утром|\bam\b|morning/.test(text),pm=/вечера|вечером|дня|днем|\bpm\b|afternoon|evening/.test(text);
 if(unsupported||matches.length>1){time='';notice='Уточните точное время выезда.';}
 else if(matches.length===1){let hour=Number(matches[0][1]);const minute=matches[0][2]??'00';
  if(hour>23||(am&&pm)||((am||pm)&&(hour<1||hour>12))||(!am&&!pm&&!matches[0][2]&&hour<13)){time='';notice='Уточните: во сколько и утром или вечером?';}
  else{if(am||pm)hour=hour%12+(pm?12:0);time=`${pad(hour)}:${minute}`;}
 }else if(/полдень|noon/.test(text))time='12:00';
 else if(/полночь|midnight/.test(text))time='00:00';
 else if(am||pm){time='';notice='Уточните точное время выезда.';}
 if(!date)notice=notice||'На какую дату поставить выезд?';
 else if(!time)notice=notice||'Во сколько выезжаете?';
 return{date,time,leaveNow:false,notice};
}
export function voiceDepartureIssue(value:VoiceDeparture,clock=new Date()):'incomplete'|'invalid'|'past'|null{
 if(value.leaveNow)return null;
 if(value.notice==='timezone'||value.notice==='ambiguous'||value.notice==='invalid')return 'invalid';
 if(value.instant){const instant=Date.parse(value.instant);return !Number.isFinite(instant)?'invalid':instant<=clock.getTime()?'past':null;}
 if(!value.date||!value.time)return 'incomplete';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!/^\d{2}:\d{2}$/.test(value.time))return 'invalid';
 const date=new Date(value.date+'T'+value.time);
 if(!Number.isFinite(date.getTime())||dateText(date)!==value.date||pad(date.getHours())+':'+pad(date.getMinutes())!==value.time)return 'invalid';
 return date<=clock?'past':null;
}
export function voiceDepartureInstant(value:VoiceDeparture,clock=new Date()):string|null{
 if(voiceDepartureIssue(value,clock)!==null)return null;
 return value.leaveNow?'':value.instant??new Date(value.date+'T'+value.time).toISOString();
}
