# Extension build and packaging tools

- `branding/`: shared shield base and design-source provenance.
- `generate_icons.py`: rasterize official extension SVGs and inverse companions.
- `package.py`: assemble allowlisted browser packages; Chrome/Edge Store ZIPs omit the source manifest's development key so the existing Store item supplies its identity.
- `build_locales.py`, `translate_pass.py`: locale catalog tooling.
- `build_promo_screenshots.py`, `build_promo_tiles.py`: promotional asset tooling.
