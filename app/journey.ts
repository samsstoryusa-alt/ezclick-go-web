import clips from './journey-clips.json';
export {clips};
export const FPS=16;
export const chapters=[
 {name:'Overview',title:'Your truck. Your business. Your rules.',start:0,end:6,mark:0,clip:0,card:''},
 {name:'Find Load',title:'Stay one step ahead.',start:10,end:15.5,mark:12,clip:0,card:'find'},
 {name:'Calculator',title:'Know your profit before you roll.',start:16,end:21,mark:18,clip:0,card:'calculator'},
 {name:'My Trip',title:'Plan the trip. Own the road.',start:28,end:33.5,mark:30,clip:1,card:'trip'},
 {name:'Weather',title:'Choose a safer route.',start:34,end:40,mark:36,clip:1,card:'weather'},
 {name:'Hot Zones',title:'Go where your next load is.',start:46,end:52,mark:49,clip:2,card:'hotzones'},
 {name:'Fuel',title:'Less at the pump. More in your pocket.',start:59,end:65,mark:62,clip:3,card:'fuel'},
 {name:'Documents',title:'Your paperwork. Handled.',start:72,end:78,mark:75,clip:4,card:'documents'},
 {name:'AI Dispatcher',title:'Never miss a great load.',start:83,end:91,mark:87,clip:5,card:'dispatcher'},
 {name:'Brokers',title:'Know your broker. Make your move.',start:98,end:104,mark:101,clip:6,card:'brokers'},
 {name:'Quick Setup',title:'Less setup. More hauling.',start:104,end:110,mark:107,clip:6,card:'setup'},
 {name:'Statement',title:'Every load. Every dollar.',start:118,end:127,mark:123,clip:12,card:'statement'},
 {name:'Security',title:'Your documents. Your control.',start:134,end:144,mark:140,clip:13,card:'security'},
 {name:'City',title:'Your business. Under control.',start:146.3,end:152,mark:149,clip:15,card:''},
 {name:'Downloads',title:'Your next move. One click away.',start:163.5,end:171.125229,mark:170,clip:9,card:''},
];
// Scroll-time holds allow reading while keeping one continuous source sequence.
export const shots=[
 {clip:0,start:0,end:11}, {clip:0,start:11,end:21,hold:true},
 {clip:1,start:21,end:29},{clip:1,start:29,end:39,hold:true},
 {clip:2,start:39,end:47},{clip:2,start:47,end:52,hold:true},
 {clip:3,start:52,end:60},{clip:3,start:60,end:65,hold:true},
 {clip:4,start:65,end:73},{clip:4,start:73,end:78,hold:true},
 {clip:5,start:78,end:86},{clip:5,start:86,end:91,hold:true},
 {clip:6,start:91,end:99},{clip:6,start:99,end:110,hold:true},
 {clip:12,start:110,end:120},{clip:12,start:120,end:127,hold:true},
 {clip:13,start:127,end:137},{clip:13,start:137,end:144,hold:true},
 {clip:14,start:144,end:145},
 {clip:15,start:145,end:149},{clip:15,start:149,end:152,hold:true},
 {clip:8,start:152,end:159.125229},
 {clip:9,start:159.125229,end:167.125229},{clip:9,start:167.125229,end:171.125229,hold:true},
];
export const total=shots[shots.length-1].end;
export function frameAt(time:number){
 const shot=shots.find(s=>time<s.end)||shots[shots.length-1];
 const clip=clips[shot.clip];
 const fraction=shot.hold?1:Math.max(0,Math.min(1,(time-shot.start)/(shot.end-shot.start)));
 return {clip:shot.clip,index:Math.round(fraction*(clip.frames-1))};
}
export const frameUrl=(clip:number,index:number)=>`/media/journey/${clips[clip].id}/${String(index+1).padStart(4,'0')}.webp`;
