import type {SearchPlace} from './route-search-data';
const states:Record<string,string>=Object.fromEntries(('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming').split('|').map(entry=>entry.split(':')));
const normalize=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bd\.\s*c\./g,'dc').replace(/[^a-z0-9]+/g,' ').trim();
export function chooseVoicePlace(query:string,places:SearchPlace[]):string{
 const requested=normalize(query).replace(/ (?:united states(?: of america)?|usa|us)$/,'');
 const matches=places.filter(place=>{
  // Do not silently select a station, road or business bearing the city's name.
  if(!['city','town','village','hamlet','municipality'].includes(place.kind??''))return false;
  const name=normalize(place.name),state=normalize(place.state??'');
  const code=Object.entries(states).find(([,full])=>normalize(full)===state)?.[0].toLowerCase();
  return requested===name||!!state&&requested===`${name} ${state}`||!!code&&requested===`${name} ${code}`;
 });
 return matches.length===1?matches[0].id:'';
}

// Automatic routing requires a spoken state, even for a currently unique result.
export function chooseVoiceRoutePlace(query:string,places:SearchPlace[]):string{
 const id=chooseVoicePlace(query,places),place=places.find(p=>p.id===id);
 if(!place)return '';
 const requested=normalize(query).replace(/ (?:united states(?: of america)?|usa|us)$/,'');
 return requested===normalize(place.name)?'':id;
}
