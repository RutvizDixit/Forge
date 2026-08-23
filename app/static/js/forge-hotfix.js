/* ================================================================
   FORGE — FINAL SUBMISSION STABILIZATION
   Shared source filtering, Find, structured output and Compare.
   ================================================================ */
"use strict";

const FORGE_SELECTED_SOURCE_KEY = "forge_selected_source_ids";

function getSelectedSourceIds() {
    try {
        const value = JSON.parse(sessionStorage.getItem(FORGE_SELECTED_SOURCE_KEY) || "null");
        return Array.isArray(value) ? value.map(String) : null;
    } catch (_) { return null; }
}

function setSelectedSourceIds(ids) {
    sessionStorage.setItem(FORGE_SELECTED_SOURCE_KEY, JSON.stringify([...new Set((ids || []).map(String))]));
}

function getAllWorkspaceProducts() {
    if (!window.FORGE_STORE) return [];
    return typeof FORGE_STORE.getProductsUnfiltered === "function" ? FORGE_STORE.getProductsUnfiltered() : (typeof FORGE_STORE.getProducts === "function" ? FORGE_STORE.getProducts() : []);
}

function getActiveWorkspaceProducts() {
    const products = getAllWorkspaceProducts();
    const selected = getSelectedSourceIds();
    if (selected === null) return products;
    if (!selected.length) return [];
    const allowed = new Set(selected);
    return products.filter((product) => allowed.has(String(product?.source_id ?? product?.source?.id ?? "")));
}

function patchGlobalProductStore() {
    if (!window.FORGE_STORE || FORGE_STORE.__sourceFilterPatched || typeof FORGE_STORE.getProducts !== "function") return;
    const originalGetProducts = FORGE_STORE.getProducts.bind(FORGE_STORE);
    FORGE_STORE.getProductsUnfiltered = originalGetProducts;
    FORGE_STORE.getProducts = function () {
        const products = originalGetProducts();
        const selected = getSelectedSourceIds();
        if (selected === null) return products;
        if (!selected.length) return [];
        const allowed = new Set(selected);
        return products.filter((product) => allowed.has(String(product?.source_id ?? product?.source?.id ?? "")));
    };
    FORGE_STORE.__sourceFilterPatched = true;
}

function syncWorkspaceSources(force = false) {
    if (!window.WORKSPACE || !window.FORGE_STORE || typeof FORGE_STORE.setSources !== "function") return false;
    const sources = WORKSPACE.sources || [];
    const signature = JSON.stringify(sources.map((source) => String(source.id)));
    const valid = new Set(sources.map((source) => String(source.id)));
    const current = getSelectedSourceIds();
    if (current === null) setSelectedSourceIds(sources.map((source) => String(source.id)));
    else setSelectedSourceIds(current.filter((id) => valid.has(id)));
    if (force || signature !== window.__forgeSourceSignature) {
        window.__forgeSourceSignature = signature;
        FORGE_STORE.setSources(sources);
        patchGlobalProductStore();
        return true;
    }
    return false;
}

function refreshSourceDependentPages() {
    const changed = syncWorkspaceSources();
    if (!changed) return;
    ["refreshCatalogue", "loadCatalogueProducts", "loadMatchProducts"].forEach((name) => {
        if (typeof window[name] === "function") {
            try { window[name](); } catch (error) { console.warn(`FORGE: ${name} refresh failed`, error); }
        }
    });
    renderFilteredStructuredOutput();
    if (typeof window.updateFindStatus === "function") window.updateFindStatus();
}

function injectSourceSelectionControls() {
    const container = document.querySelector("[data-workspace-sources]");
    if (!container || !window.WORKSPACE) return;
    if (!container.dataset.forgeSelectionBound) container.dataset.forgeSelectionBound = "true";
    const sources = WORKSPACE.sources || [];
    const current = getSelectedSourceIds();
    const selected = current === null ? sources.map((source) => String(source.id)) : current;
    if (current === null) setSelectedSourceIds(selected);
    sources.forEach((source) => {
        const item = container.querySelector(`[data-source-id="${CSS.escape(String(source.id))}"]`);
        if (!item || item.querySelector("[data-forge-source-checkbox]")) return;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.forgeSourceCheckbox = String(source.id);
        checkbox.checked = selected.includes(String(source.id));
        checkbox.title = "Use this source across FORGE workflows";
        checkbox.setAttribute("aria-label", `Use ${source.name} across FORGE workflows`);
        const actions = item.querySelector(".source-item-actions");
        if (actions) actions.prepend(checkbox); else item.prepend(checkbox);
        checkbox.addEventListener("click", (event) => event.stopPropagation());
        checkbox.addEventListener("change", () => {
            const ids = getSelectedSourceIds() || [];
            const id = String(source.id);
            setSelectedSourceIds(checkbox.checked ? [...ids, id] : ids.filter((value) => value !== id));
            refreshSourceDependentPages();
            renderFilteredStructuredOutput();
        });
    });
}

function setupSourceLifecycleSync() {
    const container = document.querySelector("[data-workspace-sources]");
    if (!container || !window.WORKSPACE || container.dataset.forgeLifecycleBound) return;
    container.dataset.forgeLifecycleBound = "true";
    let lastIds = "";
    const sync = () => {
        const ids = (WORKSPACE.sources || []).map((source) => String(source.id));
        const signature = JSON.stringify(ids);
        if (signature !== lastIds) {
            lastIds = signature;
            syncWorkspaceSources(true);
            refreshSourceDependentPages();
        }
        injectSourceSelectionControls();
    };
    sync();
    new MutationObserver(sync).observe(container, { childList: true, subtree: true });
}

function getFilteredStructuredRecords() {
    return getActiveWorkspaceProducts().map((product) => ({ ...product }));
}

function formatStructuredValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") { try { return JSON.stringify(value); } catch (_) { return String(value); } }
    return String(value);
}

function renderFilteredStructuredOutput() {
    const count = document.querySelector("[data-structured-output-count]");
    const preview = document.querySelector("[data-structured-output-preview]");
    const previewButton = document.querySelector("[data-preview-structured-output]");
    const downloadButton = document.querySelector("[data-download-structured-output]");
    const records = getFilteredStructuredRecords();
    if (count) count.textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
    if (previewButton) previewButton.disabled = records.length === 0;
    if (downloadButton) downloadButton.disabled = records.length === 0;
    if (!preview || preview.hasAttribute("hidden")) return;
    const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
    const rows = records.slice(0, 25);
    preview.innerHTML = `<div class="structured-output-meta"><span>Showing ${rows.length} of ${records.length} records</span>${records.length > 25 ? "<span>Preview limited to the first 25 records</span>" : ""}</div><div class="structured-output-table-wrap"><table class="structured-output-table"><thead><tr>${columns.map((column) => `<th>${escapeHTML(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((record) => `<tr>${columns.map((column) => `<td>${escapeHTML(formatStructuredValue(record[column]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function setupStructuredOutputFilter() {
    const previewButton = document.querySelector("[data-preview-structured-output]");
    const downloadButton = document.querySelector("[data-download-structured-output]");
    const format = document.querySelector("[data-structured-output-format]");
    const preview = document.querySelector("[data-structured-output-preview]");
    if (previewButton && !previewButton.dataset.forgeBound) {
        previewButton.dataset.forgeBound = "true";
        previewButton.addEventListener("click", (event) => {
            event.preventDefault(); event.stopImmediatePropagation();
            if (!getFilteredStructuredRecords().length) { showToast("Select a source with structured records first.", "warning", "No source selected"); return; }
            if (preview.hasAttribute("hidden")) { renderFilteredStructuredOutput(); preview.removeAttribute("hidden"); previewButton.textContent = "Hide Structured Preview"; }
            else { preview.setAttribute("hidden", ""); previewButton.textContent = "Preview Structured Data"; }
        }, true);
    }
    if (downloadButton && !downloadButton.dataset.forgeBound) {
        downloadButton.dataset.forgeBound = "true";
        downloadButton.addEventListener("click", async (event) => {
            event.preventDefault(); event.stopImmediatePropagation();
            const records = getFilteredStructuredRecords();
            if (!records.length) { showToast("Select a source with structured records first.", "warning", "No source selected"); return; }
            const exportFormat = (format?.value || "csv").toLowerCase();
            setButtonLoading(downloadButton, true, "Preparing...");
            try {
                const response = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/octet-stream" }, body: JSON.stringify({ data: records, filename: "forge_structured_output", format: exportFormat, metadata: { title: "FORGE Structured Output", subtitle: "Structured product records extracted from the selected source(s)", record_count: records.length } }) });
                if (!response.ok) { let message = "Unable to download structured output."; try { message = (await response.json()).error || message; } catch (_) {} throw new Error(message); }
                const blob = await response.blob(); const disposition = response.headers.get("Content-Disposition") || ""; const match = disposition.match(/filename="?([^\"]+)"?/i); const filename = match?.[1] || `forge_structured_output.${exportFormat}`; const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); showToast(`Structured output downloaded as ${exportFormat.toUpperCase()}.`, "success");
            } catch (error) { showToast(getErrorMessage(error), "error", "Download failed"); }
            finally { setButtonLoading(downloadButton, false); }
        }, true);
    }
}

function runWorkspaceFind() {
    const input = document.querySelector("[data-forge-find-input]"); const status = document.querySelector("[data-forge-find-status]"); const results = document.querySelector("[data-forge-find-results]");
    if (!input || !status || !results) return;
    const query = input.value.trim().toLowerCase(); const records = getFilteredStructuredRecords();
    if (!query) { status.textContent = "Enter a term to search the selected source(s)."; results.innerHTML = ""; return; }
    if (!records.length) { status.textContent = "No selected source contains structured records."; results.innerHTML = ""; return; }
    const matches = records.filter((record) => JSON.stringify(record).toLowerCase().includes(query)).slice(0, 50);
    status.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}${matches.length === 50 ? " (first 50 shown)" : ""}.`;
    results.innerHTML = matches.length ? matches.map((record) => `<div class="workspace-find-result"><pre>${escapeHTML(JSON.stringify(record, null, 2))}</pre></div>`).join("") : `<div class="empty-state compact"><p>No matching records found.</p></div>`;
}

function setupWorkspaceFind() {
    const input = document.querySelector("[data-forge-find-input]"); const button = document.querySelector("[data-forge-find-button]");
    if (!input || !button || button.dataset.forgeBound) return;
    button.dataset.forgeBound = "true"; button.addEventListener("click", runWorkspaceFind); input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); runWorkspaceFind(); } }); window.updateFindStatus = () => { if (input.value.trim()) runWorkspaceFind(); };
}

function setupCompareIntegration() {
    if (!location.pathname.includes("compare") || document.body.dataset.forgeCompareSetup) return;
    document.body.dataset.forgeCompareSetup = "true";
    document.body.dataset.comparisonEndpoint = "/api/compare";
    const sync = () => {
        if (!window.COMPARISON) return;
        const products = getActiveWorkspaceProducts();
        if (!products.length) return;
        const normalized = products.map((product) => ({ ...product, name: product.name || product.product_name || product.title || product.manufacturer || product.vendor || product.model || product.part_number || product.id || "Unnamed product" }));
        if (typeof window.setComparisonProducts === "function") window.setComparisonProducts(normalized);
        else {
            COMPARISON.products = normalized.map((product) => ({ id: product.id || product.product_id || product.source_id, name: product.name, source: product.source || product.source_name || null, vendor: product.vendor || product.manufacturer || null, model: product.model || product.model_number || null, metadata: product.metadata || {}, raw: product }));
            window.renderComparisonProducts?.(); window.updateComparisonSelectionState?.();
        }
    };
    window.setTimeout(sync, 300); window.setTimeout(sync, 1200);
}

function normalizeAboutContactSection() {
    if (!location.pathname.includes("about")) return;
    const grid = Array.from(document.querySelectorAll(".help-format-grid")).at(-1);
    if (!grid || grid.dataset.forgeNormalized) return;
    const emails = Array.from(grid.querySelectorAll("strong")).map((node) => node.textContent.trim()).filter((value) => value.includes("@"));
    if (emails.length < 2) return;
    const container = document.createElement("div"); container.className = "connect-with-us"; container.dataset.forgeNormalized = "true";
    emails.forEach((email) => { const p = document.createElement("p"); const a = document.createElement("a"); a.href = `mailto:${email}`; a.textContent = email; p.appendChild(a); container.appendChild(p); });
    grid.replaceWith(container);
}

function initializeForgeFinalStabilization() {
    const fileInput = document.getElementById("file-input"); const chooseFiles = document.getElementById("choose-files");
    if (fileInput && chooseFiles && !chooseFiles.dataset.forgeFilePickerBound) { chooseFiles.dataset.forgeFilePickerBound = "true"; chooseFiles.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); if (!fileInput.disabled) fileInput.click(); }); }
    patchGlobalProductStore(); setupWorkspaceFind(); setupStructuredOutputFilter(); setupCompareIntegration(); normalizeAboutContactSection();
    if (window.WORKSPACE) setupSourceLifecycleSync();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeForgeFinalStabilization, { once: true }); else initializeForgeFinalStabilization();
const forgeFinalInterval = window.setInterval(() => { initializeForgeFinalStabilization(); }, 700);
window.setTimeout(() => window.clearInterval(forgeFinalInterval), 15000);
