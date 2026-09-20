import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx


UPLOAD_DIR = os.getenv("XIESHANG_UPLOAD_DIR", "uploads")
PUBLIC_UPLOAD_BASE_URL = os.getenv("PUBLIC_UPLOAD_BASE_URL", "http://localhost:8000/uploads").rstrip("/")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
CONTENT_TYPE_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def is_placeholder_url(url: str | None) -> bool:
    return bool(url and "mock-oss.com" in url.lower())


def usable_media_url(url: str | None) -> str | None:
    if not url or is_placeholder_url(url):
        return None
    return url


async def persist_remote_image(url: str, prefix: str) -> str:
    """Download a generated remote image so persisted records do not depend on expiring URLs."""
    if not url or url.startswith("/") or "/uploads/" in url:
        return url

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return url

    timeout = httpx.Timeout(60.0, connect=20.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
    suffix = Path(parsed.path).suffix.lower()
    if suffix not in IMAGE_SUFFIXES:
        suffix = CONTENT_TYPE_SUFFIXES.get(content_type, ".png")
    if content_type and not content_type.startswith("image/"):
        raise ValueError(f"生成结果不是图片类型：{content_type}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_prefix = re.sub(r"[^a-zA-Z0-9_-]+", "_", prefix).strip("_") or "generated"
    filename = f"{safe_prefix}_{uuid.uuid4().hex[:10]}{suffix}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as output:
        output.write(response.content)
    return f"{PUBLIC_UPLOAD_BASE_URL}/{filename}"
