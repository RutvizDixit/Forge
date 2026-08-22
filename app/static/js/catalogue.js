/* ================================================================
   FORGE — CATALOGUE INTELLIGENCE
   Preserves the original catalogue page and renders live workspace
   records into its existing table/detail panels.
   ================================================================ */
"use strict";

const CATALOGUE = {
    products: [],
    filtered: [],
    selected: null,
    query: "",
    source: "",
    status: ""
};

function catalogueProducts() {
    return window.FORGE_STORE ? FORGE_STORE.getProducts() : [];
}

function productName(product) {
    return String(product.name || product.product_name || product.title || product.description || product.id || "Unnamed product");
}

function manufacturer(product) {
    return product.manufacturer || product.manufacturer_name || product.brand || product.vendor || "—";
}

function partNumber(product) {
    return product.part_number || product.part_no || product.part_num || product.model || product.sku || product.product_code || "—";
}

function sourceName(product) {
    return product.source_name || product.source || product.source_id || "Workspace source";
}

function statusForProduct(product) {
    const values = Object.entries(product || {}).filter(([key, value]) =>
        !["id", "source_id", "source_name"].includes(key) && value !== null && value !== undefined && String(value).trim() !== ""
    );
    return values.length >= 4 ? "complete" : values.length >= 1 ? "review" : "uncertain";
}

function keySpecification(product) {
    const ignored = new Set([
        "id", "name", "product_name", "title", "description",
        "manufacturer", "manufacturer_name", "brand", "vendor",
        "part_number", "part_no", "part_num", "model", "sku",
        "product_code", "source", "source_id", "source_name"
    ]);
    const entry = Object.entries(product || {}).find(([key, value]) =>
        !ignored.has(key) && value !== null && value !== undefined && String(value).trim() !== ""
    );
    if (!entry) return { name: "—", value: "—" };
    return { name: formatField(entry[0]), value: formatValue(entry[1]) };
}

function formatField(key) {
    return String(key || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function escapeCatalogue(value) {
    return window.escapeHTML ? escapeHTML(formatValue(value)) : String(value ?? "");
}

function applyCatalogueFilters() {
    const q = CATALOGUE.query.trim().toLowerCase();
    CATALOGUE.filtered = CATALOGUE.products.filter(product => {
        const searchable = JSON.stringify(product).toLowerCase();
        const sourceOk = !CATALOGUE.source || sourceName(product) === CATALOGUE.source;
        const statusOk = !CATALOGUE.status || statusForProduct(product) === CATALOGUE.status;
        return (!q || searchable.includes(q)) && sourceOk && statusOk;
    });
}

function renderCatalogue() {
    const container = document.getElementById("catalogue-table-container");
    if (!container) return;

    if (!CATALOGUE.filtered.length) {
        container.innerHTML = `
            <div id="catalogue-empty-state" class="empty-state">
                <div class="empty-state-icon">▤</div>
                <h3>No catalogue records yet</h3>
                <p>Bring a product catalogue or structured source into the Workspace first. Once FORGE has processed it, the product records will appear here.</p>
                <a href="/workspace" class="button button-secondary">Add Product Sources</a>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="catalogue-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Manufacturer</th>
                    <th>Part / Model</th>
                    <th>Key specification</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${CATALOGUE.filtered.map((product, index) => {
                    const spec = keySpecification(product);
                    const status = statusForProduct(product);
                    return `
                        <tr class="catalogue-row" data-catalogue-index="${index}">
                            <td><div class="catalogue-product-cell"><strong class="catalogue-product-name">${escapeCatalogue(productName(product))}</strong><span class="catalogue-product-description">${escapeCatalogue(product.description || product.summary || "")}</span></div></td>
                            <td><span class="catalogue-manufacturer">${escapeCatalogue(manufacturer(product))}</span></td>
                            <td><span class="catalogue-part-number">${escapeCatalogue(partNumber(product))}</span></td>
                            <td><div class="catalogue-specification-cell"><span class="catalogue-specification-name">${escapeCatalogue(spec.name)}</span><strong class="catalogue-specification-value">${escapeCatalogue(spec.value)}</strong></div></td>
                            <td><span class="source-reference">${escapeCatalogue(sourceName(product))}</span></td>
                            <td><span class="catalogue-status-badge status-${status}">${escapeCatalogue(status.replace("-", " ").toUpperCase())}</span></td>
                            <td><button type="button" class="text-button catalogue-open" data-index="${index}">Inspect →</button></td>
                        </tr>`;
                }).join("")}
            </tbody>
        </table>`;

    container.querySelectorAll(".catalogue-open").forEach(button => {
        button.addEventListener("click", () => selectCatalogueProduct(Number(button.dataset.index)));
    });
}

function updateCatalogueMetrics() {
    const allFields = new Set();
    CATALOGUE.products.forEach(product => Object.keys(product || {}).forEach(key => allFields.add(key)));
    const sources = new Set(CATALOGUE.products.map(sourceName));
    const review = CATALOGUE.products.filter(p => statusForProduct(p) !== "complete").length;

    const values = {
        "catalogue-product-count": CATALOGUE.products.length,
        "catalogue-field-count": allFields.size,
        "catalogue-source-count": sources.size,
        "catalogue-review-count": review
    };
    Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    });
}

function updateSourceFilter() {
    const select = document.getElementById("catalogue-source-filter");
    if (!select) return;
    const current = CATALOGUE.source;
    const sources = [...new Set(CATALOGUE.products.map(sourceName))].sort();
    select.innerHTML = `<option value="">All sources</option>${sources.map(s => `<option value="${escapeCatalogue(s)}">${escapeCatalogue(s)}</option>`).join("")}`;
    select.value = sources.includes(current) ? current : "";
}

function selectCatalogueProduct(index) {
    const product = CATALOGUE.filtered[index];
    if (!product) return;
    CATALOGUE.selected = product;

    const panel = document.getElementById("catalogue-detail-panel");
    if (!panel) return;
    panel.classList.remove("hidden");

    const name = document.getElementById("catalogue-detail-name");
    const description = document.getElementById("catalogue-detail-description");
    if (name) name.textContent = productName(product);
    if (description) description.textContent = product.description || product.summary || "Product information available from supplied sources.";

    renderDetailList("catalogue-identity-fields", [
        ["Product", productName(product)],
        ["Manufacturer", manufacturer(product)],
        ["Part / Model", partNumber(product)],
        ["Source", sourceName(product)]
    ]);

    const ignored = new Set(["id", "name", "product_name", "title", "description", "manufacturer", "manufacturer_name", "brand", "vendor", "part_number", "part_no", "part_num", "model", "sku", "product_code", "source", "source_id", "source_name"]);
    renderDetailList("catalogue-specification-fields", Object.entries(product).filter(([key, value]) => !ignored.has(key) && value !== null && value !== undefined && String(value).trim() !== "").map(([key, value]) => [formatField(key), formatValue(value)]));
    renderDetailList("catalogue-source-fields", [["Source", sourceName(product)], ["Source ID", product.source_id || "—"]]);
}

function renderDetailList(id, entries) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = entries.length
        ? entries.map(([key, value]) => `<div><dt>${escapeCatalogue(key)}</dt><dd>${escapeCatalogue(value)}</dd></div>`).join("")
        : `<div><dt>Information</dt><dd>Not available</dd></div>`;
}

function initializeCatalogue() {
    CATALOGUE.products = catalogueProducts();
    applyCatalogueFilters();
    updateCatalogueMetrics();
    updateSourceFilter();
    renderCatalogue();

    const search = document.getElementById("catalogue-search-input");
    const source = document.getElementById("catalogue-source-filter");
    const status = document.getElementById("catalogue-status-filter");
    const refresh = document.getElementById("refresh-catalogue");

    if (search) search.addEventListener("input", () => { CATALOGUE.query = search.value; applyCatalogueFilters(); renderCatalogue(); });
    if (source) source.addEventListener("change", () => { CATALOGUE.source = source.value; applyCatalogueFilters(); renderCatalogue(); });
    if (status) status.addEventListener("change", () => { CATALOGUE.status = status.value; applyCatalogueFilters(); renderCatalogue(); });
    if (refresh) refresh.addEventListener("click", () => { CATALOGUE.products = catalogueProducts(); applyCatalogueFilters(); updateCatalogueMetrics(); updateSourceFilter(); renderCatalogue(); showToast("Catalogue refreshed.", "success"); });

    const compare = document.getElementById("catalogue-detail-compare");
    if (compare) compare.addEventListener("click", () => {
        if (!CATALOGUE.selected) return;
        sessionStorage.setItem("forge_comparison_pending", JSON.stringify([CATALOGUE.selected]));
        window.location.href = "/compare";
    });

    const trace = document.getElementById("catalogue-detail-trace");
    if (trace) trace.addEventListener("click", () => {
        if (!CATALOGUE.selected) return;
        const id = CATALOGUE.selected.source_id || "";
        window.location.href = id ? `/trace?source_id=${encodeURIComponent(id)}` : "/trace";
    });
}

window.CATALOGUE = CATALOGUE;
window.refreshCatalogue = () => { CATALOGUE.products = catalogueProducts(); applyCatalogueFilters(); updateCatalogueMetrics(); updateSourceFilter(); renderCatalogue(); };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeCatalogue);
else initializeCatalogue();
