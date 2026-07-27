// JSDoc typedefs for multiplayer payloads

/** @typedef {{x:number,y:number,z:number}} Vec3 */

/** @typedef {{roomId:string, seq:number, t:number, position:Vec3, yaw:number}} PlayerMovePayload */
/**
 * @typedef {object} AvatarAppearanceV1
 * @property {1} version
 * @property {'body01'|'body02'} body
 * @property {'head01'|'head02'} head
 * @property {'hair01'|'hair02'|'hair03'} hair
 * @property {'top01'|'top02'|'top03'} top
 * @property {'bottom01'|'bottom02'|'bottom03'} bottom
 * @property {'shoes01'|'shoes02'} shoes
 * @property {'none'|'glasses01'|'hat01'} accessory
 * @property {{skin:string,hair:string,top:string,bottom:string,shoes:string}} colors
 */
/** @typedef {{roomId:string, nickname:string, appearance?:AvatarAppearanceV1}} RoomJoinPayload */
/** @typedef {{id:string, nickname:string, appearance:AvatarAppearanceV1, position:Vec3, yaw:number, lastSeq:number, updatedAt:number}} PlayerSnapshot */
/** @typedef {{roomId:string, appearance:AvatarAppearanceV1}} PlayerAppearancePayload */
/** @typedef {{roomId:string, id:string, appearance:AvatarAppearanceV1, updatedAt:number}} PlayerAppearanceChangedPayload */
