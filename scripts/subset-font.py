#!/usr/bin/env python3
"""Subset the Ma Shan Zheng calligraphy font (OFL) to the characters used in
the game's source, producing a small woff2 committed to the repo.

Usage: python3 scripts/subset-font.py
Requires: pip install fonttools brotli
"""
import os
import re
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'node_modules', '.cache', 'fonts')
TTF = os.path.join(CACHE, 'MaShanZheng-Regular.ttf')
URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf'
OUT = os.path.join(ROOT, 'src', 'assets', 'fonts', 'msz-subset.woff2')


def collect_chars() -> str:
    chars = set()
    for base, _dirs, files in os.walk(os.path.join(ROOT, 'src')):
        for f in files:
            if not f.endswith(('.ts', '.tsx', '.css', '.html')):
                continue
            with open(os.path.join(base, f), encoding='utf-8') as fh:
                text = fh.read()
            for ch in text:
                if ord(ch) > 0x2e80:
                    chars.add(ch)
    # ASCII digits/letters and common punctuation
    chars.update(chr(c) for c in range(0x20, 0x7f))
    chars.update('，。！？、：；“”‘’（）【】《》·—…～')
    return ''.join(sorted(chars))


def main() -> int:
    os.makedirs(CACHE, exist_ok=True)
    if not os.path.exists(TTF):
        print('downloading', URL)
        urllib.request.urlretrieve(URL, TTF)
    chars = collect_chars()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    text_file = os.path.join(CACHE, 'chars.txt')
    with open(text_file, 'w', encoding='utf-8') as fh:
        fh.write(chars)
    cmd = [sys.executable, '-m', 'fontTools.subset', TTF, f'--text-file={text_file}', '--flavor=woff2', f'--output-file={OUT}', '--layout-features=*', '--no-hinting']
    subprocess.check_call(cmd)
    print(f'{len(chars)} glyphs -> {OUT} ({os.path.getsize(OUT) // 1024} KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
