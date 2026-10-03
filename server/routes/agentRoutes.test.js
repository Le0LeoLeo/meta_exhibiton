import express from 'express';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAgentRoutes } from './agentRoutes.js';
const servers=[];
afterEach(()=>{ for(const server of servers.splice(0)) server.close(); });
async function setup(authenticated=true) {
  const app=express(); app.use(express.json({limit:'1mb'}));
  const generateAgentReply=vi.fn().mockResolvedValue({answer:'ok',source:'qwen'});
  registerAgentRoutes(app,{requireActiveUser:(_req,res)=>authenticated?{sub:'test'}:(res.status(401).json({message:'login required'}),null),generateAgentReply});
  const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});servers.push(server);
  return {url:`http://127.0.0.1:${server.address().port}/api/agent/reply`,generateAgentReply};
}
describe('authenticated guide image endpoint',()=>{
  it('validates and forwards original image pixels to the guide',async()=>{
    const {url,generateAgentReply}=await setup();
    const png=await sharp({create:{width:12,height:12,channels:3,background:'blue'}}).png().toBuffer();
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'What is shown?',exhibit:{id:'a'},exhibitImage:`data:image/png;base64,${png.toString('base64')}`})});
    expect(res.status).toBe(200);
    expect(generateAgentReply).toHaveBeenCalledWith(expect.objectContaining({exhibitImage:expect.stringMatching(/^data:image\/jpeg/)}));
  });
  it('rejects remote URLs without invoking the model',async()=>{
    const {url,generateAgentReply}=await setup();
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'read',exhibit:{id:'a'},exhibitImage:'http://127.0.0.1/private'})});
    expect(res.status).toBe(400);expect(generateAgentReply).not.toHaveBeenCalled();
  });
  it('keeps image requests behind authentication',async()=>{
    const {url,generateAgentReply}=await setup(false);
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'read'})});
    expect(res.status).toBe(401);expect(generateAgentReply).not.toHaveBeenCalled();
  });
});

describe('public exhibit work context',()=>{
  it('forwards validated creator context for current and nearby works',async()=>{
    const {url,generateAgentReply}=await setup();
    const workContext={contribution:'I made this installation.',sources:[{label:'Process note',url:'https://example.com/process',excerpt:'The supplied note says I tested a small model.'}]};
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'How was it made?',exhibit:{id:'a',workContext},nearbyExhibits:[{id:'b',workContext}]})});
    expect(res.status).toBe(200);
    expect(generateAgentReply).toHaveBeenCalledWith(expect.objectContaining({exhibit:expect.objectContaining({workContext}),nearbyExhibits:[expect.objectContaining({workContext})]}));
  });

  it.each([
    {reflection:'x'.repeat(2001)},
    {sources:Array.from({length:6},(_,index)=>({label:`Source ${index}`}))},
    {sources:[{label:'Source',url:'file:///private/cv.pdf'}]},
  ])('rejects invalid work context before model invocation (%o)',async(workContext)=>{
    const {url,generateAgentReply}=await setup();
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'What is this?',exhibit:{id:'a',workContext}})});
    expect(res.status).toBe(400);
    expect(generateAgentReply).not.toHaveBeenCalled();
  });
});
