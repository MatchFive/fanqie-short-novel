"""
桌面应用启动器 - 使用系统 WebView 窗口
- 启动 FastAPI 后端（或复用已有实例）
- 打开原生桌面窗口加载前端页面
- 管理应用生命周期

依赖: pip install pywebview
"""

import sys
import os
import time
import threading
import subprocess
from pathlib import Path

# 修复 Windows 控制台编码 + GUI 模式兼容
# PyInstaller --windowed 打包后 sys.stdout/stderr 为 None，
# 但 uvicorn/logging 需要它们支持 .write() 和 .isatty()
if sys.platform == 'win32':
    if sys.stdout is None or sys.stdout is open(os.devnull, 'w', encoding='utf-8'):
        pass  # 在下面统一处理日志文件
    elif hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if sys.stderr is None or sys.stderr is open(os.devnull, 'w', encoding='utf-8'):
        pass
    elif hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')


# 项目根目录
if getattr(sys, 'frozen', False):
    PROJECT_ROOT = Path(sys.executable).parent          # 可写数据目录（exe 旁）
    RESOURCE_ROOT = Path(sys._MEIPASS)                   # 只读资源（打包内）  # type: ignore
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent
    RESOURCE_ROOT = PROJECT_ROOT

# 确保后端路径在 sys.path 中
sys.path.insert(0, str(Path(__file__).resolve().parent))

BACKEND_PORT = 8001
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"

# 桌面窗口图标（任务栏/标题栏）
ICON_PATH = str(RESOURCE_ROOT / "assets" / "app-icon.ico")

# ===== 首次启动自动初始化 =====
LOG_DIR = PROJECT_ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# GUI 模式下 stdout/stderr 为 None → 重定向到日志文件，便于排查问题
LOG_PATH = LOG_DIR / "desktop.log"
if sys.platform == 'win32':
    _log_file = open(str(LOG_PATH), 'a', encoding='utf-8', buffering=1)
    if sys.stdout is None:
        sys.stdout = _log_file
    if sys.stderr is None:
        sys.stderr = _log_file

# .env 自动创建（首次启动时写入默认模板）
_ENV_PATH = PROJECT_ROOT / ".env"
if not _ENV_PATH.exists():
    _ENV_PATH.write_text(
        '# 番茄短篇 - LLM 配置\n'
        '# 在此文件中设置你的 API Key 后重新启动应用\n'
        '# 也可以在应用内「设置」页面中配置\n\n'
        'LLM_BASE_URL="https://api.deepseek.com"\n'
        'LLM_API_KEY=""\n'
        'LLM_MODEL="deepseek-v4-flash"\n'
        'LLM_TEMPERATURE=0.7\n'
        'LLM_MAX_TOKENS=4000\n',
        encoding='utf-8'
    )
    print(f"[INIT] 已创建默认 .env 配置文件: {_ENV_PATH}")



def check_port_in_use(port: int) -> bool:
    """检测端口是否已被占用"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
            return False
        except OSError:
            return True


def is_backend_alive() -> bool:
    """检测后端是否已运行"""
    import urllib.request
    try:
        resp = urllib.request.urlopen(f"{BACKEND_URL}/health", timeout=2)
        return resp.status == 200
    except Exception:
        return False


def check_frontend_built():
    """检查前端是否已构建（打包模式下仅检查，不应出现此情况）"""
    dist_dir = RESOURCE_ROOT / "frontend" / "dist"
    index_html = dist_dir / "index.html"
    if not index_html.exists():
        # 打包后 node/npm 不可用，直接报错
        if getattr(sys, 'frozen', False):
            print("[FAIL] 前端资源缺失：frontend/dist/")
            print("  请确保打包时已包含前端构建产物")
            return False

        print("=" * 50)
        print("[!] 前端未构建，正在自动构建...")
        print("=" * 50)
        try:
            subprocess.run(
                ["npm", "run", "build"],
                cwd=str(PROJECT_ROOT / "frontend"),
                check=True,
                shell=True,
            )
            print("[OK] 前端构建完成")
        except subprocess.CalledProcessError:
            print("[FAIL] 前端构建失败")
            print("  请手动执行: cd frontend && npm run build")
            return False
    return True


def start_backend():
    """在后台线程启动 FastAPI 后端"""
    # 如果已在运行，直接复用
    if is_backend_alive():
        print(f"[OK] 后端服务已运行 ({BACKEND_URL})")
        return True

    import uvicorn
    from app.main import app

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=BACKEND_PORT,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)

    def run():
        server.run()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    # 等待后端就绪
    import urllib.request
    for i in range(30):
        try:
            resp = urllib.request.urlopen(f"{BACKEND_URL}/health")
            if resp.status == 200:
                print(f"[OK] 后端服务已就绪 ({BACKEND_URL})")
                return True
        except Exception:
            pass
        time.sleep(0.5)

    print("[FAIL] 后端服务启动超时")
    return False


def launch_desktop():
    """主入口：启动桌面应用"""
    print("\n" + "=" * 50)
    print("  番茄短篇 - AI 短篇小说创作助手")
    print("  桌面版 v1.0")
    print("=" * 50 + "\n")

    # 检查前端是否构建
    if not check_frontend_built():
        print("\n按 Enter 退出...")
        input()
        return

    # 启动/连接后端
    if not start_backend():
        print("\n按 Enter 退出...")
        input()
        return

    # 打开桌面窗口
    print("正在启动桌面窗口...")
    try:
        import webview
    except ImportError:
        print("\n[FAIL] 缺少 pywebview 库")
        print("  请执行: pip install pywebview")
        print("\n按 Enter 退出...")
        input()
        return

    # 创建窗口
    webview.create_window(
        title="番茄短篇 - AI 短篇小说创作",
        url=BACKEND_URL,
        width=1280,
        height=860,
        min_size=(960, 640),
        resizable=True,
        fullscreen=False,
        easy_drag=True,
        text_select=True,
    )


    # 启动事件循环（icon 参数仅 GTK/QT 生效，Windows 图标由 exe 打包时设置）
    webview.start(
        debug=False,
        http_server=False,
        gui="edgechromium",
        icon=ICON_PATH if Path(ICON_PATH).exists() else None,
    )

    print("应用已退出")


if __name__ == "__main__":
    launch_desktop()
