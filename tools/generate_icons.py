"""Render the approved bright Vault icons with Chromium, preserving SVG shadows.

Run on Mini2 with its Playwright Python environment. The defaults regenerate
Chrome and Safari browser assets. --product mac/windows/safari --output PATH
also creates native masters, browser aliases, and .icns/.ico files as appropriate.
The website retains the separate dark source SVGs and pinned demo icons.
"""
from pathlib import Path
import argparse
import shutil
import struct
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS = ('mac', 'windows', 'chrome', 'safari')
BRANDING_SOURCES = {
    'mac': 'tools/branding/mac-vault-bright.svg',
    'windows': 'tools/branding/windows-vault-bright.svg',
    'chrome': 'tools/branding/extension-lock-bright.svg',
    'safari': 'tools/branding/safari/safari-vault.svg',
}


def selected_svg(product):
    """Use the exact approved product SVG, including its original geometry."""
    return (ROOT / BRANDING_SOURCES[product]).read_text()


def render(page, svg, path, size):
    page.set_viewport_size({'width': size, 'height': size})
    page.set_content('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' + svg)
    page.locator('svg').screenshot(path=str(path), omit_background=True)


def generate(page, product, output):
    output.mkdir(parents=True, exist_ok=True)
    svg = selected_svg(product)
    # The app and extension icon stays bright in both browser theme states.
    # The legacy inverse-dark filenames are aliases consumed by the popup and
    # toolbar, not separate artwork. The website has its own dark sources.
    dark = svg
    name = 'official-vault-extension' if product == 'chrome' else f'{product}-vault'
    (output / f'{name}.svg').write_text(svg)
    (output / f'{name}-inverse-dark.svg').write_text(dark)
    render(page, svg, output / (f'{name}-master.png' if product != 'chrome' else 'icon-master.png'), 1024)
    render(page, dark, output / (f'{name}-inverse-dark-master.png' if product != 'chrome' else 'icon-inverse-dark-master.png'), 1024)
    browser_icons = output if product == 'chrome' else output / 'BrowserIcons'
    browser_icons.mkdir(exist_ok=True)
    (browser_icons / 'official-vault-extension.svg').write_text(svg)
    (browser_icons / 'official-vault-extension-inverse-dark.svg').write_text(dark)
    for size in (16, 32, 48, 128):
        normal = browser_icons / f'icon-{size}.png'
        render(page, svg, normal, size)
        shutil.copyfile(normal, browser_icons / f'adamancia-vault-lock-v3-{size}.png')
        render(page, dark, browser_icons / f'adamancia-vault-lock-inverse-dark-{size}.png', size)
    for retired in browser_icons.glob('adamancia-vault-lock-v2-*.png'):
        retired.unlink()
    if product in ('mac', 'safari'):
        iconset = output / f'{name}.iconset'
        iconset.mkdir(exist_ok=True)
        for size in (16, 32, 128, 256, 512):
            render(page, svg, iconset / f'icon_{size}x{size}.png', size)
            render(page, svg, iconset / f'icon_{size}x{size}@2x.png', size * 2)
        subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(output / f'{name}.icns')], check=True)
        shutil.rmtree(iconset)
    if product == 'windows':
        frames=[]
        for size in (16, 24, 32, 48, 64, 128, 256):
            tmp=output / f'frame-{size}.png'
            render(page, svg, tmp, size)
            frames.append((size, tmp.read_bytes())); tmp.unlink()
        offset=6+16*len(frames); entries=[]; data=[]
        for size, png in frames:
            entries.append(struct.pack('<BBBBHHII', size if size<256 else 0, size if size<256 else 0, 0, 0, 1, 32, len(png), offset))
            data.append(png); offset+=len(png)
        (output/'windows-vault.ico').write_bytes(struct.pack('<HHH', 0, 1, len(frames))+b''.join(entries+data))
    print(f'{product} bright icon: {output}')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--product', choices=PRODUCTS)
    parser.add_argument('--output', type=Path)
    args=parser.parse_args()
    if bool(args.product) != bool(args.output): parser.error('--product and --output must be supplied together')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(device_scale_factor=1)
        if args.product: generate(page, args.product, args.output)
        else:
            generate(page, 'chrome', ROOT/'icons')
            generate(page, 'safari', ROOT/'tools/branding/safari')
        browser.close()

if __name__ == '__main__': main()
