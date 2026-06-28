// ═══════════════════════════════════════════════════════════
// EXPORT WEEKLY REPORT (text-based)
// ═══════════════════════════════════════════════════════════
async function exportWeeklyReport() {
  const proj = STATE.currentProject
  if (!proj) { toast('Chưa có dự án', 'error'); return }

  const week = getISOWeek(new Date())
  const year = new Date().getFullYear()

  loading(true, 'Đang tải dữ liệu báo cáo...')
  const { data: aiData } = await sb.from('ai_summaries')
    .select('*').eq('project_id', proj.id)
    .eq('week_number', week).eq('year', year)
    .order('created_at', { ascending: false }).limit(1)
  const aiSummary = aiData?.[0]?.summary_text || null

  const { data: weekPhotos } = await sb.from('task_photos')
    .select('photo_url,caption,taken_at,task_id,tasks(name)')
    .eq('project_id', proj.id)
    .eq('week_number', week).eq('year', year)
    .order('taken_at', { ascending: false })
    .limit(9)
  loading(false)

  // Mở editor để review trước khi xuất PDF
  openReportEditor(aiSummary, weekPhotos, week, year)
}

// ── Editor review báo cáo trước khi xuất PDF ─────────────
function openReportEditor(aiSummary, weekPhotos, week, year) {
  const proj = STATE.currentProject
  const photoCount = weekPhotos?.length || 0

  openModal(`📋 Review báo cáo tuần ${week}/${year}`, `
    <div style="min-height:60vh">
      <div style="background:var(--lblue);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px;
        display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--blue)">
            ${proj.code} — Tuần ${week}/${year}
          </div>
          <div style="font-size:11px;color:var(--gray5);margin-top:2px">
            ${photoCount} ảnh · Có Gantt chart · Có biểu đồ quân số
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${!aiSummary ? `<span style="font-size:11px;color:var(--amber);background:#FEF3C7;padding:4px 10px;border-radius:6px">
            ⚠️ Chưa có AI tóm tắt — nội dung sẽ trống
          </span>` : `<span style="font-size:11px;color:var(--green);background:#DCFCE7;padding:4px 10px;border-radius:6px">
            ✅ Đã có AI tóm tắt tuần này
          </span>`}
        </div>
      </div>

      <!-- Editor nội dung AI -->
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:6px;
          display:flex;justify-content:space-between;align-items:center">
          <span>✏️ Nội dung phân tích AI (có thể chỉnh sửa trước khi xuất)</span>
          <button onclick="resetReportContent()" class="btn btn-secondary btn-sm" style="font-size:11px">
            ↩ Reset về AI gốc
          </button>
        </div>
        <textarea id="report-ai-content"
          style="width:100%;height:340px;padding:12px;font-size:13px;line-height:1.7;
            border:1px solid var(--gray3);border-radius:var(--radius);resize:vertical;
            font-family:'Segoe UI',sans-serif;color:var(--gray8)"
          placeholder="Chưa có nội dung AI. Bấm 'AI Tóm tắt tiến độ' trước để tạo nội dung."
          spellcheck="false">${aiSummary || ''}</textarea>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:11px;color:var(--gray4)">
            Chỉnh sửa trực tiếp trong ô này — thay đổi sẽ được xuất vào PDF
          </span>
          <span id="report-char-count" style="font-size:11px;color:var(--gray4)">
            ${(aiSummary||'').length} ký tự
          </span>
        </div>
      </div>

      <!-- Ghi chú thêm của KTTC -->
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:6px">
          📝 Ghi chú thêm của KTTC (tuỳ chọn — xuất hiện cuối báo cáo)
        </div>
        <textarea id="report-kttc-note"
          style="width:100%;height:72px;padding:10px 12px;font-size:13px;
            border:1px solid var(--gray3);border-radius:var(--radius);resize:vertical;
            font-family:'Segoe UI',sans-serif;color:var(--gray8)"
          placeholder="VD: Tuần tới ưu tiên đẩy LK1, họp CĐT ngày 15/6 về phát sinh..."></textarea>
      </div>

      <!-- Ảnh đính kèm báo cáo -->
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:8px;
          display:flex;justify-content:space-between;align-items:center">
          <span>📎 Ảnh đính kèm báo cáo (cảnh báo / tham khảo công tác sắp tới)</span>
          <span style="font-size:11px;color:var(--gray4);font-weight:400">Tối đa 6 ảnh · Xuất thành section riêng trong PDF</span>
        </div>

        <!-- 2 nguồn ảnh -->
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openReportPhotoLibrary()"
            style="font-size:12px">
            🖼️ Chọn từ thư viện tuần này
          </button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;font-size:12px;margin:0">
            ⬆️ Upload ảnh mới
            <input type="file" id="report-photo-upload" accept="image/*" multiple
              style="display:none" onchange="handleReportPhotoUpload(this)">
          </label>
        </div>

        <!-- Grid ảnh đã chọn -->
        <div id="report-photo-grid"
          style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;min-height:40px">
          <div style="grid-column:1/-1;text-align:center;color:var(--gray4);font-size:12px;
            padding:16px;border:1px dashed var(--gray3);border-radius:var(--radius)">
            Chưa có ảnh đính kèm — chọn từ thư viện hoặc upload mới
          </div>
        </div>

        <!-- Modal chọn từ thư viện -->
        <div id="report-library-modal" style="display:none;position:fixed;inset:0;
          background:rgba(0,0,0,.5);z-index:500;align-items:center;justify-content:center;padding:20px">
          <div style="background:white;border-radius:12px;width:100%;max-width:640px;
            max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)">
            <div style="padding:16px 20px;border-bottom:1px solid var(--gray2);
              display:flex;justify-content:space-between;align-items:center">
              <h3 style="font-size:15px;font-weight:600">🖼️ Chọn ảnh từ thư viện tuần này</h3>
              <button onclick="document.getElementById('report-library-modal').style.display='none'"
                style="background:none;border:none;font-size:20px;color:var(--gray4);cursor:pointer">✕</button>
            </div>
            <div id="report-library-grid"
              style="padding:16px;overflow-y:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              <div style="grid-column:1/-1;text-align:center;color:var(--gray4);padding:20px">
                Đang tải ảnh...
              </div>
            </div>
            <div style="padding:12px 20px;border-top:1px solid var(--gray2);text-align:right">
              <button class="btn btn-secondary btn-sm"
                onclick="document.getElementById('report-library-modal').style.display='none'">
                Xong
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `, `
    <div style="display:flex;align-items:center;gap:8px;width:100%;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--gray5)">
          PDF: AI · <span id="report-photo-count-label">Ảnh thi công (${photoCount})</span> · Tiến độ · Gantt · Quân số
        </span>
        <button class="btn btn-secondary btn-sm" onclick="openPhotoSelector()"
          style="font-size:11px;white-space:nowrap">
          🖼️ Chọn & sắp xếp ảnh thi công
        </button>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="renderWeeklyPDF()">
          📄 Xuất PDF
        </button>
      </div>
    </div>
  `)

  // Reset mỗi lần mở editor mới
  window._reportAttachments = []
  window._selectedPhotos    = null  // null = dùng auto (9 mới nhất)

  // Lưu dữ liệu vào STATE để renderWeeklyPDF dùng
  STATE._reportData = { aiSummary, weekPhotos, week, year }

  // Modal lớn hơn
  const m = document.querySelector('.modal')
  m.style.maxWidth = '700px'
  m.style.maxHeight = '92vh'

  // Đếm ký tự realtime
  document.getElementById('report-ai-content').addEventListener('input', function() {
    const el = document.getElementById('report-char-count')
    if (el) el.textContent = this.value.length + ' ký tự'
  })
}

function resetReportContent() {
  const ta = document.getElementById('report-ai-content')
  if (!ta || !STATE._reportData) return
  ta.value = STATE._reportData.aiSummary || ''
  const el = document.getElementById('report-char-count')
  if (el) el.textContent = ta.value.length + ' ký tự'
  toast('Đã reset về nội dung AI gốc', '')
}

async function renderWeeklyPDF() {
  const ta       = document.getElementById('report-ai-content')
  const noteEl   = document.getElementById('report-kttc-note')
  const editedAI = ta?.value || ''
  const kttcNote = noteEl?.value?.trim() || ''
  document.querySelectorAll('#report-photo-grid input[type="text"]').forEach((inp, i) => {
    if (window._reportAttachments[i]) window._reportAttachments[i].caption = inp.value
  })
  if (!STATE._reportData) { toast('Lỗi: không có dữ liệu báo cáo', 'error'); return }
  const { weekPhotos, week, year } = STATE._reportData
  closeModal()
  loading(true, 'Đang tạo PDF báo cáo tuần...')
  try {
    const wk = week, yr = year
    const LOGO_URL = 'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png'
    const proj = STATE.currentProject, tasks = STATE.tasks, leaf = tasks.filter(t => !t.is_summary)
    const today = new Date().toLocaleDateString('vi-VN')
    if (typeof computeRollupMoney === 'function' && tasks[0]?._contractValue === undefined) computeRollupMoney(tasks)
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalCV = rootTask?._contractValue || 0, totalEV = rootTask?._earnedValue || 0, totalPct = rootTask?.display_pct || 0
    const leafWithPrice = leaf.filter(t => (t.unit_price||0) > 0)
    let totalPV = 0
    if (leafWithPrice.length > 0) {
      const now = new Date(); now.setHours(0,0,0,0)
      totalPV = leafWithPrice.reduce((s, t) => {
        const cv = (t.unit_price||0)*(t.planned_quantity||1)
        const [sy,sm,sd] = (t.kh_start||'').split('-').map(Number), [ey,em,ed] = (t.kh_finish||'').split('-').map(Number)
        if (!sy||!ey) return s
        const start = new Date(sy,sm-1,sd), end = new Date(ey,em-1,ed)
        if (now < start) return s; if (now >= end) return s+cv
        return s+cv*(now-start)/(end-start)
      }, 0)
    }
    const spi = totalPV > 0 ? totalEV/totalPV : null
    let evLastWeek = 0
    try {
      const lwn=wk>1?wk-1:52, lwy=wk>1?yr:yr-1
      const { data: lp } = await sb.from('task_progress').select('task_id,pct_complete,week_number').eq('project_id',proj.id).lte('week_number',lwn).eq('year',lwy).order('week_number',{ascending:false}).order('updated_at',{ascending:false})
      if (lp?.length) { const lm={}; lp.forEach(p=>{ if(!lm[p.task_id]) lm[p.task_id]=p.pct_complete||0 }); evLastWeek=leafWithPrice.reduce((s,t)=>s+(t.unit_price||0)*(t.planned_quantity||1)*(lm[t.id]||0)/100,0) }
    } catch(e) {}
    const evThisWeek = totalEV - evLastWeek  // cho phép âm — nhất quán với sanluong.js
    const fmtM = v => { if(!v||v===0)return'—'; if(Math.abs(v)>=1e9)return(v/1e9).toFixed(1)+'tỷ'; if(Math.abs(v)>=1e6)return Math.round(v/1e6)+'tr'; return Math.round(v/1e3)+'k' }

    // ── 4 card mới ──────────────────────────────────────────
    // Card 3: Tiến độ thời gian vs sản lượng
    const projStart = tasks.filter(t=>t.kh_start).map(t=>new Date(t.kh_start)).sort((a,b)=>a-b)[0]
    const projEnd   = tasks.filter(t=>t.kh_finish).map(t=>new Date(t.kh_finish)).sort((a,b)=>b-a)[0]
    const today0    = new Date(); today0.setHours(0,0,0,0)
    let timePct = null, daysLeft = null, totalDays = null
    if (projStart && projEnd) {
      totalDays = Math.round((projEnd - projStart) / 86400000)
      daysLeft  = Math.max(0, Math.round((projEnd - today0) / 86400000))
      timePct   = Math.min(100, Math.round((today0 - projStart) / (projEnd - projStart) * 100))
    }
    const slPct   = totalCV > 0 ? Math.round(totalEV / totalCV * 100) : 0
    // SPI-based card 3 — đúng EVM, không dùng % thời gian
    const spiClr  = !spi ? '#64748B' : spi >= 1 ? '#16A34A' : spi >= 0.8 ? '#D97706' : '#DC2626'
    const spiLabel = !spi ? '—'
      : spi >= 1   ? `✅ Vượt KH ${Math.round((spi-1)*100)}%`
      : spi >= 0.8 ? `⚠️ Chậm ${Math.round((1-spi)*100)}% so với KH`
      :              `🔴 Chậm ${Math.round((1-spi)*100)}% so với KH`

    // Card 4: Quân số TB 7 ngày gần nhất
    let avgCNWeek = null
    if (STATE._attendanceData?.history?.length) {
      const hist7 = STATE._attendanceData.history.slice(-7)
      const total7 = hist7.reduce((s, d) => s + (d.cn_proj || 0), 0)
      avgCNWeek = Math.round(total7 / hist7.length)
    }

    const evmCardsHtml = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <!-- Card 1: SL tuần này -->
      <div style="background:#EFF6FF;border-radius:8px;padding:12px;text-align:center;border:1px solid #BFDBFE">
        <div style="font-size:9px;color:#1D4ED8;font-weight:700;letter-spacing:.05em;margin-bottom:4px">SẢN LƯỢNG TUẦN NÀY</div>
        <div style="font-size:26px;font-weight:800;color:${evThisWeek<0?'#DC2626':'#1D4ED8'};line-height:1.1">
          ${evThisWeek<0?'':'+'}${fmtM(evThisWeek)}
        </div>
        <div style="font-size:10px;color:#64748B;margin-top:4px">EV delta tuần ${wk}</div>
      </div>
      <!-- Card 2: Tổng giá trị HĐ -->
      <div style="background:#F8FAFC;border-radius:8px;padding:12px;text-align:center;border:1px solid #E2E8F0">
        <div style="font-size:9px;color:#475569;font-weight:700;letter-spacing:.05em;margin-bottom:4px">TỔNG GIÁ TRỊ HỢP ĐỒNG</div>
        <div style="font-size:26px;font-weight:800;color:#1A2B4A;line-height:1.1">${totalCV>0?fmtM(totalCV):'—'}</div>
        <div style="font-size:10px;color:#64748B;margin-top:4px">EV: ${fmtM(totalEV)} · Đạt ${slPct}%</div>
      </div>
      <!-- Card 3: SPI -->
      <div style="background:${spiClr}10;border-radius:8px;padding:12px;text-align:center;border:1px solid ${spiClr}30">
        <div style="font-size:9px;color:${spiClr};font-weight:700;letter-spacing:.05em;margin-bottom:4px">HIỆU SUẤT TIẾN ĐỘ (SPI)</div>
        <div style="font-size:32px;font-weight:800;color:${spiClr};line-height:1.1">${spi?spi.toFixed(2):'—'}</div>
        <div style="font-size:11px;font-weight:700;color:${spiClr};margin-top:2px">${spiLabel}</div>
        <div style="font-size:10px;color:#64748B;margin-top:4px">EV: ${fmtM(totalEV)} · PV: ${fmtM(totalPV)}${daysLeft!==null?` · Còn ${daysLeft} ngày`:''}</div>
      </div>
      <!-- Card 4: Quân số TB tuần -->
      <div style="background:#F0FDF4;border-radius:8px;padding:12px;text-align:center;border:1px solid #BBF7D0">
        <div style="font-size:9px;color:#166534;font-weight:700;letter-spacing:.05em;margin-bottom:4px">QUÂN SỐ TB TUẦN</div>
        <div style="font-size:26px;font-weight:800;color:#16A34A;line-height:1.1">${avgCNWeek!==null?avgCNWeek:'—'}</div>
        <div style="font-size:10px;color:#64748B;margin-top:4px">CN/ngày · TB 7 ngày gần nhất</div>
      </div>
    </div>`

    // S-Curve
    let scurveSvgHtml = ''
    try {
      const { data: allProg } = await sb.from('task_progress').select('task_id,pct_complete,week_number,year').eq('project_id',proj.id).order('year').order('week_number').order('updated_at',{ascending:false})
      if (allProg?.length && leafWithPrice.length > 0) {
        const taskHist={}; allProg.forEach(p=>{if(!taskHist[p.task_id])taskHist[p.task_id]=[];taskHist[p.task_id].push(p)})
        // Fix: dùng bestWk logic — nhất quán với sanluong.js/compare.js/dashboard.js
        const getPct=(tid,wkn,yrn)=>{let b=null,bwk=-1;(taskHist[tid]||[]).forEach(p=>{if(p.year<yrn||(p.year===yrn&&p.week_number<=wkn)){if(p.week_number>bwk){bwk=p.week_number;b=p.pct_complete??0}}});return b??0}
        const wkMap={}; allProg.forEach(p=>{const k=`${p.year}-${String(p.week_number).padStart(2,'0')}`;wkMap[k]={week:p.week_number,year:p.year}})
        const wks=Object.keys(wkMap).sort().slice(-12), evArr=[], pvArr=[], lblArr=[]
        wks.forEach(k=>{
          const {week:wkn,year:yrn}=wkMap[k]; lblArr.push('T'+wkn)
          const ev=leafWithPrice.reduce((s,t)=>s+(t.unit_price||0)*(t.planned_quantity||1)*getPct(t.id,wkn,yrn)/100,0)
          const wkEnd=new Date(yrn,0,4); const dow=wkEnd.getDay()||7; wkEnd.setDate(wkEnd.getDate()-dow+1+(wkn-1)*7+6)
          const pv=leafWithPrice.reduce((s,t)=>{const cv=(t.unit_price||0)*(t.planned_quantity||1);const [sy,sm,sd]=(t.kh_start||'').split('-').map(Number);const [ey,em,ed]=(t.kh_finish||'').split('-').map(Number);if(!sy||!ey)return s;const st=new Date(sy,sm-1,sd),en=new Date(ey,em-1,ed);if(wkEnd<st)return s;if(wkEnd>=en)return s+cv;return s+cv*(wkEnd-st)/(en-st)},0)
          evArr.push(ev);pvArr.push(pv)
        })
        const n=lblArr.length,W=860,H=180,PL=65,PR=16,PT=16,PB=38,cW=W-PL-PR,cH=H-PT-PB
        const maxV=Math.max(...evArr,...pvArr,totalCV,1),xC=i=>PL+i*(cW/n)+cW/(n*2),yC=v=>PT+cH-Math.round(v/maxV*cH)
        const fB=v=>{if(!v)return'0';if(v>=1e9)return(v/1e9).toFixed(1)+'tỷ';if(v>=1e6)return Math.round(v/1e6)+'tr';return Math.round(v/1e3)+'k'}
        const barW=Math.max(10,Math.floor(cW/n)-8)
        // Bars: delta EV tuần, cho phép âm
        const bars=evArr.map((ev,i)=>{
          const d=ev-(i>0?evArr[i-1]:0)
          const isNeg=d<0, absD=Math.abs(d)
          const h=Math.max(2,Math.round(absD/maxV*cH))
          const x=PL+i*(cW/n)+(cW/n-barW)/2
          const y=isNeg?PT+cH:PT+cH-h
          const clr=isNeg?'#DC2626':'#2563EB'
          return`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${clr}" rx="2" opacity="0.75"/>${d!==0?`<text x="${x+barW/2}" y="${PT+cH+13}" text-anchor="middle" font-size="9" fill="${clr}" font-weight="600">${isNeg?'-':''}${fB(absD)}</text>`:''}`
        }).join('')
        const evPts=evArr.map((v,i)=>`${xC(i)},${yC(v)}`).join(' '),pvPts=pvArr.map((v,i)=>`${xC(i)},${yC(v)}`).join(' ')
        const hdY=totalCV>0?yC(totalCV):-1
        const yT=[0,.25,.5,.75,1].map(r=>{const y=PT+cH-r*cH;return`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="#E2E8F0" stroke-width="0.5"/><text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#94A3B8">${fB(r*maxV)}</text>`}).join('')
        const xL=lblArr.map((l,i)=>`<text x="${xC(i)}" y="${H-5}" text-anchor="middle" font-size="9" fill="#64748B">${l}</text>`).join('')
        const spiV=pvArr[n-1]>0?evArr[n-1]/pvArr[n-1]:null,spiC=!spiV?'#64748B':spiV>=1?'#16A34A':spiV>=0.8?'#D97706':'#DC2626'
        scurveSvgHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;align-items:center"><span>📈 BIỂU ĐỒ SẢN LƯỢNG 12 TUẦN (S-CURVE)</span><span style="display:flex;gap:10px;font-size:11px;font-weight:400;opacity:.9;align-items:center"><span>■ SL tuần</span><span>— Lũy kế TH: <strong>${fB(evArr[n-1]||0)}</strong></span><span style="color:#86EFAC">- - KH: <strong>${fB(pvArr[n-1]||0)}</strong></span>${spiV?`<span style="padding:1px 7px;border-radius:10px;background:${spiC};font-weight:700">SPI=${spiV.toFixed(2)}</span>`:''}</span></div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA"><svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">${yT}<line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+cH}" stroke="#CBD5E1" stroke-width="1"/>${hdY>0?`<line x1="${PL}" y1="${hdY}" x2="${W-PR}" y2="${hdY}" stroke="#DC2626" stroke-width="1" stroke-dasharray="5 3" opacity="0.4"/><text x="${W-PR+2}" y="${hdY+3}" font-size="8" fill="#DC2626" opacity="0.7">HĐ</text>`:''} ${bars}<polyline points="${pvPts}" fill="none" stroke="#16A34A" stroke-width="2" stroke-dasharray="8 3" opacity="1"/>${pvArr.map((v,i)=>{const isL=i===n-1;return`<circle cx="${xC(i)}" cy="${yC(v)}" r="${isL?4:2.5}" fill="#16A34A" opacity="1"/>${isL?`<text x="${xC(i)}" y="${yC(v)-10}" text-anchor="middle" font-size="10" fill="#16A34A" font-weight="700">${fB(v)}</text>`:""}`}).join('')}<polyline points="${evPts}" fill="none" stroke="#D97706" stroke-width="2" stroke-linejoin="round"/>${evArr.map((v,i)=>{const isL=i===n-1;return`<circle cx="${xC(i)}" cy="${yC(v)}" r="${isL?4:2.5}" fill="#D97706"/>${isL?`<text x="${xC(i)}" y="${yC(v)-8}" text-anchor="middle" font-size="10" fill="#D97706" font-weight="700">${fB(v)}</text>`:''}`}).join('')}${xL}</svg></div></div>`
      }
    } catch(e) { console.warn('S-curve:',e) }

    // Bảng Tiến độ & SL (giống Dashboard/WBS)
    const summaries=tasks.filter(t=>t.is_summary&&t.outline_level<=3)
    const fmtD2=d=>d?d.slice(5).replace('-','/'):'—'
    const tableRows=summaries.map(t=>{
      const pct=t.display_pct!==undefined?t.display_pct:(t.pct_complete||0),delay=t._delay||0,cv=t._contractValue||0,ev=t._earnedValue||0
      const dlClr=typeof getDelayColor==='function'?getDelayColor(delay):delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A'
      const barClr=pct===100?'#16A34A':dlClr,indent=(t.outline_level-1)*14,fw=t.outline_level<=2?'600':'400'
      const rowBg=t.outline_level===1?'#EFF6FF':t.outline_level===2?'#F8FAFC':'#FFFFFF'
      const delayTxt=delay>0?`<span style="color:${dlClr};font-weight:600">trễ ${delay}d</span>`:delay<0?`<span style="color:#16A34A;font-weight:600">sớm ${Math.abs(delay)}d</span>`:'<span style="color:#64748B">Đúng KH</span>'
      return`<tr style="background:${rowBg};border-bottom:0.5px solid #E2E8F0"><td style="padding:5px 6px;padding-left:${indent+6}px;font-weight:${fw};font-size:13px;line-height:1.4">${t.name}</td><td style="padding:5px 6px;font-size:11px;color:#64748B;text-align:center;white-space:nowrap">${fmtD2(t.kh_start)} → ${fmtD2(t.kh_finish)}</td><td style="padding:5px 8px;min-width:120px"><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${barClr};border-radius:3px"></div></div><span style="font-size:12px;font-weight:700;color:${barClr};white-space:nowrap">${pct}%</span></div></td><td style="padding:5px 6px;font-size:11px;text-align:center">${delayTxt}</td><td style="padding:5px 6px;font-size:14px;font-weight:700;color:#0D9488;text-align:right;white-space:nowrap">${cv>0?fmtM(ev):'—'}</td><td style="padding:5px 6px;font-size:12px;color:#334155;text-align:right;white-space:nowrap">${cv>0?fmtM(cv):'—'}</td></tr>`
    }).join('')
    const summaryTableHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📊 TIẾN ĐỘ & SẢN LƯỢNG THEO HẠNG MỤC</div><table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0"><thead><tr style="background:#1E3A5F;color:white;font-size:11px"><th style="padding:5px 6px;text-align:left;font-weight:600">Hạng mục</th><th style="padding:5px 6px;text-align:center;font-weight:600">KH BĐ → KT</th><th style="padding:5px 6px;text-align:center;font-weight:600;min-width:130px">Tiến độ</th><th style="padding:5px 6px;text-align:center;font-weight:600">Lệch</th><th style="padding:5px 6px;text-align:right;font-weight:600">SL TH</th><th style="padding:5px 6px;text-align:right;font-weight:600">Giá trị HĐ</th></tr></thead><tbody>${tableRows}</tbody></table></div>`

    // Gantt
    const tl=getActualTimeline(tasks); let ganttHtml=''
    if(tl){
      const rangeMs=tl.end-tl.start,todayD=new Date();todayD.setHours(0,0,0,0)
      const nowPct=Math.max(0,Math.min(100,Math.round((todayD-tl.start)/rangeMs*100)))
      const quarters=[];let qc=new Date(tl.start.getFullYear(),Math.floor(tl.start.getMonth()/3)*3,1)
      while(qc<=tl.end){const p2=Math.max(0,Math.min(98,Math.round((qc-tl.start)/rangeMs*100)));quarters.push(`<span style="position:absolute;left:${p2}%;font-size:10px;color:rgba(255,255,255,0.8);white-space:nowrap">Q${Math.floor(qc.getMonth()/3)+1}/${qc.getFullYear()}</span>`);qc=new Date(qc.getFullYear(),qc.getMonth()+3,1)}
      ganttHtml=`<div style="display:flex;align-items:center;background:#1A2B4A;color:white;font-size:11px;padding:5px 8px;border-radius:4px 4px 0 0;position:relative;height:22px"><div style="width:190px;flex-shrink:0;font-weight:600">Hạng mục</div><div style="flex:1;position:relative">${quarters.join('')}<div style="position:absolute;top:-4px;bottom:-4px;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div></div><div style="width:70px;text-align:center;font-weight:600">Lệch</div></div>`
      tasks.filter(t=>t.is_summary&&t.outline_level<=3&&t.kh_start).forEach((t,idx)=>{
        const khL=Math.max(0,Math.min(100,Math.round((new Date(t.kh_start)-tl.start)/rangeMs*100))),khR=Math.max(0,Math.min(100,Math.round((new Date(t.kh_finish||t.kh_start)-tl.start)/rangeMs*100))),khW=Math.max(1,khR-khL)
        let ttBar=''
        if(t.tt_start){const ttL=Math.max(0,Math.min(100,Math.round((new Date(t.tt_start)-tl.start)/rangeMs*100)));const ttEnd=t.tt_finish?new Date(t.tt_finish):todayD;const ttR=Math.max(0,Math.min(100,Math.round((ttEnd-tl.start)/rangeMs*100)));const ttW=Math.max(1,ttR-ttL);const d=t._delay||0;const ttC=typeof getDelayColor==='function'?getDelayColor(d):d>14?'#DC2626':d>=7?'#D97706':'#16A34A';ttBar=`<div style="position:absolute;height:6px;top:13px;left:${ttL}%;width:${ttW}%;background:${ttC};border-radius:2px;opacity:.9"></div>`}
        const d=t._delay||0,dlyC=typeof getDelayColor==='function'?getDelayColor(d):d>14?'#DC2626':d>=7?'#D97706':'#16A34A',dlyT=d>0?`+${d}d`:d<0?`${d}d`:'—'
        const rb=idx%2===0?'#F8FAFC':'#FFFFFF',gi=(t.outline_level-1)*10
        ganttHtml+=`<div style="display:flex;align-items:center;background:${rb};border-bottom:0.5px solid #E2E8F0;height:22px"><div style="width:190px;flex-shrink:0;font-size:${t.outline_level===3?'9':'10'}px;font-weight:${t.outline_level===1?'700':t.outline_level===2?'600':'400'};padding:0 6px;padding-left:${6+gi}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</div><div style="flex:1;position:relative;height:100%"><div style="position:absolute;height:6px;top:3px;left:${khL}%;width:${khW}%;background:#93C5FD;border-radius:2px"></div>${ttBar}<div style="position:absolute;top:0;bottom:0;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div></div><div style="width:70px;font-size:11px;font-weight:600;color:${dlyC};text-align:center">${dlyT}</div></div>`
      })
    }

    // AI parse
    const aiHtml=editedAI.split('\n').map(line=>{if(!line.trim())return'<div style="height:5px"></div>';const c=line.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').trim();if(line.startsWith('## ')||line.startsWith('# '))return`<div style="margin:10px 0 5px;padding:4px 10px;background:#EFF6FF;border-left:3px solid #2563EB;border-radius:0 4px 4px 0;font-weight:700;font-size:13px;color:#1E3A8A">${c.replace(/^#+\s*/,'')}</div>`;return`<div style="font-size:13px;line-height:1.7;color:#1E293B;margin:2px 0">${c}</div>`}).join('')

    // Attach photos
    let attachHtml='';const attachments=window._reportAttachments||[]
    if(attachments.length){const items=attachments.map(p=>`<div style="border-radius:6px;overflow:hidden;border:0.5px solid #E2E8F0"><div style="width:100%;padding-top:66%;position:relative;background:#F1F5F9"><img src="${p.url}" crossorigin="anonymous" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.background='#FEE2E2'"></div>${p.caption?`<div style="padding:6px;background:#FFFBEB;border-top:2px solid #F59E0B"><div style="font-size:11px;font-weight:500;color:#92400E">⚠️ ${p.caption}</div></div>`:'<div style="padding:4px 6px;background:#F9FAFB"><div style="font-size:10px;color:#9CA3AF;font-style:italic">Chưa có ghi chú</div></div>'}</div>`).join('');attachHtml=`<div style="margin-bottom:14px"><div style="background:#F59E0B;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📋 LƯU Ý / HÌNH ẢNH THAM KHẢO (${attachments.length} ảnh)</div><div style="border:0.5px solid #FDE68A;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FFFBEB"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${items}</div></div></div>`}

    // Thi cong photos
    const finalPhotos=(window._selectedPhotos!==null&&window._selectedPhotos!==undefined)?window._selectedPhotos:(weekPhotos||[]);let photosHtml=''
    if(finalPhotos?.length){const items=finalPhotos.map(p=>{const label=!p.task_id?(p.caption||'Ảnh tổng thể'):(p.tasks?.name||p.caption||'');const date=p.taken_at?new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'';return`<div style="border-radius:6px;overflow:hidden;border:0.5px solid #E2E8F0"><div style="width:100%;padding-top:66%;position:relative;background:#E2E8F0"><img src="${p.photo_url}" crossorigin="anonymous" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML='Lỗi ảnh'"></div><div style="padding:4px 6px"><div style="font-size:10px;font-weight:500;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label.slice(0,35)}</div><div style="font-size:9px;color:#94A3B8">${date}</div></div></div>`}).join('');photosHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📷 ẢNH THI CÔNG TUẦN ${wk}/${yr} (${finalPhotos.length} ảnh)</div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${items}</div></div></div>`}

    // Attendance
    let attendanceHtml=''
    if(STATE._attendanceData?.history?.length){const hist=STATE._attendanceData.history,avgCN=STATE._attendanceData.avgCN||0,maxCN=Math.max(...hist.map(h=>h.cn_proj||0),1);const W2=700,H2=150,P2=36,bA=W2-P2-10,sH=H2-44,bW2=Math.max(8,Math.floor(bA/hist.length)-4);const aY=H2-32-Math.round((avgCN/maxCN)*sH);const b3=hist.map((d,i)=>{const cn=d.cn_proj||0,h2=Math.max(4,Math.round((cn/maxCN)*sH)),x=P2+i*(bA/hist.length),y=H2-32-h2;const dt=new Date(d.report_date),lbl=`${dt.getDate()}/${dt.getMonth()+1}`,dow=['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()];const c=cn>avgCN?'#16A34A':cn<avgCN*0.8?'#DC2626':'#60A5FA';return`<rect x="${x}" y="${y}" width="${bW2}" height="${h2}" fill="${c}" rx="2" opacity=".85"/><text x="${x+bW2/2}" y="${y-3}" text-anchor="middle" font-size="8" fill="#334155">${cn}</text><text x="${x+bW2/2}" y="${H2-16}" text-anchor="middle" font-size="8" fill="#64748B">${lbl}</text><text x="${x+bW2/2}" y="${H2-6}" text-anchor="middle" font-size="7" fill="#94A3B8">${dow}</text>`}).join('');attendanceHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">👷 QUÂN SỐ CÔNG NHÂN 30 NGÀY GẦN NHẤT</div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA"><svg width="100%" viewBox="0 0 ${W2} ${H2}" style="overflow:visible"><line x1="${P2}" y1="${H2-32}" x2="${W2-10}" y2="${H2-32}" stroke="#E2E8F0" stroke-width="0.5"/><line x1="${P2}" y1="${aY}" x2="${W2-10}" y2="${aY}" stroke="#D97706" stroke-width="1" stroke-dasharray="4 3" opacity=".7"/><text x="${W2-8}" y="${aY+4}" font-size="8" fill="#D97706" font-weight="600">TB</text>${b3}</svg><div style="font-size:11px;margin-top:4px">TB 30 ngày: <strong style="color:#2563EB">${avgCN}</strong> CN/ngày</div></div></div>`}

    const htmlContent=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI",Arial,sans-serif}body{background:white;width:900px}</style></head><body><div id="pdf-content" style="width:900px;background:white"><div style="background:#1A2B4A;padding:14px 24px;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><img src="${LOGO_URL}" style="height:44px;width:auto" crossorigin="anonymous" onerror="this.style.display='none'"><div><div style="color:#F97316;font-size:11px;letter-spacing:.08em">PHÒNG KTTC — VELAE&C</div></div></div><div style="text-align:right"><div style="color:white;font-size:20px;font-weight:700">BÁO CÁO TIẾN ĐỘ THI CÔNG</div><div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:3px">${proj.name}</div><div style="color:rgba(255,255,255,.65);font-size:11px;margin-top:2px">Tuần ${wk}/${yr} | Ngày lập: ${today}</div></div></div><div style="padding:14px 20px">${evmCardsHtml}${scurveSvgHtml}<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">🤖 PHÂN TÍCH AI — TUẦN ${wk}/${yr}</div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:12px;border-radius:0 0 4px 4px;background:#FAFAFA">${aiHtml}</div></div>${kttcNote?`<div style="margin-bottom:14px;padding:10px 14px;background:#FFFBEB;border-left:4px solid #D97706;border-radius:0 4px 4px 0"><div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:4px">📝 GHI CHÚ PHÒNG KTTC</div><div style="font-size:13px;color:#78350F;white-space:pre-wrap;line-height:1.6">${kttcNote}</div></div>`:''} ${attachHtml}${photosHtml}${summaryTableHtml}<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📅 SƠ ĐỒ GANTT TỔNG QUAN</div><div style="border:0.5px solid #E2E8F0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">${ganttHtml}<div style="padding:4px 8px;background:#F8FAFC;font-size:10px;color:#64748B;display:flex;gap:14px"><span><span style="display:inline-block;width:12px;height:5px;background:#93C5FD;border-radius:2px;vertical-align:middle;margin-right:3px"></span>KH</span><span><span style="display:inline-block;width:12px;height:5px;background:#16A34A;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT đúng/vượt</span><span><span style="display:inline-block;width:12px;height:5px;background:#DC2626;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT trễ</span><span><span style="display:inline-block;width:2px;height:12px;background:#F97316;vertical-align:middle;margin-right:3px"></span>Hôm nay</span></div></div></div>${attendanceHtml}</div><div style="background:#F1F5F9;border-top:1px solid #E2E8F0;padding:8px 24px;display:flex;justify-content:space-between"><span style="font-size:11px;color:#64748B">VelaE&C — Hệ thống theo dõi tiến độ thi công</span><span style="font-size:11px;color:#64748B">Phát hành: Phòng KTTC VelaE&C</span></div></div></body></html>`

    const container=document.createElement('div');container.style.cssText='position:fixed;top:-9999px;left:-9999px;width:900px;z-index:-1';container.innerHTML=htmlContent;document.body.appendChild(container)
    const img=container.querySelector('img');if(img)await new Promise(r=>{if(img.complete)r();else{img.onload=r;img.onerror=r;setTimeout(r,3000)}})
    const canvas=await html2canvas(container.querySelector('#pdf-content'),{scale:3,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',width:900,logging:false})
    document.body.removeChild(container)
    const {jsPDF}=window.jspdf;const pdfW=210,pdfH=Math.round(canvas.height/canvas.width*pdfW)
    const pdf=new jsPDF({unit:'mm',format:[pdfW,pdfH],orientation:'portrait'})
    pdf.addImage(canvas.toDataURL('image/jpeg',0.97),'JPEG',0,0,pdfW,pdfH)
    const fn='BC-TD_'+proj.code.replace(/[^a-zA-Z0-9]/g,'_')+'_Tuan'+wk+'_'+yr+'.pdf'
    pdf.save(fn);toast('Đã xuất PDF: '+fn,'success')
  } catch(e){toast('Lỗi xuất PDF: '+e.message,'error');console.error(e)} finally{loading(false)}
}

// ═══════════════════════════════════════════════════════════
// LỊCH SỬ PROGRESS — xem, sửa, xóa
// ═══════════════════════════════════════════════════════════
async function showProgressHistory(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  loading(true, 'Đang tải lịch sử...')
  const { data: history, error } = await sb.from('task_progress')
    .select('*')
    .eq('task_id', taskId)
    .order('updated_at', { ascending: false })
  loading(false)

  if (error) { toast('Lỗi tải lịch sử: ' + error.message, 'error'); return }

  const isAdmin = ['admin','planner'].includes(STATE.role)

  const rows = history?.length ? history.map(h => `
    <tr>
      <td style="font-size:15px;color:var(--gray5)">${new Date(h.updated_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
      <td style="text-align:center;font-weight:600;color:var(--blue)">${h.actual_quantity != null ? h.actual_quantity + ' ' + (h.unit||'') : h.pct_complete + '%'}</td>
      <td style="text-align:center">${h.pct_complete}%</td>
      <td style="font-size:15px">${h.note||'—'}</td>
      <td style="font-size:15px;color:var(--gray4)">${h.updated_by?.split('@')[0]||'—'}</td>
      <td style="text-align:center">
        <button class="btn btn-secondary btn-sm" onclick="editProgress('${h.id}','${taskId}',${h.pct_complete},'${h.note||''}',${h.actual_quantity||'null'})">✏️</button>
        ${isAdmin ? `<button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteProgress('${h.id}','${taskId}')">🗑️</button>` : ''}
      </td>
    </tr>`) .join('')
  : '<tr><td colspan="6" style="text-align:center;color:var(--gray4);padding:20px">Chưa có lịch sử cập nhật</td></tr>'

  openModal(`📋 Lịch sử: ${task.name}`,`
    <div style="font-size:16px;color:var(--gray5);margin-bottom:12px">
      KH: ${fmtDate(task.kh_start)} → ${fmtDate(task.kh_finish)} · Đơn vị: ${task.unit||'%'} · KH: ${task.planned_quantity||'—'}
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" style="min-width:500px">
        <thead><tr>
          <th>Thời gian</th><th style="text-align:center">KL thực tế</th>
          <th style="text-align:center">%</th><th>Ghi chú</th>
          <th>Người nhập</th><th style="text-align:center">Thao tác</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--gray2)">
      <div style="font-size:16px;font-weight:600;color:var(--gray7);margin-bottom:8px">➕ Nhập tay override</div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <div class="form-label">% hoặc số lượng</div>
          <input type="number" id="manual-pct" min="0" max="100" placeholder="${task.unit !== '%' ? 'Số lượng' : '%'}"
            style="width:90px;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:14px;font-weight:600">
        </div>
        <div>
          <div class="form-label">Ghi chú</div>
          <input type="text" id="manual-note" placeholder="Lý do nhập tay..."
            style="width:200px;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:13px">
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveManualProgress('${taskId}')">💾 Lưu ngay</button>
      </div>
    </div>
  `,`<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
}

async function editProgress(progressId, taskId, curPct, curNote, curQty) {
  const newPct = prompt(`Sửa % hoàn thành (hiện tại: ${curPct}%):`, curPct)
  if (newPct === null) return
  const newNote = prompt('Sửa ghi chú:', curNote)
  if (newNote === null) return

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('task_progress')
    .update({ pct_complete: parseInt(newPct), note: newNote, updated_at: new Date().toISOString() })
    .eq('id', progressId)
  loading(false)

  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã cập nhật!', 'success')
  await loadProjectData(STATE.currentProject.id)
  showProgressHistory(taskId)
}

async function deleteProgress(progressId, taskId) {
  if (!confirm('Xóa bản ghi này? Thao tác không thể hoàn tác.')) return

  loading(true, 'Đang xóa...')
  const { error } = await sb.from('task_progress').delete().eq('id', progressId)
  loading(false)

  if (error) { toast('Lỗi xóa: ' + error.message, 'error'); return }
  toast('Đã xóa bản ghi!', 'success')
  await loadProjectData(STATE.currentProject.id)
  showProgressHistory(taskId)
}

async function saveManualProgress(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  const rawVal = parseFloat(document.getElementById('manual-pct').value)
  const note = document.getElementById('manual-note').value.trim() || 'Nhập tay'
  if (isNaN(rawVal)) { toast('Vui lòng nhập giá trị', 'error'); return }

  const now = new Date()
  const today = now.toISOString().slice(0,10)
  let pct, actualQty = null

  if (task.unit && task.unit !== '%' && task.planned_quantity) {
    actualQty = rawVal
    pct = Math.min(100, Math.round(rawVal / task.planned_quantity * 100))
  } else {
    pct = Math.min(100, Math.max(0, Math.round(rawVal)))
  }

  const ttStart = (task.tt_start && task.tt_start !== '') ? task.tt_start : (pct > 0 ? today : null)
  const ttEnd = pct === 100 ? today : null

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('task_progress').insert({
    task_id: taskId, project_id: STATE.currentProject.id,
    tt_start: ttStart, tt_finish: ttEnd,
    pct_complete: pct, actual_quantity: actualQty,
    unit: task.unit || '%', note,
    updated_by: STATE.user.email,
    kh_start_snapshot: task.kh_start, kh_finish_snapshot: task.kh_finish,
    week_number: getISOWeek(now), year: now.getFullYear(),
  })
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã lưu!', 'success')
  await loadProjectData(STATE.currentProject.id)
  showProgressHistory(taskId)
}

// ═══════════════════════════════════════════════════════════
// KEY TASK — Planner chọn driving task cho task cha
// ═══════════════════════════════════════════════════════════
async function openKeyTaskModal(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task || !task.is_summary) return

  const children = STATE.tasks.filter(t =>
    t.wbs_code.startsWith(task.wbs_code + '.') && !t.is_summary
  )
  const curKeyTask = task.key_task_id ? STATE.tasks.find(t => t.id === task.key_task_id) : null

  openModal(`🔑 Key Task: ${task.name}`, `
    <div style="font-size:16px;color:var(--gray5);margin-bottom:14px">
      Chọn công tác con nào sẽ điều khiển % hoàn thành của "${task.name}".
      Nếu không chọn, hệ thống dùng trung bình có trọng số.
    </div>
    ${curKeyTask ? `<div style="padding:8px 12px;background:var(--lblue);border-radius:6px;font-size:16px;margin-bottom:12px">
      ✅ Key Task hiện tại: <strong>${curKeyTask.name}</strong>
    </div>` : ''}
    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--gray2);border-radius:8px">
      <div onclick="setKeyTask('${taskId}',null)"
        style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray2);font-size:13px;color:var(--gray5);display:flex;align-items:center;gap:8px"
        onmouseover="this.style.background='var(--gray1)'" onmouseout="this.style.background='white'">
        <span>⚖️</span> <em>Dùng trung bình có trọng số (mặc định)</em>
      </div>
      ${children.map(c => `
      <div onclick="setKeyTask('${taskId}','${c.id}')"
        style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray2);font-size:13px;display:flex;align-items:center;gap:8px;background:${c.id===curKeyTask?.id?'var(--lblue)':'white'}"
        onmouseover="this.style.background='var(--gray1)'" onmouseout="this.style.background='${c.id===curKeyTask?.id?'var(--lblue)':'white'}'">
        <span>${c.id === curKeyTask?.id ? '🔑' : '○'}</span>
        <div>
          <div style="font-weight:500">${c.name}</div>
          <div style="font-size:15px;color:var(--gray4)">${c.wbs_code} · ${c.pct_complete||0}% hoàn thành</div>
        </div>
      </div>`).join('')}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
}

async function setKeyTask(parentId, keyTaskId) {
  loading(true, 'Đang lưu...')
  const { error } = await sb.from('tasks').update({ key_task_id: keyTaskId }).eq('id', parentId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  const task = STATE.tasks.find(t => t.id === parentId)
  if (task) task.key_task_id = keyTaskId
  toast(keyTaskId ? 'Đã set Key Task!' : 'Đã về trung bình mặc định', 'success')
  closeModal()
  STATE.tasks = computeRollupPct(STATE.tasks)
  navigate('wbs')
}

// ═══════════════════════════════════════════════════════════
// TASK SETTINGS
// ═══════════════════════════════════════════════════════════
async function openTaskSettings(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  openModal(`⚙️ Cài đặt: ${task.name}`, `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Đơn vị đo lường</label>
        <select class="form-input" id="ts-unit" onchange="document.getElementById('ts-unit-custom').style.display=this.value==='other'?'':'none'">
          ${['%','căn','m²','m³','m','cái','bộ','tấn','kg'].map(u =>
            `<option value="${u}" ${task.unit===u?'selected':''}>${u}</option>`
          ).join('')}
          <option value="other" ${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?'selected':''}>Khác...</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Khối lượng kế hoạch</label>
        <input class="form-input" type="number" id="ts-qty" placeholder="VD: 66" value="${task.planned_quantity||''}">
      </div>
    </div>
    <div class="form-group" id="ts-unit-custom" style="${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?'':'display:none'}">
      <label class="form-label">Đơn vị tùy chỉnh</label>
      <input class="form-input" type="text" id="ts-unit-text" placeholder="VD: chuyến, lượt..."
        value="${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?task.unit||'':''}">
    </div>
    <div class="form-group">
      <label class="form-label">
        ${task.unit && task.unit !== '%' ? 'Đơn giá HĐ (VND/' + (task.unit||'đvt') + ')' : 'Tổng giá trị công tác (VND)'}
      </label>
      <input class="form-input" type="number" id="ts-unit-price"
        placeholder="${task.unit && task.unit !== '%' ? 'VD: 15000000' : 'VD: 500000000'}"
        value="${task.unit_price||''}" style="font-size:14px;font-weight:500">
      ${task.unit_price && task.planned_quantity && task.unit !== '%'
        ? '<div style="font-size:15px;color:var(--gray4);margin-top:4px">Tổng giá trị: <strong>' + ((task.unit_price * task.planned_quantity)/1e9).toFixed(3) + ' tỷ</strong></div>'
        : task.unit_price && task.unit === '%'
        ? '<div style="font-size:15px;color:var(--gray4);margin-top:4px">Giá trị công tác: <strong>' + (task.unit_price/1e9).toFixed(3) + ' tỷ</strong></div>'
        : ''}
    </div>
    ${task.is_summary ? `
    <div style="margin-top:4px;padding:10px;background:var(--lblue);border-radius:6px;font-size:16px;color:var(--gray6)">
      💡 Task này là hạng mục cha — bạn cũng có thể <a href="#" onclick="closeModal();openKeyTaskModal('${taskId}');return false" style="color:var(--blue)">chọn Key Task</a> để điều khiển tiến độ.
    </div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveTaskSettings('${taskId}')">💾 Lưu</button>
  `)
}

async function saveTaskSettings(taskId) {
  const unitSel = document.getElementById('ts-unit').value
  const unit = unitSel === 'other' ? (document.getElementById('ts-unit-text').value.trim() || '%') : unitSel
  const planned_quantity = parseFloat(document.getElementById('ts-qty').value) || null
  const unit_price = parseFloat(document.getElementById('ts-unit-price').value) || null

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('tasks').update({ unit, planned_quantity, unit_price }).eq('id', taskId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  const task = STATE.tasks.find(t => t.id === taskId)
  if (task) { task.unit = unit; task.planned_quantity = planned_quantity; task.unit_price = unit_price }
  toast('Đã lưu cài đặt!', 'success')
  closeModal()
  navigate('wbs')
}

// ═══════════════════════════════════════════════════════════
// ẢNH ĐÍNH KÈM BÁO CÁO
// ═══════════════════════════════════════════════════════════
if (!window._reportAttachments) window._reportAttachments = []

function renderReportPhotoGrid() {
  const grid = document.getElementById('report-photo-grid')
  if (!grid) return
  const photos = window._reportAttachments
  if (!photos.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--gray4);font-size:12px;padding:16px;border:1px dashed var(--gray3);border-radius:var(--radius)">Chưa có ảnh đính kèm — chọn từ thư viện hoặc upload mới</div>`
    return
  }
  grid.innerHTML = photos.map((p, i) => `
    <div style="border-radius:8px;overflow:hidden;border:1px solid var(--gray2);background:white;position:relative">
      <div style="width:100%;padding-top:66%;position:relative;overflow:hidden;background:var(--gray1)">
        <img src="${p.url}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.background='#FEE2E2'">
      </div>
      <div style="padding:6px 8px;background:#FAFAFA;border-top:1px solid var(--gray2)">
        <div style="font-size:9px;color:var(--gray4);margin-bottom:3px;font-weight:500">✏️ CAPTION / GHI CHÚ:</div>
        <input type="text" value="${p.caption||''}" placeholder="Nhập ghi chú hoặc cảnh báo..."
          style="width:100%;font-size:12px;border:1px solid var(--gray3);border-radius:4px;padding:5px 8px;color:var(--gray7);background:white;outline:none;box-sizing:border-box"
          oninput="window._reportAttachments[${i}].caption=this.value">
      </div>
      <button onclick="removeReportPhoto(${i})"
        style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.5);color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
    </div>`).join('')
}

function removeReportPhoto(idx) { window._reportAttachments.splice(idx,1); renderReportPhotoGrid() }

function addReportPhoto(url, caption='') {
  if (window._reportAttachments.length >= 6) { toast('Tối đa 6 ảnh đính kèm','error'); return false }
  if (window._reportAttachments.find(p=>p.url===url)) { toast('Ảnh này đã được thêm',''); return false }
  window._reportAttachments.push({url,caption}); renderReportPhotoGrid(); return true
}

async function openReportPhotoLibrary() {
  const modal=document.getElementById('report-library-modal'), grid=document.getElementById('report-library-grid')
  if(!modal||!grid) return
  modal.style.display='flex'
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray4)">Đang tải...</div>'
  const proj=STATE.currentProject, week=getISOWeek(new Date()), year=new Date().getFullYear()
  const {data:photos}=await sb.from('task_photos').select('id,photo_url,caption,taken_at,task_id,tasks(name)').eq('project_id',proj.id).eq('week_number',week).eq('year',year).order('taken_at',{ascending:false})
  if(!photos?.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray4)">Chưa có ảnh tuần này</div>';return}
  grid.innerHTML=photos.map(p=>{const isAdded=window._reportAttachments.find(a=>a.url===p.photo_url);const label=!p.task_id?(p.caption||'Ảnh tổng thể'):(p.tasks?.name||p.caption||'—');const date=p.taken_at?new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'';return`<div style="border-radius:8px;overflow:hidden;border:2px solid ${isAdded?'var(--blue)':'var(--gray2)'};cursor:pointer;background:white" onclick="toggleLibraryPhoto('${p.photo_url}','${(label||'').replace(/'/g,"\'")}',this)"><div style="width:100%;padding-top:66%;position:relative;overflow:hidden;background:var(--gray1)"><img src="${p.photo_url}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover">${isAdded?'<div style="position:absolute;top:4px;right:4px;background:var(--blue);color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px">✓</div>':''}</div><div style="padding:5px 7px"><div style="font-size:10px;font-weight:500;color:var(--gray7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div><div style="font-size:9px;color:var(--gray4)">${date}</div></div></div>`}).join('')
}

function toggleLibraryPhoto(url,caption,el){const existing=window._reportAttachments.findIndex(p=>p.url===url);if(existing>=0){window._reportAttachments.splice(existing,1);el.style.borderColor='var(--gray2)';renderReportPhotoGrid()}else{if(addReportPhoto(url,caption))el.style.borderColor='var(--blue)'}}

async function handleReportPhotoUpload(input) {
  const files=Array.from(input.files).slice(0,6-window._reportAttachments.length)
  if(!files.length) return
  loading(true,'Đang upload ảnh...')
  try {
    for (const file of files) {
      let uploadFile=file
      if(typeof imageCompression!=='undefined') uploadFile=await imageCompression(file,{maxSizeMB:0.3,maxWidthOrHeight:1280,useWebWorker:true,fileType:'image/jpeg'})
      const proj=STATE.currentProject, path=`${proj.id}/report_attach/${Date.now()}_${Math.random().toString(36).slice(2,6)}.jpg`
      const buf=await uploadFile.arrayBuffer()
      const {error}=await sb.storage.from(CFG.STORAGE_BUCKET).upload(path,buf,{upsert:true,contentType:'image/jpeg'})
      if(error) throw error
      const {data:urlData}=sb.storage.from(CFG.STORAGE_BUCKET).getPublicUrl(path)
      addReportPhoto(urlData.publicUrl,file.name.replace(/\.[^.]+$/,''))
    }
    toast(`Đã upload ${files.length} ảnh`,'success')
  } catch(e){toast('Lỗi upload: '+e.message,'error')} finally{loading(false);input.value=''}
}

// ═══════════════════════════════════════════════════════════
// CHỌN & SẮP XẾP ẢNH THI CÔNG CHO PDF
// ═══════════════════════════════════════════════════════════
async function openPhotoSelector() {
  const proj=STATE.currentProject, week=getISOWeek(new Date()), year=new Date().getFullYear()
  const {data:allPhotos}=await sb.from('task_photos').select('id,photo_url,caption,taken_at,task_id,tasks(name)').eq('project_id',proj.id).eq('week_number',week).eq('year',year).order('taken_at',{ascending:false})
  if(!allPhotos?.length){toast('Chưa có ảnh tuần này','');return}
  if(!window._selectedPhotos) window._selectedPhotos=allPhotos.slice(0,9).map(p=>({...p}))

  const renderSelector=()=>{
    const selectedIds=(window._selectedPhotos||[]).map(p=>p.id||p.photo_url)
    const allGrid=allPhotos.map(p=>{const isSelected=selectedIds.includes(p.id||p.photo_url);const selIdx=selectedIds.indexOf(p.id||p.photo_url);const label=!p.task_id?(p.caption||'Ảnh tổng thể'):(p.tasks?.name||'—');const date=p.taken_at?new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'';return`<div data-pid="${p.id}" data-url="${p.photo_url}" data-label="${encodeURIComponent(label||'')}" data-date="${date}" onclick="_handlePhotoClick(this)" style="border-radius:8px;overflow:hidden;border:2px solid ${isSelected?'var(--blue)':'var(--gray2)'};cursor:pointer;position:relative;background:white"><div style="width:100%;padding-top:66%;position:relative;background:var(--gray1)"><img src="${p.photo_url}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover">${isSelected?`<div style="position:absolute;top:4px;left:4px;background:var(--blue);color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${selIdx+1}</div>`:''}</div><div style="padding:4px 6px;font-size:10px;color:var(--gray6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div><div style="padding:0 6px 4px;font-size:9px;color:var(--gray4)">${date}</div></div>`}).join('')
    const selList=(window._selectedPhotos||[]).map((p,i)=>{const label=!p.task_id?(p.caption||'Ảnh tổng thể'):(p.tasks?.name||p.caption||'—');return`<div id="sel-item-${i}" draggable="true" ondragstart="dragPhotoStart(${i})" ondragover="event.preventDefault()" ondrop="dragPhotoDrop(${i})" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:white;border:1px solid var(--gray2);border-radius:6px;cursor:grab;margin-bottom:4px"><span style="background:var(--blue);color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i+1}</span><img src="${p.photo_url}" style="width:40px;height:30px;object-fit:cover;border-radius:4px;flex-shrink:0"><span style="font-size:11px;color:var(--gray7);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span><span style="font-size:10px;color:var(--gray4);cursor:pointer;padding:2px 6px" onclick="removeSelectedPhoto(${i})">✕</span></div>`}).join('')
    document.getElementById('ps-all-grid').innerHTML=allGrid
    document.getElementById('ps-sel-list').innerHTML=selList||'<div style="color:var(--gray4);font-size:12px;padding:8px">Chưa chọn ảnh nào</div>'
    document.getElementById('ps-sel-count').textContent=`${(window._selectedPhotos||[]).length}/9 ảnh`
  }

  openModal('🖼️ Chọn & sắp xếp ảnh thi công cho PDF',`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:55vh">
      <div><div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:8px">📷 Tất cả ảnh tuần ${week} (${allPhotos.length} ảnh)</div><div id="ps-all-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:calc(55vh - 40px);overflow-y:auto"></div></div>
      <div><div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:8px;display:flex;justify-content:space-between"><span>✅ Đã chọn (kéo thả để sắp xếp)</span><span id="ps-sel-count" style="color:var(--blue)">0/9 ảnh</span></div><div id="ps-sel-list" style="max-height:calc(55vh - 40px);overflow-y:auto"></div></div>
    </div>
  `,`
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
      <button class="btn btn-secondary btn-sm" onclick="resetPhotoSelection()">↩ Reset về mặc định</button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="confirmPhotoSelection()">✅ Xác nhận thứ tự</button>
      </div>
    </div>
  `)
  const m=document.querySelector('.modal'); m.style.maxWidth='800px'; m.style.maxHeight='90vh'
  renderSelector(); window._renderPhotoSelector=renderSelector
}

function togglePhotoSelect(id,url,label,date){const sel=window._selectedPhotos||[];const idx=sel.findIndex(p=>(p.id||p.photo_url)===(id||url));if(idx>=0){sel.splice(idx,1)}else{if(sel.length>=9){toast('Tối đa 9 ảnh cho PDF','error');return}sel.push({id,photo_url:url,caption:label,taken_at:date,task_id:null})}window._selectedPhotos=sel;if(window._renderPhotoSelector)window._renderPhotoSelector()}
function removeSelectedPhoto(idx){window._selectedPhotos.splice(idx,1);if(window._renderPhotoSelector)window._renderPhotoSelector()}
let _dragIdx=null
function dragPhotoStart(idx){_dragIdx=idx}
function dragPhotoDrop(targetIdx){if(_dragIdx===null||_dragIdx===targetIdx)return;const arr=window._selectedPhotos;const moved=arr.splice(_dragIdx,1)[0];arr.splice(targetIdx,0,moved);_dragIdx=null;if(window._renderPhotoSelector)window._renderPhotoSelector()}
function resetPhotoSelection(){window._selectedPhotos=null;if(window._renderPhotoSelector)window._renderPhotoSelector();toast('Đã reset về 9 ảnh mới nhất','')}
function confirmPhotoSelection(){const count=(window._selectedPhotos||[]).length;closeModal();const lbl=document.getElementById('report-photo-count-label');if(lbl)lbl.textContent=`Ảnh thi công (${count})`;toast(`✅ Đã chọn ${count} ảnh theo thứ tự mong muốn`,'success')}
function _handlePhotoClick(el){const id=el.dataset.pid,url=el.dataset.url,label=decodeURIComponent(el.dataset.label||''),date=el.dataset.date;togglePhotoSelect(id,url,label,date)}
