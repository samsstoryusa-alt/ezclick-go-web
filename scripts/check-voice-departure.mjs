import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('app/voice-departure.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};new Function('exports',js)(api);
const {applyVoiceDeparture:parse,emptyVoiceDeparture:empty,voiceDepartureInstant:instant}=api;
const clock=new Date(2026,9,5,15,0);
let value=parse('завтра в девять утра',empty,clock);
assert.equal(value.date,'2026-10-06');assert.equal(value.time,'09:00');assert.ok(instant(value,clock));
value=parse('лучше в десять утра',value,clock);assert.equal(value.date,'2026-10-06');assert.equal(value.time,'10:00');
value=parse('tomorrow at 9 pm',empty,clock);assert.equal(value.time,'21:00');assert.equal(value.date,'2026-10-06');
value=parse('в 9 утра',empty,clock);assert.equal(value.date,'');assert.equal(value.time,'09:00');assert.match(value.notice,/дату/);assert.equal(instant(value,clock),null);
value=parse('в 9 утра',{...empty,date:'2026-10-10',time:'15:00'},clock);assert.equal(value.date,'2026-10-10');assert.equal(value.time,'09:00');
assert.equal(parse('в девять',value,clock).time,'');
assert.equal(parse('в девять или десять утра',value,clock).time,'');
assert.equal(parse('tomorrow at 09:30',empty,clock).time,'09:30');
assert.equal(parse('послезавтра в 18:00',empty,clock).date,'2026-10-07');
assert.equal(parse('завтра утром',{...empty,time:'22:00'},clock).time,'');
assert.equal(parse('в пятницу в 9 утра',value,clock).date,'');
assert.equal(instant(parse('сегодня в 9 утра',empty,clock),clock),null);
assert.equal(instant(parse('сейчас',value,clock),clock),'');
assert.equal(parse('завтра в 25:00',empty,clock).time,'');
assert.equal(parse('2026-02-30 в 09:00',empty,clock).date,'');
assert.equal(parse('завтра в половине девятого',empty,clock).time,'');
console.log('PASS: RU/EN hours, preserved date, missing date, AM/PM ambiguity, relative days, unsupported phrases, invalid/past dates and leave-now');

for(const phrase of ['сегодня в 10 вечера','сегодня в десять вечера','today at 10 pm']){
 const parsed=parse(phrase,empty,new Date(2026,9,5,21,0));
 assert.equal(parsed.date,'2026-10-05');assert.equal(parsed.time,'22:00');
 assert.equal(api.voiceDepartureIssue(parsed,new Date(2026,9,5,21,0)),null);
 assert.equal(api.voiceDepartureIssue(parsed,new Date(2026,9,5,22,44)),'past');
 assert.equal(instant(parsed,new Date(2026,9,5,22,44)),null);
 const corrected=parse('завтра',parsed,new Date(2026,9,5,22,44));
 assert.equal(corrected.date,'2026-10-06');assert.equal(corrected.time,'22:00');assert.ok(instant(corrected,new Date(2026,9,5,22,44)));
}
assert.equal(api.voiceDepartureIssue({...empty,date:'2026-02-30',time:'22:00'},clock),'invalid');
assert.equal(api.voiceDepartureIssue(empty,clock),'incomplete');
console.log('PASS: today at 10 pm understood, past time distinguished, tomorrow correction preserves hour');

const typed=api.structuredVoiceDeparture,zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const scheduled={departure_mode:'scheduled',departure_date:'2026-10-06',departure_time:'18:00',departure_timezone:zone};
const planned=typed(scheduled,null,null,clock);
assert.equal(instant(planned,clock),new Date(2026,9,6,18,0).toISOString());
assert.deepEqual(typed({departure_mode:'keep'},planned,null,clock),planned);
assert.equal(instant(typed({departure_mode:'keep'},null,new Date(2026,9,6,18,0).toISOString(),clock),clock),instant(planned,clock));
assert.equal(instant(typed({departure_mode:'keep'},null,'',clock),clock),'');
assert.equal(instant(typed({departure_mode:'now'},planned,null,clock),clock),'');
for(const phrase of ['mañana a las ocho','завтра','tomorrow','غدا','something unsupported'])assert.equal(instant(typed({departure_phrase:phrase},planned,null,clock),clock),null);
for(const timezone of ['Mars/Base'])assert.equal(instant(typed({...scheduled,departure_timezone:timezone},null,null,clock),clock),null);
assert.equal(instant(typed({...scheduled,departure_time:null},planned,null,clock),clock),null);
assert.equal(instant(typed({...scheduled,departure_date:'2026-02-30'},null,null,clock),clock),null);
const originalZone=process.env.TZ;process.env.TZ='America/New_York';
const springClock=new Date('2026-03-01T12:00:00Z');
assert.equal(instant(typed({...scheduled,departure_date:'2026-03-08',departure_time:'02:30',departure_timezone:'America/New_York'},null,null,springClock),springClock),null);
const autumnClock=new Date('2026-10-30T12:00:00Z');
assert.equal(instant(typed({...scheduled,departure_date:'2026-11-01',departure_time:'01:30',departure_timezone:'America/New_York'},null,null,autumnClock),autumnClock),null);
assert.equal(instant(typed({departure_mode:'keep'},null,'2026-11-01T06:30:00Z',autumnClock),autumnClock),'2026-11-01T06:30:00.000Z');
if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone;
console.log('PASS: typed multilingual contract, explicit now/keep, saved instant preservation, unknown modes, timezone and DST validation');

const houston=typed({departure_mode:'scheduled',departure_date:'2026-10-06',departure_time:'06:00',departure_timezone:'America/Chicago'},null,null,new Date('2026-10-06T03:30:00Z'),'America/New_York');
assert.equal(instant(houston,new Date('2026-10-06T03:30:00Z')),'2026-10-06T11:00:00.000Z');
assert.equal(instant(typed({...scheduled,departure_time:'06:00',departure_timezone:null},null,null,clock,'America/New_York'),clock),'2026-10-06T10:00:00.000Z');
for(const [timezone,expected] of [['Asia/Kolkata','2026-10-06T00:30:00.000Z'],['Asia/Kathmandu','2026-10-06T00:15:00.000Z']])assert.equal(instant(typed({...scheduled,departure_time:'06:00',departure_timezone:timezone},null,null,clock),clock),expected);
console.log('PASS: Houston 6 AM with New York device, missing timezone fallback, fractional offsets');

// Independently round-trip known instants through every runtime-supported IANA zone.
const supportedZones=Intl.supportedValuesOf('timeZone');let zoneCases=0;
for(const timezone of supportedZones){
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(const expected of ['2027-01-15T12:00:00.000Z','2027-07-15T12:00:00.000Z']){
  const parts=Object.fromEntries(format.formatToParts(new Date(expected)).map(p=>[p.type,p.value]));
  const result=typed({departure_mode:'scheduled',departure_date:parts.year+'-'+parts.month+'-'+parts.day,departure_time:parts.hour+':'+parts.minute,departure_timezone:timezone},null,null,new Date('2026-01-01T00:00:00Z'),'America/New_York');
  assert.equal(instant(result,new Date('2026-01-01T00:00:00Z')),expected,timezone+' '+expected);zoneCases++;
 }
}
for(const [timezone,date,time] of [['America/Chicago','2027-03-14','02:30'],['America/Chicago','2027-11-07','01:30'],['Europe/Berlin','2027-03-28','02:30'],['Europe/Berlin','2027-10-31','02:30'],['Australia/Lord_Howe','2027-10-03','02:15'],['Australia/Lord_Howe','2027-04-04','01:45']]){
 const result=typed({departure_mode:'scheduled',departure_date:date,departure_time:time,departure_timezone:timezone},null,null,new Date('2026-01-01T00:00:00Z'),'America/New_York');
 assert.equal(instant(result,new Date('2026-01-01T00:00:00Z')),null,timezone+' clock change');
}
console.log('PASS: '+supportedZones.length+' IANA timezones, '+zoneCases+' winter/summer round trips, US/EU/Lord Howe clock-change exceptions');
