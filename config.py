from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------

BASE_DIR = Path(
    __file__
).resolve().parent

APP_DIR = BASE_DIR / "app"

DATA_DIR = BASE_DIR / "data"

UPLOAD_DIR = DATA_DIR / "uploads"

OUTPUT_DIR = DATA_DIR / "runtime"

EXPORT_DIR = OUTPUT_DIR / "exports"


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

load_dotenv(
    BASE_DIR / ".env"
)


# ---------------------------------------------------------------------------
# Application identity
# ---------------------------------------------------------------------------

APP_NAME = "FORGE"

APP_VERSION = "1.0.0"

CREATOR_NAME = "Rutviz Dixit"

CREATOR_YEAR = "2026"


# ---------------------------------------------------------------------------
# Flask / security
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv(
    "FORGE_SECRET_KEY",
    "forge-development-key",
)


# ---------------------------------------------------------------------------
# Upload configuration
# ---------------------------------------------------------------------------

try:
    MAX_UPLOAD_MB = int(
        os.getenv(
            "FORGE_MAX_UPLOAD_MB",
            "50",
        )
    )
except ValueError:
    MAX_UPLOAD_MB = 50


_raw_extensions = os.getenv(
    "FORGE_ALLOWED_EXTENSIONS",
    "csv,xlsx,xls,pdf,docx,txt,json,xml,zip",
)

ALLOWED_EXTENSIONS = {
    extension.strip().lower().lstrip(".")
    for extension in _raw_extensions.split(",")
    if extension.strip()
}


# ---------------------------------------------------------------------------
# Supported source classification
# ---------------------------------------------------------------------------

SUPPORTED_SOURCE_TYPES = {
    "csv": "Catalogue",
    "xlsx": "Catalogue",
    "xls": "Catalogue",
    "pdf": "Technical document",
    "docx": "Product document",
    "txt": "Text source",
    "json": "Structured data",
    "xml": "Structured data",
    "zip": "Source bundle",
}


# ---------------------------------------------------------------------------
# Website ingestion
# ---------------------------------------------------------------------------

_raw_hosts = os.getenv(
    "FORGE_ALLOWED_WEB_HOSTS",
    "",
)

ALLOWED_WEB_HOSTS = {
    host.strip().lower()
    for host in _raw_hosts.split(",")
    if host.strip()
}


# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

OPENAI_API_KEY = os.getenv(
    "OPENAI_API_KEY",
    "",
).strip()


OPENAI_MODEL = os.getenv(
    "OPENAI_MODEL",
    "",
).strip()


# ---------------------------------------------------------------------------
# Runtime defaults
# ---------------------------------------------------------------------------

DEFAULT_ENCODING = "utf-8"

DEFAULT_EXPORT_FORMAT = "xlsx"

SUPPORTED_EXPORT_FORMATS = {
    "csv",
    "xlsx",
    "json",
    "txt",
    "html",
    "pdf",
    "zip",
}


# ---------------------------------------------------------------------------
# Directory initialization
# ---------------------------------------------------------------------------

for directory in (
    DATA_DIR,
    UPLOAD_DIR,
    OUTPUT_DIR,
    EXPORT_DIR,
):
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )