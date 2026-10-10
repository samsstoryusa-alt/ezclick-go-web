/** Keep request deadlines compatible with browsers without AbortSignal.any/timeout. */
export function throwIfAborted(signal:AbortSignal):void{
 if(signal.aborted)throw signal.reason===undefined?new DOMException('The operation was aborted.','AbortError'):signal.reason;
}

/** The callback includes response-body reading so its deadline stays active until complete. */
export async function withAbortTimeout<T>(parent:AbortSignal|null|undefined,timeoutMs:number,run:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const cleanup=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}parent?.removeEventListener('abort',cancel);};
 const cancel=()=>{cleanup();controller.abort(parent?.reason);};
 if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
 if(!controller.signal.aborted)timer=setTimeout(()=>{cleanup();controller.abort(new DOMException('The operation timed out.','TimeoutError'));},timeoutMs);
 try{throwIfAborted(controller.signal);return await run(controller.signal);}
 finally{cleanup();}
}
