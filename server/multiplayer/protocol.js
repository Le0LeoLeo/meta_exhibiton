// JSDoc typedefs for multiplayer payloads

/** @typedef {{x:number,y:number,z:number}} Vec3 */

/** @typedef {{roomId:string, seq:number, t:number, position:Vec3, yaw:number}} PlayerMovePayload */
/** @typedef {{roomId:string, nickname:string}} RoomJoinPayload */
/** @typedef {{id:string, nickname:string, position:Vec3, yaw:number, lastSeq:number, updatedAt:number}} PlayerSnapshot */
