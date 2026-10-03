import { getFloorPlanRoomBounds, getFloorPlanCenter } from './editorFloorGeometry.js';
import { inspectEditorScene } from './editorScenePreflight.js';

// Expand a compact model request into connected rooms and sized display rows.
// Originals stay in their existing room; supplied media are clearly reused in the annex.
export function buildExhibitionZones(scene, operation, options) {
  if (!scene.roomSize) throw new Error('Create a room before adding zones.');
  const prefix = operation.id;
  if (scene.items.some(item => item.id.startsWith(`${prefix}-`)) || scene.floorPlanElements.some(item => item.id.startsWith(`${prefix}-`))) throw new Error('Zone IDs already exist. Edit the existing zone items instead of generating duplicates.');
  const assets = operation.assetKeys.map(key => {
    const asset = (options.editorAssets || []).find(asset => asset.key === key);
    if (!asset || asset.kind !== 'image') throw new Error('Zone artwork requires a supplied image asset key.');
    return asset;
  });
  const rooms = getFloorPlanRoomBounds(scene.floorPlanElements, scene.roomSize.width, scene.roomSize.length);
  const anchor = getFloorPlanCenter(rooms);
  if (!scene.floorPlanElements.some(element => element.type === 'room')) scene.floorPlanElements.push({
    id: `${prefix}-original-room`, type: 'room', position: [0, 0.02, 0], rotation: [0, 0, 0], scale: [scene.roomSize.width, 0.04, scene.roomSize.length], isLocked: true,
  });
  const edge = [...rooms].sort((a,b) => b.maxX - a.maxX)[0];
  const width = Math.max(20, Math.ceil(Math.max(...operation.zones.map(zone => zone.count)) / 2) * 3.2 + 4);
  const depth = Math.max(12, edge.maxZ - edge.minZ);
  const midZ = (edge.minZ + edge.maxZ) / 2;
  const wallDepth = Math.max(0.12, scene.roomSize.wallThickness);
  const wallInset = wallDepth / 2 + 0.16;
  const height = scene.roomSize.height;
  if (height < 4.5) throw new Error('Zones require a room height of at least 4.5 metres; use edit-room to raise it first.');
  const headingY = Math.min(4.4, height - 1.5);
  const artworkY = Math.min(2.5, headingY - 1.5);
  // Test the native door topology against existing displays before opening a passage.
  // Change only the new room's door offset; original rooms and artworks stay intact.
  const baselineIssues = new Set(inspectEditorScene(scene).map(issue => issue.message));
  const entranceRoom = {id:`${prefix}-0-room`,type:'room',position:[edge.maxX+width/2,0.02,midZ],rotation:[0,0,0],scale:[width,0.04,depth],doorWidth:2.4};
  const offsets = [0];
  for (let offset=1; offset < (edge.maxZ-edge.minZ)/2-1.3; offset++) offsets.push(-offset,offset);
  const entranceOffset = offsets.find(doorOffset => !inspectEditorScene({...scene,floorPlanElements:[...scene.floorPlanElements,{...entranceRoom,doorOffset}]}).some(issue => !baselineIssues.has(issue.message)));
  if (entranceOffset === undefined) throw new Error('No clear entrance is available on the existing east wall. Move an obstructing display explicitly or choose another room connection.');
  const summary = [];
  for (const [zoneIndex, zone] of operation.zones.entries()) {
    const cx = edge.maxX + width * (zoneIndex + 0.5);
    const x = cx - anchor.x, z = midZ - anchor.z;
    scene.floorPlanElements.push({id:`${prefix}-${zoneIndex}-room`,type:'room',position:[cx,0.02,midZ],rotation:[0,0,0],scale:[width,0.04,depth],doorWidth:2.4,...(zoneIndex===0 ? {doorOffset:entranceOffset} : {})});
    const exhibitIds = [];
    for (let i=0;i<zone.count;i++) {
      const side = i < Math.ceil(zone.count/2) ? 0 : 1;
      const rowCount = side === 0 ? Math.ceil(zone.count/2) : Math.floor(zone.count/2);
      const column = side === 0 ? i : i-Math.ceil(zone.count/2);
      const asset = assets.length ? assets[(zoneIndex*zone.count+i)%assets.length] : null;
      const itemId=`${prefix}-${zoneIndex}-work-${i}`;
      exhibitIds.push(itemId);
      scene.items.push({id:itemId,type:'painting',position:[x+(column-(rowCount-1)/2)*3.2,artworkY,z+(side===0?-1:1)*(depth/2-wallInset)],rotation:[0,side===0?0:Math.PI,0],scale:[1,1,1],
        content:asset?.url || '/demo/harbour.svg',...(asset ? {assetUrl:asset.url,assetId:asset.assetId,thumbnailUrl:asset.previewUrl,fileMimeType:asset.mimeType} : {}),
        title:asset ? `${zone.title}${i+1} · ${asset.label}（副本）` : `${zone.title} · ${i+1}（示意位置）`,
        description:asset ? '使用已提供素材的展示副本。' : '示意展品，等待替換為正式作品。',frameWidth:2,frameHeight:1.5,frameBorderThickness:0.04,frameColor:'#453a2b'});
    }
    scene.items.push({id:`${prefix}-${zoneIndex}-title`,type:'text',content:zone.title,position:[x,headingY,z-depth/2+wallInset],rotation:[0,0,0],scale:[1,1,1],textFontSize:0.45,textColor:'#231c15',textBackboardEnabled:true,textBackboardColor:'#fff3da'});
    scene.items.push({id:`${prefix}-${zoneIndex}-south-title`,type:'text',content:`${zone.title} · 配置示意`,position:[x,headingY,z+depth/2-wallInset],rotation:[0,Math.PI,0],scale:[1,1,1],textFontSize:0.3,textColor:'#231c15',textBackboardEnabled:true,textBackboardColor:'#fff3da'});
    if (operation.decorate) {
      scene.items.push({id:`${prefix}-${zoneIndex}-bench`,type:'bench',content:'#5c4633',position:[x,0,z+depth/2-3],rotation:[0,0,0],scale:[1,1,1]});
      scene.items.push({id:`${prefix}-${zoneIndex}-light`,type:'lightstrip',content:'#fff1d1',position:[x,height-0.55,z-depth/2+0.6],rotation:[0,0,0],scale:[Math.min(width-4,12),0.5,1],lightIntensity:1.2});
      scene.items.push({id:`${prefix}-${zoneIndex}-south-light`,type:'lightstrip',content:'#fff1d1',position:[x,height-0.55,z+depth/2-0.6],rotation:[0,Math.PI,0],scale:[Math.min(width-4,12),0.5,1],lightIntensity:1.2});
      for (const side of [-1,1]) scene.items.push({id:`${prefix}-${zoneIndex}-plant-${side}`,type:'plant',content:'#537645',position:[x+side*(width/2-2),0,z+depth/2-2],rotation:[0,0,0],scale:[0.7,0.7,0.7]});
    }
    summary.push({title:zone.title,description:assets.length?'使用已提供素材的展示副本':'示意展品位置',exhibitIds});
  }
  return summary;
}
