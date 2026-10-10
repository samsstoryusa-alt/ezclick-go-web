export type PointDrag={id:number;index:number;x:number;y:number;originX:number;originY:number;armed:boolean;cancelled:boolean;moved:boolean;timer:number};
export function startPointDrag(id:number,index:number,x:number,y:number,originX:number,originY:number,pointerType:string):PointDrag{
 return {id,index,x,y,originX,originY,armed:pointerType==='mouse',cancelled:false,moved:false,timer:0};
}
// A short tap still edits a point. Moving before the hold completes cancels dragging.
export function movePointDrag(drag:PointDrag,id:number,x:number,y:number):[number,number]|null{
 if(drag.id!==id||drag.cancelled)return null;
 const distance=Math.hypot(x-drag.x,y-drag.y);
 if(!drag.armed){if(distance>9)drag.cancelled=true;return null;}
 if(distance<3&&!drag.moved)return null;
 drag.moved=true;
 // Preserve the grab offset instead of jumping the marker underneath the finger.
 return [drag.originX+x-drag.x,drag.originY+y-drag.y];
}
