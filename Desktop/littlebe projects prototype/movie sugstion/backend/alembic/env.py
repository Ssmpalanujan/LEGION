"""Alembic environment: URL from DATABASE_URL, metadata from app models."""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.core.config import get_settings  # noqa: E402
from app.models import entities  # noqa: E402,F401
from app.models.db import Base  # noqa: E402

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", get_settings().resolved_database_url())


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url")
    connect_args = {"check_same_thread": False} if (url or "").startswith("sqlite") else {}
    connectable = engine_from_config(
        {"sqlalchemy.url": url}, prefix="sqlalchemy.", poolclass=pool.NullPool, connect_args=connect_args
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
