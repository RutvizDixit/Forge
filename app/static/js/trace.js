/* ================================================================
   FORGE — TRACE
   ================================================================ */
"use strict";

const TRACE = { events: [], selected: null };

function traceText(value) { return window.escapeHTML ? escapeHTML(value ?? "") : String(value ?? ""); }

async function loadTrace() {
    const sourceId = document.getElementById("trace-source-id")?.value.trim() || "";
    const recordId = document.getElementById("trace-record-id")?.value.trim() || "";

    if (!sourceId && !recordId) {
        TRACE.events = [];
        renderTrace();
        showToast(
            "Enter a source ID or record ID, or run a workflow first.",
            "warning",
            "No trace data selected"
        );
        return;
    }

    const params = new URLSearchParams();
    if (sourceId) params.set("source_id", sourceId);
    if (recordId) params.set("record_id", recordId);

    try {
        const result = await forgeFetch(`/api/trace${params.toString() ? `?${params}` : ""}`);
        TRACE.events = Array.isArray(result.events) ? result.events : [];
        renderTrace();

        if (TRACE.events.length === 0) {
            showToast(
                "No trace events were found for the selected source or record.",
                "warning",
                "No trace data"
            );
            return;
        }

        showToast("Trace loaded.", "success");
    } catch (error) {
        showToast(getErrorMessage(error), "error", "Trace unavailable");
    }
}

function renderTrace() {
    const path = document.getElementById("trace-path");
    if (!path) return;
    const empty = document.getElementById("trace-empty-state");
    if (empty) empty.remove();

    const stages = new Set(TRACE.events.map(event => event.data?.stage || event.event_type || "event"));
    document.getElementById("trace-event-count")?.replaceChildren(document.createTextNode(String(TRACE.events.length)));
    document.getElementById("trace-stage-count")?.replaceChildren(document.createTextNode(String(stages.size)));
    document.getElementById("trace-status")?.replaceChildren(document.createTextNode(TRACE.events.length ? "FOUND" : "EMPTY"));

    path.innerHTML = TRACE.events.length ? TRACE.events.map((event, index) => `
        <button type="button" class="trace-node" data-trace-index="${index}">
            <span class="trace-node-line"></span>
            <span class="trace-node-marker"><span class="trace-node-marker-inner"></span></span>
            <span class="trace-node-content">
                <span class="trace-node-stage">${traceText(event.data?.stage || event.event_type || "EVENT")}</span>
                <strong class="trace-node-title">${traceText(event.event_type || "Trace event")}</strong>
                <span class="trace-node-time">${traceText(event.timestamp || "")}</span>
            </span>
        </button>`).join("") : `<div class="empty-state"><div class="empty-state-icon">⌁</div><h3>No trace events found</h3><p>Run an analysis first, then follow the source or record ID.</p></div>`;

    path.querySelectorAll("[data-trace-index]").forEach(button => button.addEventListener("click", () => showTraceEvent(TRACE.events[Number(button.dataset.traceIndex)])));
}

function showTraceEvent(event) {
    if (!event) return;
    TRACE.selected = event;
    const detail = document.getElementById("trace-event-detail");
    if (!detail) return;
    detail.innerHTML = `
        <div class="trace-detail-inner">
            <div class="trace-detail-header"><div><div class="panel-kicker">TRACE EVENT</div><h3 class="trace-detail-title">${traceText(event.event_type || "Trace event")}</h3></div><span class="trace-event-type">${traceText(event.data?.stage || "EVENT")}</span></div>
            <div class="trace-detail-meta">
                <div class="trace-meta-item"><span>Event ID</span><strong>${traceText(event.event_id)}</strong></div>
                <div class="trace-meta-item"><span>Timestamp</span><strong>${traceText(event.timestamp)}</strong></div>
                <div class="trace-meta-item"><span>Source</span><strong>${traceText(event.source_id || "—")}</strong></div>
                <div class="trace-meta-item"><span>Record</span><strong>${traceText(event.record_id || "—")}</strong></div>
            </div>
            <div class="trace-detail-section"><div class="result-section-label">RECORDED DATA</div><pre class="trace-data">${traceText(JSON.stringify(event.data || {}, null, 2))}</pre></div>
            <div class="trace-detail-section"><div class="result-section-label">INTEGRITY</div><div class="trace-integrity-box"><span class="trace-integrity-icon">#</span><div><strong>Event hash</strong><code class="trace-event-hash">${traceText(event.event_hash || "—")}</code></div></div></div>
        </div>`;
}

async function verifyTrace() {
    try {
        const result = await forgeFetch("/api/trace/integrity");
        const status = document.getElementById("trace-integrity-status");
        if (status) status.textContent = result.valid ? "VALID" : "REVIEW";
        showToast(result.valid ? "Trace integrity verified." : "Trace integrity needs review.", result.valid ? "success" : "warning");
    } catch (error) { showToast(getErrorMessage(error), "error", "Integrity check failed"); }
}

function initializeTrace() {
    document.getElementById("load-trace")?.addEventListener("click", loadTrace);
    document.getElementById("verify-trace")?.addEventListener("click", verifyTrace);
    const params = new URLSearchParams(window.location.search);
    if (params.get("source_id")) document.getElementById("trace-source-id").value = params.get("source_id");
    if (params.get("record_id")) document.getElementById("trace-record-id").value = params.get("record_id");
    if (params.get("source_id") || params.get("record_id")) loadTrace();
}

window.TRACE = TRACE;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeTrace);
else initializeTrace();
