#!/usr/bin/env python3
"""Seed constituency-level religion composition into GeoReligionStat.

Reads constituency_religion.csv produced by the analysis-service
(ETL over Census C-1 + constituency–taluk mapping) and writes
rows into the Prisma table GeoReligionStat.

Idempotent: uses ON CONFLICT (geoUnitId, year, religion) DO UPDATE.

Requirements:
- DATABASE_URL_PG or DATABASE_URL env var (or fallback dev URL)
- backend/prisma/schema.prisma migrated with GeoReligionStat model
- CSV at ../../analysis-service/app/Scripts/constituency_religion.csv
- Python deps from backend/scripts/requirements.txt
"""

import os
import sys
import logging
from typing import Dict

import pandas as pd
import psycopg2
from psycopg2.extensions import connection
from dotenv import load_dotenv


# ----------------------------------------------------------------------------
# Config & logging
# ----------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load .env from backend root
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=ENV_PATH)


def get_db_url() -> str:
    db_url = os.getenv("DATABASE_URL_PG") or os.getenv("DATABASE_URL")
    if not db_url:
        logger.warning(
            "DATABASE_URL_PG / DATABASE_URL not set, falling back to local dev URL"
        )
        db_url = "postgresql://politicai_user:Dhanu111@localhost:5432/politicai_dev"
    return db_url


def get_csv_path() -> str:
    """Resolve path to constituency_religion.csv relative to backend/scripts."""
    return os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "analysis-service",
            "app",
            "Scripts",
            "constituency_religion.csv",
        )
    )


def load_csv(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        logger.error(f"CSV file not found: {csv_path}")
        sys.exit(1)

    logger.info(f"Loading constituency religion CSV: {csv_path}")
    df = pd.read_csv(csv_path)

    required_cols = [
        "constituency_name",
        "year",
        "source",
        "religion",
        "population",
        "percent",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        logger.error(f"Missing required columns in CSV: {missing}")
        sys.exit(1)

    return df


def connect_db(db_url: str) -> connection:
    try:
        conn = psycopg2.connect(db_url)
        logger.info("Connected to PostgreSQL")
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        sys.exit(1)


def load_geounit_cache(conn: connection) -> Dict[str, int]:
    """Cache GeoUnit ids by constituency name (level = CONSTITUENCY)."""
    cursor = conn.cursor()
    try:
        cursor.execute(
            'SELECT name, id FROM "GeoUnit" WHERE level = %s',
            ("CONSTITUENCY",),
        )
        rows = cursor.fetchall()
        cache = {name: gid for name, gid in rows}
        logger.info(f"Cached {len(cache)} constituency GeoUnits by name")
        return cache
    except Exception as e:
        logger.error(f"Failed to load GeoUnit cache: {e}")
        sys.exit(1)
    finally:
        cursor.close()


def seed_geo_religion(conn: connection, df: pd.DataFrame, geounit_cache: Dict[str, int]):
    cursor = conn.cursor()
    created = 0
    updated = 0
    skipped = 0

    try:
        for idx, row in df.iterrows():
            name = str(row["constituency_name"]).strip()
            year = int(row["year"])
            source = str(row["source"]).strip() if not pd.isna(row["source"]) else ""
            religion = str(row["religion"]).strip().upper()

            # population may be float in CSV, round to int for DB
            pop_val = row["population"]
            if pd.isna(pop_val):
                population = 0
            else:
                population = int(round(float(pop_val)))

            pct_val = row["percent"]
            percent = None if pd.isna(pct_val) else float(pct_val)

            geo_unit_id = geounit_cache.get(name)
            if not geo_unit_id:
                logger.warning(
                    "[SKIP] No GeoUnit found for constituency '%s' (row %d)",
                    name,
                    idx,
                )
                skipped += 1
                continue

            # Insert or update on (geoUnitId, year, religion)
            cursor.execute(
                '''
                INSERT INTO "GeoReligionStat" 
                    ("geoUnitId", "year", "source", "religion", "population", "percent")
                VALUES (%s, %s, %s, %s::"Religion", %s, %s)
                ON CONFLICT ("geoUnitId", "year", "religion")
                DO UPDATE SET
                    "source" = EXCLUDED."source",
                    "population" = EXCLUDED."population",
                    "percent" = EXCLUDED."percent"
                ''',
                (geo_unit_id, year, source, religion, population, percent),
            )

            # Use rowcount to guess insert vs update (1 for insert or update)
            # We'll infer from existing row via a lightweight check if needed.
            # For simplicity, treat all as upsert and count separately by checking existence once.
            created += 1  # counts total upserts; we won't strictly split created/updated per row

            if (idx + 1) % 500 == 0:
                conn.commit()
                logger.info("  Processed %d/%d rows...", idx + 1, len(df))

        conn.commit()
        logger.info(
            "Seeding completed. Upserts: %d, Skipped (no GeoUnit match): %d",
            created,
            skipped,
        )

    except Exception as e:
        conn.rollback()
        logger.error(f"Error during GeoReligionStat seeding: {e}")
        raise
    finally:
        cursor.close()


def main():
    csv_path = get_csv_path()
    logger.info(f"Using CSV: {csv_path}")
    df = load_csv(csv_path)

    db_url = get_db_url()
    conn = connect_db(db_url)

    try:
        geounit_cache = load_geounit_cache(conn)
        seed_geo_religion(conn, df, geounit_cache)
    finally:
        conn.close()
        logger.info("Database connection closed")


if __name__ == "__main__":
    main()
