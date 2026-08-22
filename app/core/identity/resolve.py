import re
from typing import Any, Dict, Iterable, Optional

import pandas as pd


PLACEHOLDER_VALUES = {
    "",
    "-",
    "--",
    "n/a",
    "na",
    "none",
    "null",
    "unknown",
    "not available",
    "not applicable",
    "-- unbranded --",
    "-- no unilog brand --",
    "-- no dib brand --",
}


class IdentityResolver:
    """
    Resolves and standardizes product identity fields.

    The resolver cleans identity information but does not fabricate
    manufacturer or brand values that are not present in the source.
    """

    BRAND_HINTS = (
        "brand",
        "manufacturer",
        "mfr",
        "maker",
        "vendor",
    )

    PRODUCT_ID_HINTS = (
        "part_num",
        "part_number",
        "part_no",
        "partnumber",
        "sku",
        "item",
        "product_id",
        "product_code",
        "model",
        "catalog_number",
        "catalog_no",
    )

    DESCRIPTION_HINTS = (
        "description",
        "part_desc",
        "product_desc",
        "name",
        "title",
    )

    def resolve_dataframe(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(dataframe, pd.DataFrame):
            raise TypeError("IdentityResolver expects a pandas DataFrame.")

        working = dataframe.copy()

        if working.empty:
            return working

        for column in working.columns:
            if self._is_identity_column(column):
                working[column] = working[column].map(
                    self.clean_identity_value
                )

        identity = self.resolve_dataframe_identity(working)

        working["FORGE_Identity_Manufacturer"] = identity["manufacturer"]
        working["FORGE_Identity_Brand"] = identity["brand"]
        working["FORGE_Identity_Product_ID"] = identity["product_id"]
        working["FORGE_Identity_Description"] = identity["description"]
        working["FORGE_Identity_Status"] = identity["status"]
        working["FORGE_Identity_Confidence"] = identity["confidence"]

        return working

    def resolve_dataframe_identity(
        self,
        dataframe: pd.DataFrame,
    ) -> Dict[str, pd.Series]:
        manufacturer_columns = self._find_columns(
            dataframe.columns,
            (
                "manufacturer",
                "manufacturer_name",
                "part_manuf",
                "mfr",
                "mfr_name",
                "maker",
            ),
        )

        brand_columns = self._find_columns(
            dataframe.columns,
            (
                "brand",
                "brand_name",
                "e1_brand",
                "unilog_brand",
                "dib_brand",
                "manufacturer_brand",
            ),
        )

        product_id_columns = self._find_columns(
            dataframe.columns,
            self.PRODUCT_ID_HINTS,
        )

        description_columns = self._find_columns(
            dataframe.columns,
            self.DESCRIPTION_HINTS,
        )

        manufacturer = self._first_non_empty(
            dataframe,
            manufacturer_columns,
        )

        brand = self._first_non_empty(
            dataframe,
            brand_columns,
        )

        product_id = self._first_non_empty(
            dataframe,
            product_id_columns,
        )

        description = self._first_non_empty(
            dataframe,
            description_columns,
        )

        status = []
        confidence = []

        for index in dataframe.index:
            values = {
                "manufacturer": manufacturer.loc[index],
                "brand": brand.loc[index],
                "product_id": product_id.loc[index],
                "description": description.loc[index],
            }

            status_value, confidence_value = self._identity_quality(
                values
            )

            status.append(status_value)
            confidence.append(confidence_value)

        return {
            "manufacturer": manufacturer,
            "brand": brand,
            "product_id": product_id,
            "description": description,
            "status": pd.Series(
                status,
                index=dataframe.index,
                dtype="string",
            ),
            "confidence": pd.Series(
                confidence,
                index=dataframe.index,
                dtype="float64",
            ),
        }

    def resolve_record(
        self,
        record: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not isinstance(record, dict):
            raise TypeError("IdentityResolver expects a dictionary record.")

        cleaned = {
            key: self.clean_identity_value(value)
            if self._is_identity_column(key)
            else value
            for key, value in record.items()
        }

        manufacturer = self._first_non_empty_record(
            cleaned,
            (
                "manufacturer",
                "manufacturer_name",
                "part_manuf",
                "mfr",
                "mfr_name",
                "maker",
            ),
        )

        brand = self._first_non_empty_record(
            cleaned,
            (
                "brand",
                "brand_name",
                "e1_brand",
                "unilog_brand",
                "dib_brand",
                "manufacturer_brand",
            ),
        )

        product_id = self._first_non_empty_record(
            cleaned,
            self.PRODUCT_ID_HINTS,
        )

        description = self._first_non_empty_record(
            cleaned,
            self.DESCRIPTION_HINTS,
        )

        status, confidence = self._identity_quality(
            {
                "manufacturer": manufacturer,
                "brand": brand,
                "product_id": product_id,
                "description": description,
            }
        )

        cleaned.update(
            {
                "FORGE_Identity_Manufacturer": manufacturer,
                "FORGE_Identity_Brand": brand,
                "FORGE_Identity_Product_ID": product_id,
                "FORGE_Identity_Description": description,
                "FORGE_Identity_Status": status,
                "FORGE_Identity_Confidence": confidence,
            }
        )

        return cleaned

    @staticmethod
    def clean_identity_value(value: Any) -> str:
        if value is None:
            return ""

        if isinstance(value, float) and pd.isna(value):
            return ""

        text = str(value).strip()

        if text.lower() in PLACEHOLDER_VALUES:
            return ""

        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"\s*([,/;])\s*", r"\1 ", text)

        return text.strip()

    def _is_identity_column(self, column: Any) -> bool:
        name = str(column).strip().lower()

        return any(
            hint in name
            for hint in (
                self.BRAND_HINTS
                + self.PRODUCT_ID_HINTS
                + self.DESCRIPTION_HINTS
            )
        )

    @staticmethod
    def _find_columns(
        columns: Iterable[Any],
        candidates: Iterable[str],
    ):
        normalized = {
            str(column).strip().lower(): column
            for column in columns
        }

        found = []

        for candidate in candidates:
            candidate_lower = candidate.lower()

            if candidate_lower in normalized:
                found.append(normalized[candidate_lower])
                continue

            for normalized_name, original_name in normalized.items():
                if (
                    candidate_lower in normalized_name
                    and original_name not in found
                ):
                    found.append(original_name)

        return found

    def _first_non_empty(
        self,
        dataframe: pd.DataFrame,
        columns: Iterable[Any],
    ) -> pd.Series:
        result = pd.Series(
            "",
            index=dataframe.index,
            dtype="string",
        )

        for column in columns:
            if column not in dataframe.columns:
                continue

            values = dataframe[column].map(self.clean_identity_value)

            mask = result.eq("") & values.ne("")

            result.loc[mask] = values.loc[mask]

        return result

    def _first_non_empty_record(
        self,
        record: Dict[str, Any],
        candidates: Iterable[str],
    ) -> str:
        normalized = {
            str(key).strip().lower(): value
            for key, value in record.items()
        }

        for candidate in candidates:
            candidate_lower = candidate.lower()

            for key, value in normalized.items():
                if key == candidate_lower:
                    cleaned = self.clean_identity_value(value)

                    if cleaned:
                        return cleaned

        return ""

    @staticmethod
    def _identity_quality(
        values: Dict[str, str],
    ):
        product_id = values.get("product_id", "")
        manufacturer = values.get("manufacturer", "")
        brand = values.get("brand", "")
        description = values.get("description", "")

        if product_id and manufacturer:
            return "resolved", 0.95

        if product_id and brand:
            return "resolved", 0.90

        if product_id and description:
            return "partially_resolved", 0.78

        if manufacturer or brand or description:
            return "partial", 0.60

        return "uncertain", 0.0