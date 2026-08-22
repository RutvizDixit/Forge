from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class EvaluationResult:
    score: float
    status: str
    strengths: List[str]
    weaknesses: List[str]
    evidence_coverage: float
    completeness: float
    consistency: float
    explainability: float
    reasoning: str
    checks: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class EvaluationEngine:
    """
    Evaluates the quality of a FORGE processing result.

    The evaluator focuses on:

    - evidence coverage
    - record completeness
    - decision consistency
    - explainability
    - unsupported claims
    - review requirements

    It can optionally use an LLM for a second semantic opinion,
    but the baseline score remains deterministic.
    """

    def __init__(
        self,
        llm_client=None,
    ):
        self.llm_client = llm_client

    def evaluate(
        self,
        result: Any,
        source_data: Any = None,
        rubric: Optional[Dict[str, Any]] = None,
        use_llm: bool = False,
    ) -> Dict[str, Any]:
        normalized = self._normalize_result(
            result
        )

        records = normalized.get(
            "records",
            [],
        )

        if not isinstance(
            records,
            list,
        ):
            records = []

        checks = []

        evidence_coverage = self._score_evidence(
            records,
            checks,
        )

        completeness = self._score_completeness(
            records,
            checks,
        )

        consistency = self._score_consistency(
            records,
            checks,
        )

        explainability = self._score_explainability(
            records,
            checks,
        )

        unsupported_claims = self._find_unsupported_claims(
            records
        )

        for claim in unsupported_claims:
            checks.append(
                {
                    "name": "unsupported_claim",
                    "status": "review",
                    "detail": claim,
                }
            )

        base_score = (
            evidence_coverage * 0.35
            + completeness * 0.20
            + consistency * 0.20
            + explainability * 0.25
        )

        if unsupported_claims:
            penalty = min(
                20.0,
                len(
                    unsupported_claims
                ) * 2.5,
            )

            base_score = max(
                0.0,
                base_score - penalty,
            )

        if rubric:
            base_score = self._apply_rubric(
                base_score,
                rubric,
            )

        strengths = self._build_strengths(
            evidence_coverage,
            completeness,
            consistency,
            explainability,
        )

        weaknesses = self._build_weaknesses(
            evidence_coverage,
            completeness,
            consistency,
            explainability,
            unsupported_claims,
        )

        status = self._status_from_score(
            base_score
        )

        reasoning = self._build_reasoning(
            base_score,
            evidence_coverage,
            completeness,
            consistency,
            explainability,
            unsupported_claims,
        )

        evaluation = EvaluationResult(
            score=round(
                base_score,
                2,
            ),
            status=status,
            strengths=strengths,
            weaknesses=weaknesses,
            evidence_coverage=round(
                evidence_coverage,
                2,
            ),
            completeness=round(
                completeness,
                2,
            ),
            consistency=round(
                consistency,
                2,
            ),
            explainability=round(
                explainability,
                2,
            ),
            reasoning=reasoning,
            checks=checks,
        ).to_dict()

        if use_llm and self.llm_client is not None:
            evaluation[
                "semantic_review"
            ] = self._semantic_review(
                evaluation,
                source_data,
            )

        return evaluation

    def grade(
        self,
        result: Any,
        source_data: Any = None,
        rubric: Optional[Dict[str, Any]] = None,
        use_llm: bool = False,
    ) -> Dict[str, Any]:
        return self.evaluate(
            result,
            source_data=source_data,
            rubric=rubric,
            use_llm=use_llm,
        )

    def evaluate_records(
        self,
        records: List[Dict[str, Any]],
        source_data: Any = None,
        rubric: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.evaluate(
            {
                "records": records,
            },
            source_data=source_data,
            rubric=rubric,
        )

    def _score_evidence(
        self,
        records: List[Dict[str, Any]],
        checks: List[Dict[str, Any]],
    ) -> float:
        if not records:
            checks.append(
                {
                    "name": "evidence_coverage",
                    "status": "review",
                    "detail": "No records were supplied.",
                }
            )

            return 0.0

        scores = []

        for index, record in enumerate(
            records
        ):
            evidence_fields = [
                key
                for key in record
                if any(
                    token in str(key).lower()
                    for token in (
                        "evidence",
                        "source",
                        "citation",
                        "reference",
                        "url",
                    )
                )
            ]

            if not evidence_fields:
                scores.append(
                    0.0
                )
                continue

            populated = sum(
                self._has_value(
                    record.get(
                        field,
                        "",
                    )
                )
                for field in evidence_fields
            )

            scores.append(
                (
                    populated
                    / len(evidence_fields)
                )
                * 100
            )

        score = sum(scores) / len(scores)

        checks.append(
            {
                "name": "evidence_coverage",
                "status": (
                    "pass"
                    if score >= 70
                    else "review"
                ),
                "detail": (
                    f"Average evidence coverage is "
                    f"{score:.1f}%."
                ),
            }
        )

        return score

    def _score_completeness(
        self,
        records: List[Dict[str, Any]],
        checks: List[Dict[str, Any]],
    ) -> float:
        if not records:
            return 0.0

        scores = []

        for record in records:
            source_fields = [
                key
                for key in record
                if not str(key).startswith(
                    "FORGE_"
                )
            ]

            if not source_fields:
                scores.append(
                    0.0
                )
                continue

            populated = sum(
                self._has_value(
                    record.get(
                        field,
                        "",
                    )
                )
                for field in source_fields
            )

            scores.append(
                (
                    populated
                    / len(source_fields)
                )
                * 100
            )

        score = sum(scores) / len(scores)

        checks.append(
            {
                "name": "completeness",
                "status": (
                    "pass"
                    if score >= 60
                    else "review"
                ),
                "detail": (
                    f"Average source completeness is "
                    f"{score:.1f}%."
                ),
            }
        )

        return score

    def _score_consistency(
        self,
        records: List[Dict[str, Any]],
        checks: List[Dict[str, Any]],
    ) -> float:
        if not records:
            return 0.0

        consistency_scores = []

        for record in records:
            status_values = []

            for key, value in record.items():
                key_lower = str(
                    key
                ).lower()

                if any(
                    token in key_lower
                    for token in (
                        "status",
                        "confidence",
                        "review",
                        "validation",
                    )
                ):
                    if self._has_value(
                        value
                    ):
                        status_values.append(
                            str(value).lower()
                        )

            conflicts = sum(
                "conflict" in value
                or "contradict" in value
                for value in status_values
            )

            uncertain = sum(
                "uncertain" in value
                or "review" in value
                for value in status_values
            )

            if conflicts:
                consistency_scores.append(
                    40.0
                )

            elif uncertain:
                consistency_scores.append(
                    75.0
                )

            else:
                consistency_scores.append(
                    100.0
                )

        score = (
            sum(consistency_scores)
            / len(consistency_scores)
        )

        checks.append(
            {
                "name": "consistency",
                "status": (
                    "pass"
                    if score >= 80
                    else "review"
                ),
                "detail": (
                    f"Decision consistency score is "
                    f"{score:.1f}%."
                ),
            }
        )

        return score

    def _score_explainability(
        self,
        records: List[Dict[str, Any]],
        checks: List[Dict[str, Any]],
    ) -> float:
        if not records:
            return 0.0

        scores = []

        for record in records:
            explanation_fields = [
                key
                for key in record
                if any(
                    token in str(key).lower()
                    for token in (
                        "reason",
                        "explanation",
                        "basis",
                        "rationale",
                    )
                )
            ]

            if not explanation_fields:
                scores.append(
                    0.0
                )
                continue

            populated = sum(
                self._has_value(
                    record.get(
                        field,
                        "",
                    )
                )
                for field in explanation_fields
            )

            scores.append(
                (
                    populated
                    / len(explanation_fields)
                )
                * 100
            )

        score = (
            sum(scores)
            / len(scores)
        )

        checks.append(
            {
                "name": "explainability",
                "status": (
                    "pass"
                    if score >= 70
                    else "review"
                ),
                "detail": (
                    f"Explainability coverage is "
                    f"{score:.1f}%."
                ),
            }
        )

        return score

    def _find_unsupported_claims(
        self,
        records: List[Dict[str, Any]],
    ) -> List[str]:
        findings = []

        claim_tokens = (
            "verified",
            "guaranteed",
            "certified",
            "compliant",
            "meets",
            "approved",
        )

        evidence_tokens = (
            "evidence",
            "source",
            "citation",
            "reference",
            "url",
        )

        for index, record in enumerate(
            records
        ):
            has_evidence = any(
                self._has_value(
                    record.get(
                        key,
                        "",
                    )
                )
                for key in record
                if any(
                    token in str(key).lower()
                    for token in evidence_tokens
                )
            )

            if has_evidence:
                continue

            for key, value in record.items():
                if str(key).startswith(
                    "FORGE_"
                ):
                    continue

                text = str(
                    value
                ).lower()

                if any(
                    token in text
                    for token in claim_tokens
                ):
                    findings.append(
                        (
                            f"Record {index}: "
                            f"claim-like language found in "
                            f"'{key}' without an explicit "
                            "evidence field."
                        )
                    )

        return findings

    def _semantic_review(
        self,
        evaluation: Dict[str, Any],
        source_data: Any,
    ) -> Dict[str, Any]:
        if not hasattr(
            self.llm_client,
            "explain",
        ):
            return {
                "status": "uncertain",
                "reason": (
                    "Semantic evaluation is unavailable."
                ),
            }

        context = {
            "evaluation": evaluation,
            "source_data": source_data,
        }

        try:
            return self.llm_client.explain(
                (
                    "Review this FORGE evaluation. "
                    "Identify whether the score and reasoning "
                    "appear justified by the supplied information. "
                    "Do not invent missing evidence."
                ),
                context,
            )

        except Exception as exc:
            return {
                "status": "uncertain",
                "reason": (
                    f"Semantic evaluation failed: {exc}"
                ),
            }

    @staticmethod
    def _normalize_result(
        result: Any,
    ) -> Dict[str, Any]:
        if result is None:
            return {
                "records": [],
            }

        if isinstance(
            result,
            dict,
        ):
            return result

        if hasattr(
            result,
            "records",
        ):
            return {
                "records": result.records,
                "statistics": getattr(
                    result,
                    "statistics",
                    {},
                ),
                "review_items": getattr(
                    result,
                    "review_items",
                    [],
                ),
            }

        if isinstance(
            result,
            list,
        ):
            return {
                "records": result,
            }

        return {
            "records": [],
        }

    @staticmethod
    def _apply_rubric(
        score: float,
        rubric: Dict[str, Any],
    ) -> float:
        if not isinstance(
            rubric,
            dict,
        ):
            return score

        minimum = rubric.get(
            "minimum_score"
        )

        if minimum is not None:
            try:
                minimum = float(
                    minimum
                )

                if score < minimum:
                    return max(
                        0.0,
                        score - (
                            minimum - score
                        ) * 0.1,
                    )

            except (
                TypeError,
                ValueError,
            ):
                pass

        return score

    @staticmethod
    def _status_from_score(
        score: float,
    ) -> str:
        if score >= 85:
            return "strong"

        if score >= 70:
            return "good"

        if score >= 50:
            return "review"

        return "weak"

    @staticmethod
    def _build_strengths(
        evidence: float,
        completeness: float,
        consistency: float,
        explainability: float,
    ) -> List[str]:
        strengths = []

        if evidence >= 80:
            strengths.append(
                "Strong evidence coverage."
            )

        if completeness >= 75:
            strengths.append(
                "Source records are well populated."
            )

        if consistency >= 90:
            strengths.append(
                "Decisions show strong internal consistency."
            )

        if explainability >= 80:
            strengths.append(
                "Results provide clear reasoning."
            )

        if not strengths:
            strengths.append(
                "The result contains a usable processing baseline."
            )

        return strengths

    @staticmethod
    def _build_weaknesses(
        evidence: float,
        completeness: float,
        consistency: float,
        explainability: float,
        unsupported_claims: List[str],
    ) -> List[str]:
        weaknesses = []

        if evidence < 70:
            weaknesses.append(
                "Evidence coverage should be improved."
            )

        if completeness < 60:
            weaknesses.append(
                "Several records contain incomplete source information."
            )

        if consistency < 80:
            weaknesses.append(
                "Some decisions require additional review."
            )

        if explainability < 70:
            weaknesses.append(
                "Some outputs lack sufficiently detailed reasoning."
            )

        if unsupported_claims:
            weaknesses.append(
                "Claim-like statements were found without explicit evidence."
            )

        return weaknesses

    @staticmethod
    def _build_reasoning(
        score: float,
        evidence: float,
        completeness: float,
        consistency: float,
        explainability: float,
        unsupported_claims: List[str],
    ) -> str:
        reasoning = (
            f"Overall score: {score:.1f}. "
            f"Evidence coverage: {evidence:.1f}%. "
            f"Completeness: {completeness:.1f}%. "
            f"Consistency: {consistency:.1f}%. "
            f"Explainability: {explainability:.1f}%."
        )

        if unsupported_claims:
            reasoning += (
                " Claim-like output without explicit evidence "
                "was detected and should be reviewed."
            )

        return reasoning

    @staticmethod
    def _has_value(
        value: Any,
    ) -> bool:
        if value is None:
            return False

        text = str(
            value
        ).strip().lower()

        return text not in {
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