// Gallery uploads can contain self-contained 3D models or video; avatar uploads remain images.
export function planSceneMedia(buffer, claimedMime, fileName) {
  const mime = String(claimedMime || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  const result = (mimeType, extension) => ({ buffer, mimeType, extension, metadataSanitized: false });
  if (mime === 'video/mp4' && buffer.length >= 16 && buffer.toString('ascii', 4, 8) === 'ftyp'
    && buffer.readUInt32BE(0) >= 16 && buffer.readUInt32BE(0) <= buffer.length) return result('video/mp4', '.mp4');
  if (mime === 'video/webm' && buffer.length >= 8 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    && buffer.includes(Buffer.from([0x16, 0x54, 0xae, 0x6b])) && buffer.includes(Buffer.from([0x1f, 0x43, 0xb6, 0x75]))) return result('video/webm', '.webm');
  if (mime === 'video/ogg' && buffer.length >= 27 && buffer.toString('ascii', 0, 4) === 'OggS') return result('video/ogg', '.ogg');
  const generic = mime === 'application/octet-stream';
  let json;
  let format;
  if ((mime === 'model/gltf-binary' || (generic && name.endsWith('.glb'))) && buffer.length >= 20
    && buffer.toString('ascii', 0, 4) === 'glTF' && buffer.readUInt32LE(4) === 2 && buffer.readUInt32LE(8) === buffer.length) {
    const length = buffer.readUInt32LE(12);
    if (20 + length > buffer.length || buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid GLB JSON chunk');
    json = JSON.parse(buffer.toString('utf8', 20, 20 + length)); format = result('model/gltf-binary', '.glb');
    let offset = 12;
    while (offset < buffer.length) { if (offset + 8 > buffer.length) throw new Error('Invalid GLB chunk'); offset += 8 + buffer.readUInt32LE(offset); }
    if (offset !== buffer.length) throw new Error('Invalid GLB length');
  } else if ((mime === 'model/gltf+json' || (generic && name.endsWith('.gltf'))) && buffer.length > 2) {
    json = JSON.parse(buffer.toString('utf8')); format = result('model/gltf+json', '.gltf');
  }
  if (json) {
    if (json.asset?.version !== '2.0') throw new Error('Only glTF 2.0 is supported');
    for (const resource of [...(json.buffers || []), ...(json.images || [])]) if (resource.uri && !/^data:[^,]*;base64,/.test(resource.uri)) throw new Error('Upload a self-contained GLB or glTF with embedded resources');
    return format;
  }
  if ((['model/stl', 'application/sla'].includes(mime) || (generic && name.endsWith('.stl')))
    && ((buffer.length >= 84 && 84 + buffer.readUInt32LE(80) * 50 === buffer.length)
      || (/^solid\s/.test(buffer.toString('ascii', 0, 100)) && /endsolid/.test(buffer.toString('ascii', Math.max(0, buffer.length - 150)))))) return result('model/stl', '.stl');
  throw new Error('Unsupported scene media or file signature mismatch');
}
