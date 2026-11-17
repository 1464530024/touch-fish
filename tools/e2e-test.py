"""touch fish 打包版端到端自测

流程：启动 dist/win-unpacked/touch fish.exe -> 等待托盘就绪
      -> 注入 Ctrl Ctrl（keybd_event）-> 全屏截图（应为虚拟桌面）
      -> 再注入 Ctrl Ctrl              -> 全屏截图（应回到真实桌面）
      -> 结束进程

用法： python tools/e2e-test.py
输出： e2e-virtual.png / e2e-real.png / e2e.log
"""
import ctypes
import ctypes.wintypes as wt
import os
import struct
import subprocess
import sys
import time
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# 默认测免安装目录；也可传入已安装版本的 exe 路径
EXE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "win-unpacked", "touch fish.exe")
LOG = os.path.join(ROOT, "e2e.log")

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

gdi32.CreateCompatibleDC.argtypes = [wt.HDC]
gdi32.CreateCompatibleDC.restype = wt.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wt.HDC, ctypes.c_int, ctypes.c_int]
gdi32.CreateCompatibleBitmap.restype = wt.HBITMAP
gdi32.SelectObject.argtypes = [wt.HDC, wt.HGDIOBJ]
gdi32.SelectObject.restype = wt.HGDIOBJ
gdi32.BitBlt.argtypes = [wt.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                         wt.HDC, ctypes.c_int, ctypes.c_int, wt.DWORD]
gdi32.GetDIBits.argtypes = [wt.HDC, wt.HBITMAP, wt.UINT, wt.UINT, ctypes.c_void_p,
                            ctypes.c_void_p, wt.UINT]
gdi32.DeleteObject.argtypes = [wt.HGDIOBJ]
gdi32.DeleteDC.argtypes = [wt.HDC]
user32.GetDC.argtypes = [wt.HWND]
user32.GetDC.restype = wt.HDC
user32.ReleaseDC.argtypes = [wt.HWND, wt.HDC]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [("biSize", wt.DWORD), ("biWidth", ctypes.c_long), ("biHeight", ctypes.c_long),
                ("biPlanes", wt.WORD), ("biBitCount", wt.WORD), ("biCompression", wt.DWORD),
                ("biSizeImage", wt.DWORD), ("biXPelsPerMeter", ctypes.c_long),
                ("biYPelsPerMeter", ctypes.c_long), ("biClrUsed", wt.DWORD),
                ("biClrImportant", wt.DWORD)]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", wt.DWORD * 3)]


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 6))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def grab(path):
    w = user32.GetSystemMetrics(78)
    h = user32.GetSystemMetrics(79)
    x = user32.GetSystemMetrics(76)
    y = user32.GetSystemMetrics(77)
    screen = user32.GetDC(0)
    mem = gdi32.CreateCompatibleDC(screen)
    bmp = gdi32.CreateCompatibleBitmap(screen, w, h)
    gdi32.SelectObject(mem, bmp)
    gdi32.BitBlt(mem, 0, 0, w, h, screen, x, y, 0x00CC0020)  # SRCCOPY

    bi = BITMAPINFO()
    bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.bmiHeader.biWidth = w
    bi.bmiHeader.biHeight = -h  # 自上而下
    bi.bmiHeader.biPlanes = 1
    bi.bmiHeader.biBitCount = 32
    bi.bmiHeader.biCompression = 0  # BI_RGB

    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bi), 0)
    data = bytearray(buf.raw)
    # BGRA -> RGBA
    data[0::4], data[2::4] = data[2::4], data[0::4]
    data[3::4] = b"\xff" * (w * h)

    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(mem)
    user32.ReleaseDC(0, screen)
    write_png(path, w, h, bytes(data))
    return w, h


VK_CONTROL = 0x11
KEYEVENTF_KEYUP = 0x0002


def tap_ctrl():
    user32.keybd_event(VK_CONTROL, 0, 0, 0)
    time.sleep(0.04)
    user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.06)


def double_ctrl():
    tap_ctrl()
    time.sleep(0.08)
    tap_ctrl()


def main():
    if not os.path.exists(EXE):
        print(f"未找到 {EXE}")
        return 1
    if os.path.exists(LOG):
        os.remove(LOG)
    log("启动打包版：%s" % EXE)
    # 宿主流入的 ELECTRON_RUN_AS_NODE 会让 exe 以 Node 模式启动并秒退，必须剥离
    env = {k: v for k, v in os.environ.items() if k.upper() != "ELECTRON_RUN_AS_NODE"}
    proc = subprocess.Popen([EXE], cwd=os.path.dirname(EXE), env=env)
    log("pid=%d，等待 4.5s 让托盘与键盘钩子就绪" % proc.pid)
    time.sleep(4.5)

    log("注入 双击 Ctrl -> 期望进入虚拟桌面")
    double_ctrl()
    time.sleep(1.8)
    w, h = grab(os.path.join(ROOT, "e2e-virtual.png"))
    log("已截图 e2e-virtual.png (%dx%d)" % (w, h))

    log("再次注入 双击 Ctrl -> 期望回到真实桌面")
    double_ctrl()
    time.sleep(1.8)
    w, h = grab(os.path.join(ROOT, "e2e-real.png"))
    log("已截图 e2e-real.png (%dx%d)" % (w, h))

    log("关闭进程 pid=%d" % proc.pid)
    subprocess.run(["taskkill", "/F", "/PID", str(proc.pid)],
                   capture_output=True, shell=False)
    log("完成")
    return 0


if __name__ == "__main__":
    sys.exit(main())
