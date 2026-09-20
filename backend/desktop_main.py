"""Windows executable entry point for the XieShang competition package."""

from __future__ import annotations

import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

from dotenv import load_dotenv


def executable_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def port_is_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def configure_runtime() -> tuple[str, int, str]:
    root = executable_root()
    data_dir = root / "data"
    upload_dir = data_dir / "uploads"
    data_dir.mkdir(parents=True, exist_ok=True)
    upload_dir.mkdir(parents=True, exist_ok=True)

    load_dotenv(root / ".env", override=False)

    host = os.getenv("BACKEND_HOST", "127.0.0.1") or "127.0.0.1"
    port = int(os.getenv("BACKEND_PORT", "8000") or "8000")
    public_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
    public_url = f"http://{public_host}:{port}"

    if not os.getenv("DATABASE_URL"):
        os.environ["DATABASE_URL"] = f"sqlite:///{(data_dir / 'xieshang.db').as_posix()}"
    os.environ["XIESHANG_UPLOAD_DIR"] = str(upload_dir)
    os.environ["PUBLIC_UPLOAD_BASE_URL"] = f"{public_url}/uploads"

    os.chdir(root)
    return host, port, public_url


def main() -> None:
    host, port, public_url = configure_runtime()
    bind_host = "127.0.0.1" if host in {"0.0.0.0", "::"} else host
    if not port_is_available(bind_host, port):
        print(f"启动失败：端口 {port} 已被占用。请关闭占用程序，或在程序旁的 .env 中修改 BACKEND_PORT。")
        raise SystemExit(1)

    import uvicorn
    from app.main import app

    print("=" * 56)
    print("偕裳 XieShang 已启动")
    print(f"访问地址：{public_url}")
    print("关闭本窗口或按 Ctrl+C 可停止程序")
    print("=" * 56)

    opener = threading.Timer(1.2, lambda: webbrowser.open(public_url))
    opener.daemon = True
    opener.start()
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
