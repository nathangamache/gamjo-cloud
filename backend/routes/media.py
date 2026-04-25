"""Updated media routes.
Replace backend/routes/media.py with this file.
Adds: PUT/PATCH metadata update, DELETE, uploaded_by_name in response.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
import os, shutil, json
try:
    from utils.image_processing import generate_variants, cleanup_variants
except ImportError:
    generate_variants = None
    cleanup_variants = None
from database import get_db
from models.models import Media, User
from utils.deps import get_current_user
from routes.trips import get_trip_for_user, is_admin

router = APIRouter(prefix="/trips/{trip_id}/media", tags=["media"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")


async def serialize_media(m: Media, db: AsyncSession) -> dict:
    """Serialize media with uploaded_by_name and optimized image URLs."""
    # Get uploader name
    uploader_name = None
    user_id = getattr(m, 'user_id', None) or getattr(m, 'uploaded_by', None)
    if user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        uploader = result.scalar_one_or_none()
        if uploader:
            uploader_name = uploader.name
    
    # Parse metadata
    metadata = {}
    if hasattr(m, 'metadata_json') and m.metadata_json:
        try:
            metadata = json.loads(m.metadata_json) if isinstance(m.metadata_json, str) else m.metadata_json
        except (json.JSONDecodeError, TypeError):
            pass
    
    original_url = getattr(m, 'file_url', None) or getattr(m, 'url', None)
    
    # Read thumbnail/display URLs via raw SQL (columns may not be on ORM model)
    thumbnail_url = getattr(m, 'thumbnail_url', None)
    display_url = getattr(m, 'display_url', None)
    if thumbnail_url is None and display_url is None:
        try:
            row = await db.execute(
                text("SELECT thumbnail_url, display_url FROM media WHERE id = :mid"),
                {"mid": str(m.id)}
            )
            r = row.fetchone()
            if r:
                thumbnail_url = r[0]
                display_url = r[1]
        except Exception:
            pass

    return {
        "id": m.id,
        "url": display_url or original_url,
        "thumbnail_url": thumbnail_url or display_url or original_url,
        "original_url": original_url,
        "caption": getattr(m, 'caption', None) or metadata.get('caption'),
        "date": str(getattr(m, 'date', None) or metadata.get('date', '')) or None,
        "location": getattr(m, 'location', None) or metadata.get('location'),
        "uploaded_by": user_id,
        "user_id": user_id,
        "uploaded_by_name": uploader_name,
        "created_at": str(m.created_at) if hasattr(m, 'created_at') and m.created_at else None,
    }


@router.get("")
async def list_media(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all media for a trip."""
    await get_trip_for_user(trip_id, user, db)
    
    result = await db.execute(
        select(Media).where(Media.trip_id == trip_id)
        .order_by(Media.created_at.desc() if hasattr(Media, 'created_at') else Media.id.desc())
    )
    media = result.scalars().all()
    return [await serialize_media(m, db) for m in media]


@router.post("")
async def upload_media(
    trip_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a photo to the trip."""
    await get_trip_for_user(trip_id, user, db)
    
    os.makedirs(f"{UPLOAD_DIR}/media/{trip_id}", exist_ok=True)
    media_id = uuid4()
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{media_id}{ext}"
    filepath = f"{UPLOAD_DIR}/media/{trip_id}/{filename}"
    
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    url = f"/uploads/media/{trip_id}/{filename}"
    
    # Generate optimized thumbnail and display versions
    thumbnail_url = None
    display_url = None
    if generate_variants:
        try:
            variants = generate_variants(filepath, str(trip_id), str(media_id), UPLOAD_DIR)
            thumbnail_url = variants.get("thumbnail_url")
            display_url = variants.get("display_url")
        except Exception as e:
            print(f"Image variant generation failed: {e}")
    
    # Create media record - handle different model field names
    media_data = {
        "id": media_id,
        "trip_id": trip_id,
    }
    
    m = Media(**media_data)
    
    # Set URL field (could be 'url' or 'file_url')
    if hasattr(m, 'url'):
        m.url = url
    elif hasattr(m, 'file_url'):
        m.file_url = url
    
    # Set user field (could be 'user_id' or 'uploaded_by')
    if hasattr(m, 'user_id'):
        m.user_id = user.id
    elif hasattr(m, 'uploaded_by'):
        m.uploaded_by = user.id
    
    # Set caption from filename
    if hasattr(m, 'caption'):
        m.caption = file.filename.rsplit('.', 1)[0] if file.filename else "Photo"
    
    db.add(m)
    await db.commit()
    await db.refresh(m)
    
    # Set optimized image URLs via raw SQL (columns may not be on ORM model)
    if thumbnail_url or display_url:
        # text already imported at top
        updates = []
        params = {"mid": str(media_id)}
        if thumbnail_url:
            updates.append("thumbnail_url = :thumb")
            params["thumb"] = thumbnail_url
        if display_url:
            updates.append("display_url = :disp")
            params["disp"] = display_url
        if updates:
            try:
                await db.execute(
                    text(f"UPDATE media SET {', '.join(updates)} WHERE id = :mid"),
                    params
                )
                await db.commit()
            except Exception as e:
                print(f"Failed to save image variant URLs: {e}")
    
    return await serialize_media(m, db)


@router.put("/{media_id}")
@router.patch("/{media_id}")
async def update_media(
    trip_id: UUID,
    media_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update media metadata (caption, date, location). Owner only."""
    await get_trip_for_user(trip_id, user, db)
    
    result = await db.execute(
        select(Media).where(Media.id == media_id, Media.trip_id == trip_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Media not found")
    
    # Check ownership - admin can edit any photo
    owner_id = getattr(m, 'user_id', None) or getattr(m, 'uploaded_by', None)
    admin = await is_admin(trip_id, user, db)
    if owner_id != user.id and not admin:
        raise HTTPException(403, "You can only edit your own photos")
    
    data = await request.json()
    
    # Update direct fields if they exist
    for field in ["caption", "date", "location"]:
        if field in data and hasattr(m, field):
            setattr(m, field, data[field])
    
    # Also update metadata_json if used
    if hasattr(m, 'metadata_json'):
        try:
            metadata = json.loads(m.metadata_json) if m.metadata_json and isinstance(m.metadata_json, str) else (m.metadata_json or {})
        except (json.JSONDecodeError, TypeError):
            metadata = {}
        
        for field in ["caption", "date", "location"]:
            if field in data:
                metadata[field] = data[field]
        
        m.metadata_json = json.dumps(metadata) if isinstance(metadata, dict) else metadata
    
    await db.commit()
    await db.refresh(m)
    return await serialize_media(m, db)


@router.delete("/{media_id}")
async def delete_media(
    trip_id: UUID,
    media_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a photo. Owner only."""
    await get_trip_for_user(trip_id, user, db)
    
    result = await db.execute(
        select(Media).where(Media.id == media_id, Media.trip_id == trip_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Media not found")
    
    owner_id = getattr(m, 'user_id', None) or getattr(m, 'uploaded_by', None)
    admin = await is_admin(trip_id, user, db)
    if owner_id != user.id and not admin:
        raise HTTPException(403, "You can only delete your own photos")
    
    # Delete file from disk
    url = getattr(m, 'file_url', None) or getattr(m, 'url', None)
    if url:
        filepath = url.lstrip("/")
        if os.path.exists(filepath):
            os.remove(filepath)
    
    # Delete optimized variants via raw SQL lookup
    # text already imported at top
    try:
        row = await db.execute(
            text("SELECT thumbnail_url, display_url FROM media WHERE id = :mid"),
            {"mid": str(media_id)}
        )
        r = row.fetchone()
        if r:
            for variant_url in [r[0], r[1]]:
                if variant_url:
                    vpath = variant_url.lstrip("/")
                    if os.path.exists(vpath):
                        os.remove(vpath)
    except Exception:
        pass
    
    await db.delete(m)
    await db.commit()
    return {"message": "Photo deleted"}