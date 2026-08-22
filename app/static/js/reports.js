/* ================================================================
   FORGE — REPORTS
   reports.js
   ================================================================ */

"use strict";


/* ================================================================
   REPORT STATE
   ================================================================ */

const REPORTS = {

    report: null,

    type: "technical",

    format: "json",

    loading: false,

    generating: false,

    error: null,

    query: "",

    filters: {

        includeEvidence: true,

        includeComparison: true,

        includeRequirements: true,

        includeSources: true

    }
};


/* ================================================================
   DOM HELPERS
   ================================================================ */

function reportsQuery(selector) {

    return document.querySelector(selector);
}


function reportsQueries(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* ================================================================
   NORMALIZATION
   ================================================================ */

function normalizeReport(
    report
) {

    if (!report) {

        return {

            id:
                null,

            title:
                "FORGE Report",

            type:
                "technical",

            generatedAt:
                null,

            executiveSummary:
                "",

            findings:
                [],

            requirements:
                [],

            comparison:
                null,

            evidence:
                [],

            sources:
                [],

            metadata:
                {}
        };
    }


    return {

        id:
            report.id ||
            report.report_id ||
            null,

        title:
            report.title ||
            report.name ||
            "FORGE Report",

        type:
            report.type ||
            report.report_type ||
            "technical",

        generatedAt:
            report.generated_at ||
            report.generatedAt ||
            report.created_at ||
            null,

        executiveSummary:
            report.executive_summary ||
            report.executiveSummary ||
            report.summary ||
            "",

        findings:
            normalizeReportArray(
                report.findings
            ),

        requirements:
            normalizeReportArray(
                report.requirements ||
                report.requirement_analysis
            ),

        comparison:
            report.comparison ||
            report.comparison_summary ||
            null,

        evidence:
            normalizeReportArray(
                report.evidence
            ),

        sources:
            normalizeReportArray(
                report.sources
            ),

        metadata:
            report.metadata ||
            {},

        raw:
            report
    };
}


function normalizeReportArray(
    value
) {

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


/* ================================================================
   REPORT ENDPOINT
   ================================================================ */

function getReportEndpoint() {

    return document.body.dataset
        .reportEndpoint || "";
}


/* ================================================================
   REPORT PAYLOAD
   ================================================================ */

function buildReportPayload() {

    const payload = {

        type:
            REPORTS.type,

        format:
            REPORTS.format,

        query:
            REPORTS.query || "",

        filters:
            {
                ...REPORTS.filters
            }
    };


    /*
     * Pull context from other FORGE layers when available.
     */

    if (
        window.MATCH
    ) {

        payload.match_results =
            Array.isArray(
                window.MATCH.results
            )
                ? window.MATCH.results
                : [];
    }


    if (
        window.COMPARISON
    ) {

        payload.comparison =
            Array.isArray(
                window.COMPARISON.results
            )
                ? window.COMPARISON.results
                : [];
    }


    if (
        window.EVIDENCE
    ) {

        payload.evidence =
            Array.isArray(
                window.EVIDENCE.filteredItems
            )
                ? window.EVIDENCE.filteredItems
                : (
                    Array.isArray(
                        window.EVIDENCE.items
                    )
                        ? window.EVIDENCE.items
                        : []
                );
    }


    if (
        window.CATALOGUE
    ) {

        payload.catalogue =
            Array.isArray(
                window.CATALOGUE.items
            )
                ? window.CATALOGUE.items
                : [];
    }


    if (
        window.WORKSPACE
    ) {

        payload.sources =
            Array.isArray(
                window.WORKSPACE.sources
            )
                ? window.WORKSPACE.sources
                : [];
    }


    return payload;
}


/* ================================================================
   GENERATE REPORT
   ================================================================ */

async function generateForgeReport() {

    if (
        REPORTS.generating
    ) {

        return;
    }


    const endpoint =
        getReportEndpoint();


    if (!endpoint) {

        /*
         * If there is no backend endpoint yet, create a local
         * report from the currently available FORGE state.
         */

        generateLocalReport();

        return;
    }


    const button =
        reportsQuery(
            "[data-generate-report]"
        );


    REPORTS.generating =
        true;


    REPORTS.error =
        null;


    setButtonLoading(
        button,
        true,
        "Generating..."
    );


    showProcessing({
        id:
            "report-processing-overlay",

        messageElement:
            "report-processing-message",

        message:
            "Building your FORGE report from the available evidence..."
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
                            buildReportPayload()
                        )
                }
            );


        const report =
            result.report ||
            result.data?.report ||
            result;


        REPORTS.report =
            normalizeReport(
                report
            );


        renderReport();

        updateReportMetadata();


        showToast(
            "Report generated successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "FORGE report generation error:",
            error
        );


        REPORTS.error =
            getErrorMessage(
                error
            );


        renderReportError();


        showToast(
            REPORTS.error,
            "error",
            "Report generation failed"
        );

    } finally {

        REPORTS.generating =
            false;


        setButtonLoading(
            button,
            false
        );


        hideProcessing(
            "report-processing-overlay"
        );
    }
}


/* ================================================================
   LOCAL REPORT
   ================================================================ */

function generateLocalReport() {

    const match =
        window.MATCH || null;


    const comparison =
        window.COMPARISON || null;


    const evidence =
        window.EVIDENCE || null;


    const catalogue =
        window.CATALOGUE || null;


    const workspace =
        window.WORKSPACE || null;


    const findings =
        [];


    /*
     * Requirement findings.
     */

    if (
        match &&
        Array.isArray(
            match.results
        )
    ) {

        match.results.forEach(
            (result) => {

                findings.push({

                    type:
                        "requirement",

                    status:
                        result.status,

                    title:
                        result.requirement,

                    explanation:
                        result.explanation ||
                        "",

                    confidence:
                        result.confidence,

                    evidence:
                        result.evidence ||
                        [],

                    sources:
                        result.sources ||
                        []
                });
            }
        );
    }


    /*
     * Comparison findings.
     */

    if (
        comparison &&
        Array.isArray(
            comparison.results
        )
    ) {

        comparison.results.forEach(
            (result) => {

                findings.push({

                    type:
                        "comparison",

                    status:
                        "assessment",

                    title:
                        result.dimension,

                    explanation:
                        result.explanation ||
                        "",

                    winner:
                        result.winner ||
                        null,

                    confidence:
                        result.confidence,

                    evidence:
                        result.evidence ||
                        []
                });
            }
        );
    }


    const requirements =
        match &&
        Array.isArray(
            match.results
        )
            ? match.results
            : [];


    const evidenceItems =
        evidence &&
        Array.isArray(
            evidence.filteredItems
        )
            ? evidence.filteredItems
            : (
                evidence &&
                Array.isArray(
                    evidence.items
                )
                    ? evidence.items
                    : []
            );


    const sources =
        workspace &&
        Array.isArray(
            workspace.sources
        )
            ? workspace.sources
            : [];


    const comparisonResults =
        comparison &&
        Array.isArray(
            comparison.results
        )
            ? comparison.results
            : [];


    REPORTS.report =
        normalizeReport({

            id:
                `local-${Date.now()}`,

            title:
                buildLocalReportTitle(),

            type:
                REPORTS.type,

            generated_at:
                new Date().toISOString(),

            executive_summary:
                buildLocalExecutiveSummary(
                    requirements,
                    comparisonResults,
                    evidenceItems
                ),

            findings,

            requirements,

            comparison:
                comparison
                    ? {
                        results:
                            comparisonResults,

                        summary:
                            comparison.summary ||
                            null
                    }
                    : null,

            evidence:
                REPORTS.filters.includeEvidence
                    ? evidenceItems
                    : [],

            sources:
                REPORTS.filters.includeSources
                    ? sources
                    : [],

            metadata: {

                generated_locally:
                    true,

                product_count:
                    catalogue &&
                    Array.isArray(
                        catalogue.items
                    )
                        ? catalogue.items.length
                        : 0
            }
        });


    renderReport();

    updateReportMetadata();


    showToast(
        "Local report generated.",
        "success"
    );
}


/* ================================================================
   LOCAL REPORT TITLE
   ================================================================ */

function buildLocalReportTitle() {

    const labels = {

        technical:
            "Technical Assessment Report",

        compliance:
            "Compliance Assessment Report",

        procurement:
            "Procurement Evaluation Report",

        executive:
            "Executive Decision Report"
    };


    return (
        labels[
            REPORTS.type
        ] ||
        "FORGE Report"
    );
}


/* ================================================================
   LOCAL EXECUTIVE SUMMARY
   ================================================================ */

function buildLocalExecutiveSummary(
    requirements,
    comparisonResults,
    evidenceItems
) {

    const totalRequirements =
        requirements.length;


    const matched =
        requirements.filter(
            (item) =>
                item.status ===
                "matched"
        ).length;


    const partial =
        requirements.filter(
            (item) =>
                item.status ===
                "partial"
        ).length;


    const unmatched =
        requirements.filter(
            (item) =>
                item.status !==
                    "matched" &&
                item.status !==
                    "partial"
        ).length;


    const dimensions =
        comparisonResults.length;


    const evidenceCount =
        evidenceItems.length;


    if (
        totalRequirements === 0 &&
        dimensions === 0 &&
        evidenceCount === 0
    ) {

        return (
            "No analysis data is currently available. " +
            "Add source material and run the relevant FORGE analysis workflows."
        );
    }


    const sentences = [];


    if (
        totalRequirements > 0
    ) {

        sentences.push(
            `${matched} of ${totalRequirements} requirements are fully matched, ` +
            `${partial} are partially matched, and ` +
            `${unmatched} remain unmatched.`
        );
    }


    if (
        dimensions > 0
    ) {

        sentences.push(
            `${dimensions} comparison dimension${dimensions === 1 ? "" : "s"} ` +
            `were evaluated.`
        );
    }


    if (
        evidenceCount > 0
    ) {

        sentences.push(
            `The assessment is supported by ${evidenceCount} evidence item${evidenceCount === 1 ? "" : "s"}.`
        );
    }


    sentences.push(
        "Review the detailed findings and source references before making a final decision."
    );


    return sentences.join(
        " "
    );
}


/* ================================================================
   REPORT TYPE
   ================================================================ */

function setReportType(
    type
) {

    REPORTS.type =
        type || "technical";


    reportsQueries(
        "[data-report-type]"
    ).forEach(
        (button) => {

            button.classList.toggle(
                "active",
                button.dataset
                    .reportType ===
                    REPORTS.type
            );


            button.setAttribute(
                "aria-pressed",
                button.dataset
                    .reportType ===
                    REPORTS.type
                    ? "true"
                    : "false"
            );
        }
    );
}


/* ================================================================
   REPORT FORMAT
   ================================================================ */

function setReportFormat(
    format
) {

    REPORTS.format =
        format || "json";


    const select =
        reportsQuery(
            "[data-report-format]"
        );


    if (select) {

        select.value =
            REPORTS.format;
    }
}


/* ================================================================
   REPORT FILTERS
   ================================================================ */

function setReportFilter(
    filter,
    value
) {

    if (
        !Object.prototype.hasOwnProperty.call(
            REPORTS.filters,
            filter
        )
    ) {

        return;
    }


    REPORTS.filters[filter] =
        Boolean(
            value
        );


    const input =
        reportsQuery(
            `[data-report-filter="${filter}"]`
        );


    if (input) {

        input.checked =
            REPORTS.filters[filter];
    }
}


/* ================================================================
   REPORT CONTROLS
   ================================================================ */

function setupReportControls() {

    reportsQueries(
        "[data-report-type]"
    )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        setReportType(
                            button.dataset
                                .reportType
                        );
                    }
                );
            }
        );


    const format =
        reportsQuery(
            "[data-report-format]"
        );


    if (format) {

        format.addEventListener(
            "change",
            () => {

                setReportFormat(
                    format.value
                );
            }
        );
    }


    reportsQueries(
        "[data-report-filter]"
    )
        .forEach(
            (input) => {

                input.addEventListener(
                    "change",
                    () => {

                        setReportFilter(
                            input.dataset
                                .reportFilter,
                            input.checked
                        );
                    }
                );
            }
        );


    const query =
        reportsQuery(
            "[data-report-query]"
        );


    if (query) {

        query.addEventListener(
            "input",
            () => {

                REPORTS.query =
                    query.value;
            }
        );
    }


    const generate =
        reportsQuery(
            "[data-generate-report]"
        );


    if (generate) {

        generate.addEventListener(
            "click",
            generateForgeReport
        );
    }


    const reset =
        reportsQuery(
            "[data-reset-report]"
        );


    if (reset) {

        reset.addEventListener(
            "click",
            resetReport
        );
    }


    const exportButton =
        reportsQuery(
            "[data-export-report]"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            exportReport
        );
    }


    const printButton =
        reportsQuery(
            "[data-print-report]"
        );


    if (printButton) {

        printButton.addEventListener(
            "click",
            printReport
        );
    }
}


/* ================================================================
   REPORT RENDERING
   ================================================================ */

function renderReport() {

    const container =
        reportsQuery(
            "[data-report-content]"
        );


    if (!container) {
        return;
    }


    if (
        !REPORTS.report
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ◌
                </div>

                <h3>
                    No report generated
                </h3>

                <p>
                    Run the report generator to create a decision-ready report.
                </p>

            </div>

        `;

        return;
    }


    const report =
        REPORTS.report;


    container.innerHTML = `

        <article class="forge-report">

            <header class="forge-report-header">

                <div>

                    <span class="report-kicker">
                        FORGE REPORT
                    </span>

                    <h1>
                        ${escapeHTML(
                            report.title
                        )}
                    </h1>

                    ${
                        report.generatedAt
                            ? `
                                <p class="report-generated">
                                    Generated ${escapeHTML(
                                        formatReportDate(
                                            report.generatedAt
                                        )
                                    )}
                                </p>
                            `
                            : ""
                    }

                </div>

                <span class="report-type-badge">
                    ${escapeHTML(
                        formatReportType(
                            report.type
                        )
                    )}
                </span>

            </header>


            ${
                report.executiveSummary
                    ? `
                        <section class="report-section">

                            <div class="report-section-heading">
                                <span>
                                    01
                                </span>

                                <h2>
                                    Executive Summary
                                </h2>
                            </div>

                            <div class="report-summary-box">

                                <p>
                                    ${escapeHTML(
                                        report.executiveSummary
                                    )}
                                </p>

                            </div>

                        </section>
                    `
                    : ""
            }


            ${
                REPORTS.filters.includeRequirements
                    ? renderReportRequirements(
                        report.requirements
                    )
                    : ""
            }


            ${
                REPORTS.filters.includeComparison
                    ? renderReportComparison(
                        report.comparison
                    )
                    : ""
            }


            ${renderReportFindings(
                report.findings
            )}


            ${
                REPORTS.filters.includeEvidence
                    ? renderReportEvidence(
                        report.evidence
                    )
                    : ""
            }


            ${
                REPORTS.filters.includeSources
                    ? renderReportSources(
                        report.sources
                    )
                    : ""
            }


            <footer class="forge-report-footer">

                <span>
                    FORGE — Evidence-based product intelligence
                </span>

                <span>
                    Developed by Team Forge
                </span>

            </footer>

        </article>

    `;
}


/* ================================================================
   REQUIREMENTS SECTION
   ================================================================ */

function renderReportRequirements(
    requirements
) {

    if (
        !Array.isArray(
            requirements
        ) ||
        requirements.length === 0
    ) {

        return "";
    }


    const matched =
        requirements.filter(
            (item) =>
                item.status ===
                "matched"
        ).length;


    const partial =
        requirements.filter(
            (item) =>
                item.status ===
                "partial"
        ).length;


    const unmatched =
        requirements.length -
        matched -
        partial;


    return `

        <section class="report-section">

            <div class="report-section-heading">

                <span>
                    02
                </span>

                <h2>
                    Requirement Coverage
                </h2>

            </div>


            <div class="report-stat-grid">

                <div class="report-stat">
                    <strong>
                        ${requirements.length}
                    </strong>
                    <span>
                        Total
                    </span>
                </div>

                <div class="report-stat">
                    <strong>
                        ${matched}
                    </strong>
                    <span>
                        Matched
                    </span>
                </div>

                <div class="report-stat">
                    <strong>
                        ${partial}
                    </strong>
                    <span>
                        Partial
                    </span>
                </div>

                <div class="report-stat">
                    <strong>
                        ${unmatched}
                    </strong>
                    <span>
                        Unmatched
                    </span>
                </div>

            </div>


            <div class="report-requirement-list">

                ${requirements
                    .map(
                        (item) =>
                            renderReportRequirement(
                                item
                            )
                    )
                    .join("")}

            </div>

        </section>

    `;
}


function renderReportRequirement(
    item
) {

    const status =
        item.status ||
        "unmatched";


    const confidence =
        item.confidence !== undefined &&
        item.confidence !== null
            ? `${Math.round(
                Number(
                    item.confidence
                )
            )}%`
            : "—";


    return `

        <div class="report-requirement">

            <div class="report-requirement-status status-${escapeHTML(
                status
            )}">
                ${escapeHTML(
                    formatReportStatus(
                        status
                    )
                )}
            </div>

            <div class="report-requirement-content">

                <strong>
                    ${escapeHTML(
                        item.requirement ||
                        item.requirement_text ||
                        item.title ||
                        "Requirement"
                    )}
                </strong>

                ${
                    item.explanation
                        ? `
                            <p>
                                ${escapeHTML(
                                    item.explanation
                                )}
                            </p>
                        `
                        : ""
                }

            </div>

            <span class="report-confidence">
                ${confidence}
            </span>

        </div>

    `;
}


/* ================================================================
   COMPARISON SECTION
   ================================================================ */

function renderReportComparison(
    comparison
) {

    if (!comparison) {
        return "";
    }


    const results =
        Array.isArray(
            comparison.results
        )
            ? comparison.results
            : (
                Array.isArray(
                    comparison
                )
                    ? comparison
                    : []
            );


    if (
        results.length === 0
    ) {

        return "";
    }


    return `

        <section class="report-section">

            <div class="report-section-heading">

                <span>
                    03
                </span>

                <h2>
                    Product Comparison
                </h2>

            </div>


            <div class="report-comparison-list">

                ${results
                    .map(
                        (result) =>
                            renderReportComparisonItem(
                                result
                            )
                    )
                    .join("")}

            </div>

        </section>

    `;
}


function renderReportComparisonItem(
    item
) {

    return `

        <div class="report-comparison-item">

            <div class="report-comparison-heading">

                <strong>
                    ${escapeHTML(
                        item.dimension ||
                        item.requirement ||
                        item.criterion ||
                        "Comparison dimension"
                    )}
                </strong>

                ${
                    item.confidence !== undefined &&
                    item.confidence !== null
                        ? `
                            <span>
                                ${Math.round(
                                    Number(
                                        item.confidence
                                    )
                                )}% confidence
                            </span>
                        `
                        : ""
                }

            </div>


            ${
                item.winner ||
                item.best ||
                item.strongest
                    ? `
                        <div class="report-winner">
                            Strongest:
                            <strong>
                                ${escapeHTML(
                                    getReportWinnerName(
                                        item.winner ||
                                        item.best ||
                                        item.strongest
                                    )
                                )}
                            </strong>
                        </div>
                    `
                    : ""
            }


            ${
                item.explanation
                    ? `
                        <p>
                            ${escapeHTML(
                                item.explanation
                            )}
                        </p>
                    `
                    : ""
            }

        </div>

    `;
}


function getReportWinnerName(
    winner
) {

    if (
        typeof winner === "object"
    ) {

        return (
            winner.name ||
            winner.product_name ||
            winner.product ||
            winner.id ||
            "Unknown"
        );
    }


    if (
        window.COMPARISON &&
        Array.isArray(
            window.COMPARISON.products
        )
    ) {

        const product =
            window.COMPARISON.products.find(
                (item) =>
                    String(
                        item.id
                    ) ===
                    String(
                        winner
                    )
            );


        if (product) {

            return product.name;
        }
    }


    return String(
        winner
    );
}


/* ================================================================
   FINDINGS
   ================================================================ */

function renderReportFindings(
    findings
) {

    if (
        !Array.isArray(
            findings
        ) ||
        findings.length === 0
    ) {

        return "";
    }


    return `

        <section class="report-section">

            <div class="report-section-heading">

                <span>
                    04
                </span>

                <h2>
                    Key Findings
                </h2>

            </div>


            <div class="report-findings">

                ${findings
                    .map(
                        (finding, index) => `
                            <div class="report-finding">

                                <span class="report-finding-index">
                                    ${index + 1}
                                </span>

                                <div>

                                    <strong>
                                        ${escapeHTML(
                                            finding.title ||
                                            finding.requirement ||
                                            finding.dimension ||
                                            "Finding"
                                        )}
                                    </strong>

                                    ${
                                        finding.explanation
                                            ? `
                                                <p>
                                                    ${escapeHTML(
                                                        finding.explanation
                                                    )}
                                                </p>
                                            `
                                            : ""
                                    }

                                </div>

                            </div>
                        `
                    )
                    .join("")}

            </div>

        </section>

    `;
}


/* ================================================================
   EVIDENCE SECTION
   ================================================================ */

function renderReportEvidence(
    evidence
) {

    if (
        !Array.isArray(
            evidence
        ) ||
        evidence.length === 0
    ) {

        return "";
    }


    return `

        <section class="report-section">

            <div class="report-section-heading">

                <span>
                    05
                </span>

                <h2>
                    Supporting Evidence
                </h2>

            </div>


            <div class="report-evidence-list">

                ${evidence
                    .map(
                        (item, index) =>
                            renderReportEvidenceItem(
                                item,
                                index
                            )
                    )
                    .join("")}

            </div>

        </section>

    `;
}


function renderReportEvidenceItem(
    item,
    index
) {

    if (
        typeof item === "string"
    ) {

        return `

            <div class="report-evidence-item">

                <span>
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

        <div class="report-evidence-item">

            <span>
                ${index + 1}
            </span>

            <div>

                <strong>
                    ${escapeHTML(
                        item.title ||
                        item.name ||
                        "Evidence"
                    )}
                </strong>

                ${
                    item.text ||
                    item.content ||
                    item.excerpt
                        ? `
                            <p>
                                ${escapeHTML(
                                    item.text ||
                                    item.content ||
                                    item.excerpt
                                )}
                            </p>
                        `
                        : ""
                }


                ${
                    item.source ||
                    item.source_name ||
                    item.filename
                        ? `
                            <small>
                                Source:
                                ${escapeHTML(
                                    item.source_name ||
                                    item.source ||
                                    item.filename
                                )}
                            </small>
                        `
                        : ""
                }


                ${
                    item.page
                        ? `
                            <small>
                                Page:
                                ${escapeHTML(
                                    item.page
                                )}
                            </small>
                        `
                        : ""
                }

            </div>

        </div>

    `;
}


/* ================================================================
   SOURCES SECTION
   ================================================================ */

function renderReportSources(
    sources
) {

    if (
        !Array.isArray(
            sources
        ) ||
        sources.length === 0
    ) {

        return "";
    }


    return `

        <section class="report-section">

            <div class="report-section-heading">

                <span>
                    06
                </span>

                <h2>
                    Sources
                </h2>

            </div>


            <div class="report-source-list">

                ${sources
                    .map(
                        (source, index) =>
                            renderReportSource(
                                source,
                                index
                            )
                    )
                    .join("")}

            </div>

        </section>

    `;
}


function renderReportSource(
    source,
    index
) {

    if (
        typeof source === "string"
    ) {

        return `

            <div class="report-source">

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
        source.source_name ||
        "Source";


    const url =
        source.url ||
        source.source_url ||
        null;


    return `

        <div class="report-source">

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


/* ================================================================
   REPORT METADATA
   ================================================================ */

function updateReportMetadata() {

    const title =
        reportsQuery(
            "[data-report-title]"
        );


    if (
        title &&
        REPORTS.report
    ) {

        setText(
            title,
            REPORTS.report.title
        );
    }


    const generated =
        reportsQuery(
            "[data-report-generated]"
        );


    if (
        generated &&
        REPORTS.report
    ) {

        setText(
            generated,
            REPORTS.report.generatedAt
                ? formatReportDate(
                    REPORTS.report.generatedAt
                )
                : "—"
        );
    }


    const type =
        reportsQuery(
            "[data-report-current-type]"
        );


    if (
        type
    ) {

        setText(
            type,
            formatReportType(
                REPORTS.type
            )
        );
    }
}


/* ================================================================
   REPORT ERROR
   ================================================================ */

function renderReportError() {

    const container =
        reportsQuery(
            "[data-report-content]"
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
                Report generation failed
            </h3>

            <p>
                ${escapeHTML(
                    REPORTS.error ||
                    "Unable to generate the report."
                )}
            </p>

            <button
                type="button"
                class="primary-button"
                data-retry-report
            >
                Try again
            </button>

        </div>

    `;


    const retry =
        container.querySelector(
            "[data-retry-report]"
        );


    if (retry) {

        retry.addEventListener(
            "click",
            generateForgeReport
        );
    }
}


/* ================================================================
   REPORT RESET
   ================================================================ */

function resetReport() {

    REPORTS.report =
        null;

    REPORTS.error =
        null;

    REPORTS.query =
        "";

    REPORTS.type =
        "technical";

    REPORTS.format =
        "json";

    REPORTS.filters = {

        includeEvidence:
            true,

        includeComparison:
            true,

        includeRequirements:
            true,

        includeSources:
            true
    };


    const query =
        reportsQuery(
            "[data-report-query]"
        );


    if (query) {

        query.value =
            "";
    }


    setReportType(
        "technical"
    );


    setReportFormat(
        "json"
    );


    reportsQueries(
        "[data-report-filter]"
    )
        .forEach(
            (input) => {

                const key =
                    input.dataset
                        .reportFilter;


                if (
                    Object.prototype.hasOwnProperty.call(
                        REPORTS.filters,
                        key
                    )
                ) {

                    input.checked =
                        REPORTS.filters[key];
                }
            }
        );


    renderReport();

    updateReportMetadata();
}


/* ================================================================
   EXPORT REPORT
   ================================================================ */

function exportReport() {

    if (
        !REPORTS.report
    ) {

        showToast(
            "Generate a report before exporting.",
            "warning"
        );

        return;
    }


    const format =
        REPORTS.format;


    if (
        format === "json"
    ) {

        exportReportJSON();

        return;
    }


    if (
        format === "txt"
    )
    {

        exportReportText();

        return;
    }


    /*
     * PDF / DOCX generation belongs to the backend.
     * If a download URL was returned, use it.
     */

    const downloadUrl =
        REPORTS.report.raw &&
        (
            REPORTS.report.raw.download_url ||
            REPORTS.report.raw.downloadUrl ||
            REPORTS.report.raw.file_url
        );


    if (
        downloadUrl
    ) {

        openExternalUrl(
            downloadUrl
        );

        return;
    }


    /*
     * Fall back to JSON if a browser-side document generator
     * is not available.
     */

    showToast(
        `${format.toUpperCase()} export requires a configured backend export endpoint.`,
        "warning",
        "Export format"
    );
}


/* ================================================================
   JSON EXPORT
   ================================================================ */

function exportReportJSON() {

    downloadTextFile(
        "forge-report.json",
        JSON.stringify(
            REPORTS.report,
            null,
            2
        ),
        "application/json"
    );


    showToast(
        "Report exported as JSON.",
        "success"
    );
}


/* ================================================================
   TEXT EXPORT
   ================================================================ */

function exportReportText() {

    const report =
        REPORTS.report;


    const lines = [];


    lines.push(
        report.title
    );


    if (
        report.generatedAt
    ) {

        lines.push(
            `Generated: ${formatReportDate(
                report.generatedAt
            )}`
        );
    }


    lines.push(
        ""
    );


    if (
        report.executiveSummary
    ) {

        lines.push(
            "EXECUTIVE SUMMARY"
        );

        lines.push(
            report.executiveSummary
        );

        lines.push(
            ""
        );
    }


    if (
        Array.isArray(
            report.requirements
        ) &&
        report.requirements.length
    ) {

        lines.push(
            "REQUIREMENT COVERAGE"
        );


        report.requirements.forEach(
            (item, index) => {

                lines.push(
                    `${index + 1}. ${
                        item.requirement ||
                        item.requirement_text ||
                        item.title ||
                        "Requirement"
                    }`
                );


                lines.push(
                    `Status: ${
                        formatReportStatus(
                            item.status
                        )
                    }`
                );


                if (
                    item.explanation
                ) {

                    lines.push(
                        `Explanation: ${
                            item.explanation
                        }`
                    );
                }


                lines.push(
                    ""
                );
            }
        );
    }


    if (
        Array.isArray(
            report.findings
        ) &&
        report.findings.length
    ) {

        lines.push(
            "KEY FINDINGS"
        );


        report.findings.forEach(
            (finding, index) => {

                lines.push(
                    `${index + 1}. ${
                        finding.title ||
                        finding.requirement ||
                        finding.dimension ||
                        "Finding"
                    }`
                );


                if (
                    finding.explanation
                ) {

                    lines.push(
                        finding.explanation
                    );
                }


                lines.push(
                    ""
                );
            }
        );
    }


    if (
        Array.isArray(
            report.evidence
        ) &&
        report.evidence.length
    ) {

        lines.push(
            "SUPPORTING EVIDENCE"
        );


        report.evidence.forEach(
            (item, index) => {

                if (
                    typeof item === "string"
                ) {

                    lines.push(
                        `${index + 1}. ${item}`
                    );

                } else {

                    lines.push(
                        `${index + 1}. ${
                            item.title ||
                            item.name ||
                            "Evidence"
                        }`
                    );


                    lines.push(
                        item.text ||
                        item.content ||
                        item.excerpt ||
                        ""
                    );
                }


                lines.push(
                    ""
                );
            }
        );
    }


    lines.push(
        "Developed by Team Forge"
    );


    downloadTextFile(
        "forge-report.txt",
        lines.join(
            "\n"
        ),
        "text/plain"
    );


    showToast(
        "Report exported as text.",
        "success"
    );
}


/* ================================================================
   PRINT
   ================================================================ */

function printReport() {

    if (
        !REPORTS.report
    ) {

        showToast(
            "Generate a report before printing.",
            "warning"
        );

        return;
    }


    window.print();
}


/* ================================================================
   UTILITIES
   ================================================================ */

function formatReportType(
    type
) {

    const value =
        String(
            type ||
            "technical"
        )
            .replaceAll(
                "_",
                " "
            )
            .replaceAll(
                "-",
                " "
            );


    return value
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );
}


function formatReportStatus(
    status
) {

    const value =
        String(
            status ||
            "unmatched"
        )
            .replaceAll(
                "_",
                " "
            )
            .replaceAll(
                "-",
                " "
            );


    return value
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );
}


function formatReportDate(
    value
) {

    if (!value) {

        return "—";
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            value
        );
    }


    return new Intl.DateTimeFormat(
        undefined,
        {

            dateStyle:
                "medium",

            timeStyle:
                "short"
        }
    ).format(
        date
    );
}


/* ================================================================
   DOWNLOAD TEXT FILE
   ================================================================ */

function downloadTextFile(
    filename,
    content,
    mimeType
) {

    const blob =
        new Blob(
            [
                content
            ],
            {
                type:
                    mimeType
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
        filename;


    document.body.appendChild(
        link
    );


    link.click();

    link.remove();


    URL.revokeObjectURL(
        url
    );
}


/* ================================================================
   KEYBOARD SHORTCUT
   ================================================================ */

function setupReportKeyboard() {

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
             * R = generate report.
             */

            if (
                event.key.toLowerCase() === "r"
            ) {

                const button =
                    reportsQuery(
                        "[data-generate-report]"
                    );


                if (button) {

                    event.preventDefault();

                    generateForgeReport();
                }
            }
        }
    );
}


/* ================================================================
   INITIALIZATION
   ================================================================ */

function initializeReports() {

    setupReportControls();

    setupReportKeyboard();

    setReportType(
        REPORTS.type
    );

    setReportFormat(
        REPORTS.format
    );

    renderReport();

    updateReportMetadata();
}


/* ================================================================
   PUBLIC API
   ================================================================ */

window.REPORTS =
    REPORTS;

window.generateForgeReport =
    generateForgeReport;

window.resetReport =
    resetReport;

window.exportReport =
    exportReport;

window.printReport =
    printReport;


/* ================================================================
   PAGE INITIALIZATION
   ================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeReports
    );

} else {

    initializeReports();
}