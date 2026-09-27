#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
同步自托管字体（与原型 demo .trae/demoapp 的 Google Fonts 字族/字重/分片策略完全一致）。

来源：@fontsource/{inter,ibm-plex-mono,noto-sans-sc}（仅作为字体素材来源）
产物：
  - public/fonts/<family>/*.woff2
  - src/assets/styles/fonts.scss（woff2-only @font-face，含 unicode-range，font-display: swap）

只保留 woff2（现代浏览器全覆盖；fontsource 自带 css 同时声明 woff+woff2 双格式会让
产物体积翻倍且 woff 永不加载）。CJK 保留 Google 风格 unicode-range 编号分片，浏览器
只下载当前页面字符命中的分片。

升级字体版本后重跑：python3 scripts/sync-fonts.py
"""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
NM = ROOT / 'node_modules' / '@fontsource'
OUT_FONTS = ROOT / 'public' / 'fonts'
OUT_CSS = ROOT / 'src' / 'assets' / 'styles' / 'fonts.scss'

# family -> (npm 包名, public 子目录, [(css 入口文件, 说明)...])
SOURCES = [
    ('inter', 'inter', [
        f'latin-{w}.css' for w in (400, 500, 600, 700)
    ] + [
        f'latin-ext-{w}.css' for w in (400, 500, 600, 700)
    ]),
    # 全量 400.css/500.css/700.css 内含 ~97 个带 unicode-range 的 CJK 编号分片
    ('noto-sans-sc', 'noto-sans-sc', [f'{w}.css' for w in (400, 500, 700)]),
    ('ibm-plex-mono', 'ibm-plex-mono', [
        f'latin-{w}.css' for w in (500, 600, 700)
    ] + [
        f'latin-ext-{w}.css' for w in (500, 600, 700)
    ]),
]

FACE_RE = re.compile(r'@font-face\s*\{[^}]*?\}', re.S)
WOFF2_RE = re.compile(r"url\(\s*(\S+?\.woff2)\s*\)\s*format\(\s*['\"]woff2['\"]\s*\)")


def convert_face(face: str, subdir: str) -> str | None:
    """保留 woff2 src 与其余描述符，url 改写为站点绝对路径 /fonts/<subdir>/..."""
    m = WOFF2_RE.search(face)
    if not m:
        return None
    woff2 = pathlib.Path(m.group(1)).name
    # 用新 src 整行替换原 src 行（丢掉 woff 回退）
    new_face = re.sub(
        r'src:\s*url\([^;]*?\)\s*format\([^;]*?\)\s*,\s*url\([^;]*?\)\s*format\([^;]*?\)\s*;',
        f"src: url('/fonts/{subdir}/{woff2}') format('woff2');",
        face,
        flags=re.S,
    )
    return new_face.strip()


def main() -> None:
    if OUT_FONTS.exists():
        shutil.rmtree(OUT_FONTS)
    blocks = [
        '// 由 scripts/sync-fonts.py 生成，勿手改。字族/字重与原型 demo 一致：',
        '// Inter 400/500/600/700、Noto Sans SC 400/500/700、IBM Plex Mono 500/600/700。',
        '',
    ]
    total_files = 0
    for pkg, subdir, css_list in SOURCES:
        pkg_dir = NM / pkg
        if not pkg_dir.exists():
            raise SystemExit(f'缺少依赖 {pkg}，请先在 ruoyi-ui 下执行 pnpm install')
        dest = OUT_FONTS / subdir
        dest.mkdir(parents=True, exist_ok=True)
        copied = 0
        for css_name in css_list:
            css_path = pkg_dir / css_name
            if not css_path.exists():
                raise SystemExit(f'缺少 {css_path}')
            css = css_path.read_text(encoding='utf-8')
            for face in FACE_RE.findall(css):
                woff2_match = WOFF2_RE.search(face)
                if not woff2_match:
                    continue
                src_woff2 = pkg_dir / 'files' / pathlib.Path(woff2_match.group(1)).name
                if not src_woff2.exists():
                    raise SystemExit(f'缺少字体文件 {src_woff2}')
                shutil.copy2(src_woff2, dest / src_woff2.name)
                copied += 1
                converted = convert_face(face, subdir)
                if converted:
                    blocks.append(converted)
                    blocks.append('')
        print(f'{pkg}: {copied} woff2')
        total_files += copied
    OUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    OUT_CSS.write_text('\n'.join(blocks) + '\n', encoding='utf-8')
    print(f'done: {total_files} woff2 -> {OUT_FONTS.relative_to(ROOT)}')
    print(f'css  -> {OUT_CSS.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
