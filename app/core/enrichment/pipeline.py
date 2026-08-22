from typing import Any, Dict, List, Optional

import pandas as pd


class EnrichmentPipeline:
    """
    Main product-record enrichment pipeline.

    The pipeline improves structure and consistency while preserving
    the distinction between source information and derived information.

    It does not invent missing product specifications.
    """

    DERIVED_PREFIX = "FORGE_"

    IDENTITY_COLUMNS = {
        "forge_identity_manufacturer",
        "forge_identity_brand",
        "forge_identity_product_id",
        "forge_identity_description",
    }

    TECHNICAL_HINTS = (
        "size",
        "dimension",
        "diameter",
        "length",
        "width",
        "height",
        "pressure",
        "temperature",
        "voltage",
        "current",
        "power",
        "material",
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
        "type",
        "class",
        "grade",
    )

    def __init__(
        self,
        normalizer=None,
        identity_resolver=None,
        validator=None,
        evidence_manager=None,
        llm_client=None,
    ):
        self.normalizer = normalizer
        self.identity_resolver = identity_resolver
        self.validator = validator
        self.evidence_manager = evidence_manager
        self.llm_client = llm_client

    def run(
        self,
        dataframe: pd.DataFrame,
        use_llm: bool = True,
    ) -> pd.DataFrame:
        if not isinstance(dataframe, pd.DataFrame):
            raise TypeError(
                "EnrichmentPipeline expects a pandas DataFrame."
            )

        working = dataframe.copy()

        if working.empty:
            return self._add_empty_pipeline_fields(working)

        working = self._clean_source_values(working)

        if self.normalizer is not None:
            working = self._apply_normalization(working)

        working = self._add_identity_summary(working)

        working = self._add_record_quality(working)

        working = self._add_technical_coverage(working)

        working = self._add_review_signals(working)

        if use_llm and self.llm_client is not None:
            working = self._apply_llm_enrichment(working)

        if self.validator is not None:
            working = self._apply_validation(working)

        return working

    def enrich_dataframe(
        self,
        dataframe: pd.DataFrame,
        use_llm: bool = True,
    ) -> pd.DataFrame:
        return self.run(
            dataframe,
            use_llm=use_llm,
        )

    def enrich_record(
        self,
        record: Dict[str, Any],
        use_llm: bool = True,
    ) -> Dict[str, Any]:
        if not isinstance(record, dict):
            raise TypeError(
                "EnrichmentPipeline expects a dictionary record."
            )

        dataframe = pd.DataFrame([record])

        result = self.run(
            dataframe,
            use_llm=use_llm,
        )

        if result.empty:
            return {}

        return result.iloc[0].to_dict()

    def _clean_source_values(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        working = dataframe.copy()

        for column in working.columns:
            if column.startswith(self.DERIVED_PREFIX):
                continue

            working[column] = (
                working[column]
                .fillna("")
                .astype(str)
                .map(self._clean_text)
            )

        return working

    def _apply_normalization(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        if hasattr(
            self.normalizer,
            "normalize_dataframe",
        ):
            normalized = self.normalizer.normalize_dataframe(
                dataframe
            )

            if isinstance(normalized, pd.DataFrame):
                return normalized

        if callable(self.normalizer):
            normalized = self.normalizer(dataframe)

            if isinstance(normalized, pd.DataFrame):
                return normalized

        return dataframe

    def _add_identity_summary(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        working = dataframe.copy()

        manufacturer = self._find_series(
            working,
            (
                "forge_identity_manufacturer",
                "manufacturer",
                "manufacturer_name",
                "part_manuf",
                "mfr",
                "maker",
            ),
        )

        brand = self._find_series(
            working,
            (
                "forge_identity_brand",
                "brand",
                "brand_name",
                "e1_brand",
                "unilog_brand",
                "dib_brand",
            ),
        )

        product_id = self._find_series(
            working,
            (
                "forge_identity_product_id",
                "mfg_part_num",
                "mfg_part_number",
                "part_num",
                "part_number",
                "part_no",
                "sku",
                "item_number",
                "product_id",
                "product_code",
                "model",
            ),
        )

        description = self._find_series(
            working,
            (
                "forge_identity_description",
                "part_desc",
                "product_desc",
                "description",
                "product_name",
                "name",
                "title",
            ),
        )

        working["FORGE_Product_Identity"] = [
            self._build_identity(
                manufacturer.iloc[index],
                brand.iloc[index],
                product_id.iloc[index],
            )
            for index in range(len(working))
        ]

        working["FORGE_Record_Description"] = [
            self._build_description(
                description.iloc[index],
                product_id.iloc[index],
            )
            for index in range(len(working))
        ]

        return working

    def _add_record_quality(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        working = dataframe.copy()

        source_columns = [
            column
            for column in working.columns
            if not column.startswith(self.DERIVED_PREFIX)
        ]

        if not source_columns:
            working["FORGE_Completeness"] = 0.0
            working["FORGE_Record_Status"] = "uncertain"
            return working

        completeness = []

        for _, row in working.iterrows():
            populated = 0

            for column in source_columns:
                value = row.get(column, "")

                if self._has_value(value):
                    populated += 1

            percentage = round(
                populated / len(source_columns) * 100,
                2,
            )

            completeness.append(percentage)

        working["FORGE_Completeness"] = completeness

        working["FORGE_Record_Status"] = [
            self._quality_status(value)
            for value in completeness
        ]

        return working

    def _add_technical_coverage(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        working = dataframe.copy()

        technical_columns = [
            column
            for column in working.columns
            if self._is_technical_column(column)
        ]

        if not technical_columns:
            working["FORGE_Technical_Coverage"] = 0.0
            return working

        coverage = []

        for _, row in working.iterrows():
            populated = sum(
                self._has_value(row.get(column, ""))
                for column in technical_columns
            )

            coverage.append(
                round(
                    populated / len(technical_columns) * 100,
                    2,
                )
            )

        working["FORGE_Technical_Coverage"] = coverage

        return working

    def _add_review_signals(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        working = dataframe.copy()

        review_reasons: List[str] = []
        review_required: List[str] = []

        for _, row in working.iterrows():
            reasons = []

            completeness = self._safe_float(
                row.get("FORGE_Completeness", 0)
            )

            technical_coverage = self._safe_float(
                row.get("FORGE_Technical_Coverage", 0)
            )

            identity = str(
                row.get("FORGE_Product_Identity", "")
            ).strip()

            if not identity:
                reasons.append("product identity is incomplete")

            if completeness < 35:
                reasons.append("record has low source coverage")

            if technical_coverage < 25:
                reasons.append(
                    "technical information is sparse"
                )

            status_values = self._find_status_values(row)

            if status_values:
                reasons.extend(status_values)

            review_reasons.append(
                "; ".join(dict.fromkeys(reasons))
            )

            review_required.append(
                "yes" if reasons else "no"
            )

        working["FORGE_Review_Required"] = review_required
        working["FORGE_Review_Reasons"] = review_reasons

        return working

    def _apply_llm_enrichment(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Optional semantic enrichment.

        The LLM is only given existing record information. It is not
        allowed to silently write unsupported product facts into the
        source columns.
        """

        if dataframe.empty:
            return dataframe

        if not hasattr(self.llm_client, "enrich_record"):
            return dataframe

        working = dataframe.copy()

        ai_status = []
        ai_reason = []
        ai_confidence = []

        for _, row in working.iterrows():
            record = row.to_dict()

            try:
                result = self.llm_client.enrich_record(
                    record
                )

                if not isinstance(result, dict):
                    raise ValueError(
                        "LLM enrichment returned an invalid result."
                    )

                ai_status.append(
                    str(
                        result.get(
                            "status",
                            "uncertain",
                        )
                    )
                )

                ai_reason.append(
                    str(
                        result.get(
                            "reason",
                            "",
                        )
                    )
                )

                ai_confidence.append(
                    self._safe_float(
                        result.get(
                            "confidence",
                            0,
                        )
                    )
                )

            except Exception as exc:
                ai_status.append("uncertain")
                ai_reason.append(
                    f"LLM enrichment unavailable: {exc}"
                )
                ai_confidence.append(0.0)

        working["FORGE_AI_Status"] = ai_status
        working["FORGE_AI_Reason"] = ai_reason
        working["FORGE_AI_Confidence"] = ai_confidence

        return working

    def _apply_validation(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        if hasattr(
            self.validator,
            "validate_dataframe",
        ):
            validated = self.validator.validate_dataframe(
                dataframe
            )

            if isinstance(validated, pd.DataFrame):
                return validated

        if callable(self.validator):
            validated = self.validator(dataframe)

            if isinstance(validated, pd.DataFrame):
                return validated

        return dataframe

    def _add_empty_pipeline_fields(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        working = dataframe.copy()

        working["FORGE_Product_Identity"] = pd.Series(
            dtype="string"
        )

        working["FORGE_Record_Description"] = pd.Series(
            dtype="string"
        )

        working["FORGE_Completeness"] = pd.Series(
            dtype="float64"
        )

        working["FORGE_Technical_Coverage"] = pd.Series(
            dtype="float64"
        )

        working["FORGE_Record_Status"] = pd.Series(
            dtype="string"
        )

        working["FORGE_Review_Required"] = pd.Series(
            dtype="string"
        )

        working["FORGE_Review_Reasons"] = pd.Series(
            dtype="string"
        )

        return working

    def _find_series(
        self,
        dataframe: pd.DataFrame,
        candidates,
    ) -> pd.Series:
        normalized = {
            str(column).strip().lower(): column
            for column in dataframe.columns
        }

        result = pd.Series(
            "",
            index=dataframe.index,
            dtype="string",
        )

        for candidate in candidates:
            candidate_lower = candidate.lower()

            selected = normalized.get(candidate_lower)

            if selected is None:
                for normalized_name, original in normalized.items():
                    if candidate_lower in normalized_name:
                        selected = original
                        break

            if selected is None:
                continue

            values = (
                dataframe[selected]
                .fillna("")
                .astype(str)
                .map(self._clean_text)
            )

            mask = result.eq("") & values.ne("")

            result.loc[mask] = values.loc[mask]

        return result

    def _find_status_values(
        self,
        row: pd.Series,
    ) -> List[str]:
        reasons = []

        for column in row.index:
            name = str(column).lower()

            if not any(
                token in name
                for token in (
                    "status",
                    "review",
                    "conflict",
                    "confidence",
                    "evidence",
                )
            ):
                continue

            value = str(
                row.get(column, "")
            ).strip().lower()

            if not value:
                continue

            if "conflict" in value:
                reasons.append(
                    f"conflict detected in {column}"
                )

            elif "uncertain" in value:
                reasons.append(
                    f"uncertain value in {column}"
                )

            elif "review" in value:
                reasons.append(
                    f"review indicated by {column}"
                )

            elif "low" in value and "confidence" in name:
                reasons.append(
                    f"low confidence in {column}"
                )

        return reasons

    def _is_technical_column(
        self,
        column: Any,
    ) -> bool:
        name = str(column).strip().lower()

        return any(
            hint in name
            for hint in self.TECHNICAL_HINTS
        )

    @staticmethod
    def _build_identity(
        manufacturer: str,
        brand: str,
        product_id: str,
    ) -> str:
        values = [
            str(value).strip()
            for value in (
                manufacturer,
                brand,
                product_id,
            )
            if str(value).strip()
        ]

        return " · ".join(values)

    @staticmethod
    def _build_description(
        description: str,
        product_id: str,
    ) -> str:
        description = str(
            description or ""
        ).strip()

        product_id = str(
            product_id or ""
        ).strip()

        if description:
            return description

        if product_id:
            return f"Product {product_id}"

        return ""

    @staticmethod
    def _quality_status(
        completeness: float,
    ) -> str:
        if completeness >= 75:
            return "strong"

        if completeness >= 45:
            return "usable"

        if completeness >= 25:
            return "review"

        return "incomplete"

    @staticmethod
    def _clean_text(
        value: Any,
    ) -> str:
        text = str(value or "").strip()

        if not text:
            return ""

        return " ".join(
            text.split()
        )

    @staticmethod
    def _has_value(
        value: Any,
    ) -> bool:
        if value is None:
            return False

        if pd.isna(value):
            return False

        return bool(
            str(value).strip()
        )

    @staticmethod
    def _safe_float(
        value: Any,
    ) -> float:
        try:
            return float(value)
        except (
            TypeError,
            ValueError,
        ):
            return 0.0