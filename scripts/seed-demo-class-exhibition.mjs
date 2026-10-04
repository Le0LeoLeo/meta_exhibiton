// Creates and publishes the English sample class exhibition used in Paidea demos.
// The students are fictional; every artwork is a public-domain image from
// The Met Open Access already stored in public/demo (see docs/demo-artwork-sources.md).
//
//   node scripts/seed-demo-class-exhibition.mjs
//
// Env: PAIDEA_API (default http://127.0.0.1:5176), PAIDEA_DEMO_EMAIL and
// PAIDEA_DEMO_PASSWORD. Without them a local demo account is created and its
// credentials are saved to .tmp/demo-class-account.json (git-ignored).
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const API = process.env.PAIDEA_API || 'http://127.0.0.1:5176';
const root = new URL('../', import.meta.url);
const accountFile = new URL('.tmp/demo-class-account.json', root);
const met = (objectId) => `https://www.metmuseum.org/art/collection/search/${objectId}`;

const works = [
  {
    objectId: 45434, wall: 'back', at: -5.6,
    title: 'Under the Wave off Kanagawa', artist: 'Katsushika Hokusai · c. 1830–32',
    description: 'Label by Ava (fictional student). A woodblock print that many European artists saw in the late 1800s.',
    workContext: {
      contribution: 'I researched when prints like this reached Europe and wrote the label that starts our class story.',
      process: 'I compared the museum record with our textbook chapter and fixed my dates after Ben noticed I had written 1850 instead of about 1830–32.',
      outcome: 'A 100-word label and the first card on our class timeline.',
      reflection: 'I learned to write down where every date comes from, not just the date itself.',
      sources: [
        { label: 'The Met collection record', url: met(45434), excerpt: 'My notes: Katsushika Hokusai, about 1830–32, polychrome woodblock print.' },
        { label: 'Peer feedback from Ben', excerpt: 'Dates are clear now. Say which book the claim about Europe comes from.' },
      ],
    },
  },
  {
    objectId: 436532, wall: 'back', at: 0,
    title: 'Self-Portrait with a Straw Hat', artist: 'Vincent van Gogh · 1887',
    description: 'Label by Daniel (fictional student). Painted in Paris, the year our class timeline links to Japanese prints.',
    workContext: {
      contribution: 'I wrote the label connecting Van Gogh’s time in Paris with the prints he collected there.',
      process: 'I listed what our textbook says about 1887 and kept only the points I could match to a source.',
      outcome: 'A label and two questions for visitors about the short, separate brushstrokes.',
      reflection: 'At first I wrote that the prints “caused” this style. I changed it to “may have influenced”, because my sources do not prove a direct cause.',
      sources: [
        { label: 'The Met collection record', url: met(436532), excerpt: 'My notes: Vincent van Gogh, 1887, oil on canvas.' },
        { label: 'Class textbook, chapter 6', excerpt: 'My notes: Van Gogh lived in Paris from 1886 to 1888 and collected Japanese prints.' },
      ],
    },
  },
  {
    objectId: 436535, wall: 'back', at: 5.6,
    title: 'Wheat Field with Cypresses', artist: 'Vincent van Gogh · 1889',
    description: 'Label by Emma (fictional student). Compares the curling lines of the sky with the wave print.',
    workContext: {
      contribution: 'I made the comparison between the swirling sky here and the curling wave in Hokusai’s print.',
      process: 'I traced the main curves of both images and showed the tracings to my group.',
      outcome: 'A comparison label marked clearly as my interpretation.',
      reflection: 'Two classmates did not see a link. Instead of removing the idea, I labelled it as my interpretation so visitors can judge for themselves.',
      sources: [
        { label: 'The Met collection record', url: met(436535), excerpt: 'My notes: Vincent van Gogh, 1889, oil on canvas.' },
        { label: 'Group discussion notes', excerpt: 'Two of four group members agreed the curves look similar; two thought the link was weak.' },
      ],
    },
  },
  {
    objectId: 56213, wall: 'left', at: -3.5,
    title: 'Fuji from the Katakura Tea Fields in Suruga', artist: 'Katsushika Hokusai · c. 1830–32',
    description: 'Label by Ben (fictional student). Everyday work in front of Mount Fuji.',
    workContext: {
      contribution: 'I explained how the print layers tea pickers, fields and Mount Fuji to create depth.',
      process: 'I sketched the picture as three layers before writing, then tested the label by reading it aloud to Chloe.',
      outcome: 'A label and a three-layer sketch shown in class.',
      reflection: 'Drawing the layers helped me explain composition more clearly than words alone.',
      sources: [
        { label: 'The Met collection record', url: met(56213), excerpt: 'My notes: from the series Thirty-six Views of Mount Fuji, about 1830–32.' },
        { label: 'Teacher comment', excerpt: 'Good use of your sketch. Add one sentence on why everyday scenes mattered.' },
      ],
    },
  },
  {
    objectId: 55739, wall: 'left', at: 3,
    title: 'Noboto at Shimōsa', artist: 'Katsushika Hokusai · 1832–33',
    description: 'Label by Chloe (fictional student). People working by the sea.',
    workContext: {
      contribution: 'I compared how Hokusai shows people working by the sea in this print and in the wave print.',
      process: 'I made a two-column table of what each print shows and asked Ava to check it against her research.',
      outcome: 'A label and a comparison table.',
      reflection: 'My first draft only described the picture. Feedback pushed me to explain what the comparison tells us.',
      sources: [
        { label: 'The Met collection record', url: met(55739), excerpt: 'My notes: from the series One Thousand Pictures of the Sea, 1832–33.' },
        { label: 'Peer feedback from Ava', excerpt: 'Your table is clear. What is the point of comparing them?' },
      ],
    },
  },
  {
    objectId: 436530, wall: 'right', at: -3.5,
    title: 'Oleanders', artist: 'Vincent van Gogh · 1888',
    description: 'Label by Felix (fictional student). Bright, flat areas of colour.',
    workContext: {
      contribution: 'I wrote about the flat, bright areas of colour and asked whether they show influence from prints.',
      process: 'I looked for colour areas without shading and marked them on a printout.',
      outcome: 'A label ending with an open question for visitors.',
      reflection: 'Our class reading says Van Gogh compared the south of France to Japan in his letters, but I have not read those letters myself, so I left it as a question.',
      sources: [
        { label: 'The Met collection record', url: met(436530), excerpt: 'My notes: Vincent van Gogh, 1888, oil on canvas.' },
      ],
    },
  },
];

const room = { width: 22, length: 20, height: 5.6, wallThickness: 0.1, wallColor: '#715238', wallMaterialPreset: 'paint',
  wallTextureUrl: '/textures/template-wall-warm.svg', wallTextureTiling: 3, wallRoughness: 0.96, wallMetalness: 0, wallBumpScale: 0,
  wallEnvIntensity: 0.12, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45, floorColor: '#68523e',
  floorTextureUrl: '/textures/template-oak.svg', floorTextureTiling: 3, floorRoughness: 0.98, floorMetalness: 0, environmentBrightness: 0.38 };
const wallZ = -room.length / 2 + 0.16;
const sideX = room.width / 2 - 0.16;
const placement = {
  back: (at) => ({ position: [at, 2.45, wallZ], rotation: [0, 0, 0] }),
  left: (at) => ({ position: [-sideX, 2.55, at], rotation: [0, Math.PI / 2, 0] }),
  right: (at) => ({ position: [sideX, 2.55, at], rotation: [0, -Math.PI / 2, 0] }),
};
// Fixed ids keep comments attached to their works when the script is re-run.
const text = (id, content, position, rotation, extra) => ({ id, type: 'text', position, rotation, scale: [1, 1, 1], content, title: content,
  textFontFamily: 'sans', textColor: '#f1dcc0', textIsBold: false, textBackboardEnabled: false, ...extra });

async function painting(work) {
  const { width, height } = await sharp(fileURLToPath(new URL(`public/demo/met-${work.objectId}.jpg`, root))).metadata();
  const ratio = width / height;
  const frameHeight = ratio < 1 ? 2.5 : 2.3;
  return { id: `painting-met-${work.objectId}`, type: 'painting', ...placement[work.wall](work.at), scale: [1, 1, 1],
    content: `/demo/met-${work.objectId}.jpg`, frameWidth: frameHeight * ratio, frameHeight, imageAspectRatio: ratio,
    frameStyle: 'classic', frameColor: '#b49864', frameInnerColor: '#d2bd95', frameThickness: 0.07, frameDepth: 0.055,
    frameMatEnabled: false, frameMatColor: '#e9dcc5', frameMatWidth: 0.14, frameGlassEnabled: false,
    title: work.title, artist: work.artist, description: work.description, externalUrl: met(work.objectId), workContext: work.workContext };
}

const scene = {
  roomSize: room,
  floorPlanElements: [{ id: 'room-demo-class', type: 'room', position: [0, 0.02, 0], rotation: [0, 0, 0], scale: [room.width, 0.04, room.length], color: '#dbeafe', isLocked: true }],
  wallMaterialOverrides: {},
  items: [
    text('text-demo-title', 'Waves Across the World', [0, 4.75, wallZ + 0.04], [0, 0, 0], { textFontSize: 0.46 }),
    text('text-demo-subtitle', 'CLASS 4B HISTORY & ART INQUIRY  ·  SAMPLE EXHIBITION', [0, 4.25, wallZ + 0.04], [0, 0, 0], { textFontSize: 0.14 }),
    // Wall text is sized from its longest line, so break it by hand to fit the wall.
    text('text-demo-inquiry', [
      'INQUIRY QUESTION',
      'How did Japanese woodblock prints change',
      'the way some European artists painted?',
      '',
      'Sample exhibition: the students are fictional.',
      'Artworks: public-domain images from',
      'The Met Open Access.',
    ].join('\n'), [sideX - 0.04, 2.6, 3], [0, -Math.PI / 2, 0], { textFontSize: 0.16, textBackboardEnabled: true }),
    ...await Promise.all(works.map(painting)),
    { id: 'bench-demo-class', type: 'bench', position: [0, 0, -1.5], rotation: [0, 0, 0], scale: [1.65, 1, 1], content: '#766049', title: 'Viewing bench' },
    { id: 'lightstrip-demo-class', type: 'lightstrip', position: [0, 5.15, -6.8], rotation: [0, 0, 0], scale: [11, 0.055, 0.055], content: '#ffdbad', title: 'Wall wash lighting', lightIntensity: 0.18 },
  ],
};

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function account() {
  if (process.env.PAIDEA_DEMO_EMAIL && process.env.PAIDEA_DEMO_PASSWORD) return { email: process.env.PAIDEA_DEMO_EMAIL, password: process.env.PAIDEA_DEMO_PASSWORD };
  try { return JSON.parse(await readFile(accountFile, 'utf8')); } catch { /* create below */ }
  const created = { name: 'Class 4B (sample)', email: `class-4b-${randomBytes(3).toString('hex')}@example.test`, password: randomBytes(16).toString('hex') };
  const registered = await call('/api/auth/register', { method: 'POST', body: created });
  if (registered.status !== 201) throw new Error(`Could not create the demo account (${registered.status}): ${registered.data.message ?? ''}`);
  await mkdir(new URL('.tmp/', root), { recursive: true });
  await writeFile(accountFile, JSON.stringify(created, null, 2));
  return created;
}

const { email, password } = await account();
const login = await call('/api/auth/login', { method: 'POST', body: { email, password } });
if (!login.data.token) throw new Error(`Sign-in failed (${login.status}): ${login.data.message ?? ''}`);
const exhibition = {
  title: 'Waves Across the World',
  description: 'Sample class exhibition for demonstrating Paidea. Six students (fictional) each researched one public-domain work from The Met Open Access and wrote its label and learning story.',
  templateTitle: '歷史博物館', templateImage: '/templates/cover-history.jpg', category: '文化', sceneJson: JSON.stringify(scene),
};
const token = login.data.token;
// Re-running refreshes the existing sample instead of adding a duplicate.
const mine = await call('/api/galleries/mine', { token });
const existing = (mine.data.galleries ?? []).find((gallery) => gallery.title === exhibition.title);
let galleryId;
if (existing) {
  const current = await call(`/api/galleries/${existing.id}`, { token });
  const updated = await call(`/api/galleries/${existing.id}`, { token, method: 'PATCH', body: { ...exhibition, expectedRevision: current.data.gallery.revision } });
  if (updated.status !== 200) throw new Error(`Could not update ${existing.id} (${updated.status}): ${updated.data.message ?? ''}`);
  galleryId = existing.id;
} else {
  const created = await call('/api/galleries', { token, method: 'POST', body: exhibition });
  if (created.status !== 201) throw new Error(`Could not create the exhibition (${created.status}): ${created.data.message ?? ''}`);
  galleryId = created.data.gallery.id;
}
if (!existing?.isPublished) {
  const published = await call(`/api/galleries/${galleryId}/publish`, { token, method: 'POST', body: {} });
  if (published.status !== 200) throw new Error(`Saved ${galleryId} but could not publish it (${published.status}): ${published.data.message ?? ''}`);
}
// Classmates' comments on individual works (all names are fictional).
const comments = {
  'Under the Wave off Kanagawa': [
    ['Ben', 'The timeline card really helped. Which book says prints like this reached Europe later in the 1800s?'],
    ['Ava', 'Good point, it is our textbook chapter 6. I will add the page number to the source.'],
    ['Ms Lee (teacher)', 'Try asking the AI guide what it can and cannot tell from your label alone, then compare that with your sources.'],
  ],
  'Wheat Field with Cypresses': [
    ['Chloe', 'I still do not see a link to the wave, but marking it as your interpretation is fair.'],
    ['Emma', 'Thanks! What would convince you? I could put my two tracings side by side.'],
  ],
  'Self-Portrait with a Straw Hat': [
    ['Felix', '“May have influenced” is more careful than “caused”. Is there anything in the painting itself that looks like a print?'],
  ],
  'Fuji from the Katakura Tea Fields in Suruga': [
    ['Daniel', 'The three-layer sketch made the depth easy to see. Could you hang the sketch next to the print?'],
  ],
  'Oleanders': [
    ['Ava', 'Could we look for that letter in an online collection before the final version, so you can quote it yourself?'],
    ['Felix', 'Yes, I will check and update the label if I find it.'],
  ],
};
const savedScene = JSON.parse((await call(`/api/galleries/${galleryId}`, { token })).data.gallery.sceneJson);
let added = 0;
for (const [title, entries] of Object.entries(comments)) {
  const item = savedScene.items.find((candidate) => candidate.title === title);
  if (!item) continue;
  const path = `/api/galleries/${galleryId}/items/${encodeURIComponent(item.id)}/comments`;
  const present = (await call(path, { token })).data.comments ?? [];
  for (const [userName, content] of entries) {
    if (present.some((comment) => comment.userName === userName && comment.content === content)) continue;
    const posted = await call(path, { token, method: 'POST', body: { userName, content } });
    if (posted.status !== 201) throw new Error(`Could not add a comment on "${title}" (${posted.status}): ${posted.data.message ?? ''}`);
    added += 1;
  }
}
console.log(`${existing ? 'Updated' : 'Published'} "${exhibition.title}": /exhibitions/${galleryId} (${added} new comments)`);
console.log(`Owner account: ${email} (password in ${process.env.PAIDEA_DEMO_EMAIL ? 'PAIDEA_DEMO_PASSWORD' : '.tmp/demo-class-account.json'})`);
