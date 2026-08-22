from __future__ import annotations

from pathlib import Path

from flask import Flask

import config
from .routes.api import api
from .routes.pages import pages


def create_application() -> Flask:
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
    )

    app.config["SECRET_KEY"] = config.SECRET_KEY

    app.config["MAX_CONTENT_LENGTH"] = (
        config.MAX_UPLOAD_MB * 1024 * 1024
    )

    app.config["UPLOAD_DIR"] = str(
        config.UPLOAD_DIR
    )

    app.config["OUTPUT_DIR"] = str(
        config.OUTPUT_DIR
    )

    app.config["EXPORT_DIR"] = str(
        config.EXPORT_DIR
    )

    _prepare_directories()

    app.register_blueprint(
        api
    )

    app.register_blueprint(
        pages
    )

    @app.context_processor
    def inject_forge_config():
        return {
            "forge_app_name": config.APP_NAME,
            "forge_app_version": config.APP_VERSION,
            "forge_creator": config.CREATOR_NAME,
            "forge_creator_year": config.CREATOR_YEAR,
        }

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault(
            "X-Content-Type-Options",
            "nosniff",
        )

        response.headers.setdefault(
            "X-Frame-Options",
            "SAMEORIGIN",
        )

        response.headers.setdefault(
            "Referrer-Policy",
            "strict-origin-when-cross-origin",
        )

        return response

    return app


def _prepare_directories() -> None:
    directories = (
        config.UPLOAD_DIR,
        config.OUTPUT_DIR,
        config.EXPORT_DIR,
    )

    for directory in directories:
        Path(directory).mkdir(
            parents=True,
            exist_ok=True,
        )


app = create_application()


def create_app() -> Flask:
    """
    Compatibility alias for code that expects a Flask
    application factory named create_app().
    """
    return create_application()


__all__ = [
    "app",
    "create_application",
    "create_app",
]