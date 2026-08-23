/* ================================================================
   FORGE — EVALUATION
   ================================================================ */
"use strict";

const EVALUATION = { result: null, loading: false };

function evaluationValue(value) {
    return window.escapeHTML ? escapeHTML(value ?? "") : String(value ?? "");
}

function getEvaluationInput() {
    const text = document.getElementById("evaluation-result")?.value.trim() || "";
    if (text) {
        try { return JSON.parse(text); } catch (_) { return { records: [{ result: text }] }; }
    }
    const matches = window.FORGE_STORE ? FORGE_STORE.getMatch() : [];
    return { records: matches };
}

async function runEvaluation() {
    if (EVALUATION.loading) return;

    const requirement = document.getElementById("evaluation-requirement")?.value.trim() || "";
    const payload = {
        result: getEvaluationInput(),
        source_data: window.FORGE_STORE ? FORGE_STORE.getProducts() : [],
        rubric: {
            focus: document.getElementById("evaluation-rubric")?.value || "decision",
            requirement
        },
        use_llm: Boolean(document.getElementById("evaluation-use-llm")?.checked)
    };

    EVALUATION.loading = true;
    try {
        const result = await forgeFetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        EVALUATION.result = result;
        renderEvaluation(result);
        showToast("Evaluation completed.", "success");
    } catch (error) {
        showToast(getErrorMessage(error), "error", "Evaluation failed");
    } finally {
        EVALUATION.loading = false;
    }
}

function setMetric(id, value) { const el = document.getElementById(id); if (el) el.textContent = value === undefined || value === null ? "—" : `${Math.round(Number(value))}`; }
function setBar(id, value) { const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`; }

function renderEvaluation(result) {
    setMetric("evaluation-score", result.score);
    const label = document.getElementById("evaluation-score-label");
    if (label) label.textContent = result.status || "evaluated";
    setMetric("evaluation-requirement-score", result.completeness);
    setMetric("evaluation-evidence-score", result.evidence_coverage);
    setMetric("evaluation-issue-count", Array.isArray(result.checks) ? result.checks.filter(c => c.status === "review").length : 0);
    const verdict = document.getElementById("evaluation-verdict");
    if (verdict) verdict.textContent = result.reasoning || "Evaluation completed.";
    const badge = document.getElementById("evaluation-verdict-badge");
    if (badge) badge.textContent = String(result.status || "review").replaceAll("_", " ").toUpperCase();
    setMetric("dimension-requirements-value", result.completeness);
    setMetric("dimension-evidence-value", result.evidence_coverage);
    setMetric("dimension-consistency-value", result.consistency);
    setMetric("dimension-uncertainty-value", 100 - Number(result.explainability || 0));
    setBar("dimension-requirements-bar", result.completeness);
    setBar("dimension-evidence-bar", result.evidence_coverage);
    setBar("dimension-consistency-bar", result.consistency);
    setBar("dimension-uncertainty-bar", 100 - Number(result.explainability || 0));
    const issues = document.getElementById("evaluation-issues");
    if (issues) {
        const list = Array.isArray(result.weaknesses) ? result.weaknesses : [];
        issues.innerHTML = list.length ? list.map(item => `<div class="evaluation-issue"><strong>Review</strong><p>${evaluationValue(item)}</p></div>`).join("") : `<div class="empty-state compact"><p>No major weaknesses were identified by the evaluation.</p></div>`;
    }
}

function initializeEvaluation() {
    document.getElementById("run-evaluation")?.addEventListener("click", runEvaluation);
    const stored = window.FORGE_STORE ? FORGE_STORE.getMatch() : [];
    if (stored.length) {
        const field = document.getElementById("evaluation-result");
        if (field) field.value = JSON.stringify({ records: stored }, null, 2);
    }
}

window.EVALUATION = EVALUATION;
window.runEvaluation = runEvaluation;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeEvaluation);
else initializeEvaluation();
