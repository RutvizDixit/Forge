/* ================================================================
   FORGE — TARGETED FRONTEND HOTFIXES
   ================================================================ */
"use strict";

function initializeForgeTargetedFixes() {
    const fileInput = document.getElementById("file-input");
    const chooseFiles = document.getElementById("choose-files");
    if (fileInput && chooseFiles && !chooseFiles.dataset.forgeFilePickerBound) {
        chooseFiles.dataset.forgeFilePickerBound = "true";
        chooseFiles.addEventListener("click", (event) => {
            event.preventDefault(); event.stopPropagation();
            if (!fileInput.disabled) fileInput.click();
        });
    }
    if (typeof window.getWorkspaceStructuredRecords === "function") {
        const records = window.getWorkspaceStructuredRecords();
        const available = Array.isArray(records) && records.length > 0;
        const preview = document.querySelector("[data-preview-structured-output]");
        const download = document.querySelector("[data-download-structured-output]");
        if (preview) preview.disabled = !available;
        if (download) download.disabled = !available;
    }
    setupSourceStoreSync(); setupWorkspaceFind(); setupSourceSelection(); setupComparisonGuard();
}

const FORGE_SELECTED_SOURCE_KEY = "forge_selected_source_ids";
function selectedSourceIds() { try { return JSON.parse(sessionStorage.getItem(FORGE_SELECTED_SOURCE_KEY) || "[]").map(String); } catch { return []; } }
function saveSelectedSourceIds(ids) { sessionStorage.setItem(FORGE_SELECTED_SOURCE_KEY, JSON.stringify([...new Set(ids.map(String))])); }

function setupSourceStoreSync() {
    const container = document.querySelector("[data-workspace-sources]");
    if (!container || !window.WORKSPACE || !window.FORGE_STORE) return;
    let signature = JSON.stringify(WORKSPACE.sources.map(s => s.id));
    const sync = () => {
        const next = JSON.stringify(WORKSPACE.sources.map(s => s.id));
        if (next === signature) return;
        signature = next; FORGE_STORE.setSources(WORKSPACE.sources);
        const valid = new Set(WORKSPACE.sources.map(s => String(s.id)));
        saveSelectedSourceIds(selectedSourceIds().filter(id => valid.has(id)));
        if (typeof window.refreshCatalogue === "function") window.refreshCatalogue();
    };
    new MutationObserver(sync).observe(container, {childList:true, subtree:true});
}

function setupSourceSelection() {
    const container = document.querySelector("[data-workspace-sources]");
    if (!container || !window.WORKSPACE) return;
    const inject = () => {
        const sources = WORKSPACE.sources || []; if (!sources.length) return;
        let ids = selectedSourceIds();
        if (!ids.length) { ids = sources.map(s => String(s.id)); saveSelectedSourceIds(ids); }
        sources.forEach(source => {
            const item = container.querySelector(`[data-source-id="${CSS.escape(String(source.id))}"]`);
            if (!item || item.querySelector("[data-forge-source-checkbox]")) return;
            const checkbox = document.createElement("input"); checkbox.type="checkbox"; checkbox.dataset.forgeSourceCheckbox=String(source.id); checkbox.checked=ids.includes(String(source.id)); checkbox.title="Use this source in workflow actions";
            (item.querySelector(".source-item-actions") || item).prepend(checkbox);
            checkbox.addEventListener("change", () => { const next=selectedSourceIds(); const id=String(source.id); if(checkbox.checked&&!next.includes(id))next.push(id); if(!checkbox.checked)saveSelectedSourceIds(next.filter(x=>x!==id)); else saveSelectedSourceIds(next); });
        });
    };
    inject(); new MutationObserver(inject).observe(container,{childList:true,subtree:true});
}

function setupWorkspaceFind() {
    const sourceContainer=document.querySelector("[data-workspace-sources]");
    if(!sourceContainer||sourceContainer.parentNode.querySelector("[data-forge-find-panel]"))return;
    const panel=document.createElement("div"); panel.dataset.forgeFindPanel="true"; panel.className="workspace-find-panel";
    panel.innerHTML='<div class="panel-kicker">FIND IN WORKSPACE</div><div class="workspace-find-row"><input type="search" data-forge-find-input placeholder="Find a product, manufacturer, model, specification..."><button type="button" class="button button-secondary" data-forge-find-button>Find</button></div><div class="workspace-find-status" data-forge-find-status></div><div class="workspace-find-results" data-forge-find-results></div>';
    sourceContainer.parentNode.insertBefore(panel,sourceContainer);
    const input=panel.querySelector("[data-forge-find-input]"),button=panel.querySelector("[data-forge-find-button]"),status=panel.querySelector("[data-forge-find-status]"),results=panel.querySelector("[data-forge-find-results]");
    const run=()=>{const q=input.value.trim().toLowerCase();const records=typeof window.getWorkspaceStructuredRecords==="function"?window.getWorkspaceStructuredRecords():[];if(!q){status.textContent="Enter a term to search uploaded records.";results.innerHTML="";return;}if(!records.length){status.textContent="No structured records are available yet.";results.innerHTML="";return;}const matches=records.filter(r=>JSON.stringify(r).toLowerCase().includes(q)).slice(0,50);status.textContent=`${matches.length} match${matches.length===1?"":"es"}${matches.length===50?" (first 50 shown)":""}.`;results.innerHTML=matches.map(r=>`<div class="workspace-find-result"><pre>${escapeHTML(JSON.stringify(r,null,2))}</pre></div>`).join("")||'<div class="empty-state compact"><p>No matching records found.</p></div>';};
    button.addEventListener("click",run); input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();run();}});
}

function setupComparisonGuard() {
    if(!window.COMPARISON)return; const button=document.querySelector("[data-run-comparison]"); if(!button||button.dataset.forgeGuardBound)return; button.dataset.forgeGuardBound="true";
    button.addEventListener("click",()=>{const ids=selectedSourceIds();if(!ids.length)return;const allowed=new Set(ids);const filtered=COMPARISON.products.filter(p=>{const sid=p.raw?.source_id||p.source_id||p.source;return !sid||allowed.has(String(sid));});if(filtered.length>=2){COMPARISON.products=filtered;COMPARISON.selectedProducts=COMPARISON.selectedProducts.filter(id=>filtered.some(p=>String(p.id)===String(id)));renderComparisonProducts();updateComparisonSelectionState();}},true);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(initializeForgeTargetedFixes,0),{once:true});else setTimeout(initializeForgeTargetedFixes,0);
