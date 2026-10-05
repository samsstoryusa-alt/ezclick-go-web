// Opt-in localhost diagnostics. Memory is JS heap only, not total tab/GPU memory.
export function weatherPerf(canvas:HTMLCanvasElement){
 if(!['localhost','127.0.0.1'].includes(location.hostname)||!new URLSearchParams(location.search).has('weatherPerf'))return null;
 const groups={moving:[] as number[],still:[] as number[]};let last=0,peakHeap=0,frames=0,movingFrames=0;
 return (start:number,moving:boolean)=>{
  const values=moving?groups.moving:groups.still;values.push(performance.now()-start);if(values.length>180)values.shift();frames++;if(moving)movingFrames++;
  const heap=(performance as Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number}}).memory;
  if(heap)peakHeap=Math.max(peakHeap,heap.usedJSHeapSize);
  if(performance.now()-last<500)return;last=performance.now();
  const summarize=(v:number[])=>({samples:v.length,meanMs:v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):null,p95Ms:v.length?+([...v].sort((a,b)=>a-b)[Math.floor((v.length-1)*.95)]).toFixed(2):null});
  canvas.dataset.weatherPerf=JSON.stringify({frames,movingFrames,jsHeapMB:heap?+(heap.usedJSHeapSize/1048576).toFixed(1):null,peakJsHeapMB:heap?+(peakHeap/1048576).toFixed(1):null,canvasMB:+(canvas.width*canvas.height*4/1048576).toFixed(2),moving:summarize(groups.moving),still:summarize(groups.still)});
 };
}
