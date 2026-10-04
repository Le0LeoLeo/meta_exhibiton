import { expect, it } from 'vitest';
import { applySceneOperationPlan } from './exhibitionSceneOperations.js';
import { inspectEditorScene } from './editorScenePreflight.js';
const source=()=>({roomSize:{width:20,length:20,height:6,wallThickness:0.1},items:[{id:'original',type:'painting',content:'/demo/harbour.svg',position:[0,2.5,-9.65],rotation:[0,0,0],scale:[1,1,1],isLocked:true}],floorPlanElements:[],wallMaterialOverrides:{}});
const plan={schemaVersion:1,summary:'Six zones',operations:[{type:'build-exhibition-zones',id:'ai-six',zones:['A','B','C','D','E','F'].map(title=>({title,count:10})),assetKeys:['harbour'],decorate:true}]};
const options={editMode:'complete',editorAssets:[{key:'harbour',label:'Harbour',kind:'image',url:'/demo/harbour.svg',assetId:'owned-asset'}]};
it.each([4.5,5,6])('preserves a wide east-wall original and clears titles, lights and captions at height %s',height=>{
 const original=source();original.roomSize.height=height;
 original.floorPlanElements=[{id:'room-fi233icm',type:'room',position:[0,0.02,0],rotation:[0,0,0],scale:[20,0.04,20],isLocked:true}];
 original.items.push({id:'east-original',type:'painting',content:'/demo/harbour.svg',position:[9.65,2.5,0],rotation:[0,-Math.PI/2,0],scale:[1,1,1],frameWidth:4,frameHeight:2,isLocked:true});
 const before=structuredClone(original);const result=applySceneOperationPlan(original,plan,options);
 expect(original).toEqual(before);expect(result.scene.items.slice(0,2)).toEqual(before.items);
 expect(result.scene.floorPlanElements[0]).toEqual(before.floorPlanElements[0]);
 expect(result.scene.floorPlanElements).toHaveLength(7);
 expect(result.scene.floorPlanElements[1].doorOffset).not.toBe(0);
 expect(result.scene.items.filter(item=>item.id.includes('-work-'))).toHaveLength(60);
 expect(inspectEditorScene(result.scene)).toEqual([]);
});
it('rejects a wall with no clear entrance without mutating the original scene',()=>{
 const original=source();original.items=[{id:'east-original',type:'painting',content:'/demo/harbour.svg',position:[9.65,2.5,0],rotation:[0,-Math.PI/2,0],scale:[1,1,1],frameWidth:19.5,frameHeight:2,isLocked:true}];
 const before=structuredClone(original);
 expect(()=>applySceneOperationPlan(original,plan,options)).toThrow(/No clear entrance/);
 expect(original).toEqual(before);
});
it('expands one command to six connected populated zones with ten media copies each and decorations',()=>{
 const original=source();const result=applySceneOperationPlan(original,plan,options);
 expect(original).toEqual(source());expect(result.scene.items[0]).toEqual(original.items[0]);
 expect(result.scene.floorPlanElements.filter(item=>item.type==='room')).toHaveLength(7);
 for(let zone=0;zone<6;zone++){
  const works=result.scene.items.filter(item=>item.id.startsWith(`ai-six-${zone}-work-`));expect(works).toHaveLength(10);
  expect(works.every(item=>item.assetId==='owned-asset'&&item.content==='/demo/harbour.svg')).toBe(true);
 }
 expect(result.scene.items.filter(item=>item.type==='bench')).toHaveLength(6);
 expect(inspectEditorScene(result.scene)).toEqual([]);
 expect(()=>applySceneOperationPlan(result.scene,plan,options)).toThrow(/already exist/);
});
it('labels concept slots when no image assets were supplied and rejects unknown asset keys',()=>{
 const blankPlan=structuredClone(plan);blankPlan.operations[0].assetKeys=[];
 const result=applySceneOperationPlan(source(),blankPlan,{editMode:'complete'});
 expect(result.scene.items.filter(item=>item.title?.includes('示意位置'))).toHaveLength(60);
 expect(()=>applySceneOperationPlan(source(),plan,{editMode:'complete'})).toThrow(/Unknown or unusable asset/);
});
