"""在 Chromium 中加载虚拟桌面页面，量出图标网格的真实几何尺寸（用于对齐真机 Win10 视觉）。

用法： python tools/measure-desktop.py
"""
import json
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / "src/renderer/desktop/index.html").as_uri()

STUB = """
window.TF = {
  baseItems: %s,
  icons: [{id:"this-pc",file:"assets/icons/png/this-pc.png"},{id:"recycle-bin",file:"assets/icons/png/recycle-bin.png"},{id:"explorer",file:"assets/icons/png/explorer.png"},{id:"novel",file:"assets/icons/png/folder.png"},{id:"bilibili",file:"assets/icons/png/folder.png"},{id:"video",file:"assets/icons/png/folder.png"}],
  getConfig: async () => ({ config: {
      hotkey: { mode:'sequence', sequence:['CTRL','CTRL'], gap:420, accelerator:'Control+Shift+Q', label:'连按两次 Ctrl' },
      panic: { accelerator:'Control+Shift+H' },
      sites: %s,
      icons: { app:'whale', desktop:{} },
      layout: {},
      tray: { showStatus:true, closeToTray:true, startWithWindows:false },
      desktop: {}, stats: { toggles:0, pockets:0 }
    }, meta: { hotkeyLabel:'连按两次 Ctrl', version:'1.0.0' } }),
  patchConfig: async () => ({ config: {} }),
  setIcon: async () => true,
  saveSites: async () => true,
  saveLayout: async () => true,
  toggleDesktop: () => {}, hideDesktop: () => {}, showDesktop: () => {},
  openSettings: () => {}, openProperty: () => {}, openExternal: () => {},
  hideAll: () => {}, quit: () => {}, stats: () => {},
  onConfigChanged: () => {}, onShown: () => {}, onPool: () => {}
};
"""


def main():
    base = [
        {"id": "this-pc", "name": "此电脑", "icon": "this-pc", "type": "system", "role": "cue"},
        {"id": "recycle-bin", "name": "回收站", "icon": "recycle-bin", "type": "system", "role": "pocket"},
    ]
    for i in range(8):
        base.append({"id": f"app-{i}", "name": f"应用{i}", "icon": "explorer", "type": "app", "role": "ball"})
    sites = [
        {"id": "s1", "name": "起点中文网", "url": "https://www.qidian.com", "icon": "novel"},
        {"id": "s2", "name": "番茄小说", "url": "https://fanqienovel.com", "icon": "novel"},
        {"id": "s3", "name": "哔哩哔哩", "url": "https://www.bilibili.com", "icon": "bilibili"},
        {"id": "s4", "name": "腾讯视频", "url": "https://v.qq.com", "icon": "video"},
    ]
    stub = STUB % (json.dumps(base, ensure_ascii=False), json.dumps(sites, ensure_ascii=False))

    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        page = b.new_page(viewport={"width": 1920, "height": 1080})
        page.on("pageerror", lambda e: print("[pageerror]", e))
        page.on("console", lambda m: print("[console]", m.type, m.text[:200]))
        page.add_init_script(stub)
        page.goto(PAGE, wait_until="load")
        page.wait_for_timeout(1200)
        data = page.evaluate("""() => {
          const d = document.querySelector('#desktop');
          const cs = getComputedStyle(d);
          const dr = d.getBoundingClientRect();
          const icons = [...document.querySelectorAll('.icon')].map(el => {
            const r = el.getBoundingClientRect();
            const g = el.querySelector('.glyph').getBoundingClientRect();
            const l = el.querySelector('.label').getBoundingClientRect();
            return { id: el.dataset.id,
                     cell: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
                     glyph: [Math.round(g.width), Math.round(g.height)],
                     labelY: Math.round(l.y), labelH: Math.round(l.height),
                     text: el.querySelector('.label').textContent };
          });
          return { box: [dr.x, dr.y, dr.width, dr.height],
                   rows: cs.gridTemplateRows, cols: cs.gridTemplateColumns,
                   autoCols: cs.gridAutoColumns, count: icons.length, icons };
        }""")
        print("grid box:      ", data["box"])
        print("template rows: ", data["rows"])
        print("template cols: ", data["cols"], "| auto cols:", data["autoCols"])
        print("icon count:    ", data["count"])
        for it in data["icons"]:
            print(f"  {it['id']:<14} cell={it['cell']} glyph={it['glyph']} labelY={it['labelY']} h={it['labelH']} {it['text']}")
        page.click("#startBtn")
        page.wait_for_timeout(500)
        sm = page.evaluate("""() => {
          const q = s => { const el = document.querySelector(s); if(!el) return null;
            const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
            return {rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
                    display:cs.display, bottom:cs.bottom, height:cs.height}; };
          return { menu:q('#startMenu'), taskbar:q('#taskbar'), vh:innerHeight };
        }""")
        print("startMenu:", sm["menu"])
        print("taskbar:  ", sm["taskbar"], "| innerHeight:", sm["vh"])
        page.screenshot(path=str(ROOT / "measure-desktop.png"))
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
