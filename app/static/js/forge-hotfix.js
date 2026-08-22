/* ================================================================
   FORGE — TARGETED FRONTEND HOTFIXES
   Keeps the existing architecture intact.
   ================================================================ */
"use strict";

const FORGE_SELECTED_SOURCE_KEY = "forge_selected_source_ids";

function getSelectedSourceIds() {
    try {
        const value = JSON.parse(
            sessionStorage.getItem(FORGE_SELECTED_SOURCE_KEY) || "null"
        );
        return Array.isArray(value) ? value.map(String) : null;
    } catch {
        return null;
    }
}

function setSelectedSourceIds(ids) {
    sessionStorage.setItem(
        FORGE_SELECTED_SOURCE_KEY,
        JSON.stringify([...new Set((ids || []).map(String))])
    );
}

function getAllWorkspaceProducts() {
    if (!window.FORGE_STORE) return [];
    return FORGE_STORE.getProductsUnfiltered
        ? FORGE_STORE.getProductsUnfiltered()
        : FORGE_STORE.getProducts();
}

function getActiveWorkspaceProducts() {
    const products = getAllWorkspaceProducts();
    const selected = getSelectedSourceIds();
    if (selected === null) return products;
    if (selected.length === 0) return [];
    const allowed = new Set(selected);
    return products.filter((product) => {
        const sourceId = product?.source_id ?? product?.source?.id ?? "";
        return allowed.has(String(sourceId));
    });
}

function patchGlobalProductStore() {
    if (!window.FORGE_STORE || FORGE_STORE.__sourceFilterPatched) return;

    const originalGetProducts = FORGE_STORE.getProducts.bind(FORGE_STORE);
    FORGE_STORE.getProductsUnfiltered = originalGetProducts;
    FORGE_STORE.getProducts = function () {
        const products = originalGetProducts();
        const selected = getSelectedSourceIds();
        if (selected === null) return products;
        if (selected.length === 0) return [];
        const allowed = new Set(selected);
        return products.filter((product) =>
            allowed.has(String(product?.source_id ?? product?.source?.id ?? ""))
        );
    };
    FORGE_STORE.__sourceFilterPatched = true;
}

function ensureInitialSourceSelection() {
    if (!window.WORKSPACE) return;
    const sources = WORKSPACE.sources || [];
    if (!sources.length) return;

    const current = getSelectedSourceIds();
    const valid = new Set(sources.map((source) => String(source.id)));

    if (current === null) {
        setSelectedSourceIds(sources.map((source) => String(source.id)));
        return;
    }

    const cleaned = current.filter((id) => valid.has(id));
    if (cleaned.length !== current.length) {
        setSelectedSourceIds(cleaned);
    }
}

function refreshSourceDependentPages() {
    patchGlobalProductStore();

    [
        "refreshCatalogue",
        "loadCatalogueProducts",
        "loadComparisonProducts",
        "loadMatchProducts"
    ].forEach((name) => {
        if (typeof window[name] === "function") {
            try { window[name](); } catch (error) { console.warn(`FORGE: ${name} refresh failed`, error); }
        }
    });
}

function injectSourceSelectionControls() {
    const container = document.querySelector("[data-workspace-sources]");
    if (!container || !window.WORKSPACE) return;

    ensureInitialSourceSelection();
    const selected = getSelectedSourceIds() || [];

    (WORKSPACE.sources || []).forEach((source) => {
        const selector = `[data-source-id="${CSS.escape(String(source.id))}"]`;
        const item = container.querySelector(selector);
        if (!item || item.querySelector("[data-forge-source-checkbox]")) return;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.forgeSourceCheckbox = String(source.id);
        checkbox.checked = selected.includes(String(source.id));
        checkbox.title = "Use this source across FORGE workflows";
        checkbox.setAttribute("aria-label", `Use ${source.name} across FORGE workflows`);

        const actions = item.querySelector(".source-item-actions");
        if (actions) actions.prepend(checkbox);
        else item.prepend(checkbox);

        checkbox.addEventListener("click", (event) => event.stopPropagation());
        checkbox.addEventListener("change", () => {
            const current = getSelectedSourceIds() || [];
            const id = String(source.id);
            const next = checkbox.checked
                ? [...current, id]
                : current.filter((value) => value !== id);
            setSelectedSourceIds(next);
            refreshSourceDependentPages();
            renderFilteredStructuredOutput();
            updateFindStatus();
        });
    });
}

function setupSourceLifecycleSync() {
    const container = document.querySelector("[data-workspace-sources]");
    if (!container || !window.WORKSPACE) return;

    let lastIds = "";
    const sync = () => {
        const ids = (WORKSPACE.sources || []).map((source) => String(source.id));
        const signature = JSON.stringify(ids);
        if (signature !== lastIds) {
            lastIds = signature;
            ensureInitialSourceSelection();
            patchGlobalProductStore();
            const selected = getSelectedSourceIds() || [];
            setSelectedSourceIds(selected.filter((id) => ids.includes(id)));
            refreshSourceDependentPages();
        }
        injectSourceSelectionControls();
    };

    sync();
    new MutationObserver(sync).observe(container, { childList: true, subtree: true });
}

function getFilteredStructuredRecords() {
    const products = getActiveWorkspaceProducts();
    return products.map((product) => ({ ...product }));
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
    preview.innerHTML = `
        <div class="structured-output-meta">
            <span>Showing ${rows.length} of ${records.length} records</span>
            ${records.length > 25 ? "<span>Preview limited to the first 25 records</span>" : ""}
        </div>
        <div class="structured-output-table-wrap">
            <table class="structured-output-table">
                <thead><tr>${columns.map((column) => `<th>${escapeHTML(column)}</th>`).join("")}</tr></thead>
                <tbody>${rows.map((record) => `<tr>${columns.map((column) => `<td>${escapeHTML(formatStructuredValue(record[column]))}</td>`).join("")}</tr>`).join("")}</tbody>
            </table>
        </div>`;
}

function formatStructuredValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") {
        try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
}

function setupStructuredOutputFilter() {
    const previewButton = document.querySelector("[data-preview-structured-output]");
    const downloadButton = document.querySelector("[data-download-structured-output]");
    const format = document.querySelector("[data-structured-output-format]");
    const preview = document.querySelector("[data-structured-output-preview]");

    if (previewButton && !previewButton.dataset.forgeBound) {
        previewButton.dataset.forgeBound = "true";
        previewButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!getFilteredStructuredRecords().length) {
                showToast("Select a source with structured records first.", "warning", "No source selected");
                return;
            }
            renderFilteredStructuredOutput();
            preview?.removeAttribute("hidden");
            previewButton.textContent = "Hide Structured Preview";
        }, true);
    }

    if (downloadButton && !downloadButton.dataset.forgeBound) {
        downloadButton.dataset.forgeBound = "true";
        downloadButton.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const records = getFilteredStructuredRecords();
            if (!records.length) {
                showToast("Select a source with structured records first.", "warning", "No source selected");
                return;
            }

            const exportFormat = (format?.value || "csv").toLowerCase();
            const button = downloadButton;
            setButtonLoading(button, true, "Preparing...");
            try {
                const response = await fetch("/api/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/octet-stream" },
                    body: JSON.stringify({
                        data: records,
                        filename: "forge_structured_output",
                        format: exportFormat,
                        metadata: {
                            title: "FORGE Structured Output",
                            subtitle: "Structured product records extracted from the selected source(s)",
                            record_count: records.length
                        }
                    })
                });
                if (!response.ok) {
                    let message = "Unable to download structured output.";
                    try { message = (await response.json()).error || message; } catch {}
                    throw new Error(message);
                }
                const blob = await response.blob();
                const disposition = response.headers.get("Content-Disposition") || "";
                const match = disposition.match(/filename="?([^\"]+)"?/i);
                const filename = match?.[1] || `forge_structured_output.${exportFormat}`;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                showToast(`Structured output downloaded as ${exportFormat.toUpperCase()}.`, "success");
            } catch (error) {
                showToast(getErrorMessage(error), "error", "Download failed");
            } finally {
                setButtonLoading(button, false);
            }
        }, true);
    }
}

function setupWorkspaceFind() {
    const sourceContainer = document.querySelector("[data-workspace-sources]");
    if (!sourceContainer || sourceContainer.parentNode.querySelector("[data-forge-find-panel]")) return;

    const panel = document.createElement("div");
    panel.dataset.forgeFindPanel = "true";
    panel.className = "workspace-find-panel";
    panel.innerHTML = `
        <div class="panel-kicker">FIND IN WORKSPACE</div>
        <div class="workspace-find-row">
            <input type="search" data-forge-find-input placeholder="Find a product, manufacturer, model, specification...">
            <button type="button" class="button button-secondary" data-forge-find-button>Find</button>
        </div>
        <div class="workspace-find-status" data-forge-find-status></div>
        <div class="workspace-find-results" data-forge-find-results></div>`;
    sourceContainer.parentNode.insertBefore(panel, sourceContainer);

    const input = panel.querySelector("[data-forge-find-input]");
    const button = panel.querySelector("[data-forge-find-button]");
    const status = panel.querySelector("[data-forge-find-status]");
    const results = panel.querySelector("[data-forge-find-results]");

    const run = () => {
        const query = input.value.trim().toLowerCase();
        const records = getFilteredStructuredRecords();
        if (!query) {
            status.textContent = "Enter a term to search the selected source(s).";
            results.innerHTML = "";
            return;
        }
        if (!records.length) {
            status.textContent = "No selected source contains structured records.";
            results.innerHTML = "";
            return;
        }
        const matches = records.filter((record) => JSON.stringify(record).toLowerCase().includes(query)).slice(0, 50);
        status.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}${matches.length === 50 ? " (first 50 shown)" : ""}.`;
        results.innerHTML = matches.length
            ? matches.map((record) => `<div class="workspace-find-result"><pre>${escapeHTML(JSON.stringify(record, null, 2))}</pre></div>`).join("")
            : `<div class="empty-state compact"><p>No matching records found.</p></div>`;
    };

    button.addEventListener("click", run);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); run(); }
    });
    window.updateFindStatus = () => {
        if (input.value.trim()) run();
    };
}

function initializeForgeTargetedFixes() {
    const fileInput = document.getElementById("file-input");
    const chooseFiles = document.getElementById("choose-files");
    if (fileInput && chooseFiles && !chooseFiles.dataset.forgeFilePickerBound) {
        chooseFiles.dataset.forgeFilePickerBound = "true";
        chooseFiles.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!fileInput.disabled) fileInput.click();
        });
    }

    patchGlobalProductStore();
    setupWorkspaceFind();
    setupStructuredOutputFilter();
    if (window.WORKSPACE) setupSourceLifecycleSync();

    const waitForWorkspace = window.setInterval(() => {
        if (!window.WORKSPACE) return;
        patchGlobalProductStore();
        ensureInitialSourceSelection();
        injectSourceSelectionControls();
        if (!document.querySelector("[data-forge-find-panel]")) setupWorkspaceFind();
        setupStructuredOutputFilter();
    }, 300);
    window.setTimeout(() => window.clearInterval(waitForWorkspace), 12000);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(initializeForgeTargetedFixes, 0), { once: true });
} else {
    window.setTimeout(initializeForgeTargetedFixes, 0);
}
