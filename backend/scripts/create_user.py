"""Script to create or update a user for testing."""
import asyncio
import sys

sys.path.insert(0, ".")

from app.db.session import AsyncSessionLocal
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService


async def main(email: str, username: str, password: str, role: str = "leitor") -> None:
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)

        existing = await repo.get_by_email(email)
        if existing:
            existing.role = role
            await session.commit()
            print(f"User {email} already exists. Role updated to '{role}'.")
            return

        hashed = AuthService.hash_password(password)
        user = await repo.create(email=email, username=username, hashed_password=hashed, role=role)
        await session.commit()
        print(f"User created: id={user.id} email={user.email} role={user.role}")


if __name__ == "__main__":
    asyncio.run(
        main(
            email=sys.argv[1] if len(sys.argv) > 1 else "admin@bagaggio.com",
            username=sys.argv[2] if len(sys.argv) > 2 else "admin",
            password=sys.argv[3] if len(sys.argv) > 3 else "admin123",
            role=sys.argv[4] if len(sys.argv) > 4 else "leitor",
        )
    )
