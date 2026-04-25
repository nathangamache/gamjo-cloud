"""Add thumbnail_url and display_url columns to media table."""
import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    async with engine.begin() as conn:
        for col in ["thumbnail_url", "display_url"]:
            result = await conn.execute(text(f"""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = '{col}'
            """))
            if result.fetchone():
                print(f"  {col} already exists")
            else:
                await conn.execute(text(f"""
                    ALTER TABLE media ADD COLUMN {col} VARCHAR(500)
                """))
                print(f"  Added {col} column")
        print("Done: media image optimization columns ready")

if __name__ == "__main__":
    asyncio.run(migrate())