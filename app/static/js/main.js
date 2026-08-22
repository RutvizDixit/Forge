/* ================================================================
   FORGE — GLOBAL FRONTEND
   main.js
   ================================================================ */

"use strict";


/* ================================================================
   GLOBAL STATE
   ================================================================ */

const FORGE = {
    startupShown: false,
    startupCompleted: false,
    mobileSidebarOpen: false,
    activeModal: null,
    toastCounter: 0
};


/* ================================================================
   DOM HELPERS
   ================================================================ */

function $(selector, root = document) {
    return root.querySelector(selector);
}


function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}


function byId(id) {
    return document.getElementById(id);
}


function exists(element) {
    return element !== null && element !== undefined;
}


function setText(element, value) {
    if (!exists(element)) {
        return;
    }

    element.textContent =
        value === null || value === undefined
            ? ""
            : String(value);
}


function show(element) {
    if (!exists(element)) {
        return;
    }

    element.classList.remove("hidden");
}


function hide(element) {
    if (!exists(element)) {
        return;
    }

    element.classList.add("hidden");
}


function addClass(element, className) {
    if (exists(element)) {
        element.classList.add(className);
    }
}


function removeClass(element, className) {
    if (exists(element)) {
        element.classList.remove(className);
    }
}


function toggleClass(element, className, force) {
    if (!exists(element)) {
        return false;
    }

    return element.classList.toggle(className, force);
}


/* ================================================================
   SAFE JSON
   ================================================================ */

function safeJSONParse(value, fallback = null) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {

        console.warn(
            "FORGE: Unable to parse JSON.",
            error
        );

        return fallback;
    }
}


/* ================================================================
   API HELPER
   ================================================================ */

async function forgeFetch(
    url,
    options = {}
) {

    const defaultOptions = {
        headers: {
            "Accept": "application/json"
        }
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,

        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };


    const response = await fetch(
        url,
        mergedOptions
    );


    const contentType =
        response.headers.get("content-type") || "";


    let data;


    if (
        contentType.includes("application/json")
    ) {

        data = await response.json();

    } else {

        const text = await response.text();

        data = {
            success: response.ok,
            data: text
        };
    }


    if (!response.ok) {

        const message =
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}.`;

        const error = new Error(message);

        error.status = response.status;
        error.data = data;

        throw error;
    }


    return data;
}


/* ================================================================
   API ERROR MESSAGE
   ================================================================ */

function getErrorMessage(error) {

    if (!error) {
        return "An unknown error occurred.";
    }


    if (
        typeof error === "string"
    ) {
        return error;
    }


    if (
        error.data &&
        typeof error.data === "object"
    ) {

        return (
            error.data.message ||
            error.data.error ||
            error.message ||
            "An unexpected error occurred."
        );
    }


    return (
        error.message ||
        "An unexpected error occurred."
    );
}


/* ================================================================
   MOBILE SIDEBAR
   ================================================================ */

function openMobileSidebar() {

    const sidebar = $(".sidebar");

    if (!sidebar) {
        return;
    }


    sidebar.classList.add("open");

    FORGE.mobileSidebarOpen = true;


    document.body.classList.add(
        "sidebar-open"
    );
}


function closeMobileSidebar() {

    const sidebar = $(".sidebar");

    if (!sidebar) {
        return;
    }


    sidebar.classList.remove("open");

    FORGE.mobileSidebarOpen = false;


    document.body.classList.remove(
        "sidebar-open"
    );
}


function toggleMobileSidebar() {

    if (FORGE.mobileSidebarOpen) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}


function setupMobileSidebar() {

    const toggle =
        $("[data-sidebar-toggle]");

    const close =
        $("[data-sidebar-close]");

    const sidebar =
        $(".sidebar");


    if (!sidebar) {
        return;
    }


    if (toggle) {

        toggle.addEventListener(
            "click",
            toggleMobileSidebar
        );
    }


    if (close) {

        close.addEventListener(
            "click",
            closeMobileSidebar
        );
    }


    $$(".nav-item").forEach(
        (item) => {

            item.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <= 850
                    ) {

                        closeMobileSidebar();
                    }
                }
            );
        }
    );


    document.addEventListener(
        "click",
        (event) => {

            if (
                window.innerWidth > 850 ||
                !FORGE.mobileSidebarOpen
            ) {
                return;
            }


            const clickedInsideSidebar =
                sidebar.contains(event.target);

            const clickedToggle =
                toggle &&
                toggle.contains(event.target);


            if (
                !clickedInsideSidebar &&
                !clickedToggle
            ) {

                closeMobileSidebar();
            }
        }
    );


    window.addEventListener(
        "resize",
        () => {

            if (
                window.innerWidth > 850
            ) {

                closeMobileSidebar();
            }
        }
    );
}


/* ================================================================
   GLOBAL STARTUP SCREEN
   ================================================================ */

function getStartupScreen() {
    return $(".startup-screen");
}


function getStartupProgress() {
    return $(".startup-progress span");
}


function getStartupStatus() {
    return $(".startup-status");
}


function updateStartupProgress(
    percentage,
    message
) {

    const progress =
        getStartupProgress();

    const status =
        getStartupStatus();


    if (progress) {

        progress.style.width =
            `${Math.max(
                0,
                Math.min(100, percentage)
            )}%`;
    }


    if (status && message) {

        status.textContent =
            message;
    }
}


function completeStartup() {

    if (FORGE.startupCompleted) {
        return;
    }


    FORGE.startupCompleted = true;


    const screen =
        getStartupScreen();


    if (!screen) {
        return;
    }


    updateStartupProgress(
        100,
        "FORGE ready."
    );


    window.setTimeout(
        () => {

            screen.classList.add(
                "hidden"
            );

        },
        250
    );
}


function runStartupSequence() {

    const screen =
        getStartupScreen();


    if (!screen) {
        return;
    }


    if (sessionStorage.getItem(
        "forge_startup_seen"
    )) {

        screen.classList.add(
            "hidden"
        );

        FORGE.startupCompleted = true;

        return;
    }


    FORGE.startupShown = true;


    const steps = [

        {
            progress: 18,
            message: "Initializing workspace..."
        },

        {
            progress: 38,
            message: "Loading source interfaces..."
        },

        {
            progress: 59,
            message: "Preparing evidence layer..."
        },

        {
            progress: 78,
            message: "Preparing traceability..."
        },

        {
            progress: 92,
            message: "Checking system state..."
        },

        {
            progress: 100,
            message: "FORGE ready."
        }

    ];


    let index = 0;


    function nextStep() {

        if (
            index >= steps.length
        ) {

            window.setTimeout(
                completeStartup,
                280
            );

            sessionStorage.setItem(
                "forge_startup_seen",
                "true"
            );

            return;
        }


        const step =
            steps[index];


        updateStartupProgress(
            step.progress,
            step.message
        );


        index += 1;


        window.setTimeout(
            nextStep,
            240
        );
    }


    nextStep();
}


/* ================================================================
   STARTUP SCREEN — OPTIONAL REPLAY
   ================================================================ */

function replayStartup() {

    const screen =
        getStartupScreen();


    if (!screen) {
        return;
    }


    sessionStorage.removeItem(
        "forge_startup_seen"
    );


    screen.classList.remove(
        "hidden"
    );


    FORGE.startupCompleted = false;

    updateStartupProgress(
        0,
        "Initializing..."
    );


    runStartupSequence();
}


/* ================================================================
   TOAST SYSTEM
   ================================================================ */

function ensureToastContainer() {

    let container =
        $(".toast-container");


    if (container) {
        return container;
    }


    container =
        document.createElement("div");


    container.className =
        "toast-container";


    container.setAttribute(
        "aria-live",
        "polite"
    );


    container.setAttribute(
        "aria-atomic",
        "true"
    );


    document.body.appendChild(
        container
    );


    return container;
}


function showToast(
    message,
    type = "info",
    title = null,
    duration = 4200
) {

    const container =
        ensureToastContainer();


    FORGE.toastCounter += 1;


    const toast =
        document.createElement("div");


    toast.className =
        `toast toast-${type}`;


    toast.dataset.toastId =
        String(FORGE.toastCounter);


    const toastTitle =
        title ||
        (
            type === "success"
                ? "Completed"
                : type === "warning"
                    ? "Needs attention"
                    : type === "error"
                        ? "Something went wrong"
                        : "FORGE"
        );


    toast.innerHTML = `
        <div class="toast-title">
            ${escapeHTML(toastTitle)}
        </div>

        <div class="toast-message">
            ${escapeHTML(message)}
        </div>
    `;


    container.appendChild(
        toast
    );


    window.setTimeout(
        () => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateY(8px)";


            window.setTimeout(
                () => {

                    toast.remove();

                },
                220
            );

        },
        duration
    );


    return toast;
}


/* ================================================================
   HTML ESCAPING
   ================================================================ */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    const element =
        document.createElement("div");


    element.textContent =
        String(value);


    return element.innerHTML;
}


/* ================================================================
   MODALS
   ================================================================ */

function openModal(
    modal
) {

    if (
        typeof modal === "string"
    ) {

        modal =
            $(modal);
    }


    if (!modal) {
        return;
    }


    modal.classList.add(
        "visible"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );


    FORGE.activeModal =
        modal;
}


function closeModal(
    modal = null
) {

    modal =
        modal ||
        FORGE.activeModal;


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "visible"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );


    FORGE.activeModal =
        null;
}


function setupModals() {

    $$("[data-modal-open]").forEach(
        (trigger) => {

            trigger.addEventListener(
                "click",
                () => {

                    const selector =
                        trigger.dataset.modalOpen;


                    if (!selector) {
                        return;
                    }


                    openModal(
                        selector
                    );
                }
            );
        }
    );


    $$("[data-modal-close]").forEach(
        (trigger) => {

            trigger.addEventListener(
                "click",
                () => {

                    const modal =
                        trigger.closest(
                            ".modal-backdrop"
                        );


                    closeModal(
                        modal
                    );
                }
            );
        }
    );


    $$(".modal-backdrop").forEach(
        (modal) => {

            modal.addEventListener(
                "click",
                (event) => {

                    if (
                        event.target === modal
                    ) {

                        closeModal(
                            modal
                        );
                    }
                }
            );
        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                FORGE.activeModal
            ) {

                closeModal();
            }
        }
    );
}


/* ================================================================
   PROCESSING OVERLAY
   ================================================================ */

function getProcessingOverlay(
    id = "processing-overlay"
) {

    return byId(id);
}


function showProcessing(
    options = {}
) {

    const overlay =
        getProcessingOverlay(
            options.id ||
            "processing-overlay"
        );


    if (!overlay) {
        return;
    }


    const messageElement =
        options.messageElement
            ? byId(options.messageElement)
            : null;


    if (
        messageElement &&
        options.message
    ) {

        messageElement.textContent =
            options.message;
    }


    overlay.classList.add(
        "visible"
    );


    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "processing-open"
    );
}


function hideProcessing(
    id = "processing-overlay"
) {

    const overlay =
        getProcessingOverlay(id);


    if (!overlay) {
        return;
    }


    overlay.classList.remove(
        "visible"
    );


    overlay.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "processing-open"
    );
}


/* ================================================================
   BUTTON LOADING STATE
   ================================================================ */

function setButtonLoading(
    button,
    loading,
    loadingText = "Working..."
) {

    if (
        typeof button === "string"
    ) {

        button =
            $(button);
    }


    if (!button) {
        return;
    }


    if (loading) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.textContent.trim();
        }


        button.disabled = true;


        button.innerHTML = `
            <span class="button-spinner"></span>
            ${escapeHTML(loadingText)}
        `;


    } else {

        button.disabled = false;


        if (
            button.dataset.originalText
        ) {

            button.textContent =
                button.dataset.originalText;

            delete button.dataset.originalText;
        }
    }
}


/* ================================================================
   CLIPBOARD
   ================================================================ */

async function copyToClipboard(
    value
) {

    if (
        !navigator.clipboard
    ) {

        showToast(
            "Clipboard access is not available in this browser.",
            "warning"
        );

        return false;
    }


    try {

        await navigator.clipboard.writeText(
            String(value)
        );


        showToast(
            "Copied to clipboard.",
            "success"
        );


        return true;

    } catch (error) {

        console.error(
            "FORGE clipboard error:",
            error
        );


        showToast(
            "Unable to copy the selected content.",
            "error"
        );


        return false;
    }
}


function setupClipboardButtons() {

    $$("[data-copy]").forEach(
        (button) => {

            button.addEventListener(
                "click",
                async () => {

                    const value =
                        button.dataset.copy;


                    if (
                        value === undefined
                    ) {
                        return;
                    }


                    await copyToClipboard(
                        value
                    );
                }
            );
        }
    );
}


/* ================================================================
   EXTERNAL / SAFE NAVIGATION
   ================================================================ */

function setupExternalLinks() {

    $$("a[target='_blank']").forEach(
        (link) => {

            const current =
                link.getAttribute(
                    "rel"
                ) || "";


            const values =
                new Set(
                    current
                        .split(" ")
                        .filter(Boolean)
                );


            values.add("noopener");
            values.add("noreferrer");


            link.setAttribute(
                "rel",
                Array.from(values).join(" ")
            );
        }
    );
}


/* ================================================================
   FILE INPUT LABELS
   ================================================================ */

function setupFileInputs() {

    $$("input[type='file']").forEach(
        (input) => {

            input.addEventListener(
                "change",
                () => {

                    const targetSelector =
                        input.dataset.fileLabel;


                    if (!targetSelector) {
                        return;
                    }


                    const label =
                        $(targetSelector);


                    if (!label) {
                        return;
                    }


                    const files =
                        Array.from(
                            input.files || []
                        );


                    if (
                        files.length === 0
                    ) {

                        label.textContent =
                            "No file selected.";

                        return;
                    }


                    if (
                        files.length === 1
                    ) {

                        label.textContent =
                            files[0].name;

                        return;
                    }


                    label.textContent =
                        `${files.length} files selected.`;
                }
            );
        }
    );
}


/* ================================================================
   NAVIGATION STATE
   ================================================================ */

function markActiveNavigation() {

    const currentPath =
        window.location.pathname;


    $$(".nav-item").forEach(
        (item) => {

            const href =
                item.getAttribute("href");


            if (!href) {
                return;
            }


            let isActive =
                false;


            try {

                const url =
                    new URL(
                        href,
                        window.location.origin
                    );


                isActive =
                    url.pathname === currentPath;

            } catch {
                isActive = false;
            }


            item.classList.toggle(
                "active",
                isActive
            );
        }
    );
}


/* ================================================================
   BREADCRUMB
   ================================================================ */

function updateBreadcrumb() {

    const current =
        $("[data-breadcrumb-current]");


    if (!current) {
        return;
    }


    const title =
        document.title
            .replace(
                /\s*[—|-]\s*FORGE\s*$/i,
                ""
            )
            .trim();


    if (title) {
        current.textContent =
            title;
    }
}


/* ================================================================
   SMOOTH INTERNAL LINKS
   ================================================================ */

function setupSmoothAnchors() {

    $$("a[href^='#']").forEach(
        (link) => {

            link.addEventListener(
                "click",
                (event) => {

                    const targetId =
                        link.getAttribute(
                            "href"
                        );


                    if (
                        !targetId ||
                        targetId === "#"
                    ) {
                        return;
                    }


                    const target =
                        $(targetId);


                    if (!target) {
                        return;
                    }


                    event.preventDefault();


                    target.scrollIntoView({
                        behavior:
                            window.matchMedia(
                                "(prefers-reduced-motion: reduce)"
                            ).matches
                                ? "auto"
                                : "smooth",
                        block: "start"
                    });
                }
            );
        }
    );
}


/* ================================================================
   PAGE VISIBILITY
   ================================================================ */

function setupPageVisibility() {

    document.addEventListener(
        "visibilitychange",
        () => {

            document.body.dataset.pageVisible =
                document.hidden
                    ? "false"
                    : "true";
        }
    );
}


/* ================================================================
   SESSION WORKFLOW STORE
   Keeps the original multi-page UI connected without requiring a
   server-side session/database for the demo workflow.
   ================================================================ */

const FORGE_STORE = {

    keys: {
        sources: "forge_sources",
        products: "forge_products",
        match: "forge_match_results",
        comparison: "forge_comparison_result"
    },

    read(key, fallback = []) {
        return safeJSONParse(
            sessionStorage.getItem(key),
            fallback
        );
    },

    write(key, value) {
        sessionStorage.setItem(
            key,
            JSON.stringify(value)
        );
    },

    setSources(sources) {
        const safeSources = Array.isArray(sources) ? sources : [];
        this.write(this.keys.sources, safeSources);

        const products = [];
        safeSources.forEach((source) => {
            const rows = Array.isArray(source.rows) ? source.rows : [];
            rows.forEach((row, index) => {
                if (!row || typeof row !== "object") return;
                products.push({
                    ...row,
                    id: row.id || row.product_id || `${source.id || "source"}-${index + 1}`,
                    source_id: source.id || row.source_id || "",
                    source_name: source.name || row.source_name || ""
                });
            });
        });

        this.write(this.keys.products, products);
    },

    getSources() {
        return this.read(this.keys.sources, []);
    },

    getProducts() {
        const stored = this.read(this.keys.products, []);
        if (Array.isArray(stored) && stored.length) return stored;

        const products = [];
        this.getSources().forEach((source) => {
            (Array.isArray(source.rows) ? source.rows : []).forEach((row, index) => {
                if (!row || typeof row !== "object") return;
                products.push({
                    ...row,
                    id: row.id || row.product_id || `${source.id || "source"}-${index + 1}`,
                    source_id: source.id || row.source_id || "",
                    source_name: source.name || row.source_name || ""
                });
            });
        });
        return products;
    },

    setMatch(results) {
        this.write(this.keys.match, Array.isArray(results) ? results : []);
    },

    getMatch() {
        return this.read(this.keys.match, []);
    },

    setComparison(result) {
        this.write(this.keys.comparison, result || {});
    },

    getComparison() {
        return this.read(this.keys.comparison, {});
    }
};

window.FORGE_STORE = FORGE_STORE;


/* ================================================================
   GLOBAL KEYBOARD HELP
   ================================================================ */

function setupKeyboardShortcuts() {

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
             * / focuses the first search field.
             */

            if (
                event.key === "/" &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            ) {

                const search =
                    $(
                        "input[type='search'], " +
                        ".catalogue-search input, " +
                        "[data-global-search]"
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
   ERROR HANDLING
   ================================================================ */

window.addEventListener(
    "error",
    (event) => {

        /*
         * Do not expose raw JavaScript errors to the user.
         * Keep the details in the console for development.
         */

        console.error(
            "FORGE frontend error:",
            event.error || event.message
        );
    }
);


window.addEventListener(
    "unhandledrejection",
    (event) => {

        console.error(
            "FORGE unhandled promise rejection:",
            event.reason
        );
    }
);


/* ================================================================
   GLOBAL INITIALIZATION
   ================================================================ */

function configureOriginalForgeUI() {

    const body = document.body;

    const aliases = {
        "sidebar-toggle": "data-sidebar-toggle",
        "file-input": "data-workspace-file-input",
        "upload-dropzone": "data-workspace-dropzone",
        "start-analysis": "data-upload-files",
        "add-url-source": "data-add-url",
        "source-url": "data-source-url",
        "source-list": "data-workspace-sources",
        "source-count": "data-source-count",
        "match-requirement": "data-requirement-input",
        "run-match": "data-run-match",
        "candidate-count": "data-match-total",
        "strong-match-count": "data-match-matched",
        "review-match-count": "data-match-partial",
        "unsupported-match-count": "data-match-unmatched",
        "match-results": "data-match-results",
        "comparison-product-list": "data-comparison-products",
        "run-comparison": "data-run-comparison",
        "comparison-product-count": "data-comparison-products-count",
        "comparison-difference-count": "data-comparison-dimensions",
        "comparison-shared-count": "data-comparison-strongest",
        "comparison-table-container": "data-comparison-table",
        "evidence-list": "data-evidence-results",
        "evidence-list-count": "data-evidence-filtered-count",
        "evidence-source-count": "data-evidence-source-count",
        "evidence-item-count": "data-evidence-count",
        "evidence-supported-count": "data-evidence-count",
        "evidence-review-count": "data-evidence-filtered-count",
        "evidence-product-filter": "data-evidence-product-filter",
        "evidence-source-filter": "data-evidence-source-filter",
        "evidence-status-filter": "data-evidence-status-filter",
        "evidence-product-filter": "data-evidence-product-filter",
        "evidence-status-filter": "data-evidence-type-filter",
        "refresh-evidence": "data-refresh-evidence",
        "catalogue-search-input": "data-catalogue-search",
        "catalogue-source-filter": "data-catalogue-source-filter",
        "catalogue-status-filter": "data-catalogue-status-filter",
        "refresh-catalogue": "data-refresh-catalogue",
        "catalogue-table-container": "data-catalogue-results",
        "catalogue-product-count": "data-catalogue-count",
        "catalogue-source-count": "data-catalogue-source-count",
        "catalogue-field-count": "data-catalogue-field-count",
        "catalogue-review-count": "data-catalogue-review-count",
        "export-comparison": "data-export-comparison",
        "compare-selected": "data-compare-selected",
        "load-trace": "data-load-trace",
        "verify-trace": "data-verify-trace",
        "trace-source-id": "data-trace-source-id",
        "trace-record-id": "data-trace-record-id",
        "trace-event-count": "data-trace-event-count",
        "trace-stage-count": "data-trace-stage-count",
        "trace-integrity-status": "data-trace-integrity-status",
        "trace-status": "data-trace-status",
        "trace-path": "data-trace-path",
        "trace-event-detail": "data-trace-event-detail",
        "evaluation-result": "data-evaluation-result",
        "evaluation-requirement": "data-evaluation-requirement",
        "evaluation-rubric": "data-evaluation-rubric",
        "evaluation-use-llm": "data-evaluation-use-llm",
        "run-evaluation": "data-run-evaluation",
        "evaluation-score": "data-evaluation-score",
        "evaluation-score-label": "data-evaluation-score-label",
        "evaluation-requirement-score": "data-evaluation-requirement-score",
        "evaluation-evidence-score": "data-evaluation-evidence-score",
        "evaluation-issue-count": "data-evaluation-issue-count",
        "evaluation-verdict-badge": "data-evaluation-verdict-badge",
        "evaluation-verdict": "data-evaluation-verdict",
        "evaluation-dimensions": "data-evaluation-dimensions",
        "evaluation-issues": "data-evaluation-issues"
    };

    Object.entries(aliases).forEach(([id, attribute]) => {
        const element = document.getElementById(id);
        if (element) {
            element.setAttribute(attribute, "");
        }
    });

    body.dataset.uploadEndpoint = "/api/ingest";
    body.dataset.sourceUrlEndpoint = "/api/ingest/url";
    body.dataset.matchEndpoint = "/api/match";
    body.dataset.comparisonEndpoint = "/api/compare";
    body.dataset.evaluationEndpoint = "/api/evaluate";
    body.dataset.traceEndpoint = "/api/trace";
    body.dataset.traceIntegrityEndpoint = "/api/trace/integrity";
    body.dataset.exportEndpoint = "/api/export";
    body.dataset.exportBundleEndpoint = "/api/export/bundle";
    body.dataset.forgeVersion = body.dataset.forgeVersion || "1.0.0";
}


function initializeForge() {

    configureOriginalForgeUI();

    setupMobileSidebar();

    setupModals();

    setupClipboardButtons();

    setupExternalLinks();

    setupFileInputs();

    markActiveNavigation();

    updateBreadcrumb();

    setupSmoothAnchors();

    setupPageVisibility();

    setupKeyboardShortcuts();

    runStartupSequence();
}


/* ================================================================
   DOM READY
   ================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeForge
    );

} else {

    initializeForge();
}


/* ================================================================
   PUBLIC GLOBAL API
   ================================================================ */

window.FORGE = FORGE;

window.forgeFetch =
    forgeFetch;

window.getErrorMessage =
    getErrorMessage;

window.showToast =
    showToast;

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.showProcessing =
    showProcessing;

window.hideProcessing =
    hideProcessing;

window.setButtonLoading =
    setButtonLoading;

window.copyToClipboard =
    copyToClipboard;

window.replayStartup =
    replayStartup;

window.escapeHTML =
    escapeHTML;

window.FORGE.configureOriginalForgeUI =
    configureOriginalForgeUI;