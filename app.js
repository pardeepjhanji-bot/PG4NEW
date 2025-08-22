/* ===== CONFIG (unchanged) ===== */
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwgriyt5hePCjd-6j-7JJCx52WalDXXI0gZjievH-84hEy9sCblNZTwcYLMYpN4OHj/exec";

    /* ===== DOM helpers ===== */
    function $(sel, root=document) { return root.querySelector(sel); }
    function $all(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

    /* ===== Utils ===== */
    function formatDate(d) { if (!d) return ""; const p=d.split("-"); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:d; }
    function maxIsoDate(dates){ if(!Array.isArray(dates)||!dates.length) return null; return dates.reduce((m,d)=>(m===null||d>m?d:m),null); }
    function toIntNonNeg(v){ const n=parseInt(v,10); return isNaN(n)||n<0?0:n; }

    /* ===== Digital Signature (unchanged) ===== */
    function getSignatureDataURL() { try { return localStorage.getItem("digitalSignDataURL") || ""; } catch { return ""; } }
    function setSignatureDataURL(dataURL) { try { localStorage.setItem("digitalSignDataURL", dataURL); } catch {} }
    function clearSignature() { try { localStorage.removeItem("digitalSignDataURL"); } catch {} updateSignaturePreview(); }
    function updateSignaturePreview() { const dataURL = getSignatureDataURL(); const prev = $("#signPreview"); const img = $("#signPreviewImg"); if (dataURL) { prev.style.display = "flex"; img.src = dataURL; } else { prev.style.display = "none"; img.removeAttribute("src"); } }
    (function initSignatureUI(){ const inp = $("#signInput"); inp?.addEventListener("change", (e) => { const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ setSignatureDataURL(r.result); updateSignaturePreview(); }; r.readAsDataURL(f); }); updateSignaturePreview(); })();

    /* ===== PART A: Bardana (entry UI) ===== */
    const BARDANA_KEY = 'bardana.types.v1';
    const BARDANA_LOCK_KEY = 'bardana.locked.v1';

    let bardanaTypes = [];
    let bardanaLocked = true; // default locked

    function normalizeType(s){ return (s||'').trim().toUpperCase().replace(/\s+/g,' '); }

    function loadBardana(){
      try { bardanaTypes = JSON.parse(localStorage.getItem(BARDANA_KEY) || '[]'); } catch { bardanaTypes = []; }
      if (!Array.isArray(bardanaTypes) || bardanaTypes.length === 0) bardanaTypes = ['JUTE NEW','JUTE PREVIOUS YEAR'];
      try { bardanaLocked = JSON.parse(localStorage.getItem(BARDANA_LOCK_KEY) || 'true'); } catch { bardanaLocked = true; }
    }
    function saveBardana(){
      try { localStorage.setItem(BARDANA_KEY, JSON.stringify(bardanaTypes)); } catch{}
      try { localStorage.setItem(BARDANA_LOCK_KEY, JSON.stringify(bardanaLocked)); } catch{}
    }

    function renderBardanaUI(){
      const [bd1,bd2,bd3] = [$('#bd1'),$('#bd2'),$('#bd3')];
      bd1.value = bardanaTypes[0] || '';
      bd2.value = bardanaTypes[1] || '';
      bd3.value = bardanaTypes[2] || '';
      bd1.disabled = bardanaLocked; bd2.disabled = bardanaLocked; bd3.disabled = bardanaLocked;
      $('#applyBardanaBtn').style.display = bardanaLocked ? 'none' : 'inline-block';
      $('#changeBardanaBtn').style.display = bardanaLocked ? 'inline-block' : 'none';
      $('#bardanaChips').innerHTML = bardanaTypes.map((t,i)=>`<span class="chip"><strong>${t}</strong>&nbsp;<small>#${i+1}</small></span>`).join('');
      rebuildEntryTableForBardana();
      updateSubtotal();
    }

    function applyBardana(){
      const vals = [normalizeType($('#bd1').value), normalizeType($('#bd2').value), normalizeType($('#bd3').value)].filter(Boolean);
      const unique = Array.from(new Set(vals)).slice(0,3);
      if (unique.length === 0) { alert('Enter at least one Bardana type.'); return; }
      bardanaTypes = unique;
      bardanaLocked = true; // freeze after apply
      saveBardana();
      renderBardanaUI();
    }
    function changeBardana(){ if (!confirm('Unlock Bardana to edit types?')) return; bardanaLocked = false; saveBardana(); renderBardanaUI(); }

    // Build table header and retrofit rows
    function rebuildEntryTableForBardana(){
      const head = $('#entryHeadRow');
      const dynamic = bardanaTypes.map(bt=>`<th>${bt} (Bags)</th>`).join('');
      head.innerHTML = `
        <th>S.No.</th>
        <th>Firm Name</th>
        ${dynamic}
        <th>Total Bags</th>
        <th>Total Weight</th>
        <th>Action</th>`;

      // Update footer colspan
      const sl = $('#subtotalLabel'); sl.colSpan = 2 + bardanaTypes.length;

      // Preserve values from old rows
      const old = $all('#entryBody tr').map(tr=>{
        const firm = tr.querySelector('.firm')?.value || '';
        const perType = {};
        $all('input.bags', tr).forEach(inp=>{ perType[inp.dataset.bardana] = toIntNonNeg(inp.value||0); });
        if (Object.keys(perType).length===0){
          perType['JUTE NEW'] = toIntNonNeg(tr.querySelector('.jnBags')?.value || 0);
          perType['JUTE PREVIOUS YEAR'] = toIntNonNeg(tr.querySelector('.jpBags')?.value || 0);
        }
        return { firm, perType };
      });
      $('#entryBody').innerHTML = '';
      old.forEach(r=> addRow(r));
      if (old.length===0) addRow();
    }

    /* ===== Existing Part A data/load (unchanged except where noted) ===== */
    let mandiListData = [];
    let firmMapData = {};

    async function loadMandisAndFirms() {
      try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        if (data.success) {
          mandiListData = data.mandis || [];
          firmMapData = data.mandiFirms || {};
          populateMandiDatalist(mandiListData);

          const yearSelect = $("#seasonYear");
          yearSelect.innerHTML = "";
          const currentYear = new Date().getFullYear();
          for (let i=0;i<3;i++){
            const y1=currentYear+i, y2=currentYear+i+1, val=`${y1}-${y2}`;
            const opt=document.createElement("option"); opt.value=val; opt.textContent=val; yearSelect.appendChild(opt);
          }

          const seasonRow = $("#seasonRow");
          seasonRow.style.display = "flex";
          if (data.needsSeason) {
            $("#seasonType").disabled = false;
            $("#seasonYear").disabled = false;
            $("#seasonRate").disabled = false;
          } else {
            $("#seasonType").value = data.seasonData.season || "";
            $("#seasonYear").value = data.seasonData.year || "";
            $("#seasonRate").value = data.seasonData.rate || "";
            $("#seasonType").disabled = true;
            $("#seasonYear").disabled = true;
            $("#seasonRate").disabled = true;
          }
        } else {
          $("#status").textContent = "❌ Failed to load data.";
        }
      } catch (err) {
        $("#status").textContent = "❌ Error loading Mandi list.";
        console.error(err);
      }
    }

    function populateMandiDatalist(mandis) { const dl = $("#mandiList"); dl.innerHTML = ""; mandis.forEach(m => { const opt=document.createElement("option"); opt.value=m; dl.appendChild(opt); }); }
    function firmsForCurrentMandi(){ const mandi=$("#mandiName").value.trim(); return (firmMapData[mandi]||[]).slice().sort(); }
    function refreshFirmDatalists() { const firms = firmsForCurrentMandi(); $all("#entryBody tr").forEach(tr => { const listId = tr.querySelector(".firm").getAttribute("list"); const dl = document.getElementById(listId); if(!dl) return; dl.innerHTML = ""; firms.forEach(f => { const opt=document.createElement("option"); opt.value=f; dl.appendChild(opt); }); }); }

    function addRow(prefill) {
      const tbody = $("#entryBody");
      const sn = tbody.children.length + 1;
      const tr = document.createElement("tr");

      let cells = '';
      bardanaTypes.forEach(bt=>{
        const v = prefill?.perType?.[bt] ?? 0;
        cells += `<td><input type="number" class="bags" data-bardana="${bt}" value="${v}" min="0" step="1" oninput="sanitizeInt(this); updateSubtotal()" /></td>`;
      });

      tr.innerHTML = `
        <td>${sn}</td>
        <td>
          <input type="text" class="firm" list="firmList_${sn}" placeholder="Type or select firm" required />
          <datalist id="firmList_${sn}"></datalist>
        </td>
        ${cells}
        <td><input type="text" class="rowTotalBags" value="0" readonly /></td>
        <td><input type="text" class="rowTotalWeight" value="0" readonly /></td>
        <td><button type="button" class="btn-del" onclick="removeRow(this)">Delete</button></td>`;

      tbody.appendChild(tr);
      if (prefill?.firm) tr.querySelector('.firm').value = prefill.firm;
      refreshFirmDatalists();
      updateSubtotal();
    }

    function sanitizeInt(el){ el.value = toIntNonNeg(el.value); }
    function renumberRows(){ $all("#entryBody tr").forEach((tr,i)=> tr.children[0].textContent = i+1); }
    function removeRow(btn){ btn.closest("tr").remove(); renumberRows(); updateSubtotal(); }

    function updateSubtotal() {
      let tb=0, tw=0;
      const seasonType = $("#seasonType").value;
      const wpb = seasonType==="Paddy Season" ? 0.375 : 0.50;
      const dec = seasonType==="Paddy Season" ? 3 : 2;

      $all("#entryBody tr").forEach(tr=>{
        const bags = $all('input.bags', tr).reduce((s,inp)=> s + toIntNonNeg(inp.value||0), 0);
        const w = +(bags * wpb).toFixed(dec);
        tr.querySelector(".rowTotalBags").value = bags;
        tr.querySelector(".rowTotalWeight").value = w.toFixed(dec);
        tb += bags; tw += w;
      });

      $("#subtotalBags").textContent = tb;
      $("#subtotalWeight").textContent = tw.toFixed(dec);
    }

    async function validatePurchaseDateStrictlyIncreasing(mandi, purchaseIsoDate) {
      const urlAll = `${SCRIPT_URL}?action=getReport&date=${encodeURIComponent("ALL")}&mandi=${encodeURIComponent(mandi)}`;
      try {
        const res = await fetch(urlAll);
        const data = await res.json();
        if (!data.success) return { ok:true };
        const rows = Array.isArray(data.rows) ? data.rows : [];
        if (!rows.length) return { ok:true };
        const dates = rows.map(r=>r.date).filter(Boolean);
        const latest = maxIsoDate(dates);
        if (!latest) return { ok:true };
        if (purchaseIsoDate <= latest) {
          return { ok:false, msg:`❌ Date must be after the last entry for this mandi. Last date is ${formatDate(latest)}.` };
        }
        return { ok:true };
      } catch {
        return { ok:false, msg:"❌ Could not verify date against previous entries. Please try again." };
      }
    }

    async function submitData() {
      const date = $("#purchaseDate").value;
      const mandi = $("#mandiName").value.trim();
      if (!date || !mandi) { $("#status").textContent="❌ Please fill Date and Mandi Name."; return; }

      if (!bardanaTypes.length) { $("#status").textContent = '❌ Please configure Bardana types first.'; return; }

      $("#status").textContent = "Checking date…";
      const check = await validatePurchaseDateStrictlyIncreasing(mandi, date);
      if (!check.ok) { $("#status").textContent = check.msg || "❌ Invalid date selection."; return; }

      const firmSeen = new Set();
      let duplicateFirm = null;
      $all("#entryBody tr").forEach(tr=>{
        const f = tr.querySelector(".firm").value.trim().toUpperCase();
        if (!f) return;
        if (firmSeen.has(f)) duplicateFirm = f; else firmSeen.add(f);
      });
      if (duplicateFirm) { $("#status").textContent=`❌ Firm "${duplicateFirm}" is entered more than once for this date & mandi.`; return; }

      // Save season if needed (unchanged)
      if (!$("#seasonType").disabled) {
        const season = $("#seasonType").value, year=$("#seasonYear").value, rate=$("#seasonRate").value;
        if (!season || !year || !rate) { $("#status").textContent="❌ Please fill Season, Year, and Rate."; return; }
        const fd2 = new FormData(); fd2.append("action","saveSeason"); fd2.append("season",season); fd2.append("year",year); fd2.append("rate",rate);
        try { await fetch(SCRIPT_URL, { method:"POST", body:fd2 }); } catch(_) {}
      }

      const seasonType = $("#seasonType").value;
      const wpb = seasonType==="Paddy Season" ? 0.375 : 0.50;
      const dec = seasonType==="Paddy Season" ? 3 : 2;

      const rows = [];
      $all("#entryBody tr").forEach(tr=>{
        const firm = tr.querySelector(".firm").value.trim();
        if (!firm) return;
        $all('input.bags', tr).forEach(inp=>{
          const bags = toIntNonNeg(inp.value||0);
          if (bags>0){ rows.push({ firm, bardana: inp.dataset.bardana, bags, weight:+(bags*wpb).toFixed(dec) }); }
        });
      });
      if (!rows.length) { $("#status").textContent="❌ Please enter at least one non-zero bags value."; return; }

      const fd = new FormData();
      fd.append("payload", JSON.stringify({ date, mandi, rows }));

      $("#status").textContent = "Saving…";
      try {
        const res = await fetch(SCRIPT_URL, { method:"POST", body: fd });
        let msg = "✅ Saved successfully!";
        try { const data = await res.json(); if (data && data.success) msg = `✅ Saved ${data.inserted} rows successfully!`; } catch(_){ }
        $("#status").textContent = msg;
        setTimeout(()=>location.reload(), 1200);
      } catch (err) { $("#status").textContent = "❌ Error saving data: " + err; }
    }

    // Init Part A
    loadBardana();
    renderBardanaUI();
    document.getElementById('applyBardanaBtn').addEventListener('click', applyBardana);
    document.getElementById('changeBardanaBtn').addEventListener('click', changeBardana);

    loadMandisAndFirms();
    addRow();
    $("#mandiName").addEventListener("change", refreshFirmDatalists);
    $("#mandiName").addEventListener("input", refreshFirmDatalists);

    /* ===== PART B: REPORT (Dynamic Bardana) ===== */
    let mandiDates = {};        // mandi => [dates]
    let currentSeason = { season:'', year:'', rate:0 };
    let allMandis = [];

    async function loadDataForReport() {
      try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        if (data.success) {
          mandiDates = data.mandiDates || {};
          allMandis = data.mandis || [];
          const rm = $("#reportMandi");
          rm.innerHTML = `<option value="ALL">ALL</option>` + allMandis.map(m => `<option value="${m}">${m}</option>`).join("");
          if (data.seasonData) {
            currentSeason.season = data.seasonData.season || '';
            currentSeason.year = data.seasonData.year || '';
            currentSeason.rate = Number(data.seasonData.rate || 0);
          }
          updateReportDates();
        } else {
          $("#reportStatus").textContent = "❌ Could not load report metadata.";
        }
      } catch (err) { console.error(err); $("#reportStatus").textContent = "❌ Error loading report metadata."; }
    }

    function updateReportDates() {
      const mandi = $("#reportMandi").value;
      const dd = $("#reportDate"); dd.innerHTML = "";
      let dates = [];
      if (mandi === "ALL") { Object.values(mandiDates).forEach(arr => { if (Array.isArray(arr)) dates.push(...arr); }); }
      else { dates = mandiDates[mandi] || []; }
      dates = Array.from(new Set(dates)).sort();

      const allOpt = document.createElement("option"); allOpt.value = "ALL"; allOpt.textContent = "ALL"; dd.appendChild(allOpt);
      if (!dates.length) { const o = document.createElement("option"); o.value=""; o.textContent="No dates available"; dd.appendChild(o); }
      else { dates.forEach(d => { const o=document.createElement("option"); o.value=d; o.textContent=formatDate(d); dd.appendChild(o); }); }
    }
    $("#reportMandi").addEventListener("change", updateReportDates);

    async function fetchAllRowsForMandi(mandi) {
      const url = `${SCRIPT_URL}?action=getReport&date=${encodeURIComponent("ALL")}&mandi=${encodeURIComponent(mandi)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) return { rows: [], rate: currentSeason.rate || 0 };
      return { rows: data.rows || [], rate: Number(data.rate || currentSeason.rate || 0) };
    }

    const useRangeEl = document.getElementById("useRange");
    const rangeWrap  = document.getElementById("rangeWrap");
    const rangeWrap2 = document.getElementById("rangeWrap2");
    const fromDateEl = document.getElementById("fromDate");
    const toDateEl   = document.getElementById("toDate");

    function ymd(d){ return (d || '').trim(); }
    function ymdCmp(a,b){ if(a===b) return 0; return a < b ? -1 : 1; }
    function isWithinInclusive(d, from, to){ if (from && ymdCmp(d, from) < 0) return false; if (to && ymdCmp(d, to) > 0) return false; return true; }

    useRangeEl.addEventListener("change", () => {
      const on = useRangeEl.checked;
      rangeWrap.style.display  = on ? "block" : "none";
      rangeWrap2.style.display = on ? "block" : "none";

      if (on) {
        const mandi = document.getElementById("reportMandi").value;
        let dates = [];
        if (mandi === "ALL") { Object.values(mandiDates).forEach(arr => { if (Array.isArray(arr)) dates.push(...arr); }); }
        else { dates = mandiDates[mandi] || []; }
        dates = Array.from(new Set(dates)).sort();
        if (dates.length) { fromDateEl.value = dates[0]; toDateEl.value = dates[dates.length - 1]; }
      }
    });

    document.getElementById("reportMandi").addEventListener("change", () => { if (useRangeEl.checked) useRangeEl.dispatchEvent(new Event("change")); });

    // ===== Helpers for dynamic Bardana in REPORT =====
    function sumPerType(rows){
      const m = new Map();
      rows.forEach(r=>{ const t = normalizeType(r.bardana||''); const b = Number(r.bags||0); if (!t) return; m.set(t, (m.get(t)||0)+b); });
      return m; // Map(type => bags)
    }
    function mergeTypeMaps(a,b){ const out = new Map(a); b.forEach((v,k)=> out.set(k, (out.get(k)||0)+v)); return out; }
    function orderedTypesUpToDate(totalsMap, date){
      const datesAsc = Array.from(totalsMap.keys()).sort();
      const set = new Set();
      datesAsc.forEach(dk=>{ if (dk<=date){ const tMap = totalsMap.get(dk)?.perType || new Map(); Array.from(tMap.keys()).forEach(t=>{ if(!set.has(t)) set.add(t); }); } });
      return Array.from(set); // in order of first appearance
    }

    async function generateReport() {
      const selectedDate = $("#reportDate").value;
      const mandiSel = $("#reportMandi").value;
      if (!mandiSel) { $("#reportStatus").textContent = "Select mandi"; return; }
      $("#reportStatus").textContent = "Loading report…";

      const signURL = getSignatureDataURL();

      try {
        let mandiBlocks = [];
        if (mandiSel === "ALL") {
          const perMandiData = [];
          for (const m of allMandis) { const x = await fetchAllRowsForMandi(m); x.rows.sort((a,b)=> (a.date||"").localeCompare(b.date||"") || (a.firm||"").localeCompare(b.firm||"")); perMandiData.push({ mandi: m, rows: x.rows, rate: x.rate }); }
          perMandiData.sort((a,b)=> (a.mandi||"").localeCompare(b.mandi||""));
          perMandiData.forEach(md=>{
            const byDate = new Map(); md.rows.forEach(r=>{ const k=r.date||""; if(!byDate.has(k)) byDate.set(k,[]); byDate.get(k).push(r); });
            const datesAsc = Array.from(byDate.keys()).sort();
            let datesToRender; if (useRangeEl.checked) { const from = ymd(fromDateEl.value); const to   = ymd(toDateEl.value); if (from && to && ymdCmp(from, to) > 0) { $("#reportStatus").textContent = "❌ From-date is after To-date."; $("#reportOutput").innerHTML = ""; mandiBlocks = []; return; } datesToRender = datesAsc.filter(d => isWithinInclusive(d, from, to)); } else { datesToRender = selectedDate === "ALL" ? datesAsc : datesAsc.filter(d => d === selectedDate); }
            if (datesToRender.length === 0) return;
            const blocks = datesToRender.map(dk => ({ date: dk, rows: byDate.get(dk) || [], rate: md.rate, totalsMap: byDate }));
            const firstRenderedDate = datesToRender[0];
            const snStart = firstRenderedDate ? (md.rows.filter(r => (r.date || "") < firstRenderedDate).length + 1) : 1;
            const pageStartIndex = firstRenderedDate ? datesAsc.findIndex(d => d === firstRenderedDate) : 0;
            mandiBlocks.push({ mandi: md.mandi, blocks, snStart, pageStartIndex });
          });
        } else {
          const { rows: allRows, rate } = await fetchAllRowsForMandi(mandiSel);
          allRows.sort((a,b)=> (a.date||"").localeCompare(b.date||"") || (a.firm||"").localeCompare(b.firm||""));
          const byDate = new Map(); allRows.forEach(r=>{ const k=r.date||""; if(!byDate.has(k)) byDate.set(k,[]); byDate.get(k).push(r); });
          const datesAsc = Array.from(byDate.keys()).sort();
          let datesToRender; if (useRangeEl.checked) { const from = ymd(fromDateEl.value); const to   = ymd(toDateEl.value); if (from && to && ymdCmp(from, to) > 0) { $("#reportStatus").textContent = "❌ From-date is after To-date."; $("#reportOutput").innerHTML = ""; return; } datesToRender = datesAsc.filter(d => isWithinInclusive(d, from, to)); } else { datesToRender = selectedDate === "ALL" ? datesAsc : datesAsc.filter(d => d === selectedDate); }
          if (datesToRender.length === 0) { $("#reportStatus").textContent = "No data to display."; $("#reportOutput").innerHTML = ""; return; }
          const blocks = datesToRender.map(dk => ({ date: dk, rows: byDate.get(dk) || [], rate, totalsMap: byDate }));
          const firstRenderedDate = datesToRender[0];
          const snStart = firstRenderedDate ? (allRows.filter(r => (r.date || "") < firstRenderedDate).length + 1) : 1;
          const pageStartIndex = firstRenderedDate ? datesAsc.findIndex(d => d === firstRenderedDate) : 0;
          mandiBlocks.push({ mandi: mandiSel, blocks, snStart, pageStartIndex });
        }

        if (!mandiBlocks.length) { $("#reportStatus").textContent = "No data to display."; $("#reportOutput").innerHTML=""; return; }

        // Precompute totals per mandi/date with per-type
        const totalsByMandi = new Map();
        async function ensureTotalsForMandi(m) {
          if (totalsByMandi.has(m)) return;
          const { rows, rate } = await fetchAllRowsForMandi(m);
          rows.sort((a,b)=> (a.date||"").localeCompare(b.date||""));
          const byDate = new Map(); rows.forEach(r=>{ const k=r.date||""; if(!byDate.has(k)) byDate.set(k,[]); byDate.get(k).push(r); });
          const tMap = new Map();
          Array.from(byDate.keys()).sort().forEach(dk=>{
            let b=0,w=0,a=0; const dayRows = byDate.get(dk)||[]; const perType = sumPerType(dayRows);
            dayRows.forEach(r=>{ const bb=Number(r.bags||0), ww=Number(r.weight||0); const aa=ww*rate; b+=bb; w+=ww; a+=aa; });
            tMap.set(dk, {b,w,a,perType});
          });
          totalsByMandi.set(m, { totals: tMap, rate });
        }

        let html = "";
        for (let mi = 0; mi < mandiBlocks.length; mi++) {
          const mandiName = mandiBlocks[mi].mandi;
          const isFirstMandi = mi === 0;
          await ensureTotalsForMandi(mandiName);
          const { totals, rate: mandiRate } = totalsByMandi.get(mandiName);

          html += `<div class="mandi-section ${isFirstMandi ? 'first' : ''}">`;
          let sn = mandiBlocks[mi].snStart || 1; let pageNo = mandiBlocks[mi].pageStartIndex || 0;

          // Carry-forward accumulators
          let prevCarry = {B:0,W:0,A:0, perType: new Map()};
const sortedAllDates = Array.from(totals.keys()).sort();
// Prefill carry-forward for the first rendered date in this mandi section
const firstRenderedDate = (mandiBlocks[mi].blocks && mandiBlocks[mi].blocks.length)
  ? mandiBlocks[mi].blocks[0].date : null;
if (firstRenderedDate) {
  sortedAllDates.forEach(dk => {
    if (dk < firstRenderedDate) {
      const t = totals.get(dk) || { b:0, w:0, a:0, perType: new Map() };
      prevCarry.B += Number(t.b||0);
      prevCarry.W += Number(t.w||0);
      prevCarry.A += Number(t.a||0);
      (t.perType||new Map()).forEach((v,k)=>{ prevCarry.perType.set(k,(prevCarry.perType.get(k)||0)+Number(v||0)); });
    }
  });
}
          for (let bi = 0; bi < mandiBlocks[mi].blocks.length; bi++) {
            const blk = mandiBlocks[mi].blocks[bi]; pageNo++;
            const dayRows = blk.rows;
            const rate = (typeof blk.rate === 'number' ? blk.rate : mandiRate || 0);

            // Types to show up to this date (first appearance order)
            const typesForHeader = orderedTypesUpToDate(totals, blk.date);

            // Today's totals
            let todayB=0,todayW=0,todayA=0; const todayTypeMap = sumPerType(dayRows);
            dayRows.forEach(r=>{ const b=Number(r.bags||0), w=Number(r.weight||0), a=w*rate; todayB += b; todayW += w; todayA += a; });

            // Previous totals strictly before this date
            const prevTypeMap = new Map(prevCarry.perType);

            const uptoB=prevCarry.B+todayB, uptoW=prevCarry.W+todayW, uptoA=prevCarry.A+todayA;
            const uptoTypeMap = mergeTypeMaps(prevTypeMap, todayTypeMap);

            // Build table
            html += `<div class="report-block ${bi===0 ? 'first-in-section' : ''}">
              <div class="report-header">
                <div class="report-left"><strong>Mandi: ${mandiName}</strong></div>
                <div class="report-title">PG-4 REPORT (${(currentSeason.season||'').toUpperCase()} ${currentSeason.year||''})</div>
                <div class="report-right"><strong>${formatDate(blk.date)} | Page No. ${pageNo}</strong></div>
              </div>
              <table class="report-table" style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Date</th>
                    <th>Firm Name</th>
                    ${typesForHeader.map(t=>`<th>${t}</th>`).join('')}
                    <th>Bags</th>
                    <th>Weight</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>`;

            // Rows: one per entry; show bags under its bardana column
            dayRows.forEach(r=>{
              const b=Number(r.bags||0), w=Number(r.weight||0), a=w*rate; const t = normalizeType(r.bardana||'');
              const perTypeCells = typesForHeader.map(h=> (h===t? b: 0));
              html += `<tr>
                <td>${sn++}</td>
                <td>${formatDate(r.date||"")}</td>
                <td>${r.firm || ""}</td>
                ${perTypeCells.map(v=>`<td>${v}</td>`).join('')}
                <td>${b}</td>
                <td>${w}</td>
                <td>${a.toFixed(2)}</td>
              </tr>`;
            });

            // Footer totals rows with per-type
            const todayTypeCells = typesForHeader.map(t=> `<td>${todayTypeMap.get(t)||0}</td>`).join('');
const prevTypeCells  = typesForHeader.map(t=> `<td>${prevTypeMap.get(t)||0}</td>`).join('');
const uptoTypeCells  = typesForHeader.map(t=> `<td>${uptoTypeMap.get(t)||0}</td>`).join('');

            html += `
              <tr style="background:#f9f9f9;font-weight:bold">
                <td colspan="3">Today's Total</td>
                ${todayTypeCells}
                <td>${todayB}</td>
                <td>${todayW}</td>
                <td>${todayA.toFixed(2)}</td>
              </tr>
              <tr style="background:#fffbe6;font-weight:bold">
                <td colspan="3">Total up to Previous Day</td>
                ${prevTypeCells}
                <td>${prevCarry.B}</td>
                <td>${prevCarry.W}</td>
                <td>${prevCarry.A.toFixed(2)}</td>
              </tr>
              <tr style="background:#e6ffe6;font-weight:bold">
                <td colspan="3">Grand Total up to Today</td>
                ${uptoTypeCells}
                <td>${uptoB}</td>
                <td>${uptoW}</td>
                <td>${uptoA.toFixed(2)}</td>
              </tr>
            </tbody></table>
            <div class="stamp">${signURL ? `<img class="sign-img" src="${signURL}" alt="Digital Sign" />` : ''}INSPECTOR PUNGRAIN<br>${mandiName}</div>
            <div class="after-report-gap"></div>
            </div>`;

            // Update carry forward for next block
            prevCarry = { B:uptoB, W:uptoW, A:uptoA, perType: uptoTypeMap };
          }
          html += `</div>`;
        }

        $("#reportOutput").innerHTML = html;
        $("#reportStatus").textContent = "";
      } catch (err) { console.error(err); $("#reportStatus").textContent = "Error fetching report"; }
    }

    async function ping() { try { await fetch(SCRIPT_URL); $("#reportStatus").textContent = "Ping OK"; } catch { $("#reportStatus").textContent = "Ping failed"; } setTimeout(()=> $("#reportStatus").textContent = "", 1500); }

    async function downloadPDF() {
      const { jsPDF } = window.jspdf;
      const container = document.getElementById("reportOutput");
      if (!container || !container.innerHTML.trim()) { alert("⚠️ No report to download. Please generate a report first."); return; }
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; const maxW = pageWidth - margin*2; const maxH = pageHeight - margin*2; const gapMM = 4;
      const blocks = Array.from(container.querySelectorAll(".report-block")); if (blocks.length === 0) { alert("⚠️ Nothing to export."); return; }
      let currentY = margin; let lastMandiEl = null;
      for (let i = 0; i < blocks.length; i++) { const el = blocks[i]; const thisMandiEl = el.closest(".mandi-section"); if (lastMandiEl && thisMandiEl !== lastMandiEl) { pdf.addPage("a4", "p"); currentY = margin; } lastMandiEl = thisMandiEl; const canvas = await html2canvas(el, { scale: 3, useCORS: true }); const imgData = canvas.toDataURL("image/png"); let imgW = maxW; let imgH = canvas.height * (imgW / canvas.width); if (imgH > maxH) { imgH = maxH; imgW = canvas.width * (imgH / canvas.height); } if (currentY + imgH > pageHeight - margin) { pdf.addPage("a4", "p"); currentY = margin; } const x = (pageWidth - imgW) / 2; pdf.addImage(imgData, "PNG", x, currentY, imgW, imgH); currentY += imgH + gapMM; }
      const mandi = document.getElementById("reportMandi").value || "ALL"; const useRange = document.getElementById("useRange").checked; let dateLabel; if (useRange) { dateLabel = `${document.getElementById("fromDate").value || 'start'}_${document.getElementById("toDate").value || 'end'}`; } else { dateLabel = document.getElementById("reportDate").value || "ALL"; } pdf.save(`Report_${mandi}_${dateLabel}.pdf`);
    }

    loadDataForReport();

// ===== Split from inline <script> blocks (no src) =====

document.addEventListener("DOMContentLoaded", function(){
    var sName = document.getElementById("seasonName");
    var sYear = document.getElementById("seasonYear");
    var seasonInput = document.getElementById("season"); // assuming id=season input exists
    if(seasonInput){
      sName.textContent = seasonInput.value || "";
    }
    var year = new Date().getFullYear();
    sYear.textContent = year;
  });
