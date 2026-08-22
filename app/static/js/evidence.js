/* ================================================================
   FORGE — EVIDENCE
   evidence.js
   ================================================================ */

"use strict";


/* ================================================================
   EVIDENCE STATE
   ================================================================ */

const EVIDENCE = {

    items: [],

    filteredItems: [],

    selectedEvidence: null,

    query: "",

    sourceFilter: "all",

    typeFilter: "all",

    loading: false,

    error: null,

    sources: [],

    types: [],

    total: 0
};


/* ================================================================
   DOM HELPERS
   ================================================================ */

function evidenceQuery(selector) {

    return document.querySelector(selector);
}


function evidenceQueries(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* ================================================================
   NORMALIZATION
   ================================================================ */

function normalizeEvidenceItem(
    item
) {

    if (!item) {

        return {

            id:
                `evidence-${Date.now()}`,

            title:
                "Evidence",

            text:
                "",

            source:
                null,

            sourceName:
                "Unknown source",

            sourceUrl:
                null,

            page:
                null,

            section:
                null,

            type:
                "document",

            confidence:
                null,

            requirement:
                null,

            metadata:
                {}
        };
    }


    return {

        id:
            item.id ||
            item.evidence_id ||
            `evidence-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        title:
            item.title ||
            item.name ||
            item.label ||
            "Evidence",

        text:
            item.text ||
            item.content ||
            item.excerpt ||
            item.snippet ||
            item.description ||
            "",

        source:
            item.source ||
            item.source_id ||
            null,

        sourceName:
            item.source_name ||
            item.sourceName ||
            item.filename ||
            item.document ||
            (
                typeof item.source === "string"
                    ? item.source
                    : "Unknown source"
            ),

        sourceUrl:
            item.source_url ||
            item.url ||
            null,

        page:
            item.page ||
            item.page_number ||
            null,

        section:
            item.section ||
            item.heading ||
            null,

        type:
            normalizeEvidenceType(
                item.type ||
                item.evidence_type ||
                item.source_type
            ),

        confidence:
            normalizeEvidenceConfidence(
                item.confidence ??
                item.score
            ),

        requirement:
            item.requirement ||
            item.requirement_text ||
            item.requirement_id ||
            null,

        product:
            item.product ||
            item.product_name ||
            null,

        metadata:
            item.metadata ||
            {},

        raw:
            item
    };
}


function normalizeEvidenceType(
    type
) {

    if (!type) {

        return "document";
    }


    return String(
        type
    )
        .trim()
        .toLowerCase()
        .replaceAll(
            "_",
            "-"
        );
}


function normalizeEvidenceConfidence(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;
    }


    let number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {

        return null;
    }


    if (
        number >= 0 &&
        number <= 1
    ) {

        number *= 100;
    }


    return Math.max(
        0,
        Math.min(
            100,
            number
        )
    );
}


/* ================================================================
   ENDPOINT
   ================================================================ */

function getEvidenceEndpoint() {

    return document.body.dataset
        .evidenceEndpoint || "";
}


/* ================================================================
   QUERY PARAMETERS
   ================================================================ */

function buildEvidenceQueryParams() {

    const params =
        new URLSearchParams();


    if (
        EVIDENCE.query
    ) {

        params.set(
            "q",
            EVIDENCE.query
        );
    }


    if (
        EVIDENCE.sourceFilter !== "all"
    ) {

        params.set(
            "source",
            EVIDENCE.sourceFilter
        );
    }


    if (
        EVIDENCE.typeFilter !== "all"
    ) {

        params.set(
            "type",
            EVIDENCE.typeFilter
        );
    }


    return params;
}


/* ================================================================
   LOAD EVIDENCE
   ================================================================ */

async function loadEvidence() {

    if (
        EVIDENCE.loading
    ) {

        return;
    }


    const endpoint =
        getEvidenceEndpoint();


    if (!endpoint) {

        loadEmbeddedEvidence();

        return;
    }


    EVIDENCE.loading =
        true;


    EVIDENCE.error =
        null;


    renderEvidenceLoading();


    try {

        const params =
            buildEvidenceQueryParams();


        const separator =
            endpoint.includes("?")
                ? "&"
                : "?";


        const url =
            params.toString()
                ? `${endpoint}${separator}${params.toString()}`
                : endpoint;


        const result =
            await forgeFetch(
                url
            );


        const rawItems =
            result.items ||
            result.evidence ||
            result.data?.items ||
            result.data?.evidence ||
            (
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : []
            );


        EVIDENCE.items =
            Array.isArray(
                rawItems
            )
                ? rawItems.map(
                    normalizeEvidenceItem
                )
                : [];


        EVIDENCE.total =
            Number(
                result.total ??
                result.data?.total ??
                EVIDENCE.items.length
            );


        updateEvidenceFacets();

        applyEvidenceFilters();

        renderEvidence();

        updateEvidenceSummary();

    } catch (error) {

        console.error(
            "FORGE evidence loading error:",
            error
        );


        EVIDENCE.error =
            getErrorMessage(
                error
            );


        renderEvidenceError();

    } finally {

        EVIDENCE.loading =
            false;
    }
}


/* ================================================================
   EMBEDDED EVIDENCE
   ================================================================ */

function loadEmbeddedEvidence() {

    const element = evidenceQuery("[data-evidence-data]");
    let items = [];

    if (element) {
        const data = safeJSONParse(element.textContent, []);
        items = Array.isArray(data)
            ? data
            : (Array.isArray(data.items) ? data.items : (Array.isArray(data.evidence) ? data.evidence : []));
    }

    if (!items.length && window.FORGE_STORE) {
        const products = FORGE_STORE.getProducts();
        products.forEach((product) => {
            const ignored = new Set(["id", "name", "product_name", "title", "source_id", "source_name"]);
            Object.entries(product || {}).forEach(([field, value]) => {
                if (ignored.has(field) || value === null || value === undefined || String(value).trim() === "") return;
                items.push({
                    id: `${product.id || "product"}-${field}`,
                    title: `${product.name || product.product_name || product.id || "Product"} — ${field.replaceAll("_", " ")}`,
                    text: String(value),
                    source_name: product.source_name || product.source_id || "Workspace source",
                    type: "supported",
                    product: product.name || product.product_name || product.id,
                    requirement: null,
                    metadata: { field, product_id: product.id }
                });
            });
        });
    }

    EVIDENCE.items = items.map(normalizeEvidenceItem);
    EVIDENCE.total = EVIDENCE.items.length;
    updateEvidenceFacets();
    applyEvidenceFilters();
    renderEvidence();
    updateEvidenceSummary();
}


/* ================================================================
   FACETS
   ================================================================ */

function updateEvidenceFacets() {

    EVIDENCE.sources =
        [
            ...new Map(
                EVIDENCE.items
                    .map(
                        (item) => [
                            item.source ||
                            item.sourceName,
                            item.sourceName
                        ]
                    )
            ).entries()
        ]
            .filter(
                ([key, value]) =>
                    key &&
                    value
            )
            .map(
                ([, value]) =>
                    value
            )
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b
                    )
            );


    EVIDENCE.types =
        [
            ...new Set(
                EVIDENCE.items
                    .map(
                        (item) =>
                            item.type
                    )
                    .filter(Boolean)
            )
        ]
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b
                    )
            );


    renderEvidenceFacets();
}


/* ================================================================
   FACET RENDERING
   ================================================================ */

function renderEvidenceFacets() {

    const sourceSelect =
        evidenceQuery(
            "[data-evidence-source-filter]"
        );


    if (sourceSelect) {

        sourceSelect.innerHTML = `

            <option value="all">
                All sources
            </option>

            ${EVIDENCE.sources
                .map(
                    (source) => `
                        <option
                            value="${escapeHTML(
                                source
                            )}"
                        >
                            ${escapeHTML(
                                source
                            )}
                        </option>
                    `
                )
                .join("")}
        `;


        sourceSelect.value =
            EVIDENCE.sources.includes(
                EVIDENCE.sourceFilter
            )
                ? EVIDENCE.sourceFilter
                : "all";
    }


    const typeSelect =
        evidenceQuery(
            "[data-evidence-type-filter]"
        );


    if (typeSelect) {

        typeSelect.innerHTML = `

            <option value="all">
                All evidence types
            </option>

            ${EVIDENCE.types
                .map(
                    (type) => `
                        <option
                            value="${escapeHTML(
                                type
                            )}"
                        >
                            ${escapeHTML(
                                formatEvidenceType(
                                    type
                                )
                            )}
                        </option>
                    `
                )
                .join("")}
        `;


        typeSelect.value =
            EVIDENCE.types.includes(
                EVIDENCE.typeFilter
            )
                ? EVIDENCE.typeFilter
                : "all";
    }
}


/* ================================================================
   FILTERING
   ================================================================ */

function applyEvidenceFilters() {

    let items =
        EVIDENCE.items.slice();


    if (
        EVIDENCE.sourceFilter !== "all"
    ) {

        items =
            items.filter(
                (item) =>
                    String(
                        item.sourceName
                    ).toLowerCase() ===
                    String(
                        EVIDENCE.sourceFilter
                    ).toLowerCase()
            );
    }


    if (
        EVIDENCE.typeFilter !== "all"
    ) {

        items =
            items.filter(
                (item) =>
                    item.type ===
                    EVIDENCE.typeFilter
            );
    }


    const query =
        EVIDENCE.query
            .trim()
            .toLowerCase();


    if (query) {

        items =
            items.filter(
                (item) => {

                    const searchable = [

                        item.title,

                        item.text,

                        item.sourceName,

                        item.section,

                        item.requirement,

                        item.product

                    ]
                        .map(
                            (value) =>
                                String(
                                    value || ""
                                ).toLowerCase()
                        )
                        .join(" ");


                    return searchable.includes(
                        query
                    );
                }
            );
    }


    EVIDENCE.filteredItems =
        items;
}


/* ================================================================
   SEARCH
   ================================================================ */

function setEvidenceQuery(
    query
) {

    EVIDENCE.query =
        String(
            query || ""
        );


    applyEvidenceFilters();

    renderEvidence();

    updateEvidenceSummary();
}


/* ================================================================
   SOURCE FILTER
   ================================================================ */

function setEvidenceSourceFilter(
    source
) {

    EVIDENCE.sourceFilter =
        source || "all";


    applyEvidenceFilters();

    renderEvidence();

    updateEvidenceSummary();
}


/* ================================================================
   TYPE FILTER
   ================================================================ */

function setEvidenceTypeFilter(
    type
) {

    EVIDENCE.typeFilter =
        type || "all";


    applyEvidenceFilters();

    renderEvidence();

    updateEvidenceSummary();
}


/* ================================================================
   CONTROL SETUP
   ================================================================ */

function setupEvidenceControls() {

    const search =
        evidenceQuery(
            "[data-evidence-search]"
        );


    if (search) {

        search.value =
            EVIDENCE.query;


        search.addEventListener(
            "input",
            () => {

                setEvidenceQuery(
                    search.value
                );
            }
        );
    }


    const source =
        evidenceQuery(
            "[data-evidence-source-filter]"
        );


    if (source) {

        source.addEventListener(
            "change",
            () => {

                setEvidenceSourceFilter(
                    source.value
                );
            }
        );
    }


    const type =
        evidenceQuery(
            "[data-evidence-type-filter]"
        );


    if (type) {

        type.addEventListener(
            "change",
            () => {

                setEvidenceTypeFilter(
                    type.value
                );
            }
        );
    }


    const clear =
        evidenceQuery(
            "[data-clear-evidence-filters]"
        );


    if (clear) {

        clear.addEventListener(
            "click",
            clearEvidenceFilters
        );
    }
}


/* ================================================================
   CLEAR FILTERS
   ================================================================ */

function clearEvidenceFilters() {

    EVIDENCE.query =
        "";

    EVIDENCE.sourceFilter =
        "all";

    EVIDENCE.typeFilter =
        "all";


    const search =
        evidenceQuery(
            "[data-evidence-search]"
        );


    if (search) {

        search.value =
            "";
    }


    const source =
        evidenceQuery(
            "[data-evidence-source-filter]"
        );


    if (source) {

        source.value =
            "all";
    }


    const type =
        evidenceQuery(
            "[data-evidence-type-filter]"
        );


    if (type) {

        type.value =
            "all";
    }


    applyEvidenceFilters();

    renderEvidence();

    updateEvidenceSummary();
}


/* ================================================================
   LOADING
   ================================================================ */

function renderEvidenceLoading() {

    const container =
        evidenceQuery(
            "[data-evidence-results]"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="loading-state">

            <div class="loading-spinner"></div>

            <p>
                Loading evidence...
            </p>

        </div>

    `;
}


/* ================================================================
   ERROR
   ================================================================ */

function renderEvidenceError() {

    const container =
        evidenceQuery(
            "[data-evidence-results]"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="empty-state error-state">

            <div class="empty-state-icon">
                !
            </div>

            <h3>
                Unable to load evidence
            </h3>

            <p>
                ${escapeHTML(
                    EVIDENCE.error ||
                    "An unexpected error occurred."
                )}
            </p>

            <button
                type="button"
                class="primary-button"
                data-retry-evidence
            >
                Retry
            </button>

        </div>

    `;


    const retry =
        container.querySelector(
            "[data-retry-evidence]"
        );


    if (retry) {

        retry.addEventListener(
            "click",
            loadEvidence
        );
    }
}


/* ================================================================
   EVIDENCE RENDERING
   ================================================================ */

function renderEvidence() {

    const container =
        evidenceQuery(
            "[data-evidence-results]"
        );


    if (!container) {
        return;
    }


    if (
        EVIDENCE.loading
    ) {

        renderEvidenceLoading();

        return;
    }


    if (
        EVIDENCE.filteredItems.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ◌
                </div>

                <h3>
                    No evidence found
                </h3>

                <p>
                    Try another search term or clear the filters.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        EVIDENCE.filteredItems
            .map(
                (item) =>
                    renderEvidenceCard(
                        item
                    )
            )
            .join("");


    container
        .querySelectorAll(
            "[data-open-evidence]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openEvidenceDetail(
                            button.dataset
                                .openEvidence
                        );
                    }
                );
            }
        );


    container
        .querySelectorAll(
            "[data-copy-evidence]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        const item =
                            getEvidenceById(
                                button.dataset
                                    .copyEvidence
                            );


                        if (!item) {
                            return;
                        }


                        await copyToClipboard(
                            item.text
                        );
                    }
                );
            }
        );
}


/* ================================================================
   EVIDENCE CARD
   ================================================================ */

function renderEvidenceCard(
    item
) {

    const confidence =
        item.confidence !== null
            ? `${Math.round(
                item.confidence
            )}%`
            : null;


    return `

        <article
            class="evidence-card"
            data-evidence-id="${escapeHTML(
                item.id
            )}"
        >

            <div class="evidence-card-header">

                <div class="evidence-type">

                    <span class="evidence-type-icon">
                        ${escapeHTML(
                            getEvidenceTypeIcon(
                                item.type
                            )
                        )}
                    </span>

                    <span>
                        ${escapeHTML(
                            formatEvidenceType(
                                item.type
                            )
                        )}
                    </span>

                </div>


                ${
                    confidence !== null
                        ? `
                            <span class="evidence-confidence">
                                ${confidence}
                            </span>
                        `
                        : ""
                }

            </div>


            <div class="evidence-card-body">

                <h3>
                    ${escapeHTML(
                        item.title
                    )}
                </h3>


                ${
                    item.text
                        ? `
                            <p>
                                ${escapeHTML(
                                    truncateEvidenceText(
                                        item.text,
                                        230
                                    )
                                )}
                            </p>
                        `
                        : `
                            <p class="muted">
                                No evidence text available.
                            </p>
                        `
                }


                <div class="evidence-source-line">

                    <span>
                        ${escapeHTML(
                            item.sourceName
                        )}
                    </span>

                    ${
                        item.page
                            ? `
                                <span>
                                    · Page ${escapeHTML(
                                        item.page
                                    )}
                                </span>
                            `
                            : ""
                    }

                    ${
                        item.section
                            ? `
                                <span>
                                    · ${escapeHTML(
                                        item.section
                                    )}
                                </span>
                            `
                            : ""
                    }

                </div>

            </div>


            <div class="evidence-card-footer">

                <button
                    type="button"
                    class="text-button"
                    data-open-evidence="${escapeHTML(
                        item.id
                    )}"
                >
                    Inspect evidence
                </button>


                <button
                    type="button"
                    class="icon-button"
                    data-copy-evidence="${escapeHTML(
                        item.id
                    )}"
                    aria-label="Copy evidence"
                    title="Copy evidence"
                >
                    ⧉
                </button>

            </div>

        </article>

    `;
}


/* ================================================================
   TYPE HELPERS
   ================================================================ */

function formatEvidenceType(
    type
) {

    const value =
        String(
            type ||
            "document"
        )
            .replaceAll(
                "-",
                " "
            )
            .replaceAll(
                "_",
                " "
            );


    return value
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );
}


function getEvidenceTypeIcon(
    type
) {

    const icons = {

        pdf:
            "PDF",

        document:
            "DOC",

        spreadsheet:
            "XLS",

        csv:
            "CSV",

        url:
            "URL",

        web:
            "WEB",

        table:
            "TAB",

        text:
            "TXT"
    };


    return (
        icons[type] ||
        "DOC"
    );
}


/* ================================================================
   TEXT
   ================================================================ */

function truncateEvidenceText(
    text,
    length
) {

    const value =
        String(
            text || ""
        );


    if (
        value.length <= length
    ) {

        return value;
    }


    return (
        value.slice(
            0,
            length - 1
        ) +
        "…"
    );
}


/* ================================================================
   SUMMARY
   ================================================================ */

function updateEvidenceSummary() {

    const total =
        evidenceQuery(
            "[data-evidence-count]"
        );


    const sources =
        evidenceQuery(
            "[data-evidence-source-count]"
        );


    const filtered =
        evidenceQuery(
            "[data-evidence-filtered-count]"
        );


    if (total) {

        setText(
            total,
            EVIDENCE.total
        );
    }


    if (sources) {

        setText(
            sources,
            new Set(
                EVIDENCE.filteredItems.map(
                    (item) =>
                        item.sourceName
                )
            ).size
        );
    }


    if (filtered) {

        setText(
            filtered,
            EVIDENCE.filteredItems.length
        );
    }
}


/* ================================================================
   DETAIL
   ================================================================ */

function getEvidenceById(
    id
) {

    return EVIDENCE.items.find(
        (item) =>
            String(item.id) ===
            String(id)
    );
}


function openEvidenceDetail(
    id
) {

    const item =
        getEvidenceById(
            id
        );


    if (!item) {

        showToast(
            "The selected evidence could not be found.",
            "error"
        );

        return;
    }


    EVIDENCE.selectedEvidence =
        item;


    const modal =
        evidenceQuery(
            "[data-evidence-detail-modal]"
        );


    if (!modal) {

        showToast(
            item.text ||
            "No evidence text available.",
            "info",
            item.title
        );

        return;
    }


    renderEvidenceDetail(
        item,
        modal
    );


    openModal(
        modal
    );
}


/* ================================================================
   DETAIL RENDERING
   ================================================================ */

function renderEvidenceDetail(
    item,
    modal
) {

    const title =
        modal.querySelector(
            "[data-evidence-detail-title]"
        );


    const text =
        modal.querySelector(
            "[data-evidence-detail-text]"
        );


    const type =
        modal.querySelector(
            "[data-evidence-detail-type]"
        );


    const source =
        modal.querySelector(
            "[data-evidence-detail-source]"
        );


    const page =
        modal.querySelector(
            "[data-evidence-detail-page]"
        );


    const section =
        modal.querySelector(
            "[data-evidence-detail-section]"
        );


    const confidence =
        modal.querySelector(
            "[data-evidence-detail-confidence]"
        );


    const requirement =
        modal.querySelector(
            "[data-evidence-detail-requirement]"
        );


    const sourceLink =
        modal.querySelector(
            "[data-evidence-detail-source-link]"
        );


    const copyButton =
        modal.querySelector(
            "[data-evidence-detail-copy]"
        );


    if (title) {

        setText(
            title,
            item.title
        );
    }


    if (text) {

        setText(
            text,
            item.text ||
            "No evidence text available."
        );
    }


    if (type) {

        setText(
            type,
            formatEvidenceType(
                item.type
            )
        );
    }


    if (source) {

        setText(
            source,
            item.sourceName ||
            "Unknown source"
        );
    }


    if (page) {

        setText(
            page,
            item.page !== null &&
            item.page !== undefined
                ? String(item.page)
                : "—"
        );
    }


    if (section) {

        setText(
            section,
            item.section ||
            "—"
        );
    }


    if (confidence) {

        setText(
            confidence,
            item.confidence !== null
                ? `${Math.round(
                    item.confidence
                )}%`
                : "—"
        );
    }


    if (requirement) {

        setText(
            requirement,
            item.requirement ||
            "—"
        );
    }


    if (sourceLink) {

        if (
            item.sourceUrl
        ) {

            sourceLink.href =
                item.sourceUrl;

            sourceLink.classList.remove(
                "hidden"
            );

        } else {

            sourceLink.removeAttribute(
                "href"
            );

            sourceLink.classList.add(
                "hidden"
            );
        }
    }


    if (copyButton) {

        copyButton.onclick =
            () => {

                copyToClipboard(
                    item.text
                );
            };
    }
}


/* ================================================================
   EVIDENCE NAVIGATION FROM MATCHING
   ================================================================ */

function openEvidenceFromMatch(
    evidence
) {

    if (!evidence) {
        return;
    }


    const normalized =
        normalizeEvidenceItem(
            evidence
        );


    EVIDENCE.selectedEvidence =
        normalized;


    const modal =
        evidenceQuery(
            "[data-evidence-detail-modal]"
        );


    if (!modal) {

        showToast(
            normalized.text,
            "info",
            normalized.title
        );

        return;
    }


    renderEvidenceDetail(
        normalized,
        modal
    );


    openModal(
        modal
    );
}


/* ================================================================
   COPY ALL FILTERED EVIDENCE
   ================================================================ */

async function copyFilteredEvidence() {

    if (
        EVIDENCE.filteredItems.length === 0
    ) {

        showToast(
            "There is no evidence to copy.",
            "warning"
        );

        return;
    }


    const text =
        EVIDENCE.filteredItems
            .map(
                (item, index) => {

                    return [
                        `[${index + 1}] ${item.title}`,
                        `Source: ${item.sourceName}`,
                        item.page
                            ? `Page: ${item.page}`
                            : null,
                        item.section
                            ? `Section: ${item.section}`
                            : null,
                        "",
                        item.text
                    ]
                        .filter(
                            Boolean
                        )
                        .join("\n");
                }
            )
            .join(
                "\n\n--------------------\n\n"
            );


    await copyToClipboard(
        text
    );
}


/* ================================================================
   EXPORT
   ================================================================ */

function exportEvidence() {

    if (
        EVIDENCE.filteredItems.length === 0
    ) {

        showToast(
            "There is no evidence to export.",
            "warning"
        );

        return;
    }


    const payload = {

        generated_at:
            new Date().toISOString(),

        query:
            EVIDENCE.query,

        source_filter:
            EVIDENCE.sourceFilter,

        type_filter:
            EVIDENCE.typeFilter,

        total:
            EVIDENCE.filteredItems.length,

        evidence:
            EVIDENCE.filteredItems
                .map(
                    (item) => ({

                        id:
                            item.id,

                        title:
                            item.title,

                        text:
                            item.text,

                        source:
                            item.sourceName,

                        page:
                            item.page,

                        section:
                            item.section,

                        type:
                            item.type,

                        confidence:
                            item.confidence,

                        requirement:
                            item.requirement,

                        product:
                            item.product
                    })
                )
    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    payload,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        "forge-evidence.json";


    document.body.appendChild(
        link
    );


    link.click();

    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "Evidence exported.",
        "success"
    );
}


/* ================================================================
   BUTTONS
   ================================================================ */

function setupEvidenceButtons() {

    const exportButton =
        evidenceQuery(
            "[data-export-evidence]"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            exportEvidence
        );
    }


    const copyButton =
        evidenceQuery(
            "[data-copy-filtered-evidence]"
        );


    if (copyButton) {

        copyButton.addEventListener(
            "click",
            copyFilteredEvidence
        );
    }


    const refreshButton =
        evidenceQuery(
            "[data-refresh-evidence]"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            loadEvidence
        );
    }
}


/* ================================================================
   KEYBOARD SHORTCUT
   ================================================================ */

function setupEvidenceKeyboard() {

    document.addEventListener(
        "keydown",
        (event) => {

            const active =
                document.activeElement;


            const typing =
                active &&
                (
                    active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA" ||
                    active.tagName === "SELECT" ||
                    active.isContentEditable
                );


            if (typing) {
                return;
            }


            /*
             * E = focus evidence search.
             */

            if (
                event.key.toLowerCase() === "e"
            ) {

                const search =
                    evidenceQuery(
                        "[data-evidence-search]"
                    );


                if (search) {

                    event.preventDefault();

                    search.focus();
                }
            }
        }
    );
}


/* ================================================================
   INITIALIZATION
   ================================================================ */

async function initializeEvidence() {

    setupEvidenceControls();

    setupEvidenceButtons();

    setupEvidenceKeyboard();

    renderEvidence();

    updateEvidenceSummary();


    await loadEvidence();
}


/* ================================================================
   PUBLIC API
   ================================================================ */

window.EVIDENCE =
    EVIDENCE;

window.loadEvidence =
    loadEvidence;

window.openEvidenceDetail =
    openEvidenceDetail;

window.openEvidenceFromMatch =
    openEvidenceFromMatch;

window.copyFilteredEvidence =
    copyFilteredEvidence;


/* ================================================================
   PAGE INITIALIZATION
   ================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initializeEvidence();
        }
    );

} else {

    initializeEvidence();
}