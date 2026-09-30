import {chapters,shots,total} from './journey';
// Every feature must disappear before the background begins its next flight.
export const sceneWindows=chapters.map((chapter,index)=>{
 if(index===0)return {start:0,end:chapter.end,exitStart:chapter.end-1.4};
 if(index===chapters.length-1)return {start:chapter.start,end:total+.01,exitStart:total};
 const nextFlight=shots.find(shot=>!shot.hold&&shot.start>chapter.start)?.start??chapter.end;
 const end=Math.min(chapter.end,nextFlight)-.2;
 return {start:chapter.start,end,exitStart:end-.8};
});
