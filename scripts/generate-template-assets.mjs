// Original, reusable exhibition studies and concept models. No external model dependencies.
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const directory = new URL('../public/templates/', import.meta.url);
await mkdir(directory, { recursive: true });
const palettes = {
  art: ['#ece5d8', '#c75238', '#263b53', '#cba95c'],
  tech: ['#101e32', '#63d8e6', '#4274ac', '#eaf8fc'],
  fashion: ['#f2e4d8', '#3d2635', '#b97c73', '#bb9b62'],
  car: ['#e9edef', '#344d68', '#e57b46', '#202a33'],
};
for (const [theme, colors] of Object.entries(palettes)) {
  if (process.argv.includes('--vehicle-platform-only')) continue;
  if (process.argv.includes('--car-posters-only') && theme !== 'car') continue;
  for (let index = 0; index < 6; index++) {
    const [bg, ink, accent, soft] = colors;
    let drawing;
    if (theme === 'art') {
      // Each study has its own silhouette and balance, readable across the room.
      drawing = [
        `<circle cx="640" cy="305" r="180" fill="${ink}"/><path d="M160 680V300a190 190 0 0 1 380 0v380Z" fill="${accent}"/><path d="M340 680V400a110 110 0 0 1 220 0v280Z" fill="${bg}"/><rect x="690" y="530" width="160" height="150" fill="${soft}"/>`,
        `<rect x="140" y="170" width="720" height="460" fill="${accent}"/><rect x="140" y="430" width="720" height="200" fill="#778b8b"/><circle cx="660" cy="310" r="82" fill="${soft}"/><path d="M140 530Q380 280 860 490V630H140Z" fill="${ink}"/><path d="M140 590Q540 410 860 550V630H140Z" fill="#d89a70"/>`,
        `<circle cx="500" cy="400" r="265" fill="${soft}"/><circle cx="500" cy="400" r="200" fill="${bg}"/><circle cx="500" cy="400" r="137" fill="${ink}"/><circle cx="500" cy="400" r="72" fill="${bg}"/><path d="M500 135V665" stroke="${accent}" stroke-width="22"/><path d="M235 400H765" stroke="${accent}" stroke-width="22"/>`,
        `<rect x="155" y="150" width="300" height="490" fill="${ink}"/><rect x="475" y="150" width="365" height="185" fill="${accent}"/><rect x="475" y="355" width="175" height="285" fill="${soft}"/><rect x="670" y="355" width="170" height="285" fill="#798b7c"/><circle cx="305" cy="395" r="115" fill="${bg}"/>`,
        `<path d="M170 650C40 390 400 150 555 270S890 510 760 670" fill="none" stroke="${accent}" stroke-width="78"/><path d="M260 650C90 330 485 95 680 250S960 565 815 675" fill="none" stroke="${ink}" stroke-width="36"/><circle cx="635" cy="505" r="83" fill="${soft}"/>`,
        `<ellipse cx="410" cy="600" rx="245" ry="80" fill="${accent}"/><path d="M240 510Q175 270 390 250Q550 250 490 510Z" fill="${ink}"/><path d="M420 435Q350 190 575 145Q810 200 705 435Z" fill="${soft}"/><ellipse cx="570" cy="155" rx="55" ry="19" fill="${accent}"/><path d="M140 685H855" stroke="#a89c87" stroke-width="3"/>`,
      ][index];
    } else if (theme === 'tech') {
      drawing = Array.from({ length: 7 }, (_, n) => `<path d="M140 ${180 + n * 72}H${360 + ((n + index) % 3) * 80}L${450 + ((n + index) % 3) * 80} ${100 + n * 72}H850" fill="none" stroke="${n % 2 ? accent : ink}" stroke-width="5"/><circle cx="850" cy="${100 + n * 72}" r="9" fill="${soft}"/>`).join('') + `<rect x="365" y="270" width="270" height="220" rx="24" fill="${bg}" stroke="${ink}" stroke-width="4"/><text x="500" y="400" text-anchor="middle" fill="${soft}" font-size="70" font-family="monospace">0${index + 1}</text>`;
    } else if (theme === 'fashion') {
      drawing = `<circle cx="500" cy="190" r="45" fill="${ink}"/><path d="M450 250L${350 - index * 8} 320L390 430L430 380L410 500L${310 + index * 16} 680H${690 - index * 16}L590 500L570 380L610 430L650 320L550 250Q500 290 450 250Z" fill="${index % 2 ? accent : ink}"/><path d="M460 310Q${410 + index * 25} 470 465 640M535 310Q${620 - index * 20} 490 545 640" fill="none" stroke="${soft}" stroke-width="6"/><path d="M300 710H700" stroke="${soft}" stroke-width="3"/>`;
    } else {
      const profile = `M125 475Q130 428 255 420L373 338Q455 298 570 330L687 398Q814 408 872 455L878 493H813A62 62 0 0 0 689 493H333A62 62 0 0 0 209 493H125Z`;
      const wheels = [271, 751].map(x => `<circle cx="${x}" cy="493" r="52" fill="${soft}"/><circle cx="${x}" cy="493" r="34" fill="${bg}"/><circle cx="${x}" cy="493" r="7" fill="${ink}"/>`).join('');
      const labels = ['01 / PROPORTION', '02 / FLOW FIELD', '03 / ROTATIONAL STUDY', '04 / LIGHT SIGNATURE', '05 / COLOUR &amp; MATERIAL', '06 / PACKAGE STUDY'];
      const grid = Array.from({length: 15}, (_,n) => `<path d="M${100+n*55} 170V630"/>`).join('') + Array.from({length: 9}, (_,n) => `<path d="M100 ${170+n*55}H900"/>`).join('');
      drawing = [
        `<path d="${profile}" fill="#bdcbd0" stroke="${ink}" stroke-width="3"/><path d="M332 410L392 351Q476 320 560 350L644 402Z" fill="${ink}"/>${wheels}<path d="M130 602H878M130 585V615M878 585V615M271 550V615M751 550V615" stroke="${ink}" fill="none" stroke-width="2"/><text x="500" y="638" text-anchor="middle" font-family="monospace" font-size="18" fill="${ink}">4 600 / 2 890</text>`,
        `<g fill="none" stroke="${ink}" stroke-width="2" opacity="0.55">${Array.from({length:9},(_,n)=>`<path d="M90 ${210+n*41}C310 ${240+n*35} 290 ${130+n*32} 495 ${158+n*31}S730 ${220+n*38} 920 ${240+n*38}"/>`).join('')}</g><path d="${profile}" fill="${ink}" transform="translate(0 85)"/><path d="M120 440Q345 220 615 310T900 450" stroke="${accent}" stroke-width="5" fill="none"/>`,
        `<circle cx="475" cy="400" r="237" fill="${soft}"/><circle cx="475" cy="400" r="190" fill="#c6d1d5"/><circle cx="475" cy="400" r="174" fill="${ink}"/>${Array.from({length:10},(_,n)=>`<path d="M465 390L445 238L473 222L487 400Z" fill="#c6d1d5" transform="rotate(${n*36} 475 400)"/>`).join('')}<circle cx="475" cy="400" r="44" fill="#c6d1d5"/><circle cx="475" cy="400" r="17" fill="${ink}"/><path d="M180 400H770M475 115V675" stroke="${accent}" stroke-width="1.5" stroke-dasharray="8 8"/>`,
        `<rect x="110" y="165" width="780" height="475" fill="${soft}"/><path d="M195 500Q215 393 323 376L375 300Q500 267 625 300L677 376Q785 393 805 500Z" fill="#344d58"/><path d="M352 367L390 315Q500 290 610 315L648 367Z" fill="#182128"/><path d="M227 430L369 453M631 453L773 430" fill="none" stroke="#e8f2ee" stroke-width="8"/><path d="M360 493H640" stroke="#182128" stroke-width="25"/><path d="M225 550H775" stroke="${accent}" stroke-width="2"/>`,
        `${['#7b9da8','#344d58','#acb7ad','#d5c7ad'].map((c,n)=>`<rect x="${125+n*192}" y="205" width="172" height="260" rx="3" fill="${c}"/><rect x="${125+n*192}" y="484" width="172" height="70" fill="${n%2?soft:ink}"/><text x="${125+n*192}" y="595" font-family="monospace" font-size="15" fill="${ink}">0${n+1} / FINISH</text>`).join('')}<path d="M125 625H873" stroke="${accent}" stroke-width="3"/>`,
        `<g stroke="#b9c9cf" stroke-width="1">${grid}</g><path d="${profile}" fill="${bg}" stroke="${ink}" stroke-width="3"/>${wheels}<path d="M275 275V590M750 275V590M100 493H900M350 340L635 340M350 325V355M635 325V355" stroke="${accent}" stroke-width="2" fill="none"/><path d="M332 410L392 351Q476 320 560 350L644 402Z" fill="none" stroke="${ink}" stroke-width="2"/>`,
      ][index] + `<text x="100" y="730" font-family="sans-serif" font-size="20" letter-spacing="4" fill="${ink}">${labels[index]}</text>`;
    }
    await writeFile(new URL(`${theme}-${index + 1}.svg`, directory), `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800"><rect width="1000" height="800" fill="${bg}"/><text x="80" y="80" font-family="sans-serif" font-size="18" letter-spacing="5" fill="${ink}">METAEXB / ${theme.toUpperCase()} STUDIES</text>${drawing}</svg>`);
  }
}

if (process.argv.includes('--car-posters-only')) process.exit(0);

// GLTFExporter uses FileReader for binary buffers even without textures.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const material = (color, metalness = 0.15) => new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.32 });
function mesh(group, geometry, color, position, rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material(color));
  object.position.set(...position); object.rotation.set(...rotation); group.add(object); return object;
}
async function save(name, group) {
  group.updateMatrixWorld(true);
  group.position.y -= new THREE.Box3().setFromObject(group).min.y;
  const data = await new GLTFExporter().parseAsync(group, { binary: true });
  await writeFile(new URL(`${name}.glb`, directory), Buffer.from(data));
}
const vehiclePlatform = new THREE.Group();
const platformSurface = mesh(vehiclePlatform, new RoundedBoxGeometry(5.4, 0.14, 2.6, 2, 0.025), '#b8c1c5', [0, 0.07, 0]);
platformSurface.material.roughness = 0.88;
platformSurface.material.metalness = 0;
await save('vehicle-platform', vehiclePlatform);
if (process.argv.includes('--vehicle-platform-only')) process.exit(0);

const car = new THREE.Group();
// Real-scale coupe: length 4.6 m, 1.84 m body, tyres resting on y=0.
const body = new THREE.Shape();
body.moveTo(-2.26, 0.41);
body.lineTo(-2.26, 0.68); body.quadraticCurveTo(-2.17, 0.91, -1.75, 0.94);
body.lineTo(-0.9, 0.98); body.lineTo(0.85, 0.94);
body.quadraticCurveTo(1.7, 0.89, 2.19, 0.71);
body.quadraticCurveTo(2.26, 0.62, 2.26, 0.42);
body.lineTo(1.91, 0.36); body.lineTo(1.91, 0.42);
body.absarc(1.43, 0.42, 0.48, 0, Math.PI, false);
body.lineTo(0.95, 0.35); body.lineTo(-0.98, 0.35); body.lineTo(-0.98, 0.42);
body.absarc(-1.46, 0.42, 0.48, 0, Math.PI, false);
body.lineTo(-1.94, 0.4); body.closePath();
function silhouette(shape, depth, bevel) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1, curveSegments: 16 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
mesh(car, silhouette(body, 1.76, 0.04), '#7b9da8', [0, 0, 0]);
const cabin = new THREE.Shape();
cabin.moveTo(-1.24, 0.96); cabin.quadraticCurveTo(-0.89, 1.3, -0.52, 1.43);
cabin.quadraticCurveTo(0.06, 1.49, 0.42, 1.36); cabin.lineTo(1.01, 0.95); cabin.closePath();
const glass = mesh(car, silhouette(cabin, 1.42, 0.035), '#21343d', [0, 0, 0]);
glass.material.metalness = 0.65; glass.material.roughness = 0.14;
mesh(car, new RoundedBoxGeometry(0.94, 0.07, 1.48, 2, 0.03), '#7b9da8', [-0.16, 1.45, 0], [0, 0, -0.025]);
for (const z of [-0.743, 0.743]) {
  mesh(car, new RoundedBoxGeometry(0.045, 0.41, 0.045, 2, 0.015), '#7b9da8', [-0.21, 1.2, z]);
  mesh(car, new RoundedBoxGeometry(0.19, 0.028, 0.028, 2, 0.01), '#c7d3d6', [-0.47, 0.87, z * 1.23]);
  mesh(car, new RoundedBoxGeometry(0.19, 0.1, 0.19, 2, 0.045), '#7b9da8', [0.68, 1.02, z * 1.28]);
}
mesh(car, new RoundedBoxGeometry(0.07, 0.12, 1.3, 3, 0.03), '#16232b', [2.25, 0.49, 0]);
for (const z of [-0.62, 0.62]) {
  const light = mesh(car, new RoundedBoxGeometry(0.055, 0.045, 0.34, 2, 0.015), '#eff9ff', [2.23, 0.68, z]);
  light.material.emissive.set('#a6d8e7'); light.material.emissiveIntensity = 0.5;
}
mesh(car, new RoundedBoxGeometry(0.05, 0.04, 1.49, 2, 0.015), '#b93d32', [-2.27, 0.72, 0]);
// Reuse wheel buffers: GLTFExporter writes shared geometries only once.
const tireGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 32);
const rimGeometry = new THREE.CylinderGeometry(0.30, 0.30, 0.258, 32);
const insetGeometry = new THREE.CylinderGeometry(0.255, 0.255, 0.262, 24);
const spokeGeometry = new THREE.BoxGeometry(0.035, 0.23, 0.025);
const hubGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.28, 16);
for (const x of [-1.46, 1.43]) for (const z of [-0.86, 0.86]) {
  const tire = mesh(car, tireGeometry, '#22252a', [x, 0.42, z], [Math.PI / 2, 0, 0]);
  tire.material.roughness = 0.9; tire.material.metalness = 0;
  mesh(car, rimGeometry, '#84939c', [x, 0.42, z], [Math.PI / 2, 0, 0]);
  mesh(car, insetGeometry, '#303840', [x, 0.42, z], [Math.PI / 2, 0, 0]);
  const faceZ = z + Math.sign(z) * 0.134;
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5;
    mesh(car, spokeGeometry, '#c6d1d6', [x + Math.sin(angle) * 0.135, 0.42 + Math.cos(angle) * 0.135, faceZ], [0, 0, -angle]);
  }
  mesh(car, hubGeometry, '#c6d1d6', [x, 0.42, z], [Math.PI / 2, 0, 0]);
}
await save('concept-car', car);
const device = new THREE.Group();
mesh(device, new RoundedBoxGeometry(0.7, 1.3, 0.1, 3, 0.035), '#303e51', [0, 0.65, 0]);
mesh(device, new RoundedBoxGeometry(0.62, 1.12, 0.015, 3, 0.007), '#193549', [0, 0.69, 0.058]);
for (let i = 0; i < 5; i++) mesh(device, new THREE.BoxGeometry(0.36 - i * 0.035, 0.012, 0.006), '#55bcc5', [-i * 0.0175, 0.84 - i * 0.11, 0.07]);
mesh(device, new THREE.BoxGeometry(0.55, 0.03, 0.3), '#657e96', [0, 0.02, 0]);
await save('display-device', device);
const sculpture = new THREE.Group();
mesh(sculpture, new THREE.TorusKnotGeometry(0.44, 0.12, 80, 12), '#b98d4c', [0, 0.7, 0]);
await save('ribbon-sculpture', sculpture);
const bag = new THREE.Group();
mesh(bag, new RoundedBoxGeometry(1.1, 0.7, 0.42, 4, 0.075), '#8a4b4f', [0, 0.35, 0]);
mesh(bag, new RoundedBoxGeometry(1.0, 0.28, 0.045, 3, 0.02), '#75434a', [0, 0.54, 0.207]);
mesh(bag, new THREE.TorusGeometry(0.27, 0.035, 8, 32, Math.PI), '#bba276', [0, 0.7, 0]);
mesh(bag, new THREE.BoxGeometry(0.16, 0.12, 0.025), '#d6b46b', [0, 0.47, 0.225]);
await save('atelier-bag', bag);
console.log('Generated 24 original studies and four texture-free GLB models.');
