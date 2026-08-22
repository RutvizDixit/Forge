/* ================================================================
   FORGE — PRODUCT COMPARISON
   comparison.js
   ================================================================ */

"use strict";


/* ================================================================
   COMPARISON STATE
   ================================================================ */

const COMPARISON = {

    products: [],

    results: [],

    selectedProducts: [],

    selectedDimension: "all",

    loading: false,

    query: "",

    summary: {

        dimensions: 0,

        compared: 0,

        strongest: null
    }
};


/* ================================================================
   DOM HELPERS
   ================================================================ */

function comparisonQuery(selector) {

    return document.querySelector(selector);
}


function comparisonQueries(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* ================================================================
   NORMALIZATION
   ================================================================ */

function normalizeComparisonProduct(
    product
) {

    if (!product) {

        return {
            id: "",
            name: "Unknown product",
            source: null,
            metadata: {}
        };
    }


    return {

        id:
            product.id ||
            product.product_id ||
            product.source_id ||
            `product-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        name:
            product.name ||
            product.product_name ||
            product.title ||
            product.filename ||
            "Unnamed product",

        source:
            product.source ||
            product.source_name ||
            null,

        vendor:
            product.vendor ||
            product.manufacturer ||
            null,

        model:
            product.model ||
            product.model_number ||
            null,

        metadata:
            product.metadata ||
            {},

        raw:
            product
    };
}


function normalizeComparisonResult(
    result
) {

    if (!result) {

        return {

            id:
                `comparison-${Date.now()}`,

            dimension:
                "",

            values:
                {},

            winner:
                null,

            explanation:
                "",

            evidence:
                [],

            confidence:
                0
        };
    }


    return {

        id:
            result.id ||
            result.dimension_id ||
            `comparison-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        dimension:
            result.dimension ||
            result.requirement ||
            result.criterion ||
            result.feature ||
            result.name ||
            "",

        dimension_id:
            result.dimension_id ||
            result.requirement_id ||
            null,

        values:
            normalizeComparisonValues(
                result.values ||
                result.products ||
                result.options
            ),

        winner:
            result.winner ||
            result.best ||
            result.strongest ||
            null,

        explanation:
            result.explanation ||
            result.reason ||
            result.rationale ||
            "",

        evidence:
            Array.isArray(
                result.evidence
            )
                ? result.evidence
                : normalizeArray(
                    result.evidence
                ),

        confidence:
            normalizeComparisonConfidence(
                result.confidence ??
                result.score
            ),

        metadata:
            result.metadata ||
            {},

        raw:
            result
    };
}


function normalizeComparisonValues(
    values
) {

    if (!values) {
        return {};
    }


    if (
        Array.isArray(values)
    ) {

        const mapped = {};


        values.forEach(
            (item, index) => {

                const key =
                    item.product_id ||
                    item.id ||
                    item.product ||
                    `product_${index}`;


                mapped[key] =
                    item.value ??
                    item.result ??
                    item.score ??
                    item;
            }
        );


        return mapped;
    }


    if (
        typeof values === "object"
    ) {

        return values;
    }


    return {};
}


function normalizeArray(value) {

    if (Array.isArray(value)) {

        return value;
    }


    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return [];
    }


    return [value];
}


function normalizeComparisonConfidence(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;
    }


    let number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {

        return 0;
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
   PRODUCT COLLECTION
   ================================================================ */

function setComparisonProducts(
    products
) {

    COMPARISON.products =
        Array.isArray(products)
            ? products.map(
                normalizeComparisonProduct
            )
            : [];


    COMPARISON.selectedProducts =
        [];


    renderComparisonProducts();

    updateComparisonSelectionState();
}


function addComparisonProduct(
    product
) {

    const normalized =
        normalizeComparisonProduct(
            product
        );


    const exists =
        COMPARISON.products.some(
            (item) =>
                String(item.id) ===
                String(normalized.id)
        );


    if (!exists) {

        COMPARISON.products.push(
            normalized
        );
    }


    renderComparisonProducts();

    updateComparisonSelectionState();
}


function removeComparisonProduct(
    productId
) {

    COMPARISON.products =
        COMPARISON.products.filter(
            (product) =>
                String(product.id) !==
                String(productId)
        );


    COMPARISON.selectedProducts =
        COMPARISON.selectedProducts.filter(
            (id) =>
                String(id) !==
                String(productId)
        );


    renderComparisonProducts();

    updateComparisonSelectionState();
}


/* ================================================================
   PRODUCT SELECTION
   ================================================================ */

function toggleComparisonProduct(
    productId
) {

    const id =
        String(productId);


    const index =
        COMPARISON.selectedProducts.findIndex(
            (selectedId) =>
                String(selectedId) === id
        );


    if (index >= 0) {

        COMPARISON.selectedProducts.splice(
            index,
            1
        );

    } else {

        /*
         * Comparison is intended for multiple products.
         * Do not impose an arbitrary maximum unless the backend
         * explicitly requires one.
         */

        COMPARISON.selectedProducts.push(
            productId
        );
    }


    renderComparisonProducts();

    updateComparisonSelectionState();
}


function clearComparisonSelection() {

    COMPARISON.selectedProducts =
        [];


    renderComparisonProducts();

    updateComparisonSelectionState();
}


function isComparisonProductSelected(
    productId
) {

    return COMPARISON.selectedProducts.some(
        (id) =>
            String(id) ===
            String(productId)
    );
}


/* ================================================================
   PRODUCT LIST RENDERING
   ================================================================ */

function renderComparisonProducts() {

    const container =
        comparisonQuery(
            "[data-comparison-products]"
        );


    if (!container) {
        return;
    }


    if (
        COMPARISON.products.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state compact">

                <div class="empty-state-icon">
                    ◌
                </div>

                <h3>
                    No products available
                </h3>

                <p>
                    Add product sources to the workspace first.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        COMPARISON.products
            .map(
                (product) =>
                    renderComparisonProduct(
                        product
                    )
            )
            .join("");


    container
        .querySelectorAll(
            "[data-select-comparison-product]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        toggleComparisonProduct(
                            button.dataset
                                .selectComparisonProduct
                        );
                    }
                );
            }
        );
}


function renderComparisonProduct(
    product
) {

    const selected =
        isComparisonProductSelected(
            product.id
        );


    return `
        <button
            type="button"
            class="comparison-product ${
                selected
                    ? "selected"
                    : ""
            }"
            data-select-comparison-product="${escapeHTML(
                product.id
            )}"
            aria-pressed="${
                selected
                    ? "true"
                    : "false"
            }"
        >

            <span class="comparison-product-check">
                ${selected ? "✓" : ""}
            </span>

            <span class="comparison-product-info">

                <strong>
                    ${escapeHTML(
                        product.name
                    )}
                </strong>

                ${
                    product.vendor
                        ? `
                            <small>
                                ${escapeHTML(
                                    product.vendor
                                )}
                            </small>
                        `
                        : ""
                }

                ${
                    product.model
                        ? `
                            <small>
                                ${escapeHTML(
                                    product.model
                                )}
                            </small>
                        `
                        : ""
                }

            </span>

        </button>
    `;
}


/* ================================================================
   SELECTION STATE
   ================================================================ */

function updateComparisonSelectionState() {

    const count =
        comparisonQuery(
            "[data-comparison-selection-count]"
        );


    if (count) {

        setText(
            count,
            COMPARISON.selectedProducts.length
        );
    }


    const runButton =
        comparisonQuery(
            "[data-run-comparison]"
        );


    if (runButton) {

        runButton.disabled =
            COMPARISON.loading ||
            COMPARISON.selectedProducts.length < 2;
    }


    const clearButton =
        comparisonQuery(
            "[data-clear-comparison-selection]"
        );


    if (clearButton) {

        clearButton.disabled =
            COMPARISON.selectedProducts.length === 0;
    }
}


/* ================================================================
   PRODUCT SOURCE LOADING
   ================================================================ */

async function loadComparisonProducts() {

    const endpoint =
        document.body.dataset
            .comparisonProductsEndpoint;


    /*
     * If the page does not configure an endpoint, attempt to
     * derive products from the current workspace.
     */

    if (!endpoint) {
        const products = window.FORGE_STORE
            ? FORGE_STORE.getProducts()
            : [];

        setComparisonProducts(products);

        const pending = safeJSONParse(
            sessionStorage.getItem("forge_comparison_pending"),
            []
        );
        if (Array.isArray(pending) && pending.length) {
            pending.forEach(addComparisonProduct);
            sessionStorage.removeItem("forge_comparison_pending");
        }
        return;
    }


    try {

        const result =
            await forgeFetch(
                endpoint
            );


        const products =
            result.products ||
            result.data?.products ||
            (
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : []
            );


        setComparisonProducts(
            products
        );

    } catch (error) {

        console.error(
            "FORGE comparison product loading error:",
            error
        );


        showToast(
            getErrorMessage(error),
            "error",
            "Unable to load products"
        );
    }
}


/* ================================================================
   COMPARISON PAYLOAD
   ================================================================ */

function buildComparisonPayload() {

    return {

        product_ids:
            COMPARISON.selectedProducts.slice(),

        products:
            COMPARISON.products
                .filter(
                    (product) =>
                        COMPARISON.selectedProducts
                            .some(
                                (id) =>
                                    String(id) ===
                                    String(product.id)
                            )
                )
                .map(
                    (product) => ({
                        ...product
                    })
                ),

        query:
            COMPARISON.query || "",

        source_ids:
            window.WORKSPACE &&
            Array.isArray(
                window.WORKSPACE.sources
            )
                ? window.WORKSPACE.sources.map(
                    (source) =>
                        source.id
                )
                : []
    };
}


/* ================================================================
   COMPARISON ENDPOINT
   ================================================================ */

function getComparisonEndpoint() {

    return document.body.dataset
        .comparisonEndpoint || "";
}


/* ================================================================
   RUN COMPARISON
   ================================================================ */

async function runProductComparison() {

    if (
        COMPARISON.loading
    ) {

        return;
    }


    if (
        COMPARISON.selectedProducts.length < 2
    ) {

        showToast(
            "Select at least two products to compare.",
            "warning",
            "Not enough products"
        );

        return;
    }


    const endpoint =
        getComparisonEndpoint();


    if (!endpoint) {

        showToast(
            "The comparison endpoint is not configured yet.",
            "error",
            "Configuration"
        );

        return;
    }


    const button =
        comparisonQuery(
            "[data-run-comparison]"
        );


    COMPARISON.loading =
        true;


    updateComparisonSelectionState();


    setButtonLoading(
        button,
        true,
        "Comparing..."
    );


    showProcessing({
        id:
            "comparison-processing-overlay",

        messageElement:
            "comparison-processing-message",

        message:
            "Comparing product capabilities and evidence..."
    });


    try {

        const result =
            await forgeFetch(
                endpoint,
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            buildComparisonPayload()
                        )
                }
            );


        const backendProducts =
            result.products ||
            result.data?.products;

        if (Array.isArray(backendProducts)) {
            backendProducts.forEach((label, index) => {
                const local = COMPARISON.products.find((product) =>
                    String(product.id) === String(COMPARISON.selectedProducts[index])
                );
                if (local && !local.description) {
                    local.description = label.description || label.label || "";
                }
            });
        }


        COMPARISON.apiResult = result;

        const matrix = Array.isArray(result.matrix) ? result.matrix : [];
        const rawResults = result.results || result.comparison || result.data?.results || result.data?.comparison;

        if (Array.isArray(rawResults)) {
            COMPARISON.results = rawResults.map(normalizeComparisonResult);
        } else {
            const selectedProducts = COMPARISON.products.filter((product) =>
                COMPARISON.selectedProducts.some((id) => String(id) === String(product.id))
            );

            COMPARISON.results = matrix.map((row) => {
                const values = {};
                (Array.isArray(row.values) ? row.values : []).forEach((item) => {
                    const product = selectedProducts[Number(item.product_index)];
                    if (product) values[product.id] = item.value;
                });
                return {
                    id: `comparison-${row.field}`,
                    dimension: row.field,
                    values,
                    winner: null,
                    explanation: row.difference ? "The supplied values differ or are incomplete across the selected products." : "The supplied values are consistent across the selected products.",
                    evidence: [],
                    confidence: 0.75,
                    type: row.difference ? "value_difference" : "shared_value"
                };
            });
        }

        if (window.FORGE_STORE) {
            FORGE_STORE.setComparison({
                ...result,
                results: COMPARISON.results
            });
        }


        COMPARISON.selectedDimension =
            "all";


        COMPARISON.query =
            "";


        calculateComparisonSummary();

        renderComparisonProducts();

        renderComparisonTable();

        renderComparisonSummary();

        renderComparisonFilters();


        showToast(
            "Product comparison completed.",
            "success"
        );

    } catch (error) {

        console.error(
            "FORGE comparison error:",
            error
        );


        showToast(
            getErrorMessage(error),
            "error",
            "Comparison failed"
        );

    } finally {

        COMPARISON.loading =
            false;


        updateComparisonSelectionState();


        setButtonLoading(
            button,
            false
        );


        hideProcessing(
            "comparison-processing-overlay"
        );
    }
}


/* ================================================================
   COMPARISON SUMMARY
   ================================================================ */

function calculateComparisonSummary() {

    const dimensions =
        COMPARISON.results.length;


    let strongest =
        null;


    const scores = {};


    COMPARISON.selectedProducts.forEach(
        (id) => {

            scores[id] = 0;
        }
    );


    COMPARISON.results.forEach(
        (result) => {

            const winner =
                resolveWinnerId(
                    result.winner
                );


            if (
                winner &&
                Object.prototype.hasOwnProperty.call(
                    scores,
                    winner
                )
            ) {

                scores[winner] += 1;
            }
        }
    );


    const ranked =
        Object.entries(
            scores
        )
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );


    if (
        ranked.length > 0 &&
        ranked[0][1] > 0
    ) {

        const product =
            COMPARISON.products.find(
                (item) =>
                    String(item.id) ===
                    String(ranked[0][0])
            );


        if (product) {

            strongest = {

                id:
                    product.id,

                name:
                    product.name,

                wins:
                    ranked[0][1]
            };
        }
    }


    COMPARISON.summary = {

        dimensions,

        compared:
            COMPARISON.selectedProducts.length,

        strongest
    };
}


function renderComparisonSummary() {

    const api = COMPARISON.apiResult || {};
    const differences = Array.isArray(api.differences)
        ? api.differences.length
        : COMPARISON.results.filter(r => r.type === "value_difference").length;
    const shared = Array.isArray(api.shared)
        ? api.shared.length
        : COMPARISON.results.filter(r => r.type === "shared_value").length;
    const review = Array.isArray(api.matrix)
        ? api.matrix.filter(row => row.values?.some(v => v.available === false)).length
        : COMPARISON.results.filter(r => r.type === "missing_value").length;

    const values = {
        "comparison-product-count": COMPARISON.summary.compared,
        "comparison-difference-count": differences,
        "comparison-shared-count": shared,
        "comparison-review-count": review
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    });
}



/* ================================================================
   WINNER RESOLUTION
   ================================================================ */

function resolveWinnerId(
    winner
) {

    if (
        winner === null ||
        winner === undefined ||
        winner === ""
    ) {

        return null;
    }


    if (
        typeof winner === "object"
    ) {

        return (
            winner.id ||
            winner.product_id ||
            winner.product ||
            null
        );
    }


    const stringWinner =
        String(winner);


    /*
     * Direct ID match.
     */

    const direct =
        COMPARISON.products.find(
            (product) =>
                String(product.id) ===
                stringWinner
        );


    if (direct) {

        return direct.id;
    }


    /*
     * Product-name match.
     */

    const byName =
        COMPARISON.products.find(
            (product) =>
                product.name.toLowerCase() ===
                stringWinner.toLowerCase()
        );


    if (byName) {

        return byName.id;
    }


    return null;
}


/* ================================================================
   DIMENSION FILTERS
   ================================================================ */

function getComparisonDimensions() {

    return [
        ...new Set(
            COMPARISON.results
                .map(
                    (result) =>
                        result.dimension
                )
                .filter(Boolean)
        )
    ];
}


function getFilteredComparisonResults() {

    let results =
        COMPARISON.results.slice();


    if (
        COMPARISON.selectedDimension !==
        "all"
    ) {

        results =
            results.filter(
                (result) =>
                    result.dimension ===
                    COMPARISON.selectedDimension
            );
    }


    const query =
        COMPARISON.query
            .trim()
            .toLowerCase();


    if (query) {

        results =
            results.filter(
                (result) =>
                    String(
                        result.dimension
                    )
                        .toLowerCase()
                        .includes(query) ||
                    String(
                        result.explanation
                    )
                        .toLowerCase()
                        .includes(query)
            );
    }


    return results;
}


function setComparisonDimension(
    dimension
) {

    COMPARISON.selectedDimension =
        dimension || "all";


    renderComparisonFilters();

    renderComparisonTable();
}


function renderComparisonFilters() {

    const container =
        comparisonQuery(
            "[data-comparison-filters]"
        );


    if (container) {

        const dimensions =
            getComparisonDimensions();


        container.innerHTML = `
            <button
                type="button"
                class="filter-button ${
                    COMPARISON.selectedDimension === "all"
                        ? "active"
                        : ""
                }"
                data-comparison-filter="all"
            >
                All
            </button>

            ${dimensions
                .map(
                    (dimension) => `
                        <button
                            type="button"
                            class="filter-button ${
                                COMPARISON.selectedDimension === dimension
                                    ? "active"
                                    : ""
                            }"
                            data-comparison-filter="${escapeHTML(
                                dimension
                            )}"
                        >
                            ${escapeHTML(
                                dimension
                            )}
                        </button>
                    `
                )
                .join("")}
        `;


        container
            .querySelectorAll(
                "[data-comparison-filter]"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        () => {

                            setComparisonDimension(
                                button.dataset
                                    .comparisonFilter
                            );
                        }
                    );
                }
            );
    }


    comparisonQueries(
        "[data-comparison-filter]"
    ).forEach(
        (button) => {

            button.classList.toggle(
                "active",
                button.dataset
                    .comparisonFilter ===
                    COMPARISON.selectedDimension
            );
        }
    );
}


/* ================================================================
   SEARCH
   ================================================================ */

function setupComparisonSearch() {

    const input =
        comparisonQuery(
            "[data-comparison-search]"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            COMPARISON.query =
                input.value;


            renderComparisonTable();
        }
    );
}


/* ================================================================
   COMPARISON TABLE
   ================================================================ */

function renderComparisonTable() {

    const container =
        comparisonQuery(
            "[data-comparison-table]"
        );


    if (!container) {
        return;
    }


    if (
        COMPARISON.results.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    ◌
                </div>

                <h3>
                    No comparison available
                </h3>

                <p>
                    Select at least two products and run a comparison.
                </p>

            </div>
        `;

        return;
    }


    const results =
        getFilteredComparisonResults();


    if (
        results.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    ⌕
                </div>

                <h3>
                    No matching dimensions
                </h3>

                <p>
                    Try a different filter or search term.
                </p>

            </div>
        `;

        return;
    }


    const selectedProducts =
        COMPARISON.products.filter(
            (product) =>
                COMPARISON.selectedProducts
                    .some(
                        (id) =>
                            String(id) ===
                            String(product.id)
                    )
        );


    const header =
        `
            <tr>

                <th class="comparison-dimension-column">
                    Requirement / Dimension
                </th>

                ${selectedProducts
                    .map(
                        (product) => `
                            <th>
                                <div class="comparison-header-product">

                                    <strong>
                                        ${escapeHTML(
                                            product.name
                                        )}
                                    </strong>

                                    ${
                                        product.vendor
                                            ? `
                                                <small>
                                                    ${escapeHTML(
                                                        product.vendor
                                                    )}
                                                </small>
                                            `
                                            : ""
                                    }

                                </div>
                            </th>
                        `
                    )
                    .join("")}

                <th>
                    FORGE assessment
                </th>

            </tr>
        `;


    const body =
        results
            .map(
                (result) =>
                    renderComparisonRow(
                        result,
                        selectedProducts
                    )
            )
            .join("");


    container.innerHTML = `
        <div class="comparison-table-wrapper">

            <table class="comparison-table">

                <thead>
                    ${header}
                </thead>

                <tbody>
                    ${body}
                </tbody>

            </table>

        </div>
    `;


    container
        .querySelectorAll(
            "[data-comparison-detail]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openComparisonDetail(
                            button.dataset
                                .comparisonDetail
                        );
                    }
                );
            }
        );
}


function renderComparisonRow(
    result,
    products
) {

    const winnerId =
        resolveWinnerId(
            result.winner
        );


    const productCells =
        products
            .map(
                (product) => {

                    const value =
                        getComparisonValue(
                            result,
                            product
                        );


                    const isWinner =
                        winnerId &&
                        String(winnerId) ===
                        String(product.id);


                    return `
                        <td class="${
                            isWinner
                                ? "comparison-winner"
                                : ""
                        }">

                            <div class="comparison-value">

                                ${
                                    isWinner
                                        ? `
                                            <span class="winner-badge">
                                                Strongest
                                            </span>
                                        `
                                        : ""
                                }

                                <span>
                                    ${escapeHTML(
                                        formatComparisonValue(
                                            value
                                        )
                                    )}
                                </span>

                            </div>

                        </td>
                    `;
                }
            )
            .join("");


    return `
        <tr>

            <td>

                <button
                    type="button"
                    class="comparison-dimension"
                    data-comparison-detail="${escapeHTML(
                        result.id
                    )}"
                >

                    <strong>
                        ${escapeHTML(
                            result.dimension
                        )}
                    </strong>

                    ${
                        result.explanation
                            ? `
                                <small>
                                    ${escapeHTML(
                                        truncateText(
                                            result.explanation,
                                            120
                                        )
                                    )}
                                </small>
                            `
                            : ""
                    }

                </button>

            </td>

            ${productCells}

            <td>

                <div class="comparison-assessment">

                    ${
                        result.winner
                            ? `
                                <strong>
                                    ${escapeHTML(
                                        getWinnerName(
                                            result.winner
                                        )
                                    )}
                                </strong>
                            `
                            : `
                                <span class="muted">
                                    No clear winner
                                </span>
                            `
                    }

                    <small>
                        ${Math.round(
                            result.confidence
                        )}% confidence
                    </small>

                </div>

            </td>

        </tr>
    `;
}


function getComparisonValue(
    result,
    product
) {

    const values =
        result.values || {};


    const direct =
        values[product.id];


    if (
        direct !== undefined
    ) {

        return direct;
    }


    const byString =
        values[
            String(
                product.id
            )
        ];


    if (
        byString !== undefined
    ) {

        return byString;
    }


    /*
     * Some backend responses may key by product name.
     */

    const byName =
        values[
            product.name
        ];


    if (
        byName !== undefined
    ) {

        return byName;
    }


    return "—";
}


function formatComparisonValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "—";
    }


    if (
        typeof value === "object"
    ) {

        if (
            value.value !== undefined
        ) {

            return String(
                value.value
            );
        }


        if (
            value.result !== undefined
        ) {

            return String(
                value.result
            );
        }


        if (
            value.score !== undefined
        ) {

            return String(
                value.score
            );
        }


        return JSON.stringify(
            value
        );
    }


    return String(
        value
    );
}


function getWinnerName(
    winner
) {

    const winnerId =
        resolveWinnerId(
            winner
        );


    if (!winnerId) {

        return String(
            winner
        );
    }


    const product =
        COMPARISON.products.find(
            (item) =>
                String(item.id) ===
                String(winnerId)
        );


    return product
        ? product.name
        : String(winner);
}


/* ================================================================
   TEXT HELPERS
   ================================================================ */

function truncateText(
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
   COMPARISON DETAIL
   ================================================================ */

function getComparisonResultById(
    id
) {

    return COMPARISON.results.find(
        (result) =>
            String(result.id) ===
            String(id)
    );
}


function openComparisonDetail(
    id
) {

    const result =
        getComparisonResultById(
            id
        );


    if (!result) {

        showToast(
            "The selected comparison dimension could not be found.",
            "error"
        );

        return;
    }


    const modal =
        comparisonQuery(
            "[data-comparison-detail-modal]"
        );


    if (!modal) {

        showToast(
            result.explanation ||
            "No additional assessment is available.",
            "info",
            result.dimension
        );

        return;
    }


    renderComparisonDetail(
        result,
        modal
    );


    openModal(
        modal
    );
}


function renderComparisonDetail(
    result,
    modal
) {

    const title =
        modal.querySelector(
            "[data-comparison-detail-title]"
        );


    const confidence =
        modal.querySelector(
            "[data-comparison-detail-confidence]"
        );


    const winner =
        modal.querySelector(
            "[data-comparison-detail-winner]"
        );


    const explanation =
        modal.querySelector(
            "[data-comparison-detail-explanation]"
        );


    const evidence =
        modal.querySelector(
            "[data-comparison-detail-evidence]"
        );


    if (title) {

        setText(
            title,
            result.dimension
        );
    }


    if (confidence) {

        setText(
            confidence,
            `${Math.round(
                result.confidence
            )}%`
        );
    }


    if (winner) {

        setText(
            winner,
            result.winner
                ? getWinnerName(
                    result.winner
                )
                : "No clear winner"
        );
    }


    if (explanation) {

        setText(
            explanation,
            result.explanation ||
            "No explanation provided."
        );
    }


    if (evidence) {

        renderComparisonEvidence(
            result.evidence,
            evidence
        );
    }
}


function renderComparisonEvidence(
    evidence,
    container
) {

    if (
        !Array.isArray(evidence) ||
        evidence.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state compact">

                <p>
                    No evidence was returned.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        evidence
            .map(
                (item, index) => {

                    if (
                        typeof item === "string"
                    ) {

                        return `
                            <div class="evidence-item">

                                <span class="evidence-index">
                                    ${index + 1}
                                </span>

                                <p>
                                    ${escapeHTML(
                                        item
                                    )}
                                </p>

                            </div>
                        `;
                    }


                    return `
                        <div class="evidence-item">

                            <span class="evidence-index">
                                ${index + 1}
                            </span>

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        item.title ||
                                        item.label ||
                                        "Evidence"
                                    )}
                                </strong>

                                <p>
                                    ${escapeHTML(
                                        item.text ||
                                        item.content ||
                                        item.description ||
                                        ""
                                    )}
                                </p>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* ================================================================
   EXPORT
   ================================================================ */

function exportComparison() {

    if (
        COMPARISON.results.length === 0
    ) {

        showToast(
            "There is no comparison to export.",
            "warning"
        );

        return;
    }


    const payload = {

        generated_at:
            new Date().toISOString(),

        products:
            COMPARISON.products
                .filter(
                    (product) =>
                        COMPARISON.selectedProducts
                            .some(
                                (id) =>
                                    String(id) ===
                                    String(product.id)
                            )
                ),

        summary:
            COMPARISON.summary,

        results:
            COMPARISON.results
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
        "forge-comparison.json";


    document.body.appendChild(
        link
    );


    link.click();

    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "Comparison exported.",
        "success"
    );
}


/* ================================================================
   RESET
   ================================================================ */

function resetComparison() {

    COMPARISON.results =
        [];

    COMPARISON.selectedDimension =
        "all";

    COMPARISON.query =
        "";

    COMPARISON.summary = {

        dimensions:
            0,

        compared:
            COMPARISON.selectedProducts.length,

        strongest:
            null
    };


    const search =
        comparisonQuery(
            "[data-comparison-search]"
        );


    if (search) {

        search.value =
            "";
    }


    renderComparisonTable();

    renderComparisonSummary();

    renderComparisonFilters();
}


/* ================================================================
   BUTTONS
   ================================================================ */

function setupComparisonButtons() {

    const runButton =
        comparisonQuery(
            "[data-run-comparison]"
        );


    if (runButton) {

        runButton.addEventListener(
            "click",
            runProductComparison
        );
    }


    const clearButton =
        comparisonQuery(
            "[data-clear-comparison-selection]"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                clearComparisonSelection();

                showToast(
                    "Product selection cleared.",
                    "info"
                );
            }
        );
    }


    const resetButton =
        comparisonQuery(
            "[data-reset-comparison]"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            () => {

                resetComparison();

                showToast(
                    "Comparison reset.",
                    "info"
                );
            }
        );
    }


    const exportButton =
        comparisonQuery(
            "[data-export-comparison]"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            exportComparison
        );
    }
}


/* ================================================================
   WORKSPACE SYNCHRONIZATION
   ================================================================ */

function setupWorkspaceSynchronization() {

    /*
     * Workspace may initialize asynchronously.
     * Refresh the available comparison products after a short delay
     * if no explicit comparison endpoint is configured.
     */

    if (
        document.body.dataset
            .comparisonProductsEndpoint
    ) {

        return;
    }


    window.setTimeout(
        () => {

            loadComparisonProducts();

        },
        150
    );
}


/* ================================================================
   KEYBOARD SHORTCUTS
   ================================================================ */

function setupComparisonKeyboard() {

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
             * C = focus comparison search.
             */

            if (
                event.key.toLowerCase() === "c"
            ) {

                const search =
                    comparisonQuery(
                        "[data-comparison-search]"
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

async function initializeComparison() {

    setupComparisonButtons();

    setupComparisonSearch();

    setupWorkspaceSynchronization();

    setupComparisonKeyboard();

    renderComparisonProducts();

    renderComparisonTable();

    renderComparisonSummary();

    renderComparisonFilters();

    updateComparisonSelectionState();


    await loadComparisonProducts();
}


/* ================================================================
   PUBLIC API
   ================================================================ */

window.COMPARISON =
    COMPARISON;

window.runProductComparison =
    runProductComparison;

window.toggleComparisonProduct =
    toggleComparisonProduct;

window.clearComparisonSelection =
    clearComparisonSelection;

window.resetComparison =
    resetComparison;

window.openComparisonDetail =
    openComparisonDetail;


/* ================================================================
   PAGE INITIALIZATION
   ================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initializeComparison();
        }
    );

} else {

    initializeComparison();
}