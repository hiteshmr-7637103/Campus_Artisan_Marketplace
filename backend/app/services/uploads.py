import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from ..config import get_settings

MAX_BYTES = 2 * 1024 * 1024
ALLOWED = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
Image.MAX_IMAGE_PIXELS = 25_000_000


def save_image(file: UploadFile, user_id: uuid.UUID) -> str:
    """Validates by actually decoding with Pillow (not extension/Content-Type). Returns the relative storage path."""
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image must be 2 MB or smaller")
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
            img.verify()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError):
        raise HTTPException(400, "File is not a valid image") from None
    if fmt not in ALLOWED:
        raise HTTPException(400, "Only JPEG, PNG or WebP images are allowed")
    rel = f"{user_id}/{uuid.uuid4().hex}{ALLOWED[fmt]}"
    path = Path(get_settings().upload_dir) / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel


def delete_image(rel: str) -> None:
    try:
        (Path(get_settings().upload_dir) / rel).unlink(missing_ok=True)
    except OSError:
        pass


def image_url(rel: str) -> str:
    return f"{get_settings().public_api_url.rstrip('/')}/uploads/{rel}"
