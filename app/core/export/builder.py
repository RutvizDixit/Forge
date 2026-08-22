from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

import config


class ExportBuilder:
    """
    Builds downloadable FORGE deliverables.

    Supported formats:

    CSV
    XLSX
    JSON
    TXT
    HTML
    PDF
    ZIP bundle
    """

    SUPPORTED_FORMATS = {
        "csv",
        "xlsx",
        "json",
        "txt",
        "html",
        "pdf",
        "zip",
    }

    def __init__(
        self,
        output_directory: Optional[str | Path] = None,
    ):
        self.output_directory = Path(
            output_directory
            or config.EXPORT_DIR
        )

        self.output_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

    def export(
        self,
        data: Any,
        filename: str,
        format: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Path:
        export_format = (
            str(format)
            .strip()
            .lower()
            .lstrip(".")
        )

        if export_format not in self.SUPPORTED_FORMATS:
            raise ValueError(
                f"Unsupported export format: {format}"
            )

        safe_filename = self._safe_filename(
            filename,
            export_format,
        )

        output_path = (
            self.output_directory
            / safe_filename
        )

        if export_format == "csv":
            self._export_csv(
                data,
                output_path,
            )

        elif export_format == "xlsx":
            self._export_xlsx(
                data,
                output_path,
            )

        elif export_format == "json":
            self._export_json(
                data,
                output_path,
            )

        elif export_format == "txt":
            self._export_txt(
                data,
                output_path,
            )

        elif export_format == "html":
            self._export_html(
                data,
                output_path,
                metadata,
            )

        elif export_format == "pdf":
            self._export_pdf(
                data,
                output_path,
                metadata,
            )

        elif export_format == "zip":
            self._export_zip(
                data,
                output_path,
                metadata,
            )

        return output_path

    def export_dataframe(
        self,
        dataframe: pd.DataFrame,
        filename: str,
        format: str,
    ) -> Path:
        if not isinstance(
            dataframe,
            pd.DataFrame,
        ):
            raise TypeError(
                "export_dataframe expects a pandas DataFrame."
            )

        return self.export(
            dataframe,
            filename,
            format,
        )

    def export_bundle(
        self,
        data: Any,
        filename: str = "forge_delivery",
        formats: Optional[Iterable[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Path:
        requested_formats = list(
            formats
            or (
                "csv",
                "xlsx",
                "json",
                "html",
                "pdf",
            )
        )

        temporary_directory = (
            self.output_directory
            / f".{self._stem(filename)}_bundle"
        )

        temporary_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        generated_files = []

        for export_format in requested_formats:
            normalized = (
                str(export_format)
                .strip()
                .lower()
                .lstrip(".")
            )

            if normalized == "zip":
                continue

            if normalized not in self.SUPPORTED_FORMATS:
                continue

            path = self.export(
                data,
                filename,
                normalized,
                metadata=metadata,
            )

            generated_files.append(
                path
            )

        zip_path = (
            self.output_directory
            / self._ensure_extension(
                filename,
                "zip",
            )
        )

        with zipfile.ZipFile(
            zip_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
        ) as archive:
            for file_path in generated_files:
                if file_path.exists():
                    archive.write(
                        file_path,
                        arcname=file_path.name,
                    )

        return zip_path

    def _export_csv(
        self,
        data: Any,
        output_path: Path,
    ) -> None:
        dataframe = self._to_dataframe(
            data
        )

        dataframe.to_csv(
            output_path,
            index=False,
            encoding="utf-8-sig",
        )

    def _export_xlsx(
        self,
        data: Any,
        output_path: Path,
    ) -> None:
        dataframe = self._to_dataframe(
            data
        )

        dataframe.to_excel(
            output_path,
            index=False,
            engine="openpyxl",
        )

    def _export_json(
        self,
        data: Any,
        output_path: Path,
    ) -> None:
        payload = self._to_serializable(
            data
        )

        with output_path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                payload,
                file,
                ensure_ascii=False,
                indent=2,
            )

    def _export_txt(
        self,
        data: Any,
        output_path: Path,
    ) -> None:
        text = self._to_text(
            data
        )

        output_path.write_text(
            text,
            encoding="utf-8",
        )

    def _export_html(
        self,
        data: Any,
        output_path: Path,
        metadata: Optional[Dict[str, Any]],
    ) -> None:
        dataframe = self._to_dataframe(
            data
        )

        title = (
            metadata.get(
                "title",
                "FORGE Results",
            )
            if metadata
            else "FORGE Results"
        )

        subtitle = (
            metadata.get(
                "subtitle",
                "Industrial Product Intelligence",
            )
            if metadata
            else "Industrial Product Intelligence"
        )

        table_html = dataframe.to_html(
            index=False,
            border=0,
            classes="results-table",
            na_rep="Not available",
        )

        metadata_html = ""

        if metadata:
            rows = []

            for key, value in metadata.items():
                if key in {
                    "title",
                    "subtitle",
                }:
                    continue

                rows.append(
                    f"<div><strong>{self._escape_html(key)}"
                    f":</strong> "
                    f"{self._escape_html(value)}</div>"
                )

            metadata_html = "\n".join(
                rows
            )

        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{self._escape_html(title)}</title>
<style>
body {{
    font-family: Arial, sans-serif;
    margin: 40px;
    color: #20252b;
    background: #ffffff;
}}

h1 {{
    margin-bottom: 4px;
}}

.subtitle {{
    color: #69727d;
    margin-bottom: 24px;
}}

.meta {{
    padding: 14px;
    margin-bottom: 24px;
    border: 1px solid #dfe3e8;
    border-radius: 8px;
}}

.results-table {{
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
}}

.results-table th,
.results-table td {{
    border: 1px solid #dfe3e8;
    padding: 8px;
    text-align: left;
    vertical-align: top;
}}

.results-table th {{
    font-weight: 600;
}}

.footer {{
    margin-top: 28px;
    color: #7b838d;
    font-size: 12px;
}}
</style>
</head>
<body>

<h1>{self._escape_html(title)}</h1>

<div class="subtitle">
{self._escape_html(subtitle)}
</div>

<div class="meta">
{metadata_html}
</div>

{table_html}

<div class="footer">
Generated by FORGE · {config.CREATOR_YEAR}
</div>

</body>
</html>
"""

        output_path.write_text(
            html,
            encoding="utf-8",
        )

    def _export_pdf(
        self,
        data: Any,
        output_path: Path,
        metadata: Optional[Dict[str, Any]],
    ) -> None:
        dataframe = self._to_dataframe(
            data
        )

        title = (
            metadata.get(
                "title",
                "FORGE Results",
            )
            if metadata
            else "FORGE Results"
        )

        document = SimpleDocTemplate(
            str(output_path),
            pagesize=landscape(A4),
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
        )

        styles = getSampleStyleSheet()

        story = []

        story.append(
            Paragraph(
                self._escape_pdf(
                    title
                ),
                styles["Title"],
            )
        )

        story.append(
            Paragraph(
                self._escape_pdf(
                    (
                        metadata.get(
                            "subtitle",
                            "Industrial Product Intelligence",
                        )
                        if metadata
                        else "Industrial Product Intelligence"
                    )
                ),
                styles["Normal"],
            )
        )

        story.append(
            Spacer(
                1,
                8 * mm,
            )
        )

        if metadata:
            for key, value in metadata.items():
                if key in {
                    "title",
                    "subtitle",
                }:
                    continue

                story.append(
                    Paragraph(
                        self._escape_pdf(
                            f"{key}: {value}"
                        ),
                        styles["Normal"],
                    )
                )

            story.append(
                Spacer(
                    1,
                    5 * mm,
                )
            )

        headers = [
            str(column)
            for column in dataframe.columns
        ]

        rows = [
            headers
        ]

        max_columns = 12

        if len(headers) > max_columns:
            selected_columns = headers[
                :max_columns
            ]

            dataframe = dataframe[
                selected_columns
            ]

            headers = selected_columns

            rows = [
                headers
            ]

        for _, row in dataframe.iterrows():
            rows.append(
                [
                    self._truncate(
                        self._display_value(
                            row.get(
                                column,
                                "",
                            )
                        ),
                        70,
                    )
                    for column in headers
                ]
            )

        table = Table(
            rows,
            repeatRows=1,
        )

        table.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor(
                            "#eeeeee"
                        ),
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.5,
                        colors.HexColor(
                            "#cccccc"
                        ),
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, 0),
                        "Helvetica-Bold",
                    ),
                    (
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        7,
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        4,
                    ),
                    (
                        "RIGHTPADDING",
                        (0, 0),
                        (-1, -1),
                        4,
                    ),
                ]
            )
        )

        story.append(
            table
        )

        story.append(
            Spacer(
                1,
                8 * mm,
            )
        )

        story.append(
            Paragraph(
                (
                    f"Generated by {config.APP_NAME} · "
                    f"{config.CREATOR_YEAR}"
                ),
                styles["Normal"],
            )
        )

        document.build(
            story
        )

    def _export_zip(
        self,
        data: Any,
        output_path: Path,
        metadata: Optional[Dict[str, Any]],
    ) -> None:
        bundle_directory = (
            self.output_directory
            / f".{output_path.stem}_files"
        )

        bundle_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        generated = []

        for export_format in (
            "csv",
            "xlsx",
            "json",
            "html",
            "pdf",
        ):
            generated_path = self.export(
                data,
                output_path.stem,
                export_format,
                metadata=metadata,
            )

            generated.append(
                generated_path
            )

        with zipfile.ZipFile(
            output_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
        ) as archive:
            for file_path in generated:
                if file_path.exists():
                    archive.write(
                        file_path,
                        arcname=file_path.name,
                    )

    @staticmethod
    def _to_dataframe(
        data: Any,
    ) -> pd.DataFrame:
        if isinstance(
            data,
            pd.DataFrame,
        ):
            return data.copy()

        if isinstance(
            data,
            list,
        ):
            return pd.DataFrame(
                data
            )

        if isinstance(
            data,
            dict,
        ):
            if isinstance(
                data.get(
                    "records"
                ),
                list,
            ):
                return pd.DataFrame(
                    data["records"]
                )

            return pd.DataFrame(
                [data]
            )

        if hasattr(
            data,
            "records",
        ):
            return pd.DataFrame(
                data.records
            )

        raise TypeError(
            "Data must be a DataFrame, list, dictionary, "
            "or processing result containing records."
        )

    @staticmethod
    def _to_serializable(
        value: Any,
    ) -> Any:
        if isinstance(
            value,
            pd.DataFrame,
        ):
            return value.to_dict(
                orient="records"
            )

        if isinstance(
            value,
            dict,
        ):
            return {
                str(key): ExportBuilder._to_serializable(
                    item
                )
                for key, item in value.items()
            }

        if isinstance(
            value,
            list,
        ):
            return [
                ExportBuilder._to_serializable(
                    item
                )
                for item in value
            ]

        if isinstance(
            value,
            tuple,
        ):
            return [
                ExportBuilder._to_serializable(
                    item
                )
                for item in value
            ]

        if hasattr(
            value,
            "item",
        ):
            try:
                return value.item()
            except Exception:
                pass

        if hasattr(
            value,
            "to_dict",
        ):
            try:
                return ExportBuilder._to_serializable(
                    value.to_dict()
                )
            except Exception:
                pass

        return value

    def _to_text(
        self,
        data: Any,
    ) -> str:
        serializable = self._to_serializable(
            data
        )

        if isinstance(
            serializable,
            list,
        ):
            return "\n\n".join(
                json.dumps(
                    item,
                    ensure_ascii=False,
                    indent=2,
                )
                for item in serializable
            )

        if isinstance(
            serializable,
            dict,
        ):
            return json.dumps(
                serializable,
                ensure_ascii=False,
                indent=2,
            )

        return str(
            serializable
        )

    @staticmethod
    def _safe_filename(
        filename: str,
        export_format: str,
    ) -> str:
        stem = (
            Path(
                str(filename)
            ).stem
        )

        safe = "".join(
            character
            if character.isalnum()
            or character in {
                "-",
                "_",
                ".",
                " ",
            }
            else "_"
            for character in stem
        ).strip()

        if not safe:
            safe = "forge_delivery"

        return (
            f"{safe}.{export_format}"
        )

    @staticmethod
    def _ensure_extension(
        filename: str,
        extension: str,
    ) -> str:
        path = Path(
            str(filename)
        )

        return (
            f"{path.stem}.{extension}"
        )

    @staticmethod
    def _stem(
        filename: str,
    ) -> str:
        return Path(
            str(filename)
        ).stem

    @staticmethod
    def _display_value(
        value: Any,
    ) -> str:
        if value is None:
            return "Not available"

        text = str(
            value
        ).strip()

        if not text:
            return "Not available"

        return text

    @staticmethod
    def _truncate(
        text: str,
        maximum: int,
    ) -> str:
        if len(text) <= maximum:
            return text

        return (
            text[: maximum - 3]
            + "..."
        )

    @staticmethod
    def _escape_html(
        value: Any,
    ) -> str:
        text = str(
            value
        )

        return (
            text.replace(
                "&",
                "&amp;",
            )
            .replace(
                "<",
                "&lt;",
            )
            .replace(
                ">",
                "&gt;",
            )
            .replace(
                '"',
                "&quot;",
            )
            .replace(
                "'",
                "&#39;",
            )
        )

    @staticmethod
    def _escape_pdf(
        value: Any,
    ) -> str:
        text = str(
            value
        )

        return (
            text.replace(
                "&",
                "&amp;",
            )
            .replace(
                "<",
                "&lt;",
            )
            .replace(
                ">",
                "&gt;",
            )
        )