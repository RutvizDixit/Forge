/* Targeted Compare assessment display fix only. */
"use strict";
(function () {
    function apply() {
        if (!location.pathname.includes("compare") || !window.COMPARISON) return;
        const rows = document.querySelectorAll("[data-comparison-table] tbody tr");
        const results = COMPARISON.results || [];
        rows.forEach((row, index) => {
            const result = results[index];
            const small = row.querySelector(".comparison-assessment small");
            if (small && result && !result.winner) small.textContent = "No winner confidence calculated";
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
    else apply();
    setInterval(apply, 700);
})();
