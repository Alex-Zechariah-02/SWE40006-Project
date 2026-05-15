from __future__ import annotations

import urllib.parse

import psycopg


def _sanitize_database_url(database_url: str) -> str:
    # Prisma commonly appends `?schema=public` which libpq doesn't use.
    # Keep everything else intact.
    parsed = urllib.parse.urlparse(database_url)
    if not parsed.query:
        return database_url
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    if "schema" in query:
        query.pop("schema", None)
    new_query = urllib.parse.urlencode(query, doseq=True)
    sanitized = parsed._replace(query=new_query)
    return urllib.parse.urlunparse(sanitized)


def connect(database_url: str) -> psycopg.Connection:
    url = _sanitize_database_url(database_url)
    # Autocommit keeps the worker simple and reduces risk of open transactions on crash.
    return psycopg.connect(url, autocommit=True)

