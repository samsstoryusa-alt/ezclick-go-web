export type SearchPlace={id:string;name:string;detail:string;label:string;point:[number,number]};
export function parsePlaces(data:unknown):SearchPlace[]{
 if(!data||typeof data!=='object'||!('features' in data)||!Array.isArray(data.features))throw new Error('Invalid search response');
 const found:SearchPlace[]=[];const seen=new Set<string>();
 for(const feature of data.features){
  const p=feature?.properties,c=feature?.geometry?.coordinates;
  if(!p||feature.geometry?.type!=='Point'||!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])||c[0]<-125||c[0]>-66||c[1]<24||c[1]>50||String(p.countrycode).toUpperCase()!=='US')continue;
  const text=(key:string)=>typeof p[key]==='string'?p[key].trim().slice(0,180):'';
  const street=[text('housenumber'),text('street')].filter(Boolean).join(' ');
  const name=street||text('name')||text('city')||text('postcode');
  const detail=[...new Set([text('city'),text('district'),text('state'),text('postcode')].filter(v=>v&&v!==name))].join(' · ');
  if(!name)continue;
  const id=`${c[0]},${c[1]}:${name}`;if(seen.has(id))continue;seen.add(id);
  found.push({id,name,detail,label:[name,detail].filter(Boolean).join(', '),point:[c[0],c[1]]});
  if(found.length===6)break;
 }
 return found;
}

export function parseZipPlaces(data:unknown,zip:string):SearchPlace[]{
 if(!data||typeof data!=='object'||!('places' in data)||!Array.isArray(data.places))throw new Error('Invalid ZIP response');
 return parsePlaces({features:data.places.map(p=>({geometry:{type:'Point',coordinates:[p&&typeof p.longitude==='string'&&p.longitude.trim()?Number(p.longitude):NaN,p&&typeof p.latitude==='string'&&p.latitude.trim()?Number(p.latitude):NaN]},properties:{name:p?.['place name'],state:p?.state,postcode:zip,countrycode:'US'}}))});
}
