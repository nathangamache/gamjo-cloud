"""Image processing utilities for generating optimized versions.
pip install Pillow --break-system-packages
"""
import os
from PIL import Image, ExifTags

THUMB_SIZE = 400       # px max dimension for gallery grid thumbnails
DISPLAY_SIZE = 1200    # px max dimension for lightbox display
JPEG_QUALITY_THUMB = 70
JPEG_QUALITY_DISPLAY = 82


def _fix_orientation(img):
    """Rotate image based on EXIF orientation tag."""
    try:
        exif = img.getexif()
        orientation_key = None
        for k, v in ExifTags.TAGS.items():
            if v == 'Orientation':
                orientation_key = k
                break
        if orientation_key and orientation_key in exif:
            orientation = exif[orientation_key]
            if orientation == 3:
                img = img.rotate(180, expand=True)
            elif orientation == 6:
                img = img.rotate(270, expand=True)
            elif orientation == 8:
                img = img.rotate(90, expand=True)
    except Exception:
        pass
    return img


def generate_variants(original_path, trip_id, media_id, upload_dir="uploads"):
    """
    Generate thumbnail and display versions of an uploaded image.
    
    Returns:
        dict with keys: thumbnail_url, display_url, original_url
        All paths relative for serving (e.g., /uploads/media/{trip_id}/thumb_xxx.jpg)
    """
    result = {
        "thumbnail_url": None,
        "display_url": None,
    }
    
    try:
        img = Image.open(original_path)
    except Exception:
        return result
    
    img = _fix_orientation(img)
    
    # Convert RGBA/palette to RGB for JPEG output
    if img.mode in ('RGBA', 'P', 'LA'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    w, h = img.size
    media_dir = f"{upload_dir}/media/{trip_id}"
    os.makedirs(media_dir, exist_ok=True)
    
    # Generate thumbnail (only if image is larger than thumb size)
    if max(w, h) > THUMB_SIZE:
        thumb = img.copy()
        thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
        thumb_filename = f"thumb_{media_id}.jpg"
        thumb_path = f"{media_dir}/{thumb_filename}"
        thumb.save(thumb_path, "JPEG", quality=JPEG_QUALITY_THUMB, optimize=True)
        result["thumbnail_url"] = f"/uploads/media/{trip_id}/{thumb_filename}"
    
    # Generate display version (only if image is larger than display size)
    if max(w, h) > DISPLAY_SIZE:
        display = img.copy()
        display.thumbnail((DISPLAY_SIZE, DISPLAY_SIZE), Image.LANCZOS)
        display_filename = f"disp_{media_id}.jpg"
        display_path = f"{media_dir}/{display_filename}"
        display.save(display_path, "JPEG", quality=JPEG_QUALITY_DISPLAY, optimize=True)
        result["display_url"] = f"/uploads/media/{trip_id}/{display_filename}"
    
    return result


def cleanup_variants(original_url, upload_dir="uploads"):
    """Delete thumbnail and display variants when original is deleted."""
    if not original_url:
        return
    
    # Derive variant paths from original URL
    directory = os.path.dirname(original_url.lstrip("/"))
    basename = os.path.basename(original_url)
    media_id_part = os.path.splitext(basename)[0]  # uuid part
    
    for prefix in ["thumb_", "disp_"]:
        variant_path = os.path.join(directory, f"{prefix}{media_id_part}.jpg")
        if os.path.exists(variant_path):
            os.remove(variant_path)