from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

try:
    from openai import OpenAI
except ImportError:  # Optional dependency when no semantic layer is configured.
    OpenAI = None

import config


class LLMClient:
    """
    Optional semantic reasoning layer for FORGE.

    The client is deliberately isolated from the deterministic
    enrichment and validation layers. LLM output is treated as
    derived reasoning and never as unquestioned source truth.
    """

    SYSTEM_PROMPT = """
You are the reasoning layer of FORGE, an industrial product
intelligence system.

Your job is to reason over supplied product information without
inventing unsupported technical facts.

Rules:

1. Use only information present in the supplied record or evidence.
2. Never fabricate a manufacturer, part number, specification,
   certification, dimension, rating or performance value.
3. If the available information is insufficient, say so.
4. Keep uncertainty visible.
5. Distinguish source facts from interpretation.
6. Do not overwrite original source values.
7. Prefer precise, concise reasoning.
8. Return valid JSON only when JSON output is requested.
"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.provider = os.getenv(
            "LLM_PROVIDER",
            "groq",
        ).strip().lower()

        if self.provider == "groq":
            self.api_key = (
                api_key
                if api_key is not None
                else os.getenv("GROQ_API_KEY")
            )

            self.model = (
                model
                if model is not None
                else os.getenv(
                    "GROQ_MODEL",
                    "llama-3.1-8b-instant",
                )
            )

            self.base_url = "https://api.groq.com/openai/v1"

        else:
            self.api_key = (
                api_key
                if api_key is not None
                else config.OPENAI_API_KEY
            )

            self.model = (
                model
                if model is not None
                else config.OPENAI_MODEL
            )

            self.base_url = None

        self.client = None

        if self.api_key and OpenAI is not None:
            if self.base_url:
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url,
                )
            else:
                self.client = OpenAI(
                    api_key=self.api_key,
                )

    @property
    def available(self) -> bool:
        return bool(
            self.client
            and self.model
        )

    def enrich_record(
        self,
        record: Dict[str, Any],
        evidence: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not isinstance(record, dict):
            raise TypeError(
                "LLMClient expects a dictionary record."
            )

        if not self.available:
            return {
                "status": "uncertain",
                "reason": (
                    "LLM reasoning is not configured. "
                    "Deterministic processing remains available."
                ),
                "confidence": 0.0,
            }

        payload = {
            "record": self._sanitize_payload(
                record
            ),
            "evidence": (
                evidence
                or ""
            ),
        }

        prompt = (
            "Review the following product record and available "
            "evidence.\n\n"
            "Return JSON with exactly these fields:\n"
            "- status: supported, uncertain, or not_supported\n"
            "- reason: concise explanation\n"
            "- confidence: number from 0 to 1\n"
            "- observations: array of concise observations\n\n"
            "Do not create missing specifications.\n\n"
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

        try:
            response = self._complete(
                prompt
            )

            parsed = self._parse_json(
                response
            )

            return self._normalize_reasoning_result(
                parsed
            )

        except Exception as exc:
            return {
                "status": "uncertain",
                "reason": (
                    f"LLM reasoning could not be completed: {exc}"
                ),
                "confidence": 0.0,
                "observations": [],
            }

    def check_requirement(
        self,
        requirement: str,
        product: Dict[str, Any],
        evidence: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not requirement.strip():
            raise ValueError(
                "Requirement cannot be empty."
            )

        if not isinstance(product, dict):
            raise TypeError(
                "Product must be a dictionary."
            )

        if not self.available:
            return {
                "status": "uncertain",
                "reason": (
                    "LLM reasoning is not configured. "
                    "The requirement cannot be semantically evaluated "
                    "by this layer."
                ),
                "confidence": 0.0,
                "requirement": requirement,
            }

        payload = {
            "requirement": requirement,
            "product": self._sanitize_payload(
                product
            ),
            "evidence": evidence or "",
        }

        prompt = (
            "Evaluate whether the supplied product satisfies "
            "the supplied requirement.\n\n"
            "Return JSON with exactly these fields:\n"
            "- status: supported, uncertain, or not_supported\n"
            "- reason: concise explanation\n"
            "- confidence: number from 0 to 1\n"
            "- matched_requirements: array\n"
            "- missing_requirements: array\n"
            "- conflicting_requirements: array\n\n"
            "Do not infer a specification that is not supported "
            "by the product information or evidence.\n\n"
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

        try:
            response = self._complete(
                prompt
            )

            parsed = self._parse_json(
                response
            )

            result = self._normalize_reasoning_result(
                parsed
            )

            result["requirement"] = requirement

            result["matched_requirements"] = (
                self._as_list(
                    parsed.get(
                        "matched_requirements",
                        [],
                    )
                )
            )

            result["missing_requirements"] = (
                self._as_list(
                    parsed.get(
                        "missing_requirements",
                        [],
                    )
                )
            )

            result["conflicting_requirements"] = (
                self._as_list(
                    parsed.get(
                        "conflicting_requirements",
                        [],
                    )
                )
            )

            return result

        except Exception as exc:
            return {
                "status": "uncertain",
                "reason": (
                    f"Requirement reasoning failed: {exc}"
                ),
                "confidence": 0.0,
                "requirement": requirement,
                "matched_requirements": [],
                "missing_requirements": [],
                "conflicting_requirements": [],
            }

    def compare_products(
        self,
        products: list[Dict[str, Any]],
        focus: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not products:
            return {
                "status": "uncertain",
                "reason": "No products were supplied.",
                "confidence": 0.0,
                "differences": [],
            }

        if not self.available:
            return {
                "status": "uncertain",
                "reason": (
                    "LLM reasoning is not configured. "
                    "Deterministic comparison can still be performed."
                ),
                "confidence": 0.0,
                "differences": [],
            }

        payload = {
            "products": [
                self._sanitize_payload(product)
                for product in products
            ],
            "focus": focus or "",
        }

        prompt = (
            "Compare the supplied industrial product records.\n\n"
            "Identify meaningful differences using only supplied "
            "information.\n\n"
            "Return JSON with:\n"
            "- status\n"
            "- reason\n"
            "- confidence\n"
            "- differences: array of objects containing field, "
            "values and significance\n"
            "- recommendation_basis: concise evidence-based summary\n\n"
            "Do not select a winner merely because information is missing.\n\n"
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

        try:
            response = self._complete(
                prompt
            )

            parsed = self._parse_json(
                response
            )

            result = self._normalize_reasoning_result(
                parsed
            )

            result["differences"] = (
                parsed.get(
                    "differences",
                    [],
                )
                if isinstance(
                    parsed.get(
                        "differences",
                        [],
                    ),
                    list,
                )
                else []
            )

            result["recommendation_basis"] = str(
                parsed.get(
                    "recommendation_basis",
                    "",
                )
            )

            return result

        except Exception as exc:
            return {
                "status": "uncertain",
                "reason": (
                    f"Comparison reasoning failed: {exc}"
                ),
                "confidence": 0.0,
                "differences": [],
                "recommendation_basis": "",
            }

    def explain(
        self,
        question: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not question.strip():
            raise ValueError(
                "Question cannot be empty."
            )

        if not self.available:
            return {
                "status": "uncertain",
                "answer": (
                    "LLM reasoning is not configured."
                ),
                "confidence": 0.0,
            }

        prompt = (
            "Answer the question using only the supplied FORGE "
            "context. If the context does not contain enough "
            "information, explicitly state that.\n\n"
            f"Question:\n{question}\n\n"
            "Context:\n"
            f"{json.dumps(self._sanitize_payload(context), ensure_ascii=False, indent=2)}"
        )

        try:
            response = self._complete(
                prompt
            )

            return {
                "status": "supported",
                "answer": response.strip(),
                "confidence": 0.8,
            }

        except Exception as exc:
            return {
                "status": "uncertain",
                "answer": (
                    f"Reasoning could not be completed: {exc}"
                ),
                "confidence": 0.0,
            }

    def _complete(
        self,
        prompt: str,
    ) -> str:
        if not self.available:
            raise RuntimeError(
                "LLM client is not configured."
            )

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": self.SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        )

        content = (
            response.choices[0]
            .message
            .content
        )

        if not content:
            raise RuntimeError(
                "LLM returned an empty response."
            )

        return content

    @staticmethod
    def _parse_json(
        response: str,
    ) -> Dict[str, Any]:
        text = response.strip()

        if text.startswith("```"):
            text = text.replace(
                "```json",
                "",
                1,
            )

            text = text.replace(
                "```",
                "",
            ).strip()

        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1:
            raise ValueError(
                "LLM response did not contain a JSON object."
            )

        parsed = json.loads(
            text[start : end + 1]
        )

        if not isinstance(
            parsed,
            dict,
        ):
            raise ValueError(
                "LLM response JSON was not an object."
            )

        return parsed

    @staticmethod
    def _normalize_reasoning_result(
        result: Dict[str, Any],
    ) -> Dict[str, Any]:
        status = str(
            result.get(
                "status",
                "uncertain",
            )
        ).strip().lower()

        status_aliases = {
            "supported": "supported",
            "support": "supported",
            "yes": "supported",
            "pass": "supported",
            "not_supported": "not_supported",
            "not supported": "not_supported",
            "unsupported": "not_supported",
            "no": "not_supported",
            "fail": "not_supported",
            "uncertain": "uncertain",
            "unknown": "uncertain",
            "insufficient": "uncertain",
        }

        status = status_aliases.get(
            status,
            "uncertain",
        )

        try:
            confidence = float(
                result.get(
                    "confidence",
                    0,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            confidence = 0.0

        confidence = max(
            0.0,
            min(
                1.0,
                confidence,
            ),
        )

        return {
            "status": status,
            "reason": str(
                result.get(
                    "reason",
                    "",
                )
            ).strip(),
            "confidence": confidence,
            "observations": (
                LLMClient._as_list(
                    result.get(
                        "observations",
                        [],
                    )
                )
            ),
        }

    @staticmethod
    def _as_list(
        value: Any,
    ) -> list:
        if value is None:
            return []

        if isinstance(
            value,
            list,
        ):
            return value

        return [value]

    @staticmethod
    def _sanitize_payload(
        value: Any,
    ) -> Any:
        if isinstance(
            value,
            dict,
        ):
            return {
                str(key): LLMClient._sanitize_payload(
                    item
                )
                for key, item in value.items()
            }

        if isinstance(
            value,
            list,
        ):
            return [
                LLMClient._sanitize_payload(
                    item
                )
                for item in value
            ]

        if value is None:
            return None

        try:
            return value.item()
        except AttributeError:
            return str(value)