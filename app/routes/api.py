from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from flask import Blueprint, current_app, jsonify, request, send_file

from app.core.comparison import ProductComparator
from app.core.evaluation import EvaluationEngine
from app.core.export import ExportBuilder
from app.core.llm import LLMClient
from app.core.matching import ProductMatcher
from app.core.trace import TraceLedger
from app.core.validation import DecisionValidator
from app.core.evidence import SourceIngestor


api = Blueprint(
    "api",
    __name__,
    url_prefix="/api",
)


def _json_body() -> Dict[str, Any]:
    payload = request.get_json(
        silent=True
    )

    if payload is None:
        return {}

    if not isinstance(
        payload,
        dict,
    ):
        raise ValueError(
            "Request body must be a JSON object."
        )

    return payload


def _services():
    """
    Create lightweight service instances for a request.

    The services themselves contain no request-specific global state.
    """

    llm = LLMClient()

    return {
        "ingestor": SourceIngestor(),
        "validator": DecisionValidator(),
        "matcher": ProductMatcher(
            llm_client=llm,
        ),
        "comparator": ProductComparator(
            llm_client=llm,
        ),
        "evaluator": EvaluationEngine(
            llm_client=llm,
        ),
        "exporter": ExportBuilder(),
        "trace": TraceLedger(),
        "llm": llm,
    }


@api.get("/health")
def health():
    services = _services()

    return jsonify(
        {
            "status": "ok",
            "application": "FORGE",
            "llm_available": services[
                "llm"
            ].available,
        }
    )


@api.get("/status")
def status():
    services = _services()

    return jsonify(
        {
            "application": "FORGE",
            "status": "ready",
            "llm": {
                "available": services[
                    "llm"
                ].available,
            },
        }
    )


@api.post("/ingest")
def ingest():
    services = _services()

    files = request.files.getlist(
        "files"
    )

    if not files:
        return jsonify(
            {
                "error": (
                    "No files were uploaded."
                )
            }
        ), 400

    upload_dir = Path(
        current_app.config[
            "UPLOAD_DIR"
        ]
    )

    upload_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    results = []

    for uploaded_file in files:
        if not uploaded_file.filename:
            continue

        filename = Path(
            uploaded_file.filename
        ).name

        destination = (
            upload_dir
            / filename
        )

        uploaded_file.save(
            destination
        )

        result = services[
            "ingestor"
        ].ingest_file(
            destination
        )

        services[
            "trace"
        ].record_source(
            source_id=result.source_id,
            source_name=result.source_name,
            source_type=result.source_type,
            metadata=result.metadata,
        )

        results.append(
            result.to_dict()
        )

    if not results:
        return jsonify(
            {
                "error": (
                    "No valid files were supplied."
                )
            }
        ), 400

    return jsonify(
        {
            "status": "processed",
            "count": len(results),
            "sources": results,
        }
    )


@api.post("/ingest/url")
def ingest_url():
    services = _services()

    payload = _json_body()

    url = str(
        payload.get(
            "url",
            "",
        )
    ).strip()

    if not url:
        return jsonify(
            {
                "error": "URL is required."
            }
        ), 400

    result = services[
        "ingestor"
    ].ingest_url(
        url
    )

    if result.status == "processed":
        services[
            "trace"
        ].record_source(
            source_id=result.source_id,
            source_name=result.source_name,
            source_type=result.source_type,
            metadata=result.metadata,
        )

    return jsonify(
        result.to_dict()
    )


@api.post("/validate")
def validate():
    services = _services()

    payload = _json_body()

    products = payload.get(
        "products",
        [],
    )

    requirement = payload.get(
        "requirement"
    )

    requirements = payload.get(
        "requirements"
    )

    if not products:
        return jsonify(
            {
                "error": (
                    "No products were supplied."
                )
            }
        ), 400

    if requirements is not None:
        if not isinstance(
            requirements,
            list,
        ):
            return jsonify(
                {
                    "error": (
                        "'requirements' must be a list."
                    )
                }
            ), 400

        results = []

        for product in products:
            results.append(
                services[
                    "validator"
                ].validate_requirements(
                    requirements,
                    product,
                )
            )

    elif requirement:
        results = [
            services[
                "validator"
            ].validate_requirement(
                requirement,
                product,
            )
            for product in products
        ]

    else:
        return jsonify(
            {
                "error": (
                    "Provide 'requirement' or 'requirements'."
                )
            }
        ), 400

    return jsonify(
        {
            "status": "completed",
            "results": results,
        }
    )


@api.post("/match")
def match():
    services = _services()

    payload = _json_body()

    products = payload.get(
        "products",
        [],
    )

    requirement = payload.get(
        "requirement",
        "",
    )

    use_llm = bool(
        payload.get(
            "use_llm",
            False,
        )
    )

    if not products:
        return jsonify(
            {
                "error": (
                    "No products were supplied."
                )
            }
        ), 400

    if not requirement:
        return jsonify(
            {
                "error": (
                    "A matching requirement is required."
                )
            }
        ), 400

    results = services[
        "matcher"
    ].match(
        products,
        requirement,
        use_llm=use_llm,
    )

    source_ids = payload.get("source_ids") or []
    for source_id in source_ids:
        services["trace"].record_processing(
            source_id=str(source_id),
            stage="matching",
            status="completed",
            details={
                "requirement": requirement,
                "candidate_count": len(products),
            },
        )

    return jsonify(
        {
            "status": "completed",
            "count": len(results),
            "results": results,
        }
    )


@api.post("/compare")
def compare():
    services = _services()

    payload = _json_body()

    products = payload.get(
        "products",
        [],
    )

    fields = payload.get(
        "fields"
    )

    use_llm = bool(
        payload.get(
            "use_llm",
            False,
        )
    )

    if not products:
        return jsonify(
            {
                "error": (
                    "No products were supplied."
                )
            }
        ), 400

    if fields is not None and not isinstance(
        fields,
        list,
    ):
        return jsonify(
            {
                "error": (
                    "'fields' must be a list."
                )
            }
        ), 400

    result = services[
        "comparator"
    ].compare(
        products,
        fields=fields,
        use_llm=use_llm,
    )

    for source_id in payload.get("source_ids") or []:
        services["trace"].record_processing(
            source_id=str(source_id),
            stage="comparison",
            status=result.get("status", "completed"),
            details={
                "product_count": len(products),
                "difference_count": len(result.get("differences", [])),
            },
        )

    return jsonify(
        result
    )


@api.post("/evaluate")
def evaluate():
    services = _services()

    payload = _json_body()

    result = payload.get(
        "result",
        payload,
    )

    source_data = payload.get(
        "source_data"
    )

    rubric = payload.get(
        "rubric"
    )

    use_llm = bool(
        payload.get(
            "use_llm",
            False,
        )
    )

    evaluation = services[
        "evaluator"
    ].evaluate(
        result,
        source_data=source_data,
        rubric=rubric,
        use_llm=use_llm,
    )

    for source_id in payload.get("source_ids") or []:
        services["trace"].record_processing(
            source_id=str(source_id),
            stage="evaluation",
            status=evaluation.get("status", "completed"),
            details={
                "score": evaluation.get("score"),
            },
        )

    return jsonify(
        evaluation
    )


@api.post("/export")
def export():
    services = _services()

    payload = _json_body()

    data = payload.get(
        "data",
        payload.get(
            "records",
            [],
        ),
    )

    filename = str(
        payload.get(
            "filename",
            "forge_results",
        )
    ).strip()

    export_format = str(
        payload.get(
            "format",
            "xlsx",
        )
    ).strip().lower()

    metadata = payload.get(
        "metadata"
    )

    try:
        output_path = services[
            "exporter"
        ].export(
            data=data,
            filename=filename,
            format=export_format,
            metadata=metadata,
        )

    except (
        ValueError,
        TypeError,
    ) as exc:
        return jsonify(
            {
                "error": str(exc)
            }
        ), 400

    services[
        "trace"
    ].record_export(
        filename=output_path.name,
        export_format=export_format,
    )

    return send_file(
        output_path,
        as_attachment=True,
        download_name=output_path.name,
    )


@api.post("/export/bundle")
def export_bundle():
    services = _services()

    payload = _json_body()

    data = payload.get(
        "data",
        payload.get(
            "records",
            [],
        ),
    )

    filename = str(
        payload.get(
            "filename",
            "forge_delivery",
        )
    ).strip()

    formats = payload.get(
        "formats"
    )

    metadata = payload.get(
        "metadata"
    )

    if formats is not None and not isinstance(
        formats,
        list,
    ):
        return jsonify(
            {
                "error": (
                    "'formats' must be a list."
                )
            }
        ), 400

    try:
        output_path = services[
            "exporter"
        ].export_bundle(
            data=data,
            filename=filename,
            formats=formats,
            metadata=metadata,
        )

    except (
        ValueError,
        TypeError,
    ) as exc:
        return jsonify(
            {
                "error": str(exc)
            }
        ), 400

    services[
        "trace"
    ].record_export(
        filename=output_path.name,
        export_format="zip",
    )

    return send_file(
        output_path,
        as_attachment=True,
        download_name=output_path.name,
    )


@api.get("/trace")
def trace():
    services = _services()

    source_id = request.args.get(
        "source_id"
    )

    record_id = request.args.get(
        "record_id"
    )

    event_type = request.args.get(
        "event_type"
    )

    events = services[
        "trace"
    ].get_events(
        source_id=source_id,
        record_id=record_id,
        event_type=event_type,
    )

    return jsonify(
        {
            "count": len(events),
            "events": events,
        }
    )


@api.get("/trace/source/<source_id>")
def source_trace(
    source_id: str,
):
    services = _services()

    summary = services[
        "trace"
    ].summarize_trace(
        source_id=source_id
    )

    events = services[
        "trace"
    ].get_source_trace(
        source_id
    )

    return jsonify(
        {
            "summary": summary,
            "events": events,
        }
    )


@api.get("/trace/record/<record_id>")
def record_trace(
    record_id: str,
):
    services = _services()

    summary = services[
        "trace"
    ].summarize_trace(
        record_id=record_id
    )

    events = services[
        "trace"
    ].get_record_trace(
        record_id
    )

    return jsonify(
        {
            "summary": summary,
            "events": events,
        }
    )


@api.get("/trace/integrity")
def trace_integrity():
    services = _services()

    return jsonify(
        services[
            "trace"
        ].verify_integrity()
    )


@api.errorhandler(400)
def bad_request(error):
    return jsonify(
        {
            "error": (
                str(error)
                or "Bad request."
            )
        }
    ), 400


@api.errorhandler(413)
def payload_too_large(error):
    return jsonify(
        {
            "error": (
                "Uploaded content exceeds the configured size limit."
            )
        }
    ), 413


@api.errorhandler(500)
def internal_error(error):
    return jsonify(
        {
            "error": (
                "FORGE encountered an internal error."
            )
        }
    ), 500