"""
开发期启动器：剥离宿主环境注入的 ELECTRON_RUN_AS_NODE，确保以真正的 Electron 模式运行。
用法：
    python tools/run.py .              # 等同 npm start
    python tools/run.py . --smoke      # 自动截图自检
    python tools/run.py tools/render-icons.js
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXE = os.path.join(ROOT, "node_modules", "electron", "dist", "electron.exe")

if not os.path.exists(EXE):
    print("找不到 Electron，请先 npm install")
    sys.exit(1)

env = {k: v for k, v in os.environ.items() if k.upper() != "ELECTRON_RUN_AS_NODE"}
args = [EXE] + (sys.argv[1:] or ["."])
sys.exit(subprocess.run(args, cwd=ROOT, env=env).returncode)
