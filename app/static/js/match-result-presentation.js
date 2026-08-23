/* FORGE — Match result presentation only. Matching data and logic remain untouched. */
"use strict";

(function () {
    function escape(value) {
        return typeof escapeHTML === "function" ? escapeHTML(String(value ?? "")) : String(value ?? "");
    }

    function productName(result) {
        const product = result?.product || result?.raw?.product || result?.raw?.product_name || result?.raw?.name;
        if (typeof product === "string") return product;
        if (product && typeof product === "object") return product.name || product.product_name || product.title || product.id || "Product";
        return "Product";
    }

    function evidenceStatus(result) {
        const raw = result?.raw || {};
        const explicit = raw.support_status || raw.evidence_status || raw.supported_status || raw.support || raw.status_label;
        if (explicit) return String(explicit).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
        if (result.status === "matched") return "Supported";
        if (result.status === "partial") return "Needs Review";
        return "Not Supported";
    }

    function render() {
        if (!location.pathname.includes("match") || !window.MATCH) return;
        const container = document.querySelector("[data-match-results]");
        if (!container) return;
        const results = typeof getFilteredResults === "function" ? getFilteredResults() : (MATCH.results || []);
        if (!MATCH.results?.length) return;
        if (!results.length) return;

        container.innerHTML = results.map((result, index) => {
            const product = productName(result);
            const requirement = result.requirement || MATCH.requirements?.[0] || "your requirement";
            const confidence = Number.isFinite(Number(result.confidence)) ? `${Math.round(Number(result.confidence))}%` : "—";
            const explanation = result.explanation || result.raw?.reason || result.raw?.rationale || "FORGE evaluated the available product information against the requirement.";
            const evidence = Array.isArray(result.evidence) ? result.evidence : [];
            const evidencePreview = evidence.slice(0, 2).map(item => typeof item === "string" ? item : (item?.text || item?.content || item?.title || "Evidence")).filter(Boolean);
            const decision = result.status === "matched" ? "matches" : result.status === "partial" ? "partially matches" : "does not match";
            const statusLabel = result.status === "matched" ? "Matched" : result.status === "partial" ? "Partial" : "Not Supported";
            const rawData = (() => { try { return JSON.stringify(result.raw || result, null, 2); } catch (_) { return String(result.raw || result); } })();
            return `<article class="match-card status-${escape(result.status)}" data-match-id="${escape(result.id)}">
                <div class="match-card-header">
                    <div class="match-card-status"><span class="status-dot"></span><span class="status-label">${escape(statusLabel)}</span></div>
                    <div class="match-confidence"><strong>${escape(confidence)}</strong><span>confidence</span></div>
                </div>
                <div class="match-card-body">
                    <div class="match-decision-heading">${escape(product)} ${decision} your requirement</div>
                    <div class="match-readable-grid">
                        <div><span class="result-section-label">REQUIREMENT</span><p>${escape(requirement)}</p></div>
                        <div><span class="result-section-label">EVIDENCE STATUS</span><p>${escape(evidenceStatus(result))}</p></div>
                    </div>
                    <div class="match-readable-reason"><span class="result-section-label">WHY</span><p>${escape(explanation)}</p></div>
                    ${evidencePreview.length ? `<div class="match-readable-evidence"><span class="result-section-label">SUPPORTING EVIDENCE</span>${evidencePreview.map(item => `<p>${escape(item)}</p>`).join("")}</div>` : ""}
                    <details class="match-full-data"><summary>View Full Match Data</summary><pre>${escape(rawData)}</pre></details>
                </div>
                <div class="match-card-footer"><div class="match-card-meta"><span>${evidence.length} evidence</span><span>${Array.isArray(result.sources) ? result.sources.length : 0} source${Array.isArray(result.sources) && result.sources.length === 1 ? "" : "s"}</span></div><button type="button" class="text-button" data-open-match="${escape(result.id)}">Inspect</button></div>
            </article>`;
        }).join("");

        container.querySelectorAll("[data-open-match]").forEach(button => {
            button.addEventListener("click", () => {
                if (typeof openMatchDetail === "function") openMatchDetail(button.dataset.openMatch);
            });
        });
    }

    function install() {
        if (!location.pathname.includes("match")) return;
        if (!document.getElementById("forge-match-result-presentation-style")) {
            const style = document.createElement("style");
            style.id = "forge-match-result-presentation-style";
            style.textContent = `.match-decision-heading{font-size:1.15rem;font-weight:700;margin-bottom:1.25rem}.match-readable-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-bottom:1rem}.match-readable-grid>div,.match-readable-reason,.match-readable-evidence{padding:1rem;border:1px solid rgba(127,127,127,.18);border-radius:12px}.match-readable-grid p,.match-readable-reason p,.match-readable-evidence p{margin:.35rem 0 0;line-height:1.55}.match-full-data{margin-top:1rem;border-top:1px solid rgba(127,127,127,.18);padding-top:.8rem}.match-full-data summary{cursor:pointer;font-weight:600}.match-full-data pre{margin-top:.8rem;max-height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word;padding:1rem;border-radius:10px;background:rgba(127,127,127,.08);font-size:.78rem;line-height:1.45}@media(max-width:700px){.match-readable-grid{grid-template-columns:1fr}}`;
            document.head.appendChild(style);
        }
        if (window.__forgeMatchResultOriginalRender && typeof window.renderMatchResults === "function") return;
        if (typeof window.renderMatchResults === "function") {
            window.__forgeMatchResultOriginalRender = window.renderMatchResults;
            window.renderMatchResults = function () {
                window.__forgeMatchResultOriginalRender.apply(this, arguments);
                render();
            };
        }
        render();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
    const timer = setInterval(install, 500);
    setTimeout(() => clearInterval(timer), 12000);
})();
