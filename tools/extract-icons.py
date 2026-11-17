"""
从 Windows 10 系统资源（imageres.dll.mun / shell32.dll.mun）中提取真实图标。
- 生成索引图（contact sheet）用于挑选
- 导出指定索引为多尺寸 PNG，供 touch fish 虚拟桌面使用

用法：
  python tools/extract-icons.py sheet            # 生成索引图
  python tools/extract-icons.py export           # 按 MAPPING 导出图标
"""
import ctypes
import struct
import sys
import zlib
from ctypes import wintypes
import os

user32 = ctypes.WinDLL('user32', use_last_error=True)
gdi32 = ctypes.WinDLL('gdi32', use_last_error=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'icons', 'png')
SHEET_DIR = os.path.join(ROOT, 'assets', 'icons', 'sheets')


class ICONINFO(ctypes.Structure):
    _fields_ = [
        ('fIcon', wintypes.BOOL),
        ('xHotspot', wintypes.DWORD),
        ('yHotspot', wintypes.DWORD),
        ('hbmMask', wintypes.HBITMAP),
        ('hbmColor', wintypes.HBITMAP),
    ]


class BITMAP(ctypes.Structure):
    _fields_ = [
        ('bmType', ctypes.c_long),
        ('bmWidth', ctypes.c_long),
        ('bmHeight', ctypes.c_long),
        ('bmWidthBytes', ctypes.c_long),
        ('bmPlanes', ctypes.c_ushort),
        ('bmBitsPixel', ctypes.c_ushort),
        ('bmBits', ctypes.c_void_p),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', wintypes.DWORD),
        ('biWidth', wintypes.LONG),
        ('biHeight', wintypes.LONG),
        ('biPlanes', wintypes.WORD),
        ('biBitCount', wintypes.WORD),
        ('biCompression', wintypes.DWORD),
        ('biSizeImage', wintypes.DWORD),
        ('biXPelsPerMeter', wintypes.LONG),
        ('biYPelsPerMeter', wintypes.LONG),
        ('biClrUsed', wintypes.DWORD),
        ('biClrImportant', wintypes.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [('bmiHeader', BITMAPINFOHEADER), ('bmiColors', wintypes.DWORD * 3)]


PrivateExtractIcons = user32.PrivateExtractIconsW
PrivateExtractIcons.argtypes = [
    wintypes.LPCWSTR, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ctypes.POINTER(wintypes.HICON), ctypes.POINTER(wintypes.UINT), wintypes.UINT, wintypes.UINT,
]
PrivateExtractIcons.restype = wintypes.UINT

GetIconInfo = user32.GetIconInfo
GetIconInfo.argtypes = [wintypes.HICON, ctypes.POINTER(ICONINFO)]
GetIconInfo.restype = wintypes.BOOL

GetObjectW = gdi32.GetObjectW
GetObjectW.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p]
GetObjectW.restype = ctypes.c_int

CreateCompatibleDC = gdi32.CreateCompatibleDC
CreateCompatibleDC.argtypes = [wintypes.HDC]
CreateCompatibleDC.restype = wintypes.HDC

GetDIBits = gdi32.GetDIBits
GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT, wintypes.UINT,
                      ctypes.c_void_p, ctypes.POINTER(BITMAPINFO), wintypes.UINT]
GetDIBits.restype = ctypes.c_int

DeleteObject = gdi32.DeleteObject
DeleteObject.argtypes = [wintypes.HGDIOBJ]
DeleteDC = gdi32.DeleteDC
DeleteDC.argtypes = [wintypes.HDC]
DestroyIcon = user32.DestroyIcon
DestroyIcon.argtypes = [wintypes.HICON]
SelectObject = gdi32.SelectObject
SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
SelectObject.restype = wintypes.HGDIOBJ


def hicon_to_rgba(hicon):
    ii = ICONINFO()
    if not GetIconInfo(hicon, ctypes.byref(ii)):
        return None
    try:
        bm = BITMAP()
        if not GetObjectW(ii.hbmColor, ctypes.sizeof(BITMAP), ctypes.byref(bm)):
            return None
        w, h = bm.bmWidth, bm.bmHeight
        if w <= 0 or h <= 0:
            return None

        hdc = CreateCompatibleDC(None)
        bi = BITMAPINFO()
        bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bi.bmiHeader.biWidth = w
        bi.bmiHeader.biHeight = -h
        bi.bmiHeader.biPlanes = 1
        bi.bmiHeader.biBitCount = 32
        bi.bmiHeader.biCompression = 0

        buf = ctypes.create_string_buffer(w * h * 4)
        SelectObject(hdc, ii.hbmColor)
        lines = GetDIBits(hdc, ii.hbmColor, 0, h, buf, ctypes.byref(bi), 0)

        alpha_all_zero = True
        data = bytearray(buf.raw)
        for i in range(3, len(data), 4):
            if data[i]:
                alpha_all_zero = False
                break

        if alpha_all_zero:
            # 老式图标：用 mask 生成 alpha
            bi2 = BITMAPINFO()
            bi2.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            bi2.bmiHeader.biWidth = w
            bi2.bmiHeader.biHeight = -h
            bi2.bmiHeader.biPlanes = 1
            bi2.bmiHeader.biBitCount = 1
            bi2.bmiHeader.biCompression = 0
            stride = ((w + 31) // 32) * 4
            mbuf = ctypes.create_string_buffer(stride * h)
            SelectObject(hdc, ii.hbmMask)
            GetDIBits(hdc, ii.hbmMask, 0, h, mbuf, ctypes.byref(bi2), 0)
            mdata = mbuf.raw
            for y in range(h):
                for x in range(w):
                    bit = (mdata[y * stride + x // 8] >> (7 - (x % 8))) & 1
                    data[(y * w + x) * 4 + 3] = 0 if bit else 255

        DeleteDC(hdc)

        # BGRA -> RGBA
        rgba = bytearray(len(data))
        for i in range(0, len(data), 4):
            rgba[i] = data[i + 2]
            rgba[i + 1] = data[i + 1]
            rgba[i + 2] = data[i]
            rgba[i + 3] = data[i + 3]
        return w, h, bytes(rgba)
    finally:
        if ii.hbmColor:
            DeleteObject(ii.hbmColor)
        if ii.hbmMask:
            DeleteObject(ii.hbmMask)


def extract(path, index, size):
    hicon = wintypes.HICON()
    iconid = wintypes.UINT()
    n = PrivateExtractIcons(path, index, size, size, ctypes.byref(hicon), ctypes.byref(iconid), 1, 0)
    if not n or not hicon.value:
        return None
    try:
        return hicon_to_rgba(hicon)
    finally:
        DestroyIcon(hicon)


def write_png(path, w, h, rgba):
    raw = b''.join(b'\x00' + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def scale(w, h, rgba, nw, nh):
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        sy0 = y * h // nh
        sy1 = max(sy0 + 1, (y + 1) * h // nh)
        for x in range(nw):
            sx0 = x * w // nw
            sx1 = max(sx0 + 1, (x + 1) * w // nw)
            r = g = b = a = 0
            cnt = 0
            for yy in range(sy0, sy1):
                base = yy * w * 4
                for xx in range(sx0, sx1):
                    i = base + xx * 4
                    r += rgba[i]
                    g += rgba[i + 1]
                    b += rgba[i + 2]
                    a += rgba[i + 3]
                    cnt += 1
            o = (y * nw + x) * 4
            out[o] = r // cnt
            out[o + 1] = g // cnt
            out[o + 2] = b // cnt
            out[o + 3] = a // cnt
    return bytes(out)


def make_sheet(dll, start, count, cols, cell, out_path):
    rows = (count + cols - 1) // cols
    W, H = cols * cell, rows * cell
    canvas = bytearray([232, 232, 232, 255] * (W * H))
    got = 0
    for i in range(count):
        idx = start + i
        res = extract(dll, idx, 256)
        if not res:
            continue
        w, h, rgba = res
        small = scale(w, h, rgba, cell - 8, cell - 8)
        cx = (i % cols) * cell + 4
        cy = (i // cols) * cell + 4
        for y in range(cell - 8):
            dst = ((cy + y) * W + cx) * 4
            src = y * (cell - 8) * 4
            canvas[dst:dst + (cell - 8) * 4] = small[src:src + (cell - 8) * 4]
        got += 1
    write_png(out_path, W, H, bytes(canvas))
    print(f'{os.path.basename(out_path)}: {got} icons, {cols} cols x {rows} rows, start={start}')


MAPPING = {
    # name: (dll, index)
}


def do_sheet():
    os.makedirs(SHEET_DIR, exist_ok=True)
    mun = r'C:\Windows\SystemResources\imageres.dll.mun'
    shell = r'C:\Windows\SystemResources\shell32.dll.mun'
    make_sheet(mun, 0, 200, 10, 72, os.path.join(SHEET_DIR, 'imageres_0_200.png'))
    make_sheet(mun, 200, 200, 10, 72, os.path.join(SHEET_DIR, 'imageres_200_400.png'))
    make_sheet(shell, 0, 120, 10, 72, os.path.join(SHEET_DIR, 'shell32_0_120.png'))
    make_sheet(mun, 400, 200, 10, 72, os.path.join(SHEET_DIR, 'imageres_400_600.png'))
    make_sheet(mun, 600, 200, 10, 72, os.path.join(SHEET_DIR, 'imageres_600_800.png'))


# ---------------------------------------------------------------------------
# 通过 IShellItemImageFactory 取「资源管理器实际使用的图标」（256px，带 alpha）
# ---------------------------------------------------------------------------

ole32 = ctypes.OleDLL('ole32')
shell32 = ctypes.OleDLL('shell32')


class GUID(ctypes.Structure):
    _fields_ = [
        ('Data1', ctypes.c_ulong),
        ('Data2', ctypes.c_ushort),
        ('Data3', ctypes.c_ushort),
        ('Data4', ctypes.c_ubyte * 8),
    ]


def guid(text):
    text = text.strip('{}')
    p = text.split('-')
    g = GUID()
    g.Data1 = int(p[0], 16)
    g.Data2 = int(p[1], 16)
    g.Data3 = int(p[2], 16)
    rest = bytes.fromhex(p[3] + p[4])
    for i in range(8):
        g.Data4[i] = rest[i]
    return g


class SIZE(ctypes.Structure):
    _fields_ = [('cx', ctypes.c_long), ('cy', ctypes.c_long)]


SHCreateItemFromParsingName = shell32.SHCreateItemFromParsingName
SHCreateItemFromParsingName.argtypes = [
    wintypes.LPCWSTR, ctypes.c_void_p, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)
]
SHCreateItemFromParsingName.restype = ctypes.c_long

IID_IShellItemImageFactory = guid('{bcc18b79-ba16-442f-80c4-8a59c30c463b}')
SIIGBF_BIGGERSIZEOK = 0x1
SIIGBF_ICONONLY = 0x4
SIIGBF_SCALEUP = 0x100


def shell_icon(path, size=256):
    ole32.CoInitialize(None)
    pitem = ctypes.c_void_p()
    hr = SHCreateItemFromParsingName(path, None, ctypes.byref(IID_IShellItemImageFactory), ctypes.byref(pitem))
    if hr != 0 or not pitem:
        return None
    hbm = wintypes.HBITMAP()
    try:
        vtbl = ctypes.cast(pitem, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        GetImage = ctypes.WINFUNCTYPE(
            ctypes.c_long, ctypes.c_void_p, SIZE, ctypes.c_uint, ctypes.POINTER(wintypes.HBITMAP)
        )(vtbl[3])
        hr = GetImage(pitem, SIZE(size, size), SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK | SIIGBF_SCALEUP,
                      ctypes.byref(hbm))
        if hr != 0 or not hbm.value:
            return None
        bm = BITMAP()
        if not GetObjectW(hbm, ctypes.sizeof(BITMAP), ctypes.byref(bm)):
            return None
        w, h = bm.bmWidth, bm.bmHeight
        bi = BITMAPINFO()
        bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bi.bmiHeader.biWidth = w
        bi.bmiHeader.biHeight = -h
        bi.bmiHeader.biPlanes = 1
        bi.bmiHeader.biBitCount = 32
        bi.bmiHeader.biCompression = 0
        buf = ctypes.create_string_buffer(w * h * 4)
        hdc = CreateCompatibleDC(None)
        SelectObject(hdc, hbm)
        GetDIBits(hdc, hbm, 0, h, buf, ctypes.byref(bi), 0)
        DeleteDC(hdc)
        src = bytearray(buf.raw)
        out = bytearray(len(src))
        for i in range(0, len(src), 4):
            b, g, r, a = src[i], src[i + 1], src[i + 2], src[i + 3]
            if a and a < 255:
                b = min(255, b * 255 // a)
                g = min(255, g * 255 // a)
                r = min(255, r * 255 // a)
            out[i] = r
            out[i + 1] = g
            out[i + 2] = b
            out[i + 3] = a
        return w, h, bytes(out)
    finally:
        if hbm.value:
            DeleteObject(hbm)
        vtbl = ctypes.cast(pitem, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        release = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vtbl[2])
        release(pitem)
        ole32.CoUninitialize()


SHELL_TARGETS = [
    ('this-pc', '::{20D04FE0-3AEA-1069-A2D8-08002B30309D}'),
    ('recycle-bin', '::{645FF040-5081-101B-9F08-00AA002F954E}'),
    ('network', '::{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}'),
    ('explorer', r'C:\Windows\explorer.exe'),
    ('edge', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),
    ('notepad', r'C:\Windows\System32\notepad.exe'),
    ('cmd', r'C:\Windows\System32\cmd.exe'),
    ('paint', r'C:\Windows\System32\mspaint.exe'),
    ('calc', r'C:\Windows\System32\calc.exe'),
    ('settings', r'C:\Windows\ImmersiveControlPanel\SystemSettings.exe'),
    ('folder', r'C:\Users\Public\Documents'),
    ('user', r'C:\Users\gzh17'),
    ('pictures', r'C:\Users\gzh17\Pictures'),
    ('downloads', r'C:\Users\gzh17\Downloads'),
    ('store', 'shell:AppsFolder\\Microsoft.WindowsStore_8wekyb3d8bbwe!App'),
    ('photos', 'shell:AppsFolder\\Microsoft.Windows.Photos_8wekyb3d8bbwe!App'),
    ('mail', 'shell:AppsFolder\\microsoft.windowscommunicationsapps_8wekyb3d8bbwe!microsoft.windowslive.mail'),
    ('music', 'shell:AppsFolder\\Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic'),
    ('video', 'shell:AppsFolder\\Microsoft.ZuneVideo_8wekyb3d8bbwe!Microsoft.ZuneVideo'),
    ('calc-uwp', 'shell:AppsFolder\\Microsoft.WindowsCalculator_8wekyb3d8bbwe!App'),
    ('settings-uwp', 'shell:AppsFolder\\windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel'),
]


# 资源管理器里「本地磁盘」不是取 C:\ 的 shell 图标（那样只会拿到未知文件白纸图），
# 而是 imageres.dll 的固定索引：30 = 银灰立体硬盘（无 logo），31 = 硬盘 + Windows logo。
INDEX_TARGETS = [
    ('drive', 'imageres', 30),
]


def do_shell():
    os.makedirs(OUT_DIR, exist_ok=True)
    tray_dir = os.path.join(ROOT, 'assets', 'tray')
    os.makedirs(tray_dir, exist_ok=True)

    mun = r'C:\Windows\SystemResources\imageres.dll.mun'
    for name, _src, idx in INDEX_TARGETS:
        res = extract(mun, idx, 256)
        if not res:
            print(f'  fail {name}')
            continue
        w, h, rgba = res
        write_png(os.path.join(OUT_DIR, name + '.png'), w, h, rgba)
        write_png(os.path.join(tray_dir, name + '.png'), 64, 64, scale(w, h, rgba, 64, 64))
        print(f'  ok   {name}  imageres#{idx}  {w}x{h}')

    for name, target in SHELL_TARGETS:
        if not (target.startswith('::{') or target.startswith('shell:') or os.path.exists(target)):
            print(f'  skip {name}: 路径不存在')
            continue
        res = shell_icon(target, 256)
        if not res:
            print(f'  fail {name}')
            continue
        w, h, rgba = res
        write_png(os.path.join(OUT_DIR, name + '.png'), w, h, rgba)
        t64 = scale(w, h, rgba, 64, 64)
        write_png(os.path.join(tray_dir, name + '.png'), 64, 64, t64)
        print(f'  ok   {name}  {w}x{h}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'sheet'
    if cmd == 'sheet':
        do_sheet()
    elif cmd == 'shell':
        do_shell()
