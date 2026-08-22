from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd

from app.core.validation.decision import DecisionValidator


@dataclass
class MatchResult:
    index: int
    score: float
    status: str
    matched: List[Dict[str, Any]]
    missing: List[Dict[str, Any]]
    conflicts: List[Dict[str, Any]]
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ProductMatcher:
    """
    Explainable product matching engine.

    Matching is based on explicit requirement evidence where possible.
    Missing information reduces confidence but is not automatically
    treated as a product failure.
    """

    REQUIREMENT_SPLIT_PATTERN = re.compile(
        r"\s*(?:\n|;|\band\b|\bwith\b|\bthat has\b|\bwhich has\b)\s*",
        flags=re.IGNORECASE,
    )

    FIELD_ALIASES = {
        "manufacturer": (
            "manufacturer",
            "manufacturer_name",
            "maker",
            "mfr",
        ),
        "brand": (
            "brand",
            "brand_name",
        ),
        "part_number": (
            "part_number",
            "part_num",
            "part_no",
            "partnumber",
            "sku",
            "product_id",
            "product_code",
            "model",
        ),
        "description": (
            "description",
            "product_description",
            "product_desc",
            "name",
            "title",
        ),
    }

    def __init__(
        self,
        validator: Optional[DecisionValidator] = None,
        llm_client=None,
    ):
        self.validator = (
            validator
            or DecisionValidator()
        )

        self.llm_client = llm_client

    def match(
        self,
        products: pd.DataFrame | List[Dict[str, Any]],
        requirement: str | List[str] | Dict[str, Any],
        use_llm: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Rank candidate products against a requirement.

        Returns a list sorted from strongest available fit to weakest.
        """

        dataframe = self._to_dataframe(
            products
        )

        if dataframe.empty:
            return []

        requirements = self.parse_requirements(
            requirement
        )

        if not requirements:
            return self._fallback_text_match(
                dataframe,
                str(requirement),
            )

        results = []

        for index, row in dataframe.iterrows():
            product = row.to_dict()

            result = self._score_product(
                index=index,
                product=product,
                requirements=requirements,
            )

            results.append(result)

        if use_llm and self.llm_client is not None:
            results = self._apply_semantic_reasoning(
                results,
                dataframe,
                requirement,
            )

        results.sort(
            key=lambda item: (
                self._status_priority(
                    item["status"]
                ),
                item["score"],
            ),
            reverse=True,
        )

        for rank, item in enumerate(
            results,
            start=1,
        ):
            item["rank"] = rank

        return results

    def rank(
        self,
        products: pd.DataFrame | List[Dict[str, Any]],
        requirements: Any,
    ) -> List[Dict[str, Any]]:
        return self.match(
            products,
            requirements,
        )

    def parse_requirements(
        self,
        requirement: str | List[str] | Dict[str, Any],
    ) -> List[str]:
        if isinstance(
            requirement,
            dict,
        ):
            return self._requirements_from_dict(
                requirement
            )

        if isinstance(
            requirement,
            list,
        ):
            return [
                str(item).strip()
                for item in requirement
                if str(item).strip()
            ]

        text = str(
            requirement or ""
        ).strip()

        if not text:
            return []

        structured = self._extract_structured_requirements(
            text
        )

        if structured:
            return structured

        parts = self.REQUIREMENT_SPLIT_PATTERN.split(
            text
        )

        cleaned = [
            part.strip(
                " .,:;-"
            )
            for part in parts
            if part.strip(
                " .,:;-"
            )
        ]

        return cleaned

    def _score_product(
        self,
        index: Any,
        product: Dict[str, Any],
        requirements: List[str],
    ) -> Dict[str, Any]:
        matched = []
        missing = []
        conflicts = []

        for requirement in requirements:
            decision = self.validator.validate_requirement(
                requirement,
                product,
            )

            status = decision.get(
                "status",
                "uncertain",
            )

            item = {
                "requirement": requirement,
                "field": decision.get(
                    "field",
                    "",
                ),
                "expected": decision.get(
                    "expected",
                    "",
                ),
                "actual": decision.get(
                    "actual",
                    "",
                ),
                "confidence": decision.get(
                    "confidence",
                    0.0,
                ),
                "reason": decision.get(
                    "reason",
                    "",
                ),
            }

            if status == "supported":
                matched.append(
                    item
                )

            elif status == "not_supported":
                conflicts.append(
                    item
                )

            else:
                missing.append(
                    item
                )

        total = len(
            requirements
        )

        if total == 0:
            score = 0.0
            status = "uncertain"

        else:
            score = (
                (
                    len(matched)
                    + (
                        0.35
                        * len(missing)
                    )
                )
                / total
            ) * 100

            if conflicts:
                status = "not_supported"

            elif len(matched) == total:
                status = "supported"

            else:
                status = "uncertain"

        explanation = self._build_explanation(
            matched=matched,
            missing=missing,
            conflicts=conflicts,
        )

        return MatchResult(
            index=int(index),
            score=round(
                min(
                    score,
                    100.0,
                ),
                2,
            ),
            status=status,
            matched=matched,
            missing=missing,
            conflicts=conflicts,
            explanation=explanation,
        ).to_dict()

    def _fallback_text_match(
        self,
        dataframe: pd.DataFrame,
        requirement: str,
    ) -> List[Dict[str, Any]]:
        query_tokens = self._tokenize(
            requirement
        )

        results = []

        for index, row in dataframe.iterrows():
            product_text = " ".join(
                str(value)
                for value in row.values
                if value is not None
            ).lower()

            product_tokens = set(
                self._tokenize(
                    product_text
                )
            )

            if not query_tokens:
                score = 0.0

            else:
                matches = sum(
                    token in product_tokens
                    for token in query_tokens
                )

                score = (
                    matches
                    / len(query_tokens)
                ) * 100

            if score >= 80:
                status = "supported"

            elif score >= 35:
                status = "uncertain"

            else:
                status = "not_supported"

            results.append(
                {
                    "rank": 0,
                    "index": int(index),
                    "score": round(
                        score,
                        2,
                    ),
                    "status": status,
                    "matched": [],
                    "missing": [],
                    "conflicts": [],
                    "explanation": (
                        "Text similarity was used because "
                        "no explicit structured requirement "
                        "could be extracted."
                    ),
                }
            )

        results.sort(
            key=lambda item: (
                self._status_priority(
                    item["status"]
                ),
                item["score"],
            ),
            reverse=True,
        )

        for rank, item in enumerate(
            results,
            start=1,
        ):
            item["rank"] = rank

        return results

    def _apply_semantic_reasoning(
        self,
        results: List[Dict[str, Any]],
        dataframe: pd.DataFrame,
        requirement: Any,
    ) -> List[Dict[str, Any]]:
        if not hasattr(
            self.llm_client,
            "check_requirement",
        ):
            return results

        updated = []

        for result in results:
            try:
                product = dataframe.iloc[
                    result["index"]
                ].to_dict()

                semantic = self.llm_client.check_requirement(
                    str(requirement),
                    product,
                )

                result = dict(
                    result
                )

                result["semantic_status"] = semantic.get(
                    "status",
                    "uncertain",
                )

                result["semantic_confidence"] = semantic.get(
                    "confidence",
                    0.0,
                )

                result["semantic_reason"] = semantic.get(
                    "reason",
                    "",
                )

                result["explanation"] = (
                    f"{result['explanation']} "
                    f"Semantic review: "
                    f"{semantic.get('reason', '')}"
                ).strip()

                updated.append(
                    result
                )

            except Exception:
                updated.append(
                    result
                )

        return updated

    def _extract_structured_requirements(
        self,
        text: str,
    ) -> List[str]:
        requirements = []

        pattern = re.compile(
            r"([A-Za-z][A-Za-z0-9 _/\-().]+?)"
            r"\s*(>=|<=|!=|=|>|<|:)"
            r"\s*"
            r"([^,;\n]+)",
            flags=re.IGNORECASE,
        )

        for match in pattern.finditer(
            text
        ):
            field = match.group(
                1
            ).strip()

            operator = match.group(
                2
            ).strip()

            value = match.group(
                3
            ).strip()

            if field and value:
                requirements.append(
                    f"{field} {operator} {value}"
                )

        return requirements

    def _requirements_from_dict(
        self,
        requirement: Dict[str, Any],
    ) -> List[str]:
        requirements = []

        for field, value in requirement.items():
            if value is None:
                continue

            if isinstance(
                value,
                dict,
            ):
                operator = value.get(
                    "operator",
                    "=",
                )

                expected = value.get(
                    "value",
                    "",
                )

                if str(expected).strip():
                    requirements.append(
                        f"{field} {operator} {expected}"
                    )

            else:
                text = str(
                    value
                ).strip()

                if text:
                    requirements.append(
                        f"{field} = {text}"
                    )

        return requirements

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
    def _build_explanation(
        matched: List[Dict[str, Any]],
        missing: List[Dict[str, Any]],
        conflicts: List[Dict[str, Any]],
    ) -> str:
        parts = []

        if matched:
            parts.append(
                f"{len(matched)} requirement"
                f"{'s' if len(matched) != 1 else ''} supported"
            )

        if missing:
            parts.append(
                f"{len(missing)} requirement"
                f"{'s' if len(missing) != 1 else ''} uncertain"
            )

        if conflicts:
            parts.append(
                f"{len(conflicts)} requirement"
                f"{'s' if len(conflicts) != 1 else ''} not supported"
            )

        if not parts:
            return "No requirement could be evaluated."

        return "; ".join(parts) + "."

    @staticmethod
    def _status_priority(
        status: str,
    ) -> int:
        return {
            "supported": 3,
            "uncertain": 2,
            "not_supported": 1,
        }.get(
            status,
            0,
        )

    @staticmethod
    def _tokenize(
        text: str,
    ) -> List[str]:
        tokens = re.findall(
            r"[a-z0-9]+",
            str(text).lower(),
        )

        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "with",
            "for",
            "of",
            "to",
            "in",
            "on",
            "that",
            "which",
            "has",
            "have",
        }

        return [
            token
            for token in tokens
            if token not in stop_words
        ]