import argparse
import json
import os
from pathlib import Path

import dashscope
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_IMAGE = BACKEND_DIR.parent / "demo-assets" / "virtual-tryon-base-portrait.png"


def print_result(response) -> int:
    status_code = int(getattr(response, "status_code", 0) or 0)
    result = {
        "status_code": status_code,
        "request_id": getattr(response, "request_id", None),
        "code": getattr(response, "code", None),
        "message": getattr(response, "message", None),
        "usable": status_code == 200,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if status_code == 200 else 1


def check_auth() -> int:
    response = dashscope.Generation.call(
        model="qwen-plus",
        prompt="只回复 OK",
        result_format="message",
    )
    return print_result(response)


def check_multimodal(image_path: Path) -> int:
    if not image_path.is_file():
        print(json.dumps({"usable": False, "message": f"测试图片不存在：{image_path}"}, ensure_ascii=False, indent=2))
        return 2

    response = dashscope.MultiModalConversation.call(
        model="qwen3.5-omni-plus",
        messages=[
            {
                "role": "user",
                "content": [
                    {"image": image_path.resolve().as_uri()},
                    {"text": "只回复 OK"},
                ],
            }
        ],
    )
    return print_result(response)


def main() -> int:
    parser = argparse.ArgumentParser(description="Safely verify DashScope credentials without printing the API key.")
    parser.add_argument("--mode", choices=("auth", "multimodal"), default="auth")
    parser.add_argument("--image", type=Path, default=DEFAULT_IMAGE)
    args = parser.parse_args()

    load_dotenv(BACKEND_DIR / ".env")
    api_key = os.getenv("DASHSCOPE_API_KEY") or os.getenv("ALIYUN_API_KEY") or ""
    base_url = os.getenv("DASHSCOPE_BASE_HTTP_API_URL", "https://dashscope.aliyuncs.com/api/v1").rstrip("/")

    key_summary = {
        "configured": bool(api_key),
        "looks_like_model_studio_key": api_key.startswith("sk-"),
        "length": len(api_key),
        "base_http_api_url": base_url,
        "mode": args.mode,
    }
    print(json.dumps(key_summary, ensure_ascii=False, indent=2))
    if not api_key:
        print("未检测到 API Key。请先配置 backend/.env。")
        return 2

    dashscope.api_key = api_key
    dashscope.base_http_api_url = base_url

    try:
        return check_auth() if args.mode == "auth" else check_multimodal(args.image)
    except Exception as error:
        print(json.dumps({"usable": False, "exception": str(error)}, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
