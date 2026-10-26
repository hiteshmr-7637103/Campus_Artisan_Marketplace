import io
import uuid
from pathlib import Path

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from ..config import get_settings

MAX_BYTES = 2 * 1024 * 1024
ALLOWED = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
Image.MAX_IMAGE_PIXELS = 25_000_000

_cloudinary_configured = False


def _ensure_cloudinary_configured() -> None:
    global _cloudinary_configured
    if _cloudinary_configured:
        return
    s = get_settings()
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
        secure=True,
    )
    _cloudinary_configured = True


def save_image(file: UploadFile, user_id: uuid.UUID) -> str:
    """Validates by actually decoding with Pillow (not extension/Content-Type). Returns the stored path/public_id."""
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

    settings = get_settings()
    if settings.image_storage_provider == "cloudinary":
        _ensure_cloudinary_configured()
        result = cloudinary.uploader.upload(
            data,
            folder=str(user_id),
            public_id=uuid.uuid4().hex,
            resource_type="image",
        )
        return result["public_id"]

    rel = f"{user_id}/{uuid.uuid4().hex}{ALLOWED[fmt]}"
    path = Path(settings.upload_dir) / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel


def delete_image(rel: str) -> None:
    local_path = Path(get_settings().upload_dir) / rel
    if local_path.is_file():
        try:
            local_path.unlink(missing_ok=True)
        except OSError:
            pass
        return
    if get_settings().image_storage_provider == "cloudinary":
        _ensure_cloudinary_configured()
        try:
            cloudinary.uploader.destroy(rel, resource_type="image")
        except Exception:
            pass


def image_url(rel: str) -> str:
    if rel.startswith("http://") or rel.startswith("https://") or rel.startswith("data:"):
        return rel
    if (Path(get_settings().upload_dir) / rel).is_file():
        return f"{get_settings().public_api_url.rstrip('/')}/uploads/{rel}"
    if get_settings().image_storage_provider == "cloudinary":
        _ensure_cloudinary_configured()
        return cloudinary.CloudinaryImage(rel).build_url(secure=True)
    return f"{get_settings().public_api_url.rstrip('/')}/uploads/{rel}"
