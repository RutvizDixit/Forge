/* ================================================================
   FORGE — REQUIREMENT MATCHING
   match.js
   ================================================================ */

"use strict";


/* ================================================================
   MATCH STATE
   ================================================================ */

const MATCH = {

    requirements: [],

    results: [],

    selectedRequirement: null,

    loading: false,

    filter: "all",

    query: "",

    summary: {

        total: 0,

        matched: 0,

        partial: 0,

        unmatched: 0

    }
};


/* ================================================================
   DOM HELPERS
   ================================================================ */

function matchQuery(selector) {

    return document.querySelector(selector);
}


function matchQueries(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* ================================================================
   NORMALIZATION
   ================================================================ */

function normalizeMatchResult(result) {

    if (!result) {

        return {

            id:
                `match-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,

            requirement:
                "",

            status:
                "unmatched",

            confidence:
                0,

            evidence:
                [],

            sources:
                [],

            explanation:
                ""

        };
    }


    return {

        id:
            result.id ||
            result.requirement_id ||
            result.match_id ||
            `match-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        requirement:
            result.requirement ||
            result.requirement_text ||
            result.text ||
            result.name ||
            "",

        requirement_id:
            result.requirement_id ||
            result.id ||
            null,

        status:
            normalizeMatchStatus(
                result.status ||
                result.match_status ||
                result.result
            ),

        confidence:
            normalizeConfidence(
                result.confidence ??
                result.score ??
                result.match_score
            ),

        evidence:
            normalizeArray(
                result.evidence
            ),

        sources:
            normalizeArray(
                result.sources ||
                result.source_references
            ),

        explanation:
            result.explanation ||
            result.reason ||
            result.rationale ||
            "",

        metadata:
            result.metadata ||
            {},

        product:
            result.product ||
            (window.FORGE_STORE && Number.isInteger(Number(result.index))
                ? FORGE_STORE.getProducts()[Number(result.index)] || null
                : null),

        raw:
            result
    };
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


function normalizeConfidence(value) {

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


    /*
     * Support both:
     *
     * 0.87
     * 87
     */

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


function normalizeMatchStatus(
    status
) {

    if (!status) {

        return "unmatched";
    }


    const normalized =
        String(status)
            .trim()
            .toLowerCase()
            .replaceAll(
                "_",
                "-"
            );


    if (
        [
            "matched",
            "match",
            "full",
            "exact",
            "pass",
            "passed"
        ].includes(normalized)
    ) {

        return "matched";
    }


    if (
        [
            "partial",
            "partially-matched",
            "partial-match",
            "possible"
        ].includes(normalized)
    ) {

        return "partial";
    }


    return "unmatched";
}


/* ================================================================
   REQUIREMENT INPUT
   ================================================================ */

function getRequirementInput() {

    return matchQuery(
        "[data-requirement-input]"
    );
}


function getRequirementText() {

    const input =
        getRequirementInput();


    if (!input) {

        return "";
    }


    return input.value.trim();
}


function clearRequirementInput() {

    const input =
        getRequirementInput();


    if (input) {

        input.value = "";
    }
}


/* ================================================================
   REQUIREMENT COLLECTION
   ================================================================ */

function addRequirement(
    text
) {

    const requirement =
        String(
            text || ""
        ).trim();


    if (!requirement) {

        showToast(
            "Enter a requirement first.",
            "warning"
        );

        return false;
    }


    const duplicate =
        MATCH.requirements.some(
            (item) =>
                item.toLowerCase() ===
                requirement.toLowerCase()
        );


    if (duplicate) {

        showToast(
            "That requirement is already in the list.",
            "warning"
        );

        return false;
    }


    MATCH.requirements.push(
        requirement
    );


    renderRequirements();

    updateMatchInputState();


    return true;
}


function removeRequirement(
    index
) {

    if (
        index < 0 ||
        index >= MATCH.requirements.length
    ) {

        return;
    }


    MATCH.requirements.splice(
        index,
        1
    );


    renderRequirements();

    updateMatchInputState();
}


function clearRequirements() {

    MATCH.requirements =
        [];


    renderRequirements();

    updateMatchInputState();
}


/* ================================================================
   REQUIREMENT LIST RENDERING
   ================================================================ */

function renderRequirements() {

    const container =
        matchQuery(
            "[data-requirements-list]"
        );


    if (!container) {

        return;
    }


    if (
        MATCH.requirements.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state compact">

                <div class="empty-state-icon">
                    +
                </div>

                <h3>
                    No requirements added
                </h3>

                <p>
                    Add the product requirements you want FORGE to evaluate.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        MATCH.requirements
            .map(
                (requirement, index) => {

                    return `
                        <div
                            class="requirement-item"
                            data-requirement-index="${index}"
                        >

                            <div class="requirement-number">
                                ${index + 1}
                            </div>

                            <div class="requirement-content">

                                <span>
                                    ${escapeHTML(
                                        requirement
                                    )}
                                </span>

                            </div>

                            <button
                                type="button"
                                class="icon-button"
                                data-remove-requirement="${index}"
                                aria-label="Remove requirement"
                            >
                                ×
                            </button>

                        </div>
                    `;
                }
            )
            .join("");


    container
        .querySelectorAll(
            "[data-remove-requirement]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        removeRequirement(
                            Number(
                                button.dataset
                                    .removeRequirement
                            )
                        );
                    }
                );
            }
        );
}


/* ================================================================
   REQUIREMENT INPUT SETUP
   ================================================================ */

function setupRequirementInput() {

    const input =
        getRequirementInput();


    const addButton =
        matchQuery(
            "[data-add-requirement]"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                const text =
                    getRequirementText();


                if (
                    addRequirement(
                        text
                    )
                ) {

                    clearRequirementInput();
                }
            }
        );
    }


    if (input) {

        input.addEventListener(
            "keydown",
            (event) => {

                /*
                 * Ctrl/Cmd + Enter:
                 * add requirement.
                 */

                if (
                    event.key === "Enter" &&
                    (
                        event.ctrlKey ||
                        event.metaKey
                    )
                ) {

                    event.preventDefault();


                    if (
                        addRequirement(
                            getRequirementText()
                        )
                    ) {

                        clearRequirementInput();
                    }
                }
            }
        );
    }


    const clearButton =
        matchQuery(
            "[data-clear-requirements]"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearRequirements
        );
    }
}


/* ================================================================
   INPUT STATE
   ================================================================ */

function updateMatchInputState() {

    const count =
        matchQuery(
            "[data-requirement-count]"
        );


    if (count) {

        setText(
            count,
            MATCH.requirements.length
        );
    }


    const runButton =
        matchQuery(
            "[data-run-match]"
        );


    if (runButton) {

        runButton.disabled =
            MATCH.loading ||
            MATCH.requirements.length === 0;
    }
}


/* ================================================================
   REQUIREMENTS FROM TEXT
   ================================================================ */

function parseRequirementsFromText(
    text
) {

    return String(
        text || ""
    )
        .split(/\r?\n/)
        .map(
            (line) =>
                line
                    .replace(
                        /^\s*(?:[-*•]|\d+[.)])\s*/,
                        ""
                    )
                    .trim()
        )
        .filter(Boolean);
}


function importRequirementsFromText(
    text
) {

    const requirements =
        parseRequirementsFromText(
            text
        );


    if (
        requirements.length === 0
    ) {

        showToast(
            "No requirements were found.",
            "warning"
        );

        return;
    }


    let added =
        0;


    requirements.forEach(
        (requirement) => {

            const result =
                addRequirement(
                    requirement
                );


            if (result) {
                added += 1;
            }
        }
    );


    if (added > 0) {

        showToast(
            `${added} requirement${added === 1 ? "" : "s"} added.`,
            "success"
        );
    }
}


/* ================================================================
   MATCH ENDPOINT
   ================================================================ */

function getMatchEndpoint() {

    return document.body.dataset
        .matchEndpoint || "";
}


/* ================================================================
   MATCH PAYLOAD
   ================================================================ */

function buildMatchPayload() {

    const requirement =
        MATCH.requirements[0] ||
        getRequirementText();

    const products = window.FORGE_STORE
        ? FORGE_STORE.getProducts()
        : [];

    return {
        products,
        requirement,
        use_llm: false,
        metadata: {
            client: "forge-web",
            version: document.body.dataset.forgeVersion || "1.0.0"
        }
    };
}


/* ================================================================
   RUN MATCHING
   ================================================================ */

async function runRequirementMatch() {

    if (
        MATCH.loading
    ) {

        return;
    }


    if (MATCH.requirements.length === 0) {
        const text = getRequirementText();
        if (text) {
            MATCH.requirements = [text];
        }
    }

    if (MATCH.requirements.length === 0) {

        showToast(
            "Add at least one requirement before running the match.",
            "warning",
            "No requirements"
        );

        return;
    }


    const endpoint =
        getMatchEndpoint();


    if (!endpoint) {

        showToast(
            "The requirement matching endpoint is not configured yet.",
            "error",
            "Configuration"
        );

        return;
    }


    const button =
        matchQuery(
            "[data-run-match]"
        );


    MATCH.loading =
        true;


    updateMatchInputState();


    setButtonLoading(
        button,
        true,
        "Matching..."
    );


    showProcessing({
        id:
            "match-processing-overlay",

        messageElement:
            "match-processing-message",

        message:
            "Analyzing requirements against the available evidence..."
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
                            buildMatchPayload()
                        )
                }
            );


        const rawResults =
            result.results ||
            result.matches ||
            result.data?.results ||
            result.data?.matches ||
            (
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : []
            );


        MATCH.results =
            Array.isArray(rawResults)
                ? rawResults.map(normalizeMatchResult)
                : [];

        if (window.FORGE_STORE) {
            FORGE_STORE.setMatch(MATCH.results);
        }


        MATCH.selectedRequirement =
            null;


        MATCH.filter =
            "all";


        MATCH.query =
            "";


        calculateMatchSummary();

        renderMatchResults();

        renderMatchSummary();

        renderMatchFilters();


        showToast(
            "Requirement matching completed.",
            "success"
        );

    } catch (error) {

        console.error(
            "FORGE matching error:",
            error
        );


        showToast(
            getErrorMessage(error),
            "error",
            "Matching failed"
        );

    } finally {

        MATCH.loading =
            false;


        updateMatchInputState();


        setButtonLoading(
            button,
            false
        );


        hideProcessing(
            "match-processing-overlay"
        );
    }
}


/* ================================================================
   MATCH SUMMARY
   ================================================================ */

function calculateMatchSummary() {

    const summary = {

        total:
            MATCH.results.length,

        matched:
            0,

        partial:
            0,

        unmatched:
            0
    };


    MATCH.results.forEach(
        (result) => {

            if (
                result.status === "matched"
            ) {

                summary.matched += 1;

            } else if (
                result.status === "partial"
            ) {

                summary.partial += 1;

            } else {

                summary.unmatched += 1;
            }
        }
    );


    MATCH.summary =
        summary;
}


function renderMatchSummary() {

    const mapping = {

        total:
            "[data-match-total]",

        matched:
            "[data-match-matched]",

        partial:
            "[data-match-partial]",

        unmatched:
            "[data-match-unmatched]"
    };


    Object.entries(
        mapping
    ).forEach(
        ([key, selector]) => {

            const element =
                matchQuery(
                    selector
                );


            if (element) {

                setText(
                    element,
                    MATCH.summary[key]
                );
            }
        }
    );
}


/* ================================================================
   MATCH FILTERS
   ================================================================ */

function getFilteredResults() {

    let results =
        MATCH.results.slice();


    if (
        MATCH.filter !== "all"
    ) {

        results =
            results.filter(
                (result) =>
                    result.status ===
                    MATCH.filter
            );
    }


    const query =
        MATCH.query
            .trim()
            .toLowerCase();


    if (query) {

        results =
            results.filter(
                (result) => {

                    const requirement =
                        String(
                            result.requirement ||
                            ""
                        )
                            .toLowerCase();


                    const explanation =
                        String(
                            result.explanation ||
                            ""
                        )
                            .toLowerCase();


                    return (
                        requirement.includes(
                            query
                        ) ||
                        explanation.includes(
                            query
                        )
                    );
                }
            );
    }


    return results;
}


function setMatchFilter(
    filter
) {

    const validFilters = [
        "all",
        "matched",
        "partial",
        "unmatched"
    ];


    if (
        !validFilters.includes(
            filter
        )
    ) {

        filter = "all";
    }


    MATCH.filter =
        filter;


    renderMatchFilters();

    renderMatchResults();
}


function renderMatchFilters() {

    matchQueries(
        "[data-match-filter]"
    ).forEach(
        (button) => {

            const value =
                button.dataset
                    .matchFilter;


            button.classList.toggle(
                "active",
                value === MATCH.filter
            );


            button.setAttribute(
                "aria-selected",
                value === MATCH.filter
                    ? "true"
                    : "false"
            );
        }
    );
}


function setupMatchFilters() {

    matchQueries(
        "[data-match-filter]"
    ).forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    setMatchFilter(
                        button.dataset
                            .matchFilter
                    );
                }
            );
        }
    );


    const search =
        matchQuery(
            "[data-match-search]"
        );


    if (search) {

        search.addEventListener(
            "input",
            () => {

                MATCH.query =
                    search.value;

                renderMatchResults();
            }
        );
    }
}


/* ================================================================
   MATCH RESULT RENDERING
   ================================================================ */

function renderMatchResults() {

    const container =
        matchQuery(
            "[data-match-results]"
        );


    if (!container) {
        return;
    }


    const results =
        getFilteredResults();


    if (
        MATCH.results.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    ◌
                </div>

                <h3>
                    No match results yet
                </h3>

                <p>
                    Add requirements and run the matching engine to generate results.
                </p>

            </div>
        `;

        return;
    }


    if (
        results.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    ⌕
                </div>

                <h3>
                    No results found
                </h3>

                <p>
                    Try another filter or search term.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        results
            .map(
                (result) =>
                    renderMatchCard(
                        result
                    )
            )
            .join("");


    container
        .querySelectorAll(
            "[data-open-match]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openMatchDetail(
                            button.dataset
                                .openMatch
                        );
                    }
                );
            }
        );
}


function renderMatchCard(
    result
) {

    const confidence =
        Math.round(
            result.confidence
        );


    const statusLabel =
        getMatchStatusLabel(
            result.status
        );


    const statusClass =
        `status-${result.status}`;


    const evidenceCount =
        result.evidence.length;


    const sourceCount =
        result.sources.length;


    return `
        <article
            class="match-card ${statusClass}"
            data-match-id="${escapeHTML(
                result.id
            )}"
        >

            <div class="match-card-header">

                <div class="match-card-status">

                    <span class="status-dot"></span>

                    <span class="status-label">
                        ${escapeHTML(
                            statusLabel
                        )}
                    </span>

                </div>

                <div class="match-confidence">

                    <strong>
                        ${confidence}%
                    </strong>

                    <span>
                        confidence
                    </span>

                </div>

            </div>


            <div class="match-card-body">

                <h3>
                    ${escapeHTML(
                        result.requirement
                    )}
                </h3>

                ${
                    result.explanation
                        ? `
                            <p>
                                ${escapeHTML(
                                    result.explanation
                                )}
                            </p>
                        `
                        : `
                            <p class="muted">
                                No explanation provided.
                            </p>
                        `
                }

            </div>


            <div class="match-card-footer">

                <div class="match-card-meta">

                    <span>
                        ${evidenceCount}
                        evidence
                    </span>

                    <span>
                        ${sourceCount}
                        source${sourceCount === 1 ? "" : "s"}
                    </span>

                </div>


                <button
                    type="button"
                    class="text-button"
                    data-open-match="${escapeHTML(
                        result.id
                    )}"
                >
                    Inspect
                </button>

            </div>

        </article>
    `;
}


function getMatchStatusLabel(
    status
) {

    const labels = {

        matched:
            "Matched",

        partial:
            "Partial",

        unmatched:
            "Unmatched"
    };


    return (
        labels[status] ||
        "Unmatched"
    );
}


/* ================================================================
   MATCH DETAIL
   ================================================================ */

function getMatchById(
    id
) {

    return MATCH.results.find(
        (result) =>
            String(result.id) ===
            String(id)
    );
}


function openMatchDetail(
    id
) {

    const result =
        getMatchById(
            id
        );


    if (!result) {

        showToast(
            "The selected match could not be found.",
            "error"
        );

        return;
    }


    MATCH.selectedRequirement =
        result;


    const modal =
        matchQuery(
            "[data-match-detail-modal]"
        );


    if (!modal) {

        /*
         * If the page does not contain the dedicated detail modal,
         * fall back to a lightweight toast.
         */

        showToast(
            `${getMatchStatusLabel(result.status)} — ${Math.round(result.confidence)}% confidence.`,
            result.status === "matched"
                ? "success"
                : result.status === "partial"
                    ? "warning"
                    : "error"
        );

        return;
    }


    renderMatchDetail(
        result,
        modal
    );


    openModal(
        modal
    );
}


function renderMatchDetail(
    result,
    modal
) {

    const requirement =
        modal.querySelector(
            "[data-detail-requirement]"
        );


    const status =
        modal.querySelector(
            "[data-detail-status]"
        );


    const confidence =
        modal.querySelector(
            "[data-detail-confidence]"
        );


    const explanation =
        modal.querySelector(
            "[data-detail-explanation]"
        );


    const evidence =
        modal.querySelector(
            "[data-detail-evidence]"
        );


    const sources =
        modal.querySelector(
            "[data-detail-sources]"
        );


    if (requirement) {

        setText(
            requirement,
            result.requirement
        );
    }


    if (status) {

        setText(
            status,
            getMatchStatusLabel(
                result.status
            )
        );


        status.dataset.status =
            result.status;
    }


    if (confidence) {

        setText(
            confidence,
            `${Math.round(
                result.confidence
            )}%`
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

        renderDetailEvidence(
            result.evidence,
            evidence
        );
    }


    if (sources) {

        renderDetailSources(
            result.sources,
            sources
        );
    }
}


function renderDetailEvidence(
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


function renderDetailSources(
    sources,
    container
) {

    if (
        !Array.isArray(sources) ||
        sources.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state compact">
                <p>
                    No source references were returned.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        sources
            .map(
                (source, index) => {

                    if (
                        typeof source === "string"
                    ) {

                        return `
                            <div class="source-reference">

                                <span>
                                    ${index + 1}
                                </span>

                                <p>
                                    ${escapeHTML(
                                        source
                                    )}
                                </p>

                            </div>
                        `;
                    }


                    const name =
                        source.name ||
                        source.title ||
                        source.filename ||
                        "Source";


                    const url =
                        source.url ||
                        source.source_url ||
                        null;


                    return `
                        <div class="source-reference">

                            <span>
                                ${index + 1}
                            </span>

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        name
                                    )}
                                </strong>

                                ${
                                    source.page
                                        ? `
                                            <small>
                                                Page ${escapeHTML(
                                                    source.page
                                                )}
                                            </small>
                                        `
                                        : ""
                                }

                                ${
                                    url
                                        ? `
                                            <a
                                                href="${escapeHTML(
                                                    url
                                                )}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="text-link"
                                            >
                                                Open source
                                            </a>
                                        `
                                        : ""
                                }

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* ================================================================
   RESULT EXPORT
   ================================================================ */

function exportMatchResults() {

    if (
        MATCH.results.length === 0
    ) {

        showToast(
            "There are no match results to export.",
            "warning"
        );

        return;
    }


    const payload = {

        generated_at:
            new Date().toISOString(),

        summary:
            MATCH.summary,

        results:
            MATCH.results.map(
                (result) => ({

                    requirement:
                        result.requirement,

                    status:
                        result.status,

                    confidence:
                        result.confidence,

                    explanation:
                        result.explanation,

                    evidence:
                        result.evidence,

                    sources:
                        result.sources
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
        "forge-match-results.json";


    document.body.appendChild(
        link
    );


    link.click();

    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "Match results exported.",
        "success"
    );
}


/* ================================================================
   RESET MATCHING
   ================================================================ */

function resetMatchResults() {

    MATCH.results =
        [];

    MATCH.selectedRequirement =
        null;

    MATCH.filter =
        "all";

    MATCH.query =
        "";

    MATCH.summary = {

        total:
            0,

        matched:
            0,

        partial:
            0,

        unmatched:
            0
    };


    const search =
        matchQuery(
            "[data-match-search]"
        );


    if (search) {

        search.value =
            "";
    }


    renderMatchResults();

    renderMatchSummary();

    renderMatchFilters();
}


/* ================================================================
   BUTTON SETUP
   ================================================================ */

function setupMatchButtons() {

    const runButton =
        matchQuery(
            "[data-run-match]"
        );


    if (runButton) {

        runButton.addEventListener(
            "click",
            runRequirementMatch
        );
    }


    const exportButton =
        matchQuery(
            "[data-export-match]"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            exportMatchResults
        );
    }


    const resetButton =
        matchQuery(
            "[data-reset-match]"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            () => {

                resetMatchResults();

                showToast(
                    "Match workspace reset.",
                    "info"
                );
            }
        );
    }
}


/* ================================================================
   REQUIREMENT TEXT IMPORT
   ================================================================ */

function setupRequirementTextImport() {

    const input =
        matchQuery(
            "[data-requirements-text]"
        );


    const button =
        matchQuery(
            "[data-import-requirements]"
        );


    if (
        !input ||
        !button
    ) {

        return;
    }


    button.addEventListener(
        "click",
        () => {

            importRequirementsFromText(
                input.value
            );


            input.value =
                "";
        }
    );
}


/* ================================================================
   KEYBOARD SHORTCUT
   ================================================================ */

function setupMatchKeyboard() {

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
             * M = focus requirement input
             */

            if (
                event.key.toLowerCase() === "m"
            ) {

                const input =
                    getRequirementInput();


                if (input) {

                    event.preventDefault();

                    input.focus();
                }
            }
        }
    );
}


/* ================================================================
   INITIALIZATION
   ================================================================ */

function initializeMatch() {

    setupRequirementInput();

    setupMatchFilters();

    setupMatchButtons();

    setupRequirementTextImport();

    setupMatchKeyboard();

    const pendingRequirement = sessionStorage.getItem("forge_pending_requirement") || "";
    const requirementInput = document.getElementById("match-requirement");
    if (pendingRequirement && requirementInput) {
        requirementInput.value = pendingRequirement;
        sessionStorage.removeItem("forge_pending_requirement");
    }

    const storedMatch = window.FORGE_STORE
        ? FORGE_STORE.getMatch()
        : [];

    if (storedMatch.length) {
        MATCH.results = storedMatch.map(normalizeMatchResult);
        calculateMatchSummary();
    }

    renderRequirements();

    renderMatchSummary();

    renderMatchFilters();

    renderMatchResults();

    updateMatchInputState();
}


/* ================================================================
   PUBLIC API
   ================================================================ */

window.MATCH =
    MATCH;

window.addRequirement =
    addRequirement;

window.removeRequirement =
    removeRequirement;

window.runRequirementMatch =
    runRequirementMatch;

window.resetMatchResults =
    resetMatchResults;

window.openMatchDetail =
    openMatchDetail;


/* ================================================================
   PAGE INITIALIZATION
   ================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMatch
    );

} else {

    initializeMatch();
}