import {afterEach,expect,it,vi} from 'vitest';
import {Object3D} from 'three';
import {waitForInspectionText} from './inspectionTextReady';
afterEach(()=>vi.useRealTimers());
it('waits for Chinese sign geometry before capturing the backboard',async()=>{
 vi.useFakeTimers();const scene=new Object3D();
 const sign=Object.assign(new Object3D(),{text:'配置示意',textRenderInfo:null as unknown,sync:vi.fn()});scene.add(sign);
 let ready=false;const result=waitForInspectionText(scene).then(()=>{ready=true;});
 await vi.advanceTimersByTimeAsync(100);expect(ready).toBe(false);
 sign.textRenderInfo={};await vi.advanceTimersByTimeAsync(50);await result;expect(ready).toBe(true);
});
it('rejects unavailable glyphs instead of sending a blank sign for review',async()=>{
 vi.useFakeTimers();const scene=new Object3D();scene.add(Object.assign(new Object3D(),{text:'展區',sync:vi.fn()}));
 const result=expect(waitForInspectionText(scene,100)).rejects.toThrow(/text is still loading/);
 await vi.advanceTimersByTimeAsync(100);await result;
});
