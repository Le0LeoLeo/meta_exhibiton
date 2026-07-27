# Quaternius Avatar Kit

This directory contains the production-ready subset used by the metaverse
avatar customizer:

- two rigged body shapes;
- three hairstyles;
- one neutral peasant outfit fitted to each body;
- `Idle`, `Walk`, and `Wave` animation clips.

All source models are by Quaternius and released under CC0. See
`LICENSE.txt` for the bundled license text and original source URLs.

The checked-in GLB files are generated from the official Standard downloads.
To rebuild them:

```powershell
npm run prepare:avatar -- `
  --base "path\to\Universal Base Characters[Standard]" `
  --animations "path\to\Universal Animation Library[Standard]" `
  --outfits "path\to\Modular Character Outfits Fantasy[Standard]"
npm run check:avatar
```

The preparation script keeps a shared humanoid bone naming convention, limits
textures to 512 by 512, strips unused animation data, and emits separate files
so body, hair, outfit, and animation resources can be cached independently.
