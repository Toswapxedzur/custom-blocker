# Shared Vault icon base

- `vault-shield-base.svg`: canonical normal icon base for platform-icon composition.
  Background, definitions, edge, highlight, shield paths and shading are copied
  exactly from Mac Vault `e23bddb` / `Assets/Branding/mac-vault.svg`. The complete
  shield is scaled 1.10 about its original bounds center (32, 31.5). The 70×70
  viewBox and transparent margin remain unchanged. The Mac symbol is omitted;
  separate platform-symbol layers are the next stage. This is a design source,
  not a replacement installed app icon or a shipped extension resource.
- `generate_choices.py`: compose ten curved, gradient symbol choices per app
  onto the approved shared base; leaves active product icons untouched.
- `choices/`: generated 40 SVGs and numbered review index; identical base/colors.

- Active selections: Mac 04, Windows 03, Safari 05; extension restored to its original lock. `../generate_icons.py` renders these exact SVGs on mini1, including native containers and browser aliases.
- `extension-lock.svg`, `extension-lock-inverse-dark.svg`: original lock artwork and toolbar inverse from `af5194e`, scaled 1.15 about (32,32) from the owner's screenshot (`prog-lock` proportions), replacing the former 1.32 enlargement. Only the lock grows; original background and keyhole design retained. The grid source is retired.
- `safari/`: generated compass masters and browser icons used by Safari packaging.

- Approved symbol scales: Mac and Windows 0.85; Safari 0.90, relative to the original selected choices. The extension lock SVGs include their approved 1.15 scale; the generator applies no additional scaling.
