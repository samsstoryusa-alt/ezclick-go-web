// Fade the old picture out before resetting particles at the new camera position.
export function createWindVisibility(reduced=false){
 let opacity=0,dirty=false,lastMovement=-Infinity,warm=0,last:number|null=null;
 return (now:number,moving:boolean)=>{
  const dt=last===null?33:Math.max(0,Math.min(100,now-last));last=now;
  if(moving){dirty=true;lastMovement=now;}
  const target=dirty||moving||warm<4?0:1;
  opacity=reduced?target:opacity+(target-opacity)*(1-Math.exp(-dt/(target?240:90)));
  if(opacity<.005)opacity=0;if(opacity>.995)opacity=1;
  let reset=false;
  if(dirty&&!moving&&now-lastMovement>=120&&opacity===0){dirty=false;warm=0;reset=true;}
  const draw=!moving&&!dirty;
  if(draw)warm++;
  return {opacity,draw,reset};
 };
}
