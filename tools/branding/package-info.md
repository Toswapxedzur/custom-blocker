# Vault icon sources

- `mac-vault-bright.svg`, `windows-vault-bright.svg`,
  `extension-lock-bright.svg`, and `safari/safari-vault.svg` are the approved
  bright product icons. Each preserves the geometry of its corresponding dark
  icon, with the visible tile outline removed. `../generate_icons.py` renders
  the production PNG, ICNS, ICO, browser and toolbar assets from these files.
- `extension-lock.svg` and `safari/safari-vault-dark.svg` remain the dark
  artwork for the website. Mac and Windows keep their dark website sources in
  their respective `Assets/Branding` and `Assets` folders.
- `extension-lock-inverse-dark.svg` is an alias of the bright extension icon
  retained for the popup/toolbar's theme-specific resource names.
- `vault-shield-base.svg`, `generate_choices.py`, and `choices/` preserve the
  earlier design exploration. Active product generation uses the exact
  approved SVGs above, not a regenerated choice.
