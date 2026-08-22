/* ================================================================
   FORGE — WORKSPACE
   workspace.js
   ================================================================ */

"use strict";


/* ================================================================
   WORKSPACE STATE
   ================================================================ */

const WORKSPACE = {
    selectedFiles: [],
    sources: [],
    uploading: false,
    dragActive: false
};


/* ================================================================
   CONFIGURATION
   ================================================================ */

const WORKSPACE_CONFIG = {

    /*
     * Keep these extensions aligned with the backend upload
     * validation.
     */

    allowedExtensions: [
        "csv",
        "xlsx",
        "xls",
        "pdf",
        "docx",
        "txt",
        "json",
        "xml",
        "zip"
    ],

    maxFiles: 20,

    /*
     * This is intentionally only a frontend safety check.
     * The backend remains authoritative.
     */

    maxFileSizeMB: 50
};


/* ================================================================
   DOM HELPERS
   ================================================================ */

function workspaceElement(
    id
) {
    return document.getElementById(id);
}


function workspaceQuery(
    selector
) {
    return document.querySelector(selector);
}


/* ================================================================
   FILE VALIDATION
   ================================================================ */

function getFileExtension(
    filename
) {

    if (
        !filename ||
        !filename.includes(".")
    ) {
        return "";
    }


    return filename
        .split(".")
        .pop()
        .toLowerCase()
        .trim();
}


function validateWorkspaceFile(
    file
) {

    if (!file) {

        return {
            valid: false,
            message: "No file was provided."
        };
    }


    const extension =
        getFileExtension(
            file.name
        );


    if (
        !WORKSPACE_CONFIG.allowedExtensions.includes(
            extension
        )
    ) {

        return {
            valid: false,
            message:
                `"${file.name}" is not a supported file type.`
        };
    }


    const maxBytes =
        WORKSPACE_CONFIG.maxFileSizeMB *
        1024 *
        1024;


    if (
        file.size > maxBytes
    ) {

        return {
            valid: false,
            message:
                `"${file.name}" exceeds the ${WORKSPACE_CONFIG.maxFileSizeMB} MB frontend limit.`
        };
    }


    return {
        valid: true,
        extension
    };
}


/* ================================================================
   FILE LIST MANAGEMENT
   ================================================================ */

function addWorkspaceFiles(
    files
) {

    if (!files) {
        return;
    }


    const incoming =
        Array.from(files);


    if (
        incoming.length === 0
    ) {
        return;
    }


    let addedCount = 0;


    for (
        const file of incoming
    ) {

        if (
            WORKSPACE.selectedFiles.length >=
            WORKSPACE_CONFIG.maxFiles
        ) {

            showToast(
                `A maximum of ${WORKSPACE_CONFIG.maxFiles} files can be selected at once.`,
                "warning"
            );

            break;
        }


        const validation =
            validateWorkspaceFile(
                file
            );


        if (!validation.valid) {

            showToast(
                validation.message,
                "warning",
                "File rejected"
            );

            continue;
        }


        const duplicate =
            WORKSPACE.selectedFiles.some(
                (existing) =>
                    existing.name === file.name &&
                    existing.size === file.size &&
                    existing.lastModified === file.lastModified
            );


        if (duplicate) {

            continue;
        }


        WORKSPACE.selectedFiles.push(
            file
        );


        addedCount += 1;
    }


    renderSelectedFiles();


    if (
        addedCount > 0
    ) {

        showToast(
            `${addedCount} file${addedCount === 1 ? "" : "s"} added.`,
            "success"
        );
    }
}


function removeWorkspaceFile(
    index
) {

    if (
        index < 0 ||
        index >= WORKSPACE.selectedFiles.length
    ) {
        return;
    }


    const removed =
        WORKSPACE.selectedFiles.splice(
            index,
            1
        );


    renderSelectedFiles();


    if (
        removed.length
    ) {

        showToast(
            `${removed[0].name} removed.`,
            "info"
        );
    }
}


function clearSelectedFiles() {

    WORKSPACE.selectedFiles =
        [];


    renderSelectedFiles();
}


/* ================================================================
   FILE SIZE FORMATTING
   ================================================================ */

function formatWorkspaceFileSize(
    bytes
) {

    if (
        bytes === null ||
        bytes === undefined ||
        Number.isNaN(Number(bytes))
    ) {
        return "Unknown size";
    }


    const value =
        Number(bytes);


    if (
        value < 1024
    ) {
        return `${value} B`;
    }


    if (
        value < 1024 * 1024
    ) {
        return `${(value / 1024).toFixed(1)} KB`;
    }


    if (
        value < 1024 * 1024 * 1024
    ) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }


    return `${(
        value /
        (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
}


/* ================================================================
   FILE TYPE LABEL
   ================================================================ */

function getWorkspaceFileType(
    filename
) {

    const extension =
        getFileExtension(
            filename
        );


    return extension
        ? extension.toUpperCase()
        : "FILE";
}


/* ================================================================
   SELECTED FILE RENDERING
   ================================================================ */

function renderSelectedFiles() {

    const container =
        workspaceQuery(
            "[data-selected-files]"
        );


    if (!container) {
        return;
    }


    if (
        WORKSPACE.selectedFiles.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-state-icon">
                    +
                </div>

                <h3>
                    No files selected
                </h3>

                <p>
                    Add one or more product sources to begin.
                </p>
            </div>
        `;

        updateWorkspaceSelectionSummary();

        return;
    }


    container.innerHTML =
        WORKSPACE.selectedFiles
            .map(
                (file, index) => {

                    return `
                        <div
                            class="source-item"
                            data-source-index="${index}"
                        >

                            <div class="source-item-icon">
                                ${escapeHTML(
                                    getWorkspaceFileType(
                                        file.name
                                    )
                                )}
                            </div>

                            <div class="source-item-info">

                                <strong>
                                    ${escapeHTML(file.name)}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        formatWorkspaceFileSize(
                                            file.size
                                        )
                                    )}
                                </small>

                            </div>

                            <button
                                type="button"
                                class="icon-button"
                                data-remove-selected-file="${index}"
                                aria-label="Remove ${escapeHTML(file.name)}"
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
            "[data-remove-selected-file]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        removeWorkspaceFile(
                            Number(
                                button.dataset
                                    .removeSelectedFile
                            )
                        );
                    }
                );
            }
        );


    updateWorkspaceSelectionSummary();
}


/* ================================================================
   SELECTION SUMMARY
   ================================================================ */

function updateWorkspaceSelectionSummary() {

    const count =
        workspaceQuery(
            "[data-selected-file-count]"
        );


    const size =
        workspaceQuery(
            "[data-selected-file-size]"
        );


    if (count) {

        setText(
            count,
            WORKSPACE.selectedFiles.length
        );
    }


    if (size) {

        const total =
            WORKSPACE.selectedFiles.reduce(
                (sum, file) =>
                    sum + (file.size || 0),
                0
            );


        setText(
            size,
            formatWorkspaceFileSize(
                total
            )
        );
    }
}


/* ================================================================
   FILE INPUT
   ================================================================ */

function setupWorkspaceFileInput() {

    const input =
        workspaceQuery(
            "[data-workspace-file-input]"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "change",
        () => {

            addWorkspaceFiles(
                input.files
            );


            /*
             * Reset the input so selecting the same file again
             * still triggers the change event.
             */

            input.value = "";
        }
    );
}


/* ================================================================
   DROPZONE
   ================================================================ */

function setupWorkspaceDropzone() {

    const dropzone =
        workspaceQuery(
            "[data-workspace-dropzone]"
        );


    if (!dropzone) {
        return;
    }


    [
        "dragenter",
        "dragover"
    ].forEach(
        (eventName) => {

            dropzone.addEventListener(
                eventName,
                (event) => {

                    event.preventDefault();
                    event.stopPropagation();

                    WORKSPACE.dragActive =
                        true;


                    dropzone.classList.add(
                        "dragover"
                    );
                }
            );
        }
    );


    [
        "dragleave",
        "dragend",
        "drop"
    ].forEach(
        (eventName) => {

            dropzone.addEventListener(
                eventName,
                (event) => {

                    event.preventDefault();
                    event.stopPropagation();

                    WORKSPACE.dragActive =
                        false;


                    dropzone.classList.remove(
                        "dragover"
                    );
                }
            );
        }
    );


    dropzone.addEventListener(
        "drop",
        (event) => {

            const files =
                event.dataTransfer &&
                event.dataTransfer.files;


            if (files) {

                addWorkspaceFiles(
                    files
                );
            }
        }
    );


    dropzone.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest(
                    "button, input, a"
                )
            ) {
                return;
            }


            const input =
                workspaceQuery(
                    "[data-workspace-file-input]"
                );


            if (input) {
                input.click();
            }
        }
    );


    dropzone.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key !== "Enter" &&
                event.key !== " "
            ) {
                return;
            }


            event.preventDefault();


            const input =
                workspaceQuery(
                    "[data-workspace-file-input]"
                );


            if (input) {
                input.click();
            }
        }
    );
}


/* ================================================================
   URL SOURCE
   ================================================================ */

function getWorkspaceURL() {

    const input =
        workspaceQuery(
            "[data-source-url]"
        );


    if (!input) {
        return "";
    }


    return input.value.trim();
}


function validateWorkspaceURL(
    value
) {

    if (!value) {

        return {
            valid: false,
            message: "Enter a source URL."
        };
    }


    let parsed;


    try {

        parsed =
            new URL(value);

    } catch {

        return {
            valid: false,
            message: "Enter a valid URL."
        };
    }


    if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
    ) {

        return {
            valid: false,
            message:
                "Only HTTP and HTTPS sources are supported."
        };
    }


    return {
        valid: true,
        url: parsed.href
    };
}


async function addURLSource() {

    const input =
        workspaceQuery(
            "[data-source-url]"
        );


    const button =
        workspaceQuery(
            "[data-add-url]"
        );


    if (!input) {
        return;
    }


    const value =
        input.value.trim();


    const validation =
        validateWorkspaceURL(
            value
        );


    if (!validation.valid) {

        showToast(
            validation.message,
            "warning",
            "Invalid source"
        );

        input.focus();

        return;
    }


    setButtonLoading(
        button,
        true,
        "Adding..."
    );


    try {

        /*
         * The backend may expose a URL-source endpoint.
         * Keep the request isolated here so the rest of the
         * workspace remains independent of the API implementation.
         */

        const endpoint =
            document.body.dataset
                .sourceUrlEndpoint;


        if (!endpoint) {

            /*
             * If the route is not configured yet, keep the URL
             * locally visible rather than making a fake request.
             */

            addLocalURLSource(
                validation.url
            );

            return;
        }


        const result =
            await forgeFetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        url: validation.url
                    })
                }
            );


        const source =
            result.source ||
            result.data ||
            result;


        addSourceToWorkspace(
            source
        );


        input.value = "";


        showToast(
            "Source URL added successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "FORGE URL source error:",
            error
        );


        showToast(
            getErrorMessage(error),
            "error",
            "Unable to add source"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


/* ================================================================
   LOCAL URL SOURCE FALLBACK
   ================================================================ */

function addLocalURLSource(
    url
) {

    const source = {

        id:
            `local-url-${Date.now()}`,

        name:
            url,

        type:
            "url",

        status:
            "ready",

        source_url:
            url
    };


    addSourceToWorkspace(
        source
    );


    const input =
        workspaceQuery(
            "[data-source-url]"
        );


    if (input) {
        input.value = "";
    }


    showToast(
        "Source added to the workspace.",
        "success"
    );
}


/* ================================================================
   SOURCE COLLECTION
   ================================================================ */

function addSourceToWorkspace(
    source
) {

    if (!source) {
        return;
    }


    const normalized = {

        id:
            source.id ||
            source.source_id ||
            `source-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        name:
            source.name ||
            source.filename ||
            source.title ||
            "Unnamed source",

        type:
            source.type ||
            source.source_type ||
            "file",

        status:
            source.status ||
            "ready",

        size:
            source.size ||
            source.file_size ||
            null,

        source_url:
            source.source_url ||
            source.url ||
            null,

        created_at:
            source.created_at ||
            null,

        metadata:
            source.metadata ||
            {},

        rows:
            Array.isArray(source.rows)
                ? source.rows
                : [],

        columns:
            Array.isArray(source.columns)
                ? source.columns
                : [],

        text:
            source.text ||
            ""
    };


    const existingIndex =
        WORKSPACE.sources.findIndex(
            (item) =>
                String(item.id) ===
                String(normalized.id)
        );


    if (
        existingIndex >= 0
    ) {

        WORKSPACE.sources[
            existingIndex
        ] = normalized;

    } else {

        WORKSPACE.sources.push(
            normalized
        );
    }


    renderWorkspaceSources();

    updateWorkspaceSourceSummary();

    renderStructuredOutput();

    if (window.FORGE_STORE) {
        FORGE_STORE.setSources(WORKSPACE.sources);
    }
}


/* ================================================================
   STRUCTURED OUTPUT
   ================================================================ */

function getWorkspaceStructuredRecords() {

    const records = [];

    WORKSPACE.sources.forEach(
        (source) => {

            if (
                !Array.isArray(source.rows) ||
                source.rows.length === 0
            ) {
                return;
            }

            source.rows.forEach(
                (row) => {

                    if (
                        !row ||
                        typeof row !== "object" ||
                        Array.isArray(row)
                    ) {
                        return;
                    }

                    records.push({
                        ...row
                    });
                }
            );
        }
    );

    return records;
}


function getWorkspaceStructuredColumns(
    records
) {

    const columns = [];

    records.forEach(
        (record) => {

            Object.keys(record).forEach(
                (key) => {

                    if (
                        !columns.includes(key)
                    ) {
                        columns.push(key);
                    }
                }
            );
        }
    );

    return columns;
}


function formatStructuredOutputValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    if (
        typeof value === "object"
    ) {
        try {
            return JSON.stringify(
                value
            );
        } catch {
            return String(value);
        }
    }

    return String(value);
}


function renderStructuredOutput() {

    const count =
        workspaceQuery(
            "[data-structured-output-count]"
        );

    const previewButton =
        workspaceQuery(
            "[data-preview-structured-output]"
        );

    const downloadButton =
        workspaceQuery(
            "[data-download-structured-output]"
        );

    const preview =
        workspaceQuery(
            "[data-structured-output-preview]"
        );

    const records =
        getWorkspaceStructuredRecords();

    if (count) {
        setText(
            count,
            `${records.length} record${records.length === 1 ? "" : "s"}`
        );
    }

    if (previewButton) {
        previewButton.disabled =
            records.length === 0;
    }

    if (downloadButton) {
        downloadButton.disabled =
            records.length === 0;
    }

    if (!preview) {
        return;
    }

    if (records.length === 0) {
        preview.innerHTML = "";
        return;
    }

    const columns =
        getWorkspaceStructuredColumns(
            records
        );

    const previewRecords =
        records.slice(
            0,
            25
        );

    preview.innerHTML = `
        <div class="structured-output-meta">
            <span>
                Showing ${previewRecords.length} of ${records.length} records
            </span>
            ${
                records.length > 25
                    ? `
                        <span>
                            Preview limited to the first 25 records
                        </span>
                    `
                    : ""
            }
        </div>

        <div class="structured-output-table-wrap">
            <table class="structured-output-table">
                <thead>
                    <tr>
                        ${columns
                            .map(
                                (column) => `
                                    <th scope="col">
                                        ${escapeHTML(column)}
                                    </th>
                                `
                            )
                            .join("")}
                    </tr>
                </thead>

                <tbody>
                    ${previewRecords
                        .map(
                            (record) => `
                                <tr>
                                    ${columns
                                        .map(
                                            (column) => `
                                                <td>
                                                    ${escapeHTML(
                                                        formatStructuredOutputValue(
                                                            record[column]
                                                        )
                                                    )}
                                                </td>
                                            `
                                        )
                                        .join("")}
                                </tr>
                            `
                        )
                        .join("")}
                </tbody>
            </table>
        </div>
    `;
}


function toggleStructuredOutputPreview() {

    const preview =
        workspaceQuery(
            "[data-structured-output-preview]"
        );

    const button =
        workspaceQuery(
            "[data-preview-structured-output]"
        );

    if (!preview) {
        return;
    }

    const shouldShow =
        preview.hasAttribute("hidden");

    if (shouldShow) {
        renderStructuredOutput();
        preview.removeAttribute("hidden");

        if (button) {
            setText(
                button,
                "Hide Structured Preview"
            );
        }

        return;
    }

    preview.setAttribute(
        "hidden",
        ""
    );

    if (button) {
        setText(
            button,
            "Preview Structured Data"
        );
    }
}


async function downloadStructuredOutput() {

    const records =
        getWorkspaceStructuredRecords();

    if (records.length === 0) {

        showToast(
            "No structured records are available yet.",
            "warning",
            "Structured output"
        );

        return;
    }

    const endpoint =
        workspaceQuery(
            "[data-download-structured-output]"
        )?.dataset.exportEndpoint ||
        "/api/export";

    if (!endpoint) {

        showToast(
            "The structured-output download endpoint is not configured.",
            "error",
            "Download unavailable"
        );

        return;
    }

    const button =
        workspaceQuery(
            "[data-download-structured-output]"
        );

    setButtonLoading(
        button,
        true,
        "Preparing..."
    );

    try {

        const result =
            await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        data: records,
                        filename:
                            "forge_structured_output",
                        format:
                            "json",
                        metadata: {
                            title:
                                "FORGE Structured Output",
                            subtitle:
                                "Structured records extracted from source material",
                            record_count:
                                records.length
                        }
                    })
                }
            );

        if (!result.ok) {

            let message =
                "Unable to download structured output.";

            try {
                const payload =
                    await result.json();

                message =
                    payload.error ||
                    message;
            } catch {
                /* Keep the default message. */
            }

            throw new Error(
                message
            );
        }

        const blob =
            await result.blob();

        const disposition =
            result.headers.get(
                "Content-Disposition"
            ) || "";

        const filenameMatch =
            disposition.match(
                /filename="?([^"]+)"?/i
            );

        const filename =
            filenameMatch?.[1] ||
            "forge_structured_output.json";

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

        showToast(
            "Structured output downloaded.",
            "success"
        );

    } catch (error) {

        console.error(
            "FORGE structured output download error:",
            error
        );

        showToast(
            getErrorMessage(error),
            "error",
            "Download failed"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


function setupStructuredOutput() {

    const previewButton =
        workspaceQuery(
            "[data-preview-structured-output]"
        );

    const downloadButton =
        workspaceQuery(
            "[data-download-structured-output]"
        );

    if (previewButton) {
        previewButton.addEventListener(
            "click",
            toggleStructuredOutputPreview
        );
    }

    if (downloadButton) {
        downloadButton.addEventListener(
            "click",
            downloadStructuredOutput
        );
    }

    renderStructuredOutput();
}


/* ================================================================
   SOURCE RENDERING
   ================================================================ */

function renderWorkspaceSources() {

    const container =
        workspaceQuery(
            "[data-workspace-sources]"
        );


    if (!container) {
        return;
    }


    if (
        WORKSPACE.sources.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state compact">

                <div class="empty-state-icon">
                    ◌
                </div>

                <h3>
                    No sources yet
                </h3>

                <p>
                    Uploaded files and source URLs will appear here.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        WORKSPACE.sources
            .map(
                (source) =>
                    renderWorkspaceSource(
                        source
                    )
            )
            .join("");


    container
        .querySelectorAll(
            "[data-remove-source]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        removeWorkspaceSource(
                            button.dataset
                                .removeSource
                        );
                    }
                );
            }
        );
}


function renderWorkspaceSource(
    source
) {

    const status =
        String(
            source.status ||
            "ready"
        ).toLowerCase();


    const type =
        String(
            source.type ||
            "file"
        ).toUpperCase();


    const size =
        source.size
            ? formatWorkspaceFileSize(
                source.size
            )
            : "";


    const statusLabel =
        status
            .replaceAll(
                "_",
                " "
            )
            .toUpperCase();


    return `
        <div
            class="source-item"
            data-source-id="${escapeHTML(
                source.id
            )}"
        >

            <div class="source-item-icon">
                ${escapeHTML(type.slice(0, 5))}
            </div>

            <div class="source-item-info">

                <strong>
                    ${escapeHTML(source.name)}
                </strong>

                <small>
                    ${escapeHTML(statusLabel)}
                    ${size ? ` · ${escapeHTML(size)}` : ""}
                </small>

            </div>

            <div class="source-item-actions">

                ${
                    source.source_url
                        ? `
                            <a
                                href="${escapeHTML(
                                    source.source_url
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-link"
                            >
                                Open
                            </a>
                        `
                        : ""
                }

                <button
                    type="button"
                    class="icon-button"
                    data-remove-source="${escapeHTML(
                        source.id
                    )}"
                    aria-label="Remove source"
                >
                    ×
                </button>

            </div>

        </div>
    `;
}


/* ================================================================
   SOURCE SUMMARY
   ================================================================ */

function updateWorkspaceSourceSummary() {

    const count =
        workspaceQuery(
            "[data-source-count]"
        );


    const ready =
        workspaceQuery(
            "[data-ready-source-count]"
        );


    const processing =
        workspaceQuery(
            "[data-processing-source-count]"
        );


    if (count) {

        setText(
            count,
            WORKSPACE.sources.length
        );
    }


    if (ready) {

        setText(
            ready,
            WORKSPACE.sources.filter(
                (source) =>
                    [
                        "ready",
                        "processed",
                        "complete",
                        "completed"
                    ].includes(
                        String(
                            source.status
                        ).toLowerCase()
                    )
            ).length
        );
    }


    if (processing) {

        setText(
            processing,
            WORKSPACE.sources.filter(
                (source) =>
                    [
                        "processing",
                        "queued",
                        "pending"
                    ].includes(
                        String(
                            source.status
                        ).toLowerCase()
                    )
            ).length
        );
    }
}


/* ================================================================
   SOURCE REMOVAL
   ================================================================ */

async function removeWorkspaceSource(
    sourceId
) {

    if (!sourceId) {
        return;
    }


    const source =
        WORKSPACE.sources.find(
            (item) =>
                String(item.id) ===
                String(sourceId)
        );


    if (!source) {
        return;
    }


    const endpointTemplate =
        document.body.dataset
            .sourceDeleteEndpoint;


    /*
     * If the backend exposes a deletion endpoint, use it.
     * Otherwise remove it from the current frontend state.
     */

    if (endpointTemplate) {

        try {

            const endpoint =
                endpointTemplate
                    .replace(
                        ":id",
                        encodeURIComponent(
                            sourceId
                        )
                    );


            await forgeFetch(
                endpoint,
                {
                    method: "DELETE"
                }
            );

        } catch (error) {

            console.error(
                "FORGE source deletion error:",
                error
            );


            showToast(
                getErrorMessage(error),
                "error",
                "Unable to remove source"
            );

            return;
        }
    }


    WORKSPACE.sources =
        WORKSPACE.sources.filter(
            (item) =>
                String(item.id) !==
                String(sourceId)
        );


    renderWorkspaceSources();

    updateWorkspaceSourceSummary();


    showToast(
        "Source removed.",
        "success"
    );
}


/* ================================================================
   UPLOAD
   ================================================================ */

function getUploadEndpoint() {

    return document.body.dataset
        .uploadEndpoint || "";
}


async function uploadWorkspaceFiles() {

    if (
        WORKSPACE.uploading
    ) {
        return;
    }


    if (
        WORKSPACE.selectedFiles.length === 0
    ) {

        showToast(
            "Select at least one file first.",
            "warning",
            "Nothing to upload"
        );

        return;
    }


    const endpoint =
        getUploadEndpoint();


    if (!endpoint) {

        showToast(
            "The upload endpoint is not configured yet.",
            "error",
            "Workspace configuration"
        );

        return;
    }


    const button =
        workspaceQuery(
            "[data-upload-files]"
        );


    const formData =
        new FormData();


    WORKSPACE.selectedFiles.forEach(
        (file) => {

            formData.append(
                "files",
                file,
                file.name
            );
        }
    );


    WORKSPACE.uploading =
        true;


    setButtonLoading(
        button,
        true,
        "Uploading..."
    );


    showProcessing({
        id:
            "analysis-overlay",

        messageElement:
            "processing-message",

        message:
            "Uploading source material..."
    });


    try {

        const result =
            await forgeFetch(
                endpoint,
                {
                    method: "POST",
                    body: formData
                }
            );


        const sources =
            result.sources ||
            result.data?.sources ||
            (
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : null
            );


        if (
            Array.isArray(sources)
        ) {

            sources.forEach(
                addSourceToWorkspace
            );

        } else {

            /*
             * If the backend only returns a success message,
             * refresh the source collection if a route exists.
             */

            await refreshWorkspaceSources();
        }


        const uploadedCount =
            Array.isArray(sources)
                ? sources.length
                : WORKSPACE.selectedFiles.length;


        clearSelectedFiles();


        showToast(
            `${uploadedCount} source${uploadedCount === 1 ? "" : "s"} uploaded successfully.`,
            "success"
        );

        const requirementInput = document.getElementById("requirement-input");
        const requirement = requirementInput?.value.trim() || "";
        if (requirement) {
            sessionStorage.setItem("forge_pending_requirement", requirement);
            window.setTimeout(() => {
                window.location.href = "/match";
            }, 250);
        }

    } catch (error) {

        console.error(
            "FORGE upload error:",
            error
        );


        showToast(
            getErrorMessage(error),
            "error",
            "Upload failed"
        );

    } finally {

        WORKSPACE.uploading =
            false;


        setButtonLoading(
            button,
            false
        );


        hideProcessing(
            "analysis-overlay"
        );
    }
}


/* ================================================================
   SOURCE REFRESH
   ================================================================ */

async function refreshWorkspaceSources() {

    const endpoint =
        document.body.dataset
            .sourceListEndpoint;


    if (!endpoint) {
        return;
    }


    try {

        const result =
            await forgeFetch(
                endpoint
            );


        const sources =
            result.sources ||
            result.data?.sources ||
            (
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : []
            );


        WORKSPACE.sources =
            Array.isArray(sources)
                ? sources.map(
                    normalizeWorkspaceSource
                )
                : [];


        renderWorkspaceSources();

        updateWorkspaceSourceSummary();

        renderStructuredOutput();

        if (window.FORGE_STORE) {
            FORGE_STORE.setSources(WORKSPACE.sources);
        }

    } catch (error) {

        console.error(
            "FORGE source refresh error:",
            error
        );
    }
}


function normalizeWorkspaceSource(
    source
) {

    return {

        id:
            source.id ||
            source.source_id ||
            `source-${Date.now()}`,

        name:
            source.name ||
            source.filename ||
            source.title ||
            "Unnamed source",

        type:
            source.type ||
            source.source_type ||
            "file",

        status:
            source.status ||
            "ready",

        size:
            source.size ||
            source.file_size ||
            null,

        source_url:
            source.source_url ||
            source.url ||
            null,

        created_at:
            source.created_at ||
            null,

        metadata:
            source.metadata ||
            {},

        rows:
            Array.isArray(source.rows)
                ? source.rows
                : [],

        columns:
            Array.isArray(source.columns)
                ? source.columns
                : [],

        text:
            source.text ||
            ""
    };
}


/* ================================================================
   UPLOAD FORM SUBMISSION
   ================================================================ */

function setupWorkspaceUpload() {

    const button =
        workspaceQuery(
            "[data-upload-files]"
        );


    if (!button) {
        return;
    }

    button.disabled = false;


    button.addEventListener(
        "click",
        uploadWorkspaceFiles
    );
}


/* ================================================================
   URL SOURCE BUTTON
   ================================================================ */

function setupWorkspaceURLSource() {

    const button =
        workspaceQuery(
            "[data-add-url]"
        );


    const input =
        workspaceQuery(
            "[data-source-url]"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        addURLSource
    );


    if (input) {

        input.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    addURLSource();
                }
            }
        );
    }
}


/* ================================================================
   CLEAR SELECTION BUTTON
   ================================================================ */

function setupWorkspaceClearButton() {

    const button =
        workspaceQuery(
            "[data-clear-selected-files]"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            if (
                WORKSPACE.selectedFiles.length === 0
            ) {
                return;
            }


            clearSelectedFiles();


            showToast(
                "Selected files cleared.",
                "info"
            );
        }
    );
}


/* ================================================================
   DRAG/DROP PASTE SUPPORT
   ================================================================ */

function setupWorkspacePaste() {

    document.addEventListener(
        "paste",
        (event) => {

            const files =
                event.clipboardData &&
                event.clipboardData.files;


            if (
                !files ||
                files.length === 0
            ) {
                return;
            }


            /*
             * Only handle pasted files when the user is not actively
             * typing into a text field.
             */

            const active =
                document.activeElement;


            const typing =
                active &&
                (
                    active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA"
                );


            if (typing) {
                return;
            }


            addWorkspaceFiles(
                files
            );
        }
    );
}


/* ================================================================
   INITIAL WORKSPACE LOAD
   ================================================================ */

async function initializeWorkspace() {

    setupWorkspaceFileInput();

    setupWorkspaceDropzone();

    setupWorkspaceUpload();

    setupWorkspaceURLSource();

    setupWorkspaceClearButton();

    setupWorkspacePaste();

    setupStructuredOutput();

    const storedSources = window.FORGE_STORE
        ? FORGE_STORE.getSources()
        : [];

    if (storedSources.length) {
        WORKSPACE.sources = storedSources;
    }

    renderSelectedFiles();

    renderWorkspaceSources();

    updateWorkspaceSelectionSummary();

    updateWorkspaceSourceSummary();


    await refreshWorkspaceSources();
}


/* ================================================================
   PUBLIC API
   ================================================================ */

window.WORKSPACE =
    WORKSPACE;

window.addWorkspaceFiles =
    addWorkspaceFiles;

window.removeWorkspaceFile =
    removeWorkspaceFile;

window.clearSelectedFiles =
    clearSelectedFiles;

window.uploadWorkspaceFiles =
    uploadWorkspaceFiles;

window.refreshWorkspaceSources =
    refreshWorkspaceSources;

window.getWorkspaceStructuredRecords =
    getWorkspaceStructuredRecords;


/* ================================================================
   PAGE INITIALIZATION
   ================================================================ */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initializeWorkspace();
        }
    );

} else {

    initializeWorkspace();
}