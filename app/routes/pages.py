from __future__ import annotations

from flask import Blueprint, render_template


pages = Blueprint(
    "pages",
    __name__,
)


@pages.get("/")
def home():
    return render_template(
        "index.html",
        active_page="home",
    )


@pages.get("/workspace")
def workspace():
    return render_template(
        "workspace.html",
        active_page="workspace",
    )


@pages.get("/match")
def match_page():
    return render_template(
        "match.html",
        active_page="match",
    )


@pages.get("/compare")
def compare_page():
    return render_template(
        "compare.html",
        active_page="compare",
    )


@pages.get("/catalogue")
def catalogue():
    return render_template(
        "catalogue.html",
        active_page="catalogue",
    )


@pages.get("/evidence")
def evidence():
    return render_template(
        "evidence.html",
        active_page="evidence",
    )


@pages.get("/trace")
def trace():
    return render_template(
        "trace.html",
        active_page="trace",
    )


@pages.get("/evaluation")
def evaluation():
    return render_template(
        "evaluation.html",
        active_page="evaluation",
    )


@pages.get("/help")
def help_page():
    return render_template(
        "help.html",
        active_page="help",
    )


@pages.get("/about")
def about_page():
    return render_template(
        "about.html",
        active_page="about",
    )


@pages.errorhandler(404)
def page_not_found(error):
    return render_template(
        "404.html",
        active_page="",
    ), 404