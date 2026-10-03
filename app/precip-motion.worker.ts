import {estimateFlow} from './precip-motion-math';
self.onmessage=(event:MessageEvent<Float32Array[]>)=>{
 const fields=event.data,result=[];
 for(let i=0;i<fields.length-1;i++)result.push({forward:estimateFlow(fields[i],fields[i+1]),backward:estimateFlow(fields[i+1],fields[i])});
 self.postMessage(result,{transfer:result.flatMap(p=>[p.forward.buffer,p.backward.buffer])});
};

