/** The Met Open Access images, served locally. See docs/demo-artwork-sources.md. */
export const demoArtworks = [
  { id: 45434, key: 1, width: 600, height: 403, date: 'ca. 1830–32' },
  { id: 436535, key: 2, width: 599, height: 477, date: '1889' },
  { id: 437881, key: 3, width: 555, height: 624, date: 'ca. 1662' },
] as const;

const additionalArtworks = [
  {
    "id": 436529,
    "key": 8,
    "width": 496,
    "height": 624,
    "date": "1888–89"
  },
  {
    "id": 436532,
    "key": 9,
    "width": 502,
    "height": 625,
    "date": "1887"
  },
  {
    "id": 436533,
    "key": 10,
    "width": 599,
    "height": 501,
    "date": "1888"
  },
  {
    "id": 437153,
    "key": 11,
    "width": 323,
    "height": 624,
    "date": "1864"
  },
  {
    "id": 437158,
    "key": 12,
    "width": 590,
    "height": 625,
    "date": "ca. 1520–25"
  },
  {
    "id": 437174,
    "key": 13,
    "width": 365,
    "height": 624,
    "date": "ca. 1650–55"
  },
  {
    "id": 437182,
    "key": 14,
    "width": 504,
    "height": 624,
    "date": "1753"
  },
  {
    "id": 437327,
    "key": 15,
    "width": 539,
    "height": 625,
    "date": "ca. 1633"
  },
  {
    "id": 436526,
    "key": 16,
    "width": 599,
    "height": 475,
    "date": "1890"
  },
  {
    "id": 436530,
    "key": 17,
    "width": 599,
    "height": 492,
    "date": "1888"
  },
  {
    "id": 436536,
    "key": 18,
    "width": 599,
    "height": 484,
    "date": "1889"
  },
  {
    "id": 436175,
    "key": 19,
    "width": 600,
    "height": 453,
    "date": "1848–49"
  },
  {
    "id": 436121,
    "key": 20,
    "width": 600,
    "height": 488,
    "date": "1865"
  },
  {
    "id": 437382,
    "key": 21,
    "width": 465,
    "height": 624,
    "date": "ca. 1906"
  },
  {
    "id": 436524,
    "key": 22,
    "width": 599,
    "height": 423,
    "date": "1887"
  },
  {
    "id": 436528,
    "key": 23,
    "width": 599,
    "height": 475,
    "date": "1890"
  },
  {
    "id": 55236,
    "key": 24,
    "width": 600,
    "height": 412,
    "date": "ca. 1830–32"
  },
  {
    "id": 56686,
    "key": 25,
    "width": 600,
    "height": 415,
    "date": "ca. 1830–32"
  },
  {
    "id": 56229,
    "key": 26,
    "width": 599,
    "height": 409,
    "date": "ca. 1830–32"
  },
  {
    "id": 55223,
    "key": 27,
    "width": 599,
    "height": 408,
    "date": "ca. 1830–32"
  },
  {
    "id": 56216,
    "key": 28,
    "width": 599,
    "height": 410,
    "date": "ca. 1830–32"
  },
  {
    "id": 56214,
    "key": 29,
    "width": 599,
    "height": 409,
    "date": "ca. 1830–32"
  },
  {
    "id": 56217,
    "key": 30,
    "width": 599,
    "height": 412,
    "date": "ca. 1830–32"
  },
  {
    "id": 56240,
    "key": 31,
    "width": 599,
    "height": 414,
    "date": "ca. 1830–32"
  }
] as const;

export const demoExhibitions = [
  { id: 'classics', title: 'demoTitle', description: 'demoDescription', cover: 436535, artworks: [...demoArtworks, ...additionalArtworks.slice(0, 8)], wall: '#f5f0e8' },
  { id: 'garden', title: 'demoGardenTitle', description: 'demoGardenDescription', cover: 436965, wall: '#edf1e8', artworks: [
    { id: 436965, key: 4, width: 599, height: 377, date: '1874' },
    { id: 436534, key: 5, width: 494, height: 624, date: '1890' }, demoArtworks[1], ...additionalArtworks.slice(8, 16),
  ] },
  { id: 'landscape', title: 'demoLandscapeTitle', description: 'demoLandscapeDescription', cover: 56213, wall: '#eaf0f4', artworks: [
    demoArtworks[0], { id: 56213, key: 6, width: 599, height: 394, date: 'ca. 1830–32' },
    { id: 55739, key: 7, width: 599, height: 421, date: '1832–33' }, ...additionalArtworks.slice(16),
  ] },
] as const;
export function getDemoExhibition(id: string | null) {
  return demoExhibitions.find(exhibition => exhibition.id === id) ?? demoExhibitions[0];
}
