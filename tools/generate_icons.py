"""Render the owner's selected vector icons with Chromium, preserving SVG shadows.

Run on mini1 with its Playwright Python environment. The defaults regenerate
Chrome and Safari browser assets. --product mac/windows/safari --output PATH
also creates native masters, browser aliases, and .icns/.ico files as appropriate.
"""
from pathlib import Path
import argparse
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS = ('mac', 'windows', 'chrome', 'safari')
SELECTIONS = {'mac': 4, 'windows': 3, 'safari': 5}
SYMBOL_SCALES = {'mac': .85, 'windows': .85, 'safari': .90}
SYMBOL_CENTERS = {'mac': (32, 30.5), 'windows': (32, 30), 'safari': (32, 30.5)}
NS = {'s': 'http://www.w3.org/2000/svg'}
ET.register_namespace('', NS['s'])


def selected_svg(product):
    """Use the approved grid or apply a native symbol's reduction once."""
    if product == 'chrome':
        # Size 05 / stroke A already has its approved 22-unit footprint.
        # Do not apply the retired Chrome-circle reduction to this grid.
        return (ROOT / 'tools/branding/chrome-grid.svg').read_text()
    source = (ROOT / f'tools/branding/choices/{product}-{SELECTIONS[product]:02d}.svg').read_text()
    root = ET.fromstring(source)
    symbol = root.find('s:g[@id="platform-symbol"]', NS)
    x, y = SYMBOL_CENTERS[product]
    wrapper = ET.Element('{'+NS['s']+'}g', {
        'id': 'symbol-scale',
        'transform': f'translate({x} {y}) scale({SYMBOL_SCALES[product]:g}) translate({-x} {-y})'
    })
    position = list(root).index(symbol)
    root.remove(symbol)
    wrapper.append(symbol)
    root.insert(position, wrapper)
    return '\n'.join(line.rstrip() for line in ET.tostring(root, encoding='unicode').splitlines()) + '\n'


def inverse(svg):
    """Keep the existing light-tile/dark-shield toolbar appearance, new symbol."""
    root = ET.fromstring(svg)
    for name, colors in [('tile', ['#ffffff', '#c2dbfa']), ('white', ['#22344f', '#152339', '#070d18'])]:
        for stop, color in zip(root.find(f's:defs/s:linearGradient[@id="{name}"]', NS), colors):
            stop.set('stop-color', color)
    rects = root.findall('s:rect', NS)
    rects[1].set('opacity', '.52')
    rects[2].set('stroke', '#1c5ca8'); rects[2].set('stroke-opacity', '.18')
    shade = root.find('s:g[@id="vault-shield"]/s:path', NS)
    shade.set('fill', '#fff'); shade.set('opacity', '.07')
    root.find('s:defs/s:filter/s:feDropShadow', NS).set('flood-opacity', '.42')
    return '\n'.join(line.rstrip() for line in ET.tostring(root, encoding='unicode').splitlines()) + '\n'


def render(page, svg, path, size):
    page.set_viewport_size({'width': size, 'height': size})
    page.set_content('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' + svg)
    page.locator('svg').screenshot(path=str(path), omit_background=True)


def generate(page, product, output):
    output.mkdir(parents=True, exist_ok=True)
    svg = selected_svg(product)
    dark = inverse(svg)
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
    selection = 'grid size 05, stroke A' if product == 'chrome' else f'choice {SELECTIONS[product]:02d}, symbol −{round((1-SYMBOL_SCALES[product])*100)}%'
    print(f'{product} {selection}: {output}')


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
