from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class Decision:
    status: str
    confidence: float
    reason: str
    field: str = ""
    expected: Any = None
    actual: Any = None
    evidence: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DecisionValidator:
    """
    Deterministic validation engine for FORGE.

    It evaluates explicit product requirements against available
    product values. Missing information is treated as uncertain,
    never as a failure.

    Supported requirement forms include:

        voltage >= 24 V
        pressure <= 10 bar
        temperature > 100 °C
        material = stainless steel
        thread = 1/2 in
        IP rating = IP65
        type = ball valve
    """

    OPERATORS = (
        ">=",
        "<=",
        "!=",
        "=",
        ">",
        "<",
        ":",
    )

    NUMERIC_PATTERN = re.compile(
        r"^\s*"
        r"(?P<number>-?\d+(?:\.\d+)?)"
        r"\s*"
        r"(?P<unit>[A-Za-zµΩ%°/0-9.\-\s]*)"
        r"$"
    )

    REQUIREMENT_PATTERN = re.compile(
        r"^\s*"
        r"(?P<field>[A-Za-z0-9_ .\-/()]+?)"
        r"\s*"
        r"(?P<operator>>=|<=|!=|=|>|<|:)"
        r"\s*"
        r"(?P<value>.+?)"
        r"\s*$"
    )

    def validate_dataframe(
        self,
        dataframe,
        requirement: Optional[str] = None,
    ):
        import pandas as pd

        if not isinstance(dataframe, pd.DataFrame):
            raise TypeError(
                "DecisionValidator expects a pandas DataFrame."
            )

        working = dataframe.copy()

        if working.empty:
            return working

        if not requirement:
            return self._add_quality_validation(
                working
            )

        results = []

        for _, row in working.iterrows():
            decision = self.validate_requirement(
                requirement,
                row.to_dict(),
            )

            results.append(
                decision
            )

        working["FORGE_Decision_Status"] = [
            item["status"]
            for item in results
        ]

        working["FORGE_Decision_Confidence"] = [
            item["confidence"]
            for item in results
        ]

        working["FORGE_Decision_Reason"] = [
            item["reason"]
            for item in results
        ]

        return working

    def validate_requirement(
        self,
        requirement: str,
        product: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not isinstance(
            requirement,
            str,
        ):
            raise TypeError(
                "Requirement must be a string."
            )

        requirement = requirement.strip()

        if not requirement:
            return Decision(
                status="uncertain",
                confidence=0.0,
                reason="No requirement was provided.",
            ).to_dict()

        if not isinstance(
            product,
            dict,
        ):
            raise TypeError(
                "Product must be a dictionary."
            )

        parsed = self.parse_requirement(
            requirement
        )

        if parsed is None:
            return Decision(
                status="uncertain",
                confidence=0.0,
                reason=(
                    "FORGE could not identify a structured "
                    "field, operator and value in the requirement."
                ),
            ).to_dict()

        field, operator, expected = parsed

        actual_key = self.find_product_field(
            field,
            product,
        )

        if actual_key is None:
            return Decision(
                status="uncertain",
                confidence=0.0,
                reason=(
                    f"No product field matching '{field}' "
                    "was found."
                ),
                field=field,
                expected=expected,
            ).to_dict()

        actual = product.get(
            actual_key,
            "",
        )

        if self._is_empty(actual):
            return Decision(
                status="uncertain",
                confidence=0.0,
                reason=(
                    f"The product does not provide a value "
                    f"for '{field}'."
                ),
                field=actual_key,
                expected=expected,
                actual=actual,
            ).to_dict()

        status, confidence, reason = self._compare(
            actual,
            operator,
            expected,
        )

        return Decision(
            status=status,
            confidence=confidence,
            reason=reason,
            field=actual_key,
            expected=expected,
            actual=actual,
        ).to_dict()

    def validate_requirements(
        self,
        requirements: List[str],
        product: Dict[str, Any],
    ) -> Dict[str, Any]:
        decisions = [
            self.validate_requirement(
                requirement,
                product,
            )
            for requirement in requirements
            if str(requirement).strip()
        ]

        if not decisions:
            return {
                "status": "uncertain",
                "confidence": 0.0,
                "reason": "No valid requirements were supplied.",
                "decisions": [],
            }

        statuses = [
            item["status"]
            for item in decisions
        ]

        if "not_supported" in statuses:
            overall_status = "not_supported"

        elif all(
            status == "supported"
            for status in statuses
        ):
            overall_status = "supported"

        else:
            overall_status = "uncertain"

        confidence_values = [
            float(
                item.get(
                    "confidence",
                    0.0,
                )
            )
            for item in decisions
        ]

        confidence = (
            sum(confidence_values)
            / len(confidence_values)
        )

        return {
            "status": overall_status,
            "confidence": round(
                confidence,
                3,
            ),
            "reason": self._overall_reason(
                decisions
            ),
            "decisions": decisions,
        }

    def parse_requirement(
        self,
        requirement: str,
    ) -> Optional[
        Tuple[str, str, str]
    ]:
        match = self.REQUIREMENT_PATTERN.match(
            requirement
        )

        if not match:
            return None

        field = match.group(
            "field"
        ).strip()

        operator = match.group(
            "operator"
        ).strip()

        value = match.group(
            "value"
        ).strip()

        if operator == ":":
            operator = "="

        if not field or not value:
            return None

        return (
            field,
            operator,
            value,
        )

    def find_product_field(
        self,
        field: str,
        product: Dict[str, Any],
    ) -> Optional[str]:
        normalized_target = self._normalize_name(
            field
        )

        exact_matches = []

        for key in product:
            normalized_key = self._normalize_name(
                key
            )

            if normalized_key == normalized_target:
                exact_matches.append(
                    key
                )

        if exact_matches:
            return exact_matches[0]

        candidates = []

        for key in product:
            normalized_key = self._normalize_name(
                key
            )

            if (
                normalized_target in normalized_key
                or normalized_key in normalized_target
            ):
                candidates.append(
                    key
                )

        if candidates:
            candidates.sort(
                key=lambda value: len(
                    str(value)
                )
            )

            return candidates[0]

        return None

    def _compare(
        self,
        actual: Any,
        operator: str,
        expected: str,
    ) -> Tuple[
        str,
        float,
        str,
    ]:
        actual_number = self._parse_number(
            actual
        )

        expected_number = self._parse_number(
            expected
        )

        if (
            actual_number is not None
            and expected_number is not None
        ):
            actual_value, actual_unit = (
                actual_number
            )

            expected_value, expected_unit = (
                expected_number
            )

            if (
                actual_unit
                and expected_unit
                and not self._units_compatible(
                    actual_unit,
                    expected_unit,
                )
            ):
                return (
                    "uncertain",
                    0.0,
                    (
                        f"The product value uses '{actual_unit}' "
                        f"while the requirement uses '{expected_unit}'."
                    ),
                )

            comparison = self._numeric_compare(
                actual_value,
                operator,
                expected_value,
            )

            if comparison:
                return (
                    "supported",
                    0.98,
                    (
                        f"The product value {actual} "
                        f"satisfies the requirement {operator} {expected}."
                    ),
                )

            return (
                "not_supported",
                0.98,
                (
                    f"The product value {actual} "
                    f"does not satisfy the requirement {operator} {expected}."
                ),
            )

        actual_text = self._normalize_text(
            actual
        )

        expected_text = self._normalize_text(
            expected
        )

        if operator == "=":
            if (
                actual_text == expected_text
                or expected_text in actual_text
                or actual_text in expected_text
            ):
                return (
                    "supported",
                    0.92,
                    (
                        f"The product value '{actual}' "
                        f"matches the requested value '{expected}'."
                    ),
                )

            return (
                "not_supported",
                0.92,
                (
                    f"The product value '{actual}' "
                    f"does not match the requested value '{expected}'."
                ),
            )

        if operator == "!=":
            if actual_text != expected_text:
                return (
                    "supported",
                    0.92,
                    (
                        f"The product value '{actual}' "
                        f"differs from '{expected}'."
                    ),
                )

            return (
                "not_supported",
                0.92,
                (
                    f"The product value '{actual}' "
                    f"is the value excluded by the requirement."
                ),
            )

        return (
            "uncertain",
            0.0,
            (
                "The requirement appears to be qualitative "
                "but the requested comparison cannot be "
                "performed reliably."
            ),
        )

    def _add_quality_validation(
        self,
        dataframe,
    ):
        working = dataframe.copy()

        statuses = []
        reasons = []

        for _, row in working.iterrows():
            populated = 0
            total = 0

            for column, value in row.items():
                if str(column).startswith(
                    "FORGE_"
                ):
                    continue

                total += 1

                if not self._is_empty(
                    value
                ):
                    populated += 1

            coverage = (
                populated / total
                if total
                else 0.0
            )

            if coverage >= 0.75:
                status = "supported"
                reason = (
                    "The record contains strong source coverage."
                )

            elif coverage >= 0.4:
                status = "uncertain"
                reason = (
                    "The record contains partial source coverage."
                )

            else:
                status = "uncertain"
                reason = (
                    "The record has insufficient source coverage "
                    "for a strong validation conclusion."
                )

            statuses.append(
                status
            )

            reasons.append(
                reason
            )

        working[
            "FORGE_Validation_Status"
        ] = statuses

        working[
            "FORGE_Validation_Reason"
        ] = reasons

        return working

    @staticmethod
    def _numeric_compare(
        actual: float,
        operator: str,
        expected: float,
    ) -> bool:
        if operator == ">=":
            return actual >= expected

        if operator == "<=":
            return actual <= expected

        if operator == ">":
            return actual > expected

        if operator == "<":
            return actual < expected

        if operator == "=":
            return actual == expected

        if operator == "!=":
            return actual != expected

        return False

    def _parse_number(
        self,
        value: Any,
    ) -> Optional[
        Tuple[float, str]
    ]:
        if value is None:
            return None

        text = str(
            value
        ).strip()

        if not text:
            return None

        match = self.NUMERIC_PATTERN.match(
            text
        )

        if not match:
            return None

        try:
            number = float(
                match.group(
                    "number"
                )
            )
        except ValueError:
            return None

        unit = (
            match.group(
                "unit"
            )
            .strip()
            .lower()
        )

        return (
            number,
            unit,
        )

    @staticmethod
    def _units_compatible(
        first: str,
        second: str,
    ) -> bool:
        if first == second:
            return True

        compatible_groups = (
            {
                "v",
                "mv",
            },
            {
                "a",
                "ma",
            },
            {
                "w",
                "kw",
            },
            {
                "hz",
                "khz",
                "mhz",
                "ghz",
            },
            {
                "mm",
                "cm",
                "m",
            },
            {
                "pa",
                "kpa",
                "mpa",
                "bar",
                "psi",
            },
            {
                "c",
                "°c",
                "f",
                "°f",
            },
        )

        return any(
            first in group
            and second in group
            for group in compatible_groups
        )

    @staticmethod
    def _normalize_name(
        value: Any,
    ) -> str:
        return re.sub(
            r"[^a-z0-9]+",
            "_",
            str(value)
            .strip()
            .lower(),
        ).strip("_")

    @staticmethod
    def _normalize_text(
        value: Any,
    ) -> str:
        text = str(
            value or ""
        ).strip().lower()

        text = re.sub(
            r"\s+",
            " ",
            text,
        )

        return text

    @staticmethod
    def _is_empty(
        value: Any,
    ) -> bool:
        if value is None:
            return True

        text = str(
            value
        ).strip().lower()

        return text in {
            "",
            "nan",
            "none",
            "null",
            "n/a",
            "na",
            "unknown",
            "-",
            "--",
        }

    @staticmethod
    def _overall_reason(
        decisions: List[Dict[str, Any]],
    ) -> str:
        supported = sum(
            item["status"] == "supported"
            for item in decisions
        )

        not_supported = sum(
            item["status"] == "not_supported"
            for item in decisions
        )

        uncertain = sum(
            item["status"] == "uncertain"
            for item in decisions
        )

        return (
            f"{supported} supported, "
            f"{not_supported} not supported, "
            f"{uncertain} uncertain."
        )