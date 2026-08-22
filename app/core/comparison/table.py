from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd


class ProductComparator:
    """
    Builds an explainable comparison between product records.

    Missing information is represented as unavailable rather than
    interpreted as a negative product attribute.
    """

    INTERNAL_PREFIXES = (
        "forge_",
        "_forge_",
    )

    IDENTITY_FIELDS = (
        "manufacturer",
        "manufacturer_name",
        "brand",
        "brand_name",
        "part_number",
        "part_num",
        "part_no",
        "sku",
        "model",
        "product_id",
        "product_code",
        "description",
        "product_description",
        "product_desc",
        "name",
        "title",
    )

    def __init__(
        self,
        llm_client=None,
    ):
        self.llm_client = llm_client

    def compare(
        self,
        products: pd.DataFrame | List[Dict[str, Any]],
        fields: Optional[List[str]] = None,
        use_llm: bool = False,
    ) -> Dict[str, Any]:
        dataframe = self._to_dataframe(products)

        if dataframe.empty:
            return {
                "products": [],
                "fields": [],
                "matrix": [],
                "differences": [],
                "shared": [],
                "summary": "No products were supplied.",
                "status": "uncertain",
            }

        dataframe = dataframe.reset_index(
            drop=True
        )

        selected_fields = (
            fields
            if fields
            else self._select_fields(
                dataframe
            )
        )

        matrix = self._build_matrix(
            dataframe,
            selected_fields,
        )

        differences = self._find_differences(
            dataframe,
            selected_fields,
        )

        shared = self._find_shared_values(
            dataframe,
            selected_fields,
        )

        summary = self._build_summary(
            dataframe,
            differences,
            shared,
        )

        result = {
            "products": self._build_product_labels(
                dataframe
            ),
            "fields": selected_fields,
            "matrix": matrix,
            "differences": differences,
            "shared": shared,
            "summary": summary,
            "status": (
                "supported"
                if differences
                else "uncertain"
            ),
        }

        if use_llm and self.llm_client is not None:
            result["semantic_analysis"] = (
                self._semantic_analysis(
                    result
                )
            )

        return result

    def build_table(
        self,
        products: pd.DataFrame | List[Dict[str, Any]],
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return self.compare(
            products,
            fields=fields,
        )

    def compare_records(
        self,
        products: List[Dict[str, Any]],
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return self.compare(
            products,
            fields=fields,
        )

    def _build_matrix(
        self,
        dataframe: pd.DataFrame,
        fields: List[str],
    ) -> List[Dict[str, Any]]:
        matrix = []

        for field in fields:
            values = []

            for index, row in dataframe.iterrows():
                value = row.get(
                    field,
                    "",
                )

                values.append(
                    {
                        "product_index": int(
                            index
                        ),
                        "value": self._display_value(
                            value
                        ),
                        "available": self._has_value(
                            value
                        ),
                    }
                )

            matrix.append(
                {
                    "field": field,
                    "values": values,
                    "difference": self._field_has_difference(
                        values
                    ),
                }
            )

        return matrix

    def _find_differences(
        self,
        dataframe: pd.DataFrame,
        fields: List[str],
    ) -> List[Dict[str, Any]]:
        differences = []

        for field in fields:
            values = [
                self._normalize_compare_value(
                    row.get(
                        field,
                        "",
                    )
                )
                for _, row in dataframe.iterrows()
            ]

            available_values = [
                value
                for value in values
                if value != ""
            ]

            if len(
                set(
                    available_values
                )
            ) > 1:
                differences.append(
                    {
                        "field": field,
                        "values": [
                            self._display_value(
                                row.get(
                                    field,
                                    "",
                                )
                            )
                            for _, row in dataframe.iterrows()
                        ],
                        "type": "value_difference",
                        "significance": (
                            self._significance(
                                field
                            )
                        ),
                    }
                )

            elif (
                len(available_values)
                and len(available_values)
                < len(values)
            ):
                differences.append(
                    {
                        "field": field,
                        "values": [
                            self._display_value(
                                row.get(
                                    field,
                                    "",
                                )
                            )
                            for _, row in dataframe.iterrows()
                        ],
                        "type": "availability_difference",
                        "significance": (
                            self._significance(
                                field
                            )
                        ),
                    }
                )

        return differences

    def _find_shared_values(
        self,
        dataframe: pd.DataFrame,
        fields: List[str],
    ) -> List[Dict[str, Any]]:
        shared = []

        for field in fields:
            values = [
                self._normalize_compare_value(
                    row.get(
                        field,
                        "",
                    )
                )
                for _, row in dataframe.iterrows()
            ]

            if not values or any(
                value == ""
                for value in values
            ):
                continue

            if len(
                set(values)
            ) == 1:
                shared.append(
                    {
                        "field": field,
                        "value": self._display_value(
                            dataframe.iloc[
                                0
                            ].get(
                                field,
                                "",
                            )
                        ),
                    }
                )

        return shared

    def _select_fields(
        self,
        dataframe: pd.DataFrame,
    ) -> List[str]:
        fields = []

        for column in dataframe.columns:
            normalized = str(
                column
            ).strip().lower()

            if any(
                normalized.startswith(
                    prefix
                )
                for prefix in self.INTERNAL_PREFIXES
            ):
                continue

            if column not in fields:
                fields.append(
                    column
                )

        identity = []
        technical = []
        remaining = []

        for field in fields:
            normalized = self._normalize_field(
                field
            )

            if normalized in self.IDENTITY_FIELDS:
                identity.append(
                    field
                )

            elif self._looks_technical(
                normalized
            ):
                technical.append(
                    field
                )

            else:
                remaining.append(
                    field
                )

        return (
            identity
            + technical
            + remaining
        )[:60]

    def _build_product_labels(
        self,
        dataframe: pd.DataFrame,
    ) -> List[Dict[str, Any]]:
        labels = []

        for index, row in dataframe.iterrows():
            manufacturer = self._first_value(
                row,
                (
                    "manufacturer",
                    "manufacturer_name",
                    "forge_identity_manufacturer",
                ),
            )

            brand = self._first_value(
                row,
                (
                    "brand",
                    "brand_name",
                    "forge_identity_brand",
                ),
            )

            part_number = self._first_value(
                row,
                (
                    "part_number",
                    "part_num",
                    "part_no",
                    "sku",
                    "model",
                    "product_id",
                    "forge_identity_product_id",
                ),
            )

            description = self._first_value(
                row,
                (
                    "description",
                    "product_description",
                    "product_desc",
                    "name",
                    "title",
                    "forge_identity_description",
                ),
            )

            pieces = [
                value
                for value in (
                    manufacturer,
                    brand,
                    part_number,
                )
                if value
            ]

            label = " · ".join(
                pieces
            )

            if not label:
                label = description

            if not label:
                label = f"Product {index + 1}"

            labels.append(
                {
                    "index": int(index),
                    "label": label,
                    "description": description,
                }
            )

        return labels

    def _build_summary(
        self,
        dataframe: pd.DataFrame,
        differences: List[Dict[str, Any]],
        shared: List[Dict[str, Any]],
    ) -> str:
        product_count = len(
            dataframe
        )

        difference_count = len(
            differences
        )

        shared_count = len(
            shared
        )

        if difference_count:
            return (
                f"{product_count} products compared. "
                f"{difference_count} fields show meaningful "
                f"differences and {shared_count} fields are "
                f"shared across the available records."
            )

        return (
            f"{product_count} products compared. "
            "No value differences were found in the "
            "available comparison fields."
        )

    def _semantic_analysis(
        self,
        comparison: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not hasattr(
            self.llm_client,
            "compare_products",
        ):
            return {
                "status": "uncertain",
                "reason": (
                    "Semantic comparison is unavailable."
                ),
            }

        products = []

        for product in comparison.get(
            "products",
            [],
        ):
            products.append(
                product
            )

        try:
            result = self.llm_client.compare_products(
                products
            )

            return result

        except Exception as exc:
            return {
                "status": "uncertain",
                "reason": (
                    f"Semantic comparison failed: {exc}"
                ),
            }

    @staticmethod
    def _to_dataframe(
        products: pd.DataFrame | List[Dict[str, Any]],
    ) -> pd.DataFrame:
        if isinstance(
            products,
            pd.DataFrame,
        ):
            return products.copy()

        if isinstance(
            products,
            list,
        ):
            return pd.DataFrame(
                products
            )

        raise TypeError(
            "Products must be a DataFrame or list of dictionaries."
        )

    @staticmethod
    def _normalize_field(
        field: Any,
    ) -> str:
        text = str(
            field
        ).strip().lower()

        text = text.replace(
            "-",
            "_",
        )

        text = text.replace(
            " ",
            "_",
        )

        return text

    @staticmethod
    def _normalize_compare_value(
        value: Any,
    ) -> str:
        if value is None:
            return ""

        text = str(
            value
        ).strip().lower()

        if text in {
            "",
            "nan",
            "none",
            "null",
            "n/a",
            "na",
            "unknown",
            "-",
            "--",
        }:
            return ""

        return " ".join(
            text.split()
        )

    @staticmethod
    def _display_value(
        value: Any,
    ) -> str:
        if value is None:
            return "Not available"

        text = str(
            value
        ).strip()

        if not text or text.lower() in {
            "nan",
            "none",
            "null",
            "n/a",
            "na",
            "unknown",
            "-",
            "--",
        }:
            return "Not available"

        return text

    @staticmethod
    def _has_value(
        value: Any,
    ) -> bool:
        return (
            ProductComparator._normalize_compare_value(
                value
            )
            != ""
        )

    @staticmethod
    def _field_has_difference(
        values: List[Dict[str, Any]],
    ) -> bool:
        normalized = [
            ProductComparator._normalize_compare_value(
                item.get(
                    "value",
                    "",
                )
            )
            for item in values
        ]

        available = [
            value
            for value in normalized
            if value
        ]

        if not available:
            return False

        return (
            len(
                set(
                    available
                )
            ) > 1
        )

    @staticmethod
    def _looks_technical(
        field: str,
    ) -> bool:
        hints = (
            "voltage",
            "current",
            "power",
            "pressure",
            "temperature",
            "material",
            "size",
            "dimension",
            "diameter",
            "length",
            "width",
            "height",
            "thread",
            "connection",
            "port",
            "flow",
            "speed",
            "frequency",
            "capacity",
            "weight",
            "rating",
            "range",
            "class",
            "grade",
            "ip",
        )

        return any(
            hint in field
            for hint in hints
        )

    @staticmethod
    def _significance(
        field: str,
    ) -> str:
        normalized = str(
            field
        ).lower()

        critical = (
            "voltage",
            "pressure",
            "temperature",
            "rating",
            "material",
            "connection",
            "thread",
            "size",
            "dimension",
        )

        if any(
            token in normalized
            for token in critical
        ):
            return "high"

        if any(
            token in normalized
            for token in (
                "description",
                "name",
                "title",
            )
        ):
            return "low"

        return "medium"

    @staticmethod
    def _first_value(
        row: pd.Series,
        candidates,
    ) -> str:
        normalized = {
            str(key).strip().lower(): key
            for key in row.index
        }

        for candidate in candidates:
            key = normalized.get(
                candidate.lower()
            )

            if key is not None:
                value = str(
                    row.get(
                        key,
                        "",
                    )
                ).strip()

                if value:
                    return value

        return ""