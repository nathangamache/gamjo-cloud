"""Backfill thumbnails and display versions for existing media.
Run after: add_media_thumbnails.py migration + pip install Pillow --break-system-packages
Usage: python backfill_thumbnails.py
"""
import asyncio
import os
from sqlalchemy import text
from database import engine
from utils.image_processing import generate_variants

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")


async def backfill():
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT id, trip_id, file_url FROM media WHERE file_url IS NOT NULL"
        ))
        rows = result.fetchall()
        
        total = len(rows)
        processed = 0
        skipped = 0
        errors = 0
        
        print(f"Found {total} media records to process")
        
        for row in rows:
            media_id, trip_id, file_url = str(row[0]), str(row[1]), row[2]
            
            if not file_url:
                skipped += 1
                continue
            
            filepath = file_url.lstrip("/")
            if not os.path.exists(filepath):
                print(f"  SKIP {media_id}: file not found ({filepath})")
                skipped += 1
                continue
            
            try:
                variants = generate_variants(filepath, trip_id, media_id, UPLOAD_DIR)
                
                thumb_url = variants.get("thumbnail_url")
                disp_url = variants.get("display_url")
                
                if thumb_url or disp_url:
                    updates = []
                    params = {"mid": media_id}
                    if thumb_url:
                        updates.append("thumbnail_url = :thumb")
                        params["thumb"] = thumb_url
                    if disp_url:
                        updates.append("display_url = :disp")
                        params["disp"] = disp_url
                    
                    await conn.execute(
                        text(f"UPDATE media SET {', '.join(updates)} WHERE id = :mid"),
                        params
                    )
                    processed += 1
                    print(f"  OK {media_id}: thumb={'yes' if thumb_url else 'no'} disp={'yes' if disp_url else 'no'}")
                else:
                    print(f"  SKIP {media_id}: image too small for variants")
                    skipped += 1
            except Exception as e:
                print(f"  ERR {media_id}: {e}")
                errors += 1
        
        print(f"\nDone: {processed} processed, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    asyncio.run(backfill())