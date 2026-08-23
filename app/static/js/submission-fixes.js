/* FORGE — targeted submission fixes only */
"use strict";

(function () {
    const page = () => location.pathname;
    const activeProducts = () => {
        if (typeof getActiveWorkspaceProducts === "function") return getActiveWorkspaceProducts();
        if (window.FORGE_STORE && typeof FORGE_STORE.getProducts === "function") return FORGE_STORE.getProducts();
        return [];
    };
    const toast = (message, type="info", title="FORGE") => {
        if (typeof showToast === "function") showToast(message, type, title);
        else console[type === "error" ? "error" : "log"](message);
    };

    function setupStructuredOutput() {
        if (!page().includes("workspace")) return;
        const previewButton = document.querySelector("[data-preview-structured-output]");
        const downloadButton = document.querySelector("[data-download-structured-output]");
        const format = document.querySelector("[data-structured-output-format]");
        const preview = document.querySelector("[data-structured-output-preview]");
        if (!previewButton || !downloadButton || !preview) return;
        if (!previewButton.dataset.targetFix) {
            previewButton.dataset.targetFix = "true";
            previewButton.addEventListener("click", (event) => {
                event.preventDefault(); event.stopImmediatePropagation();
                const records = activeProducts().map(p => ({...p}));
                if (!records.length) { toast("Select a source with structured records first.", "warning", "No source selected"); return; }
                if (preview.hasAttribute("hidden")) {
                    const columns = [...new Set(records.flatMap(r => Object.keys(r || {})))];
                    const rows = records.slice(0, 25);
                    const fmt = value => value == null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
                    preview.innerHTML = `<div class="structured-output-meta"><span>Showing ${rows.length} of ${records.length} records</span>${records.length > 25 ? "<span>Preview limited to the first 25 records</span>" : ""}</div><div class="structured-output-table-wrap"><table class="structured-output-table"><thead><tr>${columns.map(c => `<th>${escapeHTML(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${escapeHTML(fmt(r[c]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
                    preview.removeAttribute("hidden"); previewButton.textContent = "Hide Structured Preview";
                } else { preview.setAttribute("hidden", ""); previewButton.textContent = "Preview Structured Data"; }
            }, true);
        }
        if (!downloadButton.dataset.targetFix) {
            downloadButton.dataset.targetFix = "true";
            downloadButton.addEventListener("click", async (event) => {
                event.preventDefault(); event.stopImmediatePropagation();
                const records = activeProducts().map(p => ({...p}));
                if (!records.length) { toast("Select a source with structured records first.", "warning", "No source selected"); return; }
                const exportFormat = (format?.value || "csv").toLowerCase();
                setButtonLoading(downloadButton, true, "Preparing...");
                try {
                    const response = await fetch("/api/export", {method:"POST", headers:{"Content-Type":"application/json","Accept":"application/octet-stream"}, body:JSON.stringify({data:records, filename:"forge_structured_output", format:exportFormat, metadata:{title:"FORGE Structured Output", subtitle:"Structured product records extracted from the selected source(s)", record_count:records.length}})});
                    if (!response.ok) { let msg="Unable to download structured output."; try { msg=(await response.json()).error||msg; } catch (_) {} throw new Error(msg); }
                    const blob=await response.blob(), disposition=response.headers.get("Content-Disposition")||"", match=disposition.match(/filename="?([^\"]+)"?/i), filename=match?.[1]||`forge_structured_output.${exportFormat}`;
                    const url=URL.createObjectURL(blob), link=document.createElement("a"); link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
                    toast(`Structured output downloaded as ${exportFormat.toUpperCase()}.`, "success");
                } catch (error) { toast(getErrorMessage(error), "error", "Download failed"); }
                finally { setButtonLoading(downloadButton, false); }
            }, true);
        }
    }

    function setupMatch() {
        if (!page().includes("match")) return;
        const button = document.querySelector("[data-run-match]");
        const input = document.querySelector("[data-requirement-input]");
        if (!button || !input) return;
        if (!input.dataset.matchEnableFix) {
            input.dataset.matchEnableFix = "true";
            const sync = () => { if (!window.MATCH || !MATCH.loading) button.disabled = !input.value.trim(); };
            input.addEventListener("input", sync); sync();
        }
        if (!button.dataset.targetFix) {
            button.dataset.targetFix = "true";
            button.addEventListener("click", async (event) => {
                event.preventDefault(); event.stopImmediatePropagation();
                const requirement = (input.value || "").trim(), products = activeProducts();
                if (!requirement) { toast("Add a requirement before finding matches.", "warning", "No requirement"); return; }
                if (!products.length) { toast("Upload and select a source with product records first.", "warning", "No products"); return; }
                if (!window.MATCH || typeof window.runRequirementMatch !== "function") { toast("The match engine is still loading. Try again.", "warning"); return; }
                MATCH.requirements = [requirement];
                await window.runRequirementMatch();
            }, true);
        }
    }

    function renderCompareExtras() {
        if (!window.COMPARISON || !page().includes("compare")) return;
        const api=COMPARISON.apiResult||{}, differences=Array.isArray(api.differences)?api.differences:[], shared=Array.isArray(api.shared)?api.shared:[];
        const diff=document.getElementById("difference-list"), same=document.getElementById("shared-list");
        if(diff) diff.innerHTML=differences.length?differences.map(item=>`<div class="comparison-insight-item"><strong>${escapeHTML(item.field||"Difference")}</strong><span>${escapeHTML((item.values||[]).join(" · "))}</span><small>${escapeHTML(item.significance||"Meaningful difference")}</small></div>`).join(""):"<div class=\"empty-state compact\"><p>No meaningful differences were identified in the available fields.</p></div>";
        if(same) same.innerHTML=shared.length?shared.map(item=>`<div class="comparison-insight-item"><strong>${escapeHTML(item.field||"Shared specification")}</strong><span>${escapeHTML(item.value??"—")}</span><small>Shared across selected candidates</small></div>`).join(""):"<div class=\"empty-state compact\"><p>No shared specifications were identified across the available fields.</p></div>";
    }

    function setupCompare() {
        if(!page().includes("compare")) return;
        const button=document.querySelector("[data-run-comparison]");
        if(!button || button.dataset.targetFix) return;
        button.dataset.targetFix="true";
        button.addEventListener("click", async(event)=>{
            event.preventDefault(); event.stopImmediatePropagation();
            if(typeof window.__forgeOriginalCompare !== "function") window.__forgeOriginalCompare=window.runProductComparison;
            if(typeof window.__forgeOriginalCompare !== "function"){toast("Comparison engine is still loading.","warning");return;}
            await window.__forgeOriginalCompare();
            if(window.COMPARISON) COMPARISON.results.forEach(r=>{if(!r.winner) r.confidence=null;});
            if(typeof renderComparisonTable==="function") renderComparisonTable();
            renderCompareExtras();
        },true);
    }

    function renderSelectedEvidence(item) {
        const content = document.getElementById("evidence-detail-content");
        const heading = document.querySelector("#evidence-detail .panel-header h2");
        if (!content || !item) return;
        if (heading) heading.textContent = "Selected evidence";
        const source = item.sourceName || "Unknown source";
        const location = [item.page ? `Page ${item.page}` : "", item.section || ""].filter(Boolean).join(" · ");
        const field = item.metadata?.field ? String(item.metadata.field).replaceAll("_", " ") : "Information point";
        const confidence = item.confidence == null ? "Not specified" : `${Math.round(item.confidence)}%`;
        content.innerHTML = `<div class="evidence-detail-inner"><div class="evidence-detail-header"><div><div class="panel-kicker">SELECTED EVIDENCE</div><h3>${escapeHTML(item.title || "Evidence")}</h3></div><span class="evidence-status-badge">${escapeHTML(formatEvidenceTypeSafe(item.type))}</span></div><div class="evidence-detail-section"><div class="result-section-label">SOURCE</div><div class="evidence-source-box"><strong>${escapeHTML(source)}</strong><span>${escapeHTML(location || "Source location not specified")}</span></div></div><div class="evidence-detail-section"><div class="result-section-label">EXTRACTED INFORMATION</div><div class="evidence-extracted-box"><strong>${escapeHTML(item.text || "No evidence text available.")}</strong><span>${escapeHTML(field)}</span></div></div><div class="evidence-detail-section"><div class="result-section-label">EVIDENCE STATUS</div><p>${escapeHTML(`Confidence: ${confidence}`)}</p></div><div class="evidence-detail-section"><div class="result-section-label">HOW IT WAS USED</div><p>${escapeHTML(item.requirement ? `Used in relation to: ${item.requirement}` : "This information point is available as supporting product evidence.")}</p></div></div>`;
    }

    function formatEvidenceTypeSafe(type) {
        return String(type || "document").replaceAll("-", " ").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    function setupEvidence() {
        if(!page().includes("evidence")) return;
        const list=document.getElementById("evidence-list"); if(!list) return;
        list.dataset.evidenceResults="true";
        list.style.maxHeight = "620px";
        list.style.overflowY = "auto";
        list.style.overflowX = "hidden";

        const search=document.querySelector("[data-evidence-search]");
        if(search){ search.remove(); }
        const count=document.getElementById("evidence-list-count");
        if(count){ count.remove(); }

        if(!list.dataset.selectionFix){
            list.dataset.selectionFix="true";
            list.addEventListener("click",event=>{
                const action=event.target.closest("[data-open-evidence]"), card=event.target.closest(".evidence-card");
                const id = action?.dataset.openEvidence || card?.dataset.evidenceId;
                if(id && typeof getEvidenceById === "function"){
                    event.preventDefault();
                    event.stopPropagation();
                    const item=getEvidenceById(id);
                    if(item){
                        if(window.EVIDENCE) EVIDENCE.selectedEvidence=item;
                        renderSelectedEvidence(item);
                    }
                }
            });
            list.addEventListener("keydown",event=>{
                if(event.key!=="Enter"&&event.key!==" ") return;
                const card=event.target.closest(".evidence-card");
                if(card && typeof getEvidenceById === "function"){
                    event.preventDefault();
                    const item=getEvidenceById(card.dataset.evidenceId);
                    if(item){
                        if(window.EVIDENCE) EVIDENCE.selectedEvidence=item;
                        renderSelectedEvidence(item);
                    }
                }
            });
        }
    }

    function setupEvaluation(){
        if(!page().includes("evaluation")) return;
        const button=document.getElementById("run-evaluation"); if(!button||button.dataset.targetFix)return;
        button.dataset.targetFix="true";
        button.addEventListener("click",async(event)=>{
            event.preventDefault();event.stopImmediatePropagation();
            const resultText=(document.getElementById("evaluation-result")?.value||"").trim(), requirement=(document.getElementById("evaluation-requirement")?.value||"").trim(), stored=window.FORGE_STORE?FORGE_STORE.getMatch():[];
            if(!resultText&&!stored.length){toast("Add a FORGE result before running evaluation.","warning","Nothing to evaluate");return;}
            const result=resultText?(()=>{try{return JSON.parse(resultText);}catch(_){return {records:[{result:resultText}]};}})():{records:stored};
            try{
                const payload={result,requirement,source_data:activeProducts(),rubric:{focus:document.getElementById("evaluation-rubric")?.value||"decision"},use_llm:Boolean(document.getElementById("evaluation-use-llm")?.checked)};
                const data=await forgeFetch("/api/evaluate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
                if(typeof renderEvaluation==="function")renderEvaluation(data);
                toast("Evaluation completed.","success");
            }catch(error){toast(getErrorMessage(error),"error","Evaluation failed");}
        },true);
    }

    function init(){setupStructuredOutput();setupMatch();setupCompare();setupEvidence();setupEvaluation();}
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
    const timer=setInterval(init,500);setTimeout(()=>clearInterval(timer),12000);
})();
