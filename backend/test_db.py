import asyncio
from app.database import init_db
from app.models.book import Book

async def main():
    await init_db()
    books = await Book.find_all().to_list()
    for b in books:
        print(f"Title: {b.title}")

asyncio.run(main())
