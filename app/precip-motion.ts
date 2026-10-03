import {W,H,GX,GY,R} from './precip-motion-math';
type Pair={forward:Uint8Array;backward:Uint8Array};
export type MotionRenderer={draw:(ctx:CanvasRenderingContext2D,index:number,mix:number)=>boolean;dispose:()=>void};
export async function createPrecipMotion(images:HTMLCanvasElement[],signal:AbortSignal):Promise<MotionRenderer|null>{
 const small=document.createElement('canvas');small.width=W;small.height=H;
 const ctx=small.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 const fields=images.map(image=>{
  ctx.clearRect(0,0,W,H);ctx.drawImage(image,0,0,W,H);
  const pixels=ctx.getImageData(0,0,W,H).data;
  return Float32Array.from({length:W*H},(_,i)=>pixels[i*4+3]/255);
 });
 small.width=1;small.height=1;
 const worker=new Worker(new URL('./precip-motion.worker.ts',import.meta.url),{type:'module'});
 const pairs=await new Promise<Pair[]>((resolve,reject)=>{
  const stop=()=>{cleanup();reject(new Error('Motion calculation cancelled'));};
  const timeout=setTimeout(stop,20000);
  const cleanup=()=>{clearTimeout(timeout);signal.removeEventListener('abort',stop);worker.terminate();};
  signal.addEventListener('abort',stop,{once:true});
  worker.onmessage=e=>{cleanup();resolve(e.data);};
  worker.onerror=()=>{cleanup();reject(new Error('Motion calculation unavailable'));};
  if(signal.aborted){cleanup();reject(new Error('Motion calculation cancelled'));return;}
  worker.postMessage(fields,fields.map(f=>f.buffer));
 }).finally(()=>worker.terminate());
 if(signal.aborted)return null;
 const canvas=document.createElement('canvas');canvas.width=images[0].width;canvas.height=images[0].height;
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const program=gl.createProgram()!;
 const shader=(type:number,source:string)=>{
  const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error??'Motion shader failed');}
  gl.attachShader(program,s);gl.deleteShader(s);
 };
 shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.0)*0.5,(1.0-p.y)*0.5);gl_Position=vec4(p,0.0,1.0);}');
 shader(gl.FRAGMENT_SHADER,`
 precision mediump float;
 varying vec2 uv;
 uniform sampler2D a,b,f,r;
 uniform float t;
 vec2 forward(vec2 p){return (texture2D(f,p).rg*255.0-128.0)/127.0*vec2(${R/W},${R/H});}
 vec2 backward(vec2 p){return (texture2D(r,p).rg*255.0-128.0)/127.0*vec2(${R/W},${R/H});}
 void main(){
  float edge=smoothstep(.30,.36,uv.x)*(1.0-smoothstep(.72,.78,uv.x))*smoothstep(.53,.60,uv.y)*(1.0-smoothstep(.91,.98,uv.y));
  vec2 df=forward(uv),db=backward(uv);
  // Forward/backward disagreement weakens uncertain matching.
  float consistent=1.0-smoothstep(.008,.055,length(df+backward(clamp(uv+df,0.0,1.0))));
  float weight=edge*consistent;
  vec2 ua=clamp(uv-t*df*weight,0.0,1.0);
  vec2 ub=clamp(uv-(1.0-t)*db*weight,0.0,1.0);
  gl_FragColor=mix(texture2D(a,ua),texture2D(b,ub),t);
 }`);
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Motion program failed');
 gl.useProgram(program);
 const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const attribute=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
 const textures=['a','b','f','r'].map((name,i)=>{
  const texture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,name),i);return texture;
 });
 const time=gl.getUniformLocation(program,'t');let previous=-1,count=0,total=0,peak=0;
 return {
  draw(context,index,mix){
   if(!pairs[index]||gl.isContextLost())return false;
   const started=performance.now();
   if(previous!==index){
    for(let i=0;i<4;i++){
     gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);
     gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,i<2?1:0);
     if(i<2)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,images[index+i]);
     else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,GX,GY,0,gl.RGBA,gl.UNSIGNED_BYTE,i===2?pairs[index].forward:pairs[index].backward);
    }previous=index;
   }
   gl.uniform1f(time,mix);gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,6);
   context.clearRect(0,0,context.canvas.width,context.canvas.height);context.drawImage(canvas,0,0);
   if(count<120){const elapsed=performance.now()-started;total+=elapsed;peak=Math.max(peak,elapsed);count++;if(count===120)console.info('Precip motion render ms',JSON.stringify({mean:total/count,peak}));}
   return true;
  },
  dispose(){textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.width=1;canvas.height=1;}
 };
}



