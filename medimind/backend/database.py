"""Database setup (SQLite) + lightweight auto-migration.

The migration step adds any new columns to an existing `medicine.db`, so data
created by older versions of MediMind keeps working.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./medicine.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# column name -> SQL type, added when missing from an older database
_NEW_COLUMNS = {
    "status": "VARCHAR DEFAULT 'Pending'",
    "status_date": "VARCHAR",
    "snoozed_until": "VARCHAR",
    "image_url": "TEXT",
    "notes": "VARCHAR",
}


_FAMILY_NEW_COLUMNS = {"photo": "TEXT", "pin": "VARCHAR"}


def run_migrations() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    plan = (("medicines", _NEW_COLUMNS), ("family_members", _FAMILY_NEW_COLUMNS))
    with engine.begin() as conn:
        for table, columns in plan:
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
