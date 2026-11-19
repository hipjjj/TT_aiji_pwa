import {useEffect,useState} from 'react';
import {chatViewport} from './viewport.mjs';

export function useChatViewport() {
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    const viewport=window.visualViewport,body=document.body;
    const previous={overflow:body.style.overflow,position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width};
    const scrollY=window.scrollY;
    Object.assign(body.style,{overflow:'hidden',position:'fixed',top:`-${scrollY}px`,left:'0',right:'0',width:'100%'});
    let baseline=viewport?.height??window.innerHeight,frame=0;
    const update=()=>{
      const active=document.activeElement;
      const focused=active instanceof HTMLElement&&!!active.closest('.chat-room')&&active.matches('textarea,input:not([type=file])');
      const height=viewport?.height??window.innerHeight;
      if(!focused)baseline=height;
      setCompact(chatViewport({height,layoutHeight:window.innerHeight,baselineHeight:baseline,focused}).compact);
    };
    const focusChanged=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
    update();
    viewport?.addEventListener('resize',update);
    window.addEventListener('resize',update);
    document.addEventListener('focusin',focusChanged);
    document.addEventListener('focusout',focusChanged);
    return()=>{
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize',update);
      window.removeEventListener('resize',update);
      document.removeEventListener('focusin',focusChanged);
      document.removeEventListener('focusout',focusChanged);
      Object.assign(body.style,previous);
      window.scrollTo(0,scrollY);
    };
  },[]);
  return compact;
}
