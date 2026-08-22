/* ================================================================
   FORGE — TARGETED FRONTEND HOTFIXES
   Keeps the existing application architecture intact.
   ================================================================ */

"use strict";


function initializeForgeTargetedFixes() {

    /* ------------------------------------------------------------
       Workspace: make Choose Files a direct, reliable control.
       The dropzone intentionally ignores button clicks, so the
       visible button must explicitly open the hidden file input.
       ------------------------------------------------------------ */

    const fileInput =
        document.getElementById("file-input");

    const chooseFiles =
        document.getElementById("choose-files");

    if (
        fileInput &&
        chooseFiles &&
        !chooseFiles.dataset.forgeFilePickerBound
    ) {

        chooseFiles.dataset.forgeFilePickerBound = "true";

        chooseFiles.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!fileInput.disabled) {
                    fileInput.click();
                }
            }
        );
    }


    /* ------------------------------------------------------------
       Structured output: keep the controls synchronized with the
       shared Workspace records after the page-specific script has
       initialized. Do not invent success states or fake records.
       ------------------------------------------------------------ */

    if (
        typeof window.getWorkspaceStructuredRecords === "function"
    ) {

        const records =
            window.getWorkspaceStructuredRecords();

        const previewButton =
            document.querySelector(
                "[data-preview-structured-output]"
            );

        const downloadButton =
            document.querySelector(
                "[data-download-structured-output]"
            );

        const count =
            document.querySelector(
                "[data-structured-output-count]"
            );

        const available =
            Array.isArray(records) &&
            records.length > 0;

        if (previewButton) {
            previewButton.disabled = !available;
        }

        if (downloadButton) {
            downloadButton.disabled = !available;
        }

        if (count) {
            count.textContent =
                `${Array.isArray(records) ? records.length : 0} record${records && records.length === 1 ? "" : "s"}`;
        }
    }
}


/*
 * workspace.js is a deferred page script. Run this after deferred
 * page initialization so the existing handlers and shared store are
 * already ready.
 */
if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        () => window.setTimeout(
            initializeForgeTargetedFixes,
            0
        ),
        { once: true }
    );

} else {

    window.setTimeout(
        initializeForgeTargetedFixes,
        0
    );
}
