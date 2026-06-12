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

  // Collect caption mới nhất từ các input trong grid trước khi đóng modal
  document.querySelectorAll('#report-photo-grid input[type="text"]').forEach((inp, i) => {
    if (window._reportAttachments[i]) {
      window._reportAttachments[i].caption = inp.value
    }
  })

  if (!STATE._reportData) { toast('Lỗi: không có dữ liệu báo cáo', 'error'); return }
  const { weekPhotos, week, year } = STATE._reportData

  closeModal()
  loading(true, 'Đang tạo PDF báo cáo tuần...')

  // Gán lại aiSummary đã chỉnh sửa để exportWeeklyPDF dùng
  STATE._editedReport = { aiSummary: editedAI, weekPhotos, week, year, kttcNote }
  // attachHtml được build trực tiếp từ window._reportAttachments trong renderWeeklyPDF
  try {
    const { aiSummary, weekPhotos: wPhotos, week: wk, year: yr, kttcNote: note } = STATE._editedReport
    const LOGO_URL = 'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png'
    const proj = STATE.currentProject
    const tasks   = STATE.tasks
    const leaf     = tasks.filter(t => !t.is_summary)
    const done     = leaf.filter(t => (t.pct_complete||0) === 100)
    const inProg   = leaf.filter(t => t.tt_start && (t.pct_complete||0) < 100)
    const late     = leaf.filter(t => t._delay > 0)
    const validLate = late.filter(t => t._delay > 0 && t._delay < 500)
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalPct = rootTask ? (rootTask.display_pct||rootTask.pct_complete||0) : 0
    const today   = new Date().toLocaleDateString('vi-VN')

    // Build level 3 table rows
    const lvl3 = tasks.filter(t => t.is_summary && t.outline_level <= 3)  // level 1-2-3
    const tableRows = lvl3.map(t => {
      const pct   = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const delay = t._delay || 0
      const isLate  = delay > 0 && delay < 365
      const isAhead = delay < 0
      const statusStr = isLate  ? `<span style="color:#DC2626;font-weight:600">Trễ ${delay}d</span>`
                       : isAhead ? `<span style="color:#16A34A;font-weight:600">Sớm ${Math.abs(delay)}d</span>`
                       : '<span style="color:#64748B">Đúng KH</span>'
      const indent = (t.outline_level - 1) * 14
      const rowBg = isLate ? '#FEF2F2' : t.outline_level === 1 ? '#EFF6FF' : t.outline_level === 2 ? '#F8FAFC' : '#FFFFFF'
      const fw = t.outline_level <= 2 ? '600' : '400'
      const khStart = t.kh_start ? t.kh_start.slice(5).replace('-','/') : '--'
      const khEnd   = t.kh_finish ? t.kh_finish.slice(5).replace('-','/') : '--'
      const pctColor = pct === 100 ? '#16A34A' : isLate ? '#DC2626' : '#1E293B'
      return `<tr style="background:${rowBg};border-bottom:0.5px solid #E2E8F0">
        <td style="padding:4px 6px;padding-left:${indent+6}px;font-weight:${fw};font-size:14px;max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</td>
        <td style="padding:4px 6px;font-size:12px;color:#64748B;text-align:center">${khStart}</td>
        <td style="padding:4px 6px;font-size:12px;color:#64748B;text-align:center">${khEnd}</td>
        <td style="padding:4px 6px;font-size:14px;font-weight:600;color:${pctColor};text-align:center">${pct}%</td>
        <td style="padding:4px 6px;font-size:12px;text-align:center">${statusStr}</td>
      </tr>`
    }).join('')

    // Build Gantt mini rows
    const tl = getActualTimeline(tasks)
    let ganttHtml = ''
    if (tl) {
      const rangeMs = tl.end - tl.start
      const todayD = new Date(); todayD.setHours(0,0,0,0)
      const nowPct = Math.max(0, Math.min(100, Math.round((todayD - tl.start) / rangeMs * 100)))
      // Quarter labels
      const quarters = []
      let qc = new Date(tl.start.getFullYear(), Math.floor(tl.start.getMonth()/3)*3, 1)
      while (qc <= tl.end) {
        const pct2 = Math.max(0, Math.min(98, Math.round((qc - tl.start) / rangeMs * 100)))
        quarters.push(`<span style="position:absolute;left:${pct2}%;font-size:11px;color:rgba(255,255,255,0.8);white-space:nowrap">Q${Math.floor(qc.getMonth()/3)+1}/${qc.getFullYear()}</span>`)
        qc = new Date(qc.getFullYear(), qc.getMonth()+3, 1)
      }
      ganttHtml = `
        <div style="display:flex;align-items:center;background:#1A2B4A;color:white;font-size:12px;padding:5px 8px;border-radius:4px 4px 0 0;position:relative;height:20px">
          <div style="width:180px;flex-shrink:0;font-weight:600">Hạng mục</div>
          <div style="flex:1;position:relative">${quarters.join('')}
            <div style="position:absolute;top:-4px;bottom:-4px;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div>
          </div>
          <div style="width:70px;text-align:center;font-weight:600">Lệch</div>
        </div>`
      const ganttTasks = tasks.filter(t => t.is_summary && t.outline_level <= 3 && t.kh_start)
      ganttTasks.forEach((t, idx) => {
        const khL = Math.max(0,Math.min(100,Math.round((new Date(t.kh_start)-tl.start)/rangeMs*100)))
        const khR = Math.max(0,Math.min(100,Math.round((new Date(t.kh_finish||t.kh_start)-tl.start)/rangeMs*100)))
        const khW = Math.max(1, khR-khL)
        let ttBar = ''
        if (t.tt_start) {
          const ttL = Math.max(0,Math.min(100,Math.round((new Date(t.tt_start)-tl.start)/rangeMs*100)))
          const ttEnd = t.tt_finish ? new Date(t.tt_finish) : todayD
          const ttR = Math.max(0,Math.min(100,Math.round((ttEnd-tl.start)/rangeMs*100)))
          const ttW = Math.max(1,ttR-ttL)
          const ttClr = (t._delay||0) > 0 ? '#FCA5A5' : '#86EFAC'
          ttBar = `<div style="position:absolute;height:6px;top:13px;left:${ttL}%;width:${ttW}%;background:${ttClr};border-radius:2px"></div>`
        }
        const delay = t._delay||0
        const isLate2 = delay > 0 && delay < 365
        const isAhead2 = delay < 0
        const dlyClr = isLate2 ? '#DC2626' : isAhead2 ? '#16A34A' : '#64748B'
        const dlyTxt = isLate2 ? `+${delay}d` : isAhead2 ? `${delay}d` : '—'
        const rowBg2 = idx%2===0 ? '#F8FAFC' : '#FFFFFF'
        const fw2 = t.outline_level === 1 ? '700' : t.outline_level === 2 ? '600' : '400'
        const gIndent = (t.outline_level - 1) * 10
        ganttHtml += `<div style="display:flex;align-items:center;background:${rowBg2};border-bottom:0.5px solid #E2E8F0;height:22px">
          <div style="width:180px;flex-shrink:0;font-size:${t.outline_level===3?'8':'9'}px;font-weight:${fw2};padding:0 6px;padding-left:${6+gIndent}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</div>
          <div style="flex:1;position:relative;height:100%">
            <div style="position:absolute;height:6px;top:3px;left:${khL}%;width:${khW}%;background:#93C5FD;border-radius:2px"></div>
            ${ttBar}
            <div style="position:absolute;top:0;bottom:0;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div>
          </div>
          <div style="width:70px;font-size:12px;font-weight:600;color:${dlyClr};text-align:center">${dlyTxt}</div>
        </div>`
      })
    }

    // Parse AI content to HTML
    const aiHtml = aiSummary.split('\n').map(line => {
      if (!line.trim()) return '<div style="height:6px"></div>'
      const clean = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').trim()
      if (line.startsWith('## ') || line.startsWith('# ')) {
        const heading = clean.replace(/^#+\s*/, '')
        return `<div style="margin:12px 0 6px;padding:5px 10px;background:#EFF6FF;border-left:3px solid #2563EB;border-radius:0 4px 4px 0;font-weight:700;font-size:15px;color:#1E3A8A">${heading}</div>`
      }
      return `<div style="font-size:14px;line-height:1.7;color:#1E293B;margin:2px 0">${clean}</div>`
    }).join('')

    // Build ảnh đính kèm cảnh báo/tham khảo
    let attachHtml = ''
    const attachments = window._reportAttachments || []
    if (attachments.length) {
      const attachItems = attachments.map(p => `
        <div style="border-radius:6px;overflow:hidden;border:0.5px solid #E2E8F0;background:white">
          <div style="width:100%;padding-top:66%;position:relative;overflow:hidden;background:#F1F5F9">
            <img src="${p.url}" crossorigin="anonymous"
              style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block"
              onerror="this.parentElement.style.background='#FEE2E2'">
          </div>
          ${p.caption ? `<div style="padding:6px 10px;background:#FFFBEB;border-top:2px solid #F59E0B">
            <div style="font-size:12px;font-weight:500;color:#92400E;line-height:1.4">⚠️ ${p.caption}</div>
          </div>` : '<div style="padding:4px 8px;background:#F9FAFB;border-top:1px solid #E5E7EB"><div style="font-size:10px;color:#9CA3AF;font-style:italic">Chưa có ghi chú</div></div>'}
        </div>`
      ).join('')

      attachHtml = `
        <div style="margin-bottom:16px">
          <div style="background:#F59E0B;color:white;font-size:14px;font-weight:700;
            padding:6px 10px;border-radius:4px 4px 0 0">
            📋 LƯU Ý / HÌNH ẢNH THAM KHẢO CÔNG TÁC SẮP THỰC HIỆN (${attachments.length} ảnh)
          </div>
          <div style="border:0.5px solid #FDE68A;border-top:none;padding:10px;
            border-radius:0 0 4px 4px;background:#FFFBEB">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              ${attachItems}
            </div>
          </div>
        </div>`
    }

    // Build photos HTML — dùng ảnh user chọn nếu có, không thì dùng auto
    const finalPhotos = (window._selectedPhotos !== null && window._selectedPhotos !== undefined)
      ? window._selectedPhotos
      : (wPhotos || [])
    let photosHtml = ''
    if (finalPhotos?.length) {
      const photoItems = finalPhotos.map(p => {
        const label = !p.task_id
          ? (p.caption || 'Ảnh tổng thể')
          : (p.tasks?.name || p.caption || '')
        const date = p.taken_at
          ? new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})
          : ''
        const isGeneral = !p.task_id
        return `
          <div style="border-radius:6px;overflow:hidden;border:0.5px solid #E2E8F0;background:white">
            <div style="width:100%;padding-top:66%;position:relative;overflow:hidden;background:#E2E8F0">
              <img src="${p.photo_url}" crossorigin="anonymous"
                style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block"
                onerror="this.parentElement.innerHTML='<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;color:#94A3B8;font-size:11px&quot;>Lỗi ảnh</div>'">
            </div>
            <div style="padding:4px 6px;background:${isGeneral?'#F0FDFA':'white'}">
              <div style="font-size:11px;font-weight:500;color:${isGeneral?'#0D9488':'#334155'};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${label}">
                ${isGeneral?'🚁 ':''}${label.slice(0,35)}
              </div>
              <div style="font-size:10px;color:#94A3B8;margin-top:1px">${date}</div>
            </div>
          </div>`
      }).join('')

      photosHtml = `
        <div style="margin-bottom:16px">
          <div style="background:#1A2B4A;color:white;font-size:14px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
            📷 ẢNH THI CÔNG TUẦN ${wk}/${yr} (${finalPhotos.length} ảnh)
          </div>
          <div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              ${photoItems}
            </div>
          </div>
        </div>`
    }

    // Build attendance chart HTML cho PDF
    let attendanceHtml = ''
    if (STATE._attendanceData?.history?.length) {
      const hist    = STATE._attendanceData.history
      const avgCN   = STATE._attendanceData.avgCN7 || 0
      const maxCN   = Math.max(...hist.map(h => h.cn_proj||0), 1)
      const W = 700, H = 160, PAD = 36
      const barArea = W - PAD - 10
      const barW2   = Math.max(8, Math.floor(barArea / hist.length) - 4)
      const scaleH  = H - 50

      const avgY = H - 32 - Math.round((avgCN / maxCN) * scaleH)

      const bars2 = hist.map((d, i) => {
        const cn  = d.cn_proj || 0
        const h2  = Math.max(4, Math.round((cn / maxCN) * scaleH))
        const x   = PAD + i * (barArea / hist.length)
        const y   = H - 32 - h2
        const dt  = new Date(d.report_date)
        const lbl = `${dt.getDate()}/${dt.getMonth()+1}`
        const dow = ['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()]
        const clr = cn > avgCN ? '#16A34A' : cn < avgCN * 0.8 ? '#DC2626' : '#60A5FA'
        return `
          <rect x="${x}" y="${y}" width="${barW2}" height="${h2}" fill="${clr}" rx="2" opacity="0.85"/>
          <text x="${x+barW2/2}" y="${y-3}" text-anchor="middle" font-size="9" fill="#334155" font-weight="500">${cn}</text>
          <text x="${x+barW2/2}" y="${H-16}" text-anchor="middle" font-size="8" fill="#64748B">${lbl}</text>
          <text x="${x+barW2/2}" y="${H-6}" text-anchor="middle" font-size="7" fill="#94A3B8">${dow}</text>`
      }).join('')

      attendanceHtml = `
        <div style="margin-bottom:16px">
          <div style="background:#1A2B4A;color:white;font-size:14px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
            👷 QUÂN SỐ CÔNG NHÂN 30 NGÀY GẦN NHẤT
          </div>
          <div style="border:0.5px solid #E2E8F0;border-top:none;padding:12px;border-radius:0 0 4px 4px;background:#FAFAFA">
            <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
              <line x1="${PAD}" y1="${H-32}" x2="${W-10}" y2="${H-32}" stroke="#E2E8F0" stroke-width="0.5"/>
              <line x1="${PAD}" y1="${avgY}" x2="${W-10}" y2="${avgY}" stroke="#D97706" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
              <text x="${W-8}" y="${avgY+4}" font-size="8" fill="#D97706" font-weight="600">TB</text>
              <text x="${PAD-4}" y="${H-32}" text-anchor="end" font-size="8" fill="#94A3B8" dominant-baseline="middle">0</text>
              <text x="${PAD-4}" y="${H-32-scaleH}" text-anchor="end" font-size="8" fill="#94A3B8" dominant-baseline="middle">${maxCN}</text>
              ${bars2}
            </svg>
            <div style="display:flex;gap:16px;margin-top:6px;font-size:11px;flex-wrap:wrap">
              <span>TB 30 ngày: <strong style="color:#2563EB;font-size:13px">${avgCN}</strong> CN/ngày</span>
              <span style="color:#64748B">·</span>
              <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:#16A34A;border-radius:2px;display:inline-block"></span> Trên TB</span>
              <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:#DC2626;border-radius:2px;display:inline-block"></span> Dưới TB 20%</span>
              <span style="display:flex;align-items:center;gap:3px"><span style="border-top:1px dashed #D97706;width:16px;display:inline-block"></span> Trung bình</span>
            </div>
          </div>
        </div>`
    }

    // Build full HTML
    const barW = Math.max(2, totalPct)
    const barClr = totalPct >= 70 ? '#16A34A' : totalPct >= 40 ? '#D97706' : '#DC2626'
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; }
  body { background: white; width: 900px; }
</style>
</head><body>
<div id="pdf-content" style="width:900px;background:white;padding:0">
  <!-- HEADER -->
  <div style="background:#1A2B4A;padding:16px 24px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${LOGO_URL}" style="height:44px;width:auto" crossorigin="anonymous" onerror="this.style.display='none'">
      <div>
        <div style="color:#F97316;font-size:12px;letter-spacing:0.08em;margin-top:2px">PHÒNG KTTC — VELAE&C</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="color:white;font-size:20px;font-weight:700">BÁO CÁO TIẾN ĐỘ THI CÔNG</div>
      <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:3px">${proj.name}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:12px;margin-top:2px">Tuần ${wk}/${yr} &nbsp;|&nbsp; Ngày lập: ${today}</div>
    </div>
  </div>

  <div style="padding:16px 24px">
    <!-- METRICS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div style="background:#2563EB;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:32px;font-weight:700">${leaf.length}</div>
        <div style="font-size:12px;opacity:0.9;margin-top:2px">Tổng công tác</div>
      </div>
      <div style="background:#16A34A;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:32px;font-weight:700">${done.length}</div>
        <div style="font-size:12px;opacity:0.9;margin-top:2px">Hoàn thành</div>
      </div>
      <div style="background:#D97706;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:32px;font-weight:700">${inProg.length}</div>
        <div style="font-size:12px;opacity:0.9;margin-top:2px">Đang thi công</div>
      </div>
      <div style="background:#DC2626;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:32px;font-weight:700">${validLate.length}</div>
        <div style="font-size:12px;opacity:0.9;margin-top:2px">Chậm tiến độ</div>
      </div>
    </div>

    <!-- PROGRESS BAR -->
    <div style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;color:#1A2B4A;margin-bottom:5px">TIẾN ĐỘ TỔNG THỂ: ${totalPct}%</div>
      <div style="background:#E2E8F0;border-radius:99px;height:8px;overflow:hidden">
        <div style="background:${barClr};width:${barW}%;height:100%;border-radius:99px"></div>
      </div>
    </div>

    <!-- AI SUMMARY -->
    <div style="margin-bottom:16px">
      <div style="background:#1A2B4A;color:white;font-size:14px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;letter-spacing:0.04em">
        🤖 PHÂN TÍCH AI — TUẦN ${wk}/${yr}
      </div>
      <div style="border:0.5px solid #E2E8F0;border-top:none;padding:12px;border-radius:0 0 4px 4px;background:#FAFAFA">
        ${aiHtml}
      </div>
    </div>

    <!-- KTTC NOTE - ngay sau AI analysis -->
    ${note ? `
    <div style="margin-bottom:16px;padding:12px 16px;background:#FFFBEB;
      border-left:4px solid #D97706;border-radius:0 4px 4px 0">
      <div style="font-size:14px;font-weight:700;color:#92400E;margin-bottom:6px">
        📝 GHI CHÚ PHÒNG KTTC
      </div>
      <div style="font-size:14px;color:#78350F;white-space:pre-wrap;line-height:1.6">${note}</div>
    </div>` : ''}

    <!-- ATTACH WARNING PHOTOS -->
    ${attachHtml}

    <!-- PHOTOS -->
    ${photosHtml}

    <!-- TABLE -->
    <div style="margin-bottom:16px">
      <div style="background:#1A2B4A;color:white;font-size:14px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
        📋 TIẾN ĐỘ THEO HẠNG MỤC
      </div>
      <table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0">
        <thead>
          <tr style="background:#1E3A5F;color:white">
            <th style="padding:5px 6px;font-size:12px;text-align:left;font-weight:600">Hạng mục / Công tác</th>
            <th style="padding:5px 6px;font-size:12px;text-align:center;width:46px;font-weight:600">KH BD</th>
            <th style="padding:5px 6px;font-size:12px;text-align:center;width:46px;font-weight:600">KH KT</th>
            <th style="padding:5px 6px;font-size:12px;text-align:center;width:40px;font-weight:600">% HT</th>
            <th style="padding:5px 6px;font-size:12px;text-align:center;width:80px;font-weight:600">Trạng thái</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <!-- GANTT -->
    <div>
      <div style="background:#1A2B4A;color:white;font-size:14px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
        📅 SƠ ĐỒ GANTT TỔNG QUAN
      </div>
      <div style="border:0.5px solid #E2E8F0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">
        ${ganttHtml}
        <div style="padding:4px 8px;background:#F8FAFC;font-size:11px;color:#64748B;display:flex;gap:16px">
          <span><span style="display:inline-block;width:12px;height:6px;background:#93C5FD;border-radius:2px;vertical-align:middle;margin-right:3px"></span>KH</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:#86EFAC;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT đúng</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:#FCA5A5;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT trễ</span>
          <span><span style="display:inline-block;width:2px;height:10px;background:#F97316;vertical-align:middle;margin-right:3px"></span>Hôm nay</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ATTENDANCE CHART -->
  <div style="padding:0 24px 16px">
    ${attendanceHtml}
  </div>

  <!-- FOOTER -->
  <div style="background:#F1F5F9;border-top:1px solid #E2E8F0;padding:8px 24px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:#64748B">VelaE&C — Hệ thống theo dõi tiến độ thi công</span>
    <span style="font-size:11px;color:#64748B">Phát hành: Lê Trần Anh Toàn — 0978635450</span>
  </div>
</div>
</body></html>`

    // Render HTML → canvas → PDF using html2canvas
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;z-index:-1'
    container.innerHTML = htmlContent
    document.body.appendChild(container)

    // Wait for logo image to load
    const img = container.querySelector('img')
    if (img) {
      await new Promise(resolve => {
        if (img.complete) resolve()
        else { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 3000) }
      })
    }

    const canvas = await html2canvas(container.querySelector('#pdf-content'), {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: 900,
      logging: false
    })
    document.body.removeChild(container)

    const { jsPDF } = window.jspdf
    const pdfW = 210  // A4 width mm
    const pdfH = Math.round(canvas.height / canvas.width * pdfW)

    // Xuất 1 trang liên tục — không cắt trang, đọc trên mobile/màn hình
    const imgData = canvas.toDataURL('image/jpeg', 0.97)
    const pdf = new jsPDF({ unit: 'mm', format: [pdfW, pdfH], orientation: 'portrait' })
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH)
    const fn = 'BC-TD_' + proj.code.replace(/[^a-zA-Z0-9]/g, '_') + '_Tuan' + week + '_' + year + '.pdf'
    pdf.save(fn)
    toast('Đã xuất PDF: ' + fn, 'success')

  } catch(e) {
    toast('Lỗi xuất PDF: ' + e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
  }
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

  // Find all descendants
  const children = STATE.tasks.filter(t =>
    t.wbs_code.startsWith(task.wbs_code + '.') && !t.is_summary
  )

  const curKeyTask = task.key_task_id
    ? STATE.tasks.find(t => t.id === task.key_task_id)
    : null

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
  const { error } = await sb.from('tasks')
    .update({ key_task_id: keyTaskId }).eq('id', parentId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }

  // Update local state
  const task = STATE.tasks.find(t => t.id === parentId)
  if (task) task.key_task_id = keyTaskId

  toast(keyTaskId ? 'Đã set Key Task!' : 'Đã về trung bình mặc định', 'success')
  closeModal()
  STATE.tasks = computeRollupPct(STATE.tasks)
  navigate('wbs')
}

// ═══════════════════════════════════════════════════════════
// TASK SETTINGS — Planner set đơn vị + kế hoạch
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
        <input class="form-input" type="number" id="ts-qty" placeholder="VD: 66"
          value="${task.planned_quantity||''}">
      </div>
    </div>
    <div class="form-group" id="ts-unit-custom" style="${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?'':'display:none'}">
      <label class="form-label">Đơn vị tùy chỉnh</label>
      <input class="form-input" type="text" id="ts-unit-text" placeholder="VD: chuyến, lượt..."
        value="${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?task.unit||'':''}">
    </div>
    <div class="form-group">
      <label class="form-label">
        ${task.unit && task.unit !== '%' ? 'Đơn giá HĐ (VND/' + (task.unit||'đvt') + ')' : 'Tổng giá trị công tác (VND) — dùng cho tính sản lượng theo %'}
      </label>
      <input class="form-input" type="number" id="ts-unit-price"
        placeholder="${task.unit && task.unit !== '%' ? 'VD: 15000000' : 'VD: 500000000'}"
        value="${task.unit_price||''}"
        style="font-size:14px;font-weight:500">
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
  const unit = unitSel === 'other'
    ? (document.getElementById('ts-unit-text').value.trim() || '%')
    : unitSel
  const planned_quantity = parseFloat(document.getElementById('ts-qty').value) || null
  const unit_price = parseFloat(document.getElementById('ts-unit-price').value) || null

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('tasks')
    .update({ unit, planned_quantity, unit_price }).eq('id', taskId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }

  const task = STATE.tasks.find(t => t.id === taskId)
  if (task) { task.unit = unit; task.planned_quantity = planned_quantity; task.unit_price = unit_price }
  toast('Đã lưu cài đặt!', 'success')
  closeModal()
  navigate('wbs')
}


// ═══════════════════════════════════════════════════════════
// ẢNH ĐÍNH KÈM BÁO CÁO — Cảnh báo / tham khảo công tác
// ═══════════════════════════════════════════════════════════

// Lưu danh sách ảnh đính kèm (url + caption)
if (!window._reportAttachments) window._reportAttachments = []

function renderReportPhotoGrid() {
  const grid = document.getElementById('report-photo-grid')
  if (!grid) return
  const photos = window._reportAttachments

  if (!photos.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;color:var(--gray4);font-size:12px;
        padding:16px;border:1px dashed var(--gray3);border-radius:var(--radius)">
        Chưa có ảnh đính kèm — chọn từ thư viện hoặc upload mới
      </div>`
    return
  }

  grid.innerHTML = photos.map((p, i) => `
    <div style="border-radius:8px;overflow:hidden;border:1px solid var(--gray2);background:white;position:relative">
      <div style="width:100%;padding-top:66%;position:relative;overflow:hidden;background:var(--gray1)">
        <img src="${p.url}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover"
          onerror="this.parentElement.style.background='#FEE2E2'">
      </div>
      <div style="padding:6px 8px;background:#FAFAFA;border-top:1px solid var(--gray2)">
        <div style="font-size:9px;color:var(--gray4);margin-bottom:3px;font-weight:500">✏️ CAPTION / GHI CHÚ:</div>
        <input type="text" value="${p.caption||''}"
          placeholder="Nhập ghi chú hoặc cảnh báo cho ảnh này..."
          style="width:100%;font-size:12px;border:1px solid var(--gray3);border-radius:4px;
            padding:5px 8px;color:var(--gray7);background:white;outline:none;
            box-sizing:border-box"
          oninput="window._reportAttachments[${i}].caption=this.value">
      </div>
      <button onclick="removeReportPhoto(${i})"
        style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.5);color:white;
          border:none;border-radius:50%;width:20px;height:20px;font-size:11px;
          cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
    </div>`
  ).join('')
}

function removeReportPhoto(idx) {
  window._reportAttachments.splice(idx, 1)
  renderReportPhotoGrid()
}

function addReportPhoto(url, caption = '') {
  if (window._reportAttachments.length >= 6) {
    toast('Tối đa 6 ảnh đính kèm', 'error'); return false
  }
  // Kiểm tra trùng
  if (window._reportAttachments.find(p => p.url === url)) {
    toast('Ảnh này đã được thêm', ''); return false
  }
  window._reportAttachments.push({ url, caption })
  renderReportPhotoGrid()
  return true
}

// Chọn từ thư viện ảnh tuần này
async function openReportPhotoLibrary() {
  const modal = document.getElementById('report-library-modal')
  const grid  = document.getElementById('report-library-grid')
  if (!modal || !grid) return

  modal.style.display = 'flex'
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray4)">Đang tải...</div>'

  const proj = STATE.currentProject
  const week = getISOWeek(new Date())
  const year = new Date().getFullYear()

  const { data: photos } = await sb.from('task_photos')
    .select('id,photo_url,caption,taken_at,task_id,tasks(name)')
    .eq('project_id', proj.id)
    .eq('week_number', week)
    .eq('year', year)
    .order('taken_at', { ascending: false })

  if (!photos?.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--gray4)">Chưa có ảnh tuần này</div>'
    return
  }

  grid.innerHTML = photos.map(p => {
    const isAdded = window._reportAttachments.find(a => a.url === p.photo_url)
    const label   = !p.task_id ? (p.caption||'Ảnh tổng thể') : (p.tasks?.name||p.caption||'—')
    const date    = p.taken_at ? new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}) : ''
    return `
      <div style="border-radius:8px;overflow:hidden;border:2px solid ${isAdded?'var(--blue)':'var(--gray2)'};
        cursor:pointer;background:white;transition:border-color .15s"
        onclick="toggleLibraryPhoto('${p.photo_url}','${(label||'').replace(/'/g,"'")}',this)">
        <div style="width:100%;padding-top:66%;position:relative;overflow:hidden;background:var(--gray1)">
          <img src="${p.photo_url}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover">
          ${isAdded ? '<div style="position:absolute;top:4px;right:4px;background:var(--blue);color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px">✓</div>' : ''}
        </div>
        <div style="padding:5px 7px">
          <div style="font-size:10px;font-weight:500;color:var(--gray7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
          <div style="font-size:9px;color:var(--gray4)">${date}</div>
        </div>
      </div>`
  }).join('')
}

function toggleLibraryPhoto(url, caption, el) {
  const existing = window._reportAttachments.findIndex(p => p.url === url)
  if (existing >= 0) {
    // Bỏ chọn
    window._reportAttachments.splice(existing, 1)
    el.style.borderColor = 'var(--gray2)'
    el.querySelector('div>div:last-child') && null
    renderReportPhotoGrid()
  } else {
    if (addReportPhoto(url, caption)) {
      el.style.borderColor = 'var(--blue)'
    }
  }
}

// Upload ảnh mới vào báo cáo
async function handleReportPhotoUpload(input) {
  const files = Array.from(input.files).slice(0, 6 - window._reportAttachments.length)
  if (!files.length) return

  loading(true, 'Đang upload ảnh...')
  try {
    for (const file of files) {
      let uploadFile = file
      if (typeof imageCompression !== 'undefined') {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: true, fileType: 'image/jpeg'
        })
      }
      const proj = STATE.currentProject
      const ext  = 'jpg'
      const path = `${proj.id}/report_attach/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`
      const buf  = await uploadFile.arrayBuffer()

      const { error } = await sb.storage.from(CFG.STORAGE_BUCKET)
        .upload(path, buf, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error

      const { data: urlData } = sb.storage.from(CFG.STORAGE_BUCKET).getPublicUrl(path)
      addReportPhoto(urlData.publicUrl, file.name.replace(/\.[^.]+$/, ''))
    }
    toast(`Đã upload ${files.length} ảnh`, 'success')
  } catch(e) {
    toast('Lỗi upload: ' + e.message, 'error')
  } finally {
    loading(false)
    input.value = ''
  }
}

// ═══════════════════════════════════════════════════════════
// CHỌN & SẮP XẾP ẢNH THI CÔNG CHO PDF
// ═══════════════════════════════════════════════════════════
async function openPhotoSelector() {
  const proj = STATE.currentProject
  const week = getISOWeek(new Date())
  const year = new Date().getFullYear()

  // Tải tất cả ảnh tuần này
  const { data: allPhotos } = await sb.from('task_photos')
    .select('id,photo_url,caption,taken_at,task_id,tasks(name)')
    .eq('project_id', proj.id)
    .eq('week_number', week)
    .eq('year', year)
    .order('taken_at', { ascending: false })

  if (!allPhotos?.length) {
    toast('Chưa có ảnh tuần này', ''); return
  }

  // Nếu chưa có danh sách đã chọn, dùng 9 ảnh mới nhất làm mặc định
  if (!window._selectedPhotos) {
    window._selectedPhotos = allPhotos.slice(0, 9).map(p => ({ ...p }))
  }

  const renderSelector = () => {
    const selectedIds = (window._selectedPhotos || []).map(p => p.id || p.photo_url)

    const allGrid = allPhotos.map(p => {
      const isSelected = selectedIds.includes(p.id || p.photo_url)
      const selIdx     = selectedIds.indexOf(p.id || p.photo_url)
      const label      = !p.task_id ? (p.caption || 'Ảnh tổng thể') : (p.tasks?.name || '—')
      const date       = p.taken_at ? new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}) : ''
      return `
        <div data-pid="${p.id}" data-url="${p.photo_url}" data-label="${encodeURIComponent(label||'')}" data-date="${date}" onclick="_handlePhotoClick(this)"
          style="border-radius:8px;overflow:hidden;border:2px solid ${isSelected?'var(--blue)':'var(--gray2)'};
            cursor:pointer;position:relative;background:white">
          <div style="width:100%;padding-top:66%;position:relative;background:var(--gray1)">
            <img src="${p.photo_url}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover">
            ${isSelected ? `<div style="position:absolute;top:4px;left:4px;background:var(--blue);color:white;
              border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;
              font-size:12px;font-weight:700">${selIdx+1}</div>` : ''}
          </div>
          <div style="padding:4px 6px;font-size:10px;color:var(--gray6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${label}
          </div>
          <div style="padding:0 6px 4px;font-size:9px;color:var(--gray4)">${date}</div>
        </div>`
    }).join('')

    // Danh sách đã chọn (có thể kéo thả)
    const selList = (window._selectedPhotos || []).map((p, i) => {
      const label = !p.task_id ? (p.caption || 'Ảnh tổng thể') : (p.tasks?.name || p.caption || '—')
      return `
        <div id="sel-item-${i}" draggable="true"
          ondragstart="dragPhotoStart(${i})"
          ondragover="event.preventDefault()"
          ondrop="dragPhotoDrop(${i})"
          style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:white;
            border:1px solid var(--gray2);border-radius:6px;cursor:grab;margin-bottom:4px">
          <span style="background:var(--blue);color:white;border-radius:50%;width:20px;height:20px;
            display:flex;align-items:center;justify-content:center;font-size:11px;
            font-weight:700;flex-shrink:0">${i+1}</span>
          <img src="${p.photo_url}" style="width:40px;height:30px;object-fit:cover;border-radius:4px;flex-shrink:0">
          <span style="font-size:11px;color:var(--gray7);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
          <span style="font-size:10px;color:var(--gray4);cursor:pointer;padding:2px 6px"
            onclick="removeSelectedPhoto(${i})">✕</span>
        </div>`
    }).join('')

    document.getElementById('ps-all-grid').innerHTML = allGrid
    document.getElementById('ps-sel-list').innerHTML = selList || '<div style="color:var(--gray4);font-size:12px;padding:8px">Chưa chọn ảnh nào</div>'
    document.getElementById('ps-sel-count').textContent = `${(window._selectedPhotos||[]).length}/9 ảnh`
  }

  // Mở modal chọn ảnh
  openModal('🖼️ Chọn & sắp xếp ảnh thi công cho PDF', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:55vh">
      <!-- Trái: tất cả ảnh -->
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:8px">
          📷 Tất cả ảnh tuần ${week} (${allPhotos.length} ảnh) — Click để chọn/bỏ chọn
        </div>
        <div id="ps-all-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;
          max-height:calc(55vh - 40px);overflow-y:auto"></div>
      </div>
      <!-- Phải: đã chọn + sắp xếp -->
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--gray6);margin-bottom:8px;
          display:flex;justify-content:space-between">
          <span>✅ Đã chọn (kéo thả để sắp xếp)</span>
          <span id="ps-sel-count" style="color:var(--blue)">0/9 ảnh</span>
        </div>
        <div id="ps-sel-list" style="max-height:calc(55vh - 40px);overflow-y:auto"></div>
      </div>
    </div>
  `, `
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
      <button class="btn btn-secondary btn-sm" onclick="resetPhotoSelection()">↩ Reset về mặc định</button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="confirmPhotoSelection()">✅ Xác nhận thứ tự</button>
      </div>
    </div>
  `)

  const m = document.querySelector('.modal')
  m.style.maxWidth = '800px'
  m.style.maxHeight = '90vh'
  renderSelector()
  window._renderPhotoSelector = renderSelector
}

function togglePhotoSelect(id, url, label, date) {
  const sel = window._selectedPhotos || []
  const idx = sel.findIndex(p => (p.id||p.photo_url) === (id||url))
  if (idx >= 0) {
    sel.splice(idx, 1)
  } else {
    if (sel.length >= 9) { toast('Tối đa 9 ảnh cho PDF', 'error'); return }
    // Tìm full photo object
    sel.push({ id, photo_url: url, caption: label, taken_at: date, task_id: null })
  }
  window._selectedPhotos = sel
  if (window._renderPhotoSelector) window._renderPhotoSelector()
}

function removeSelectedPhoto(idx) {
  window._selectedPhotos.splice(idx, 1)
  if (window._renderPhotoSelector) window._renderPhotoSelector()
}

let _dragIdx = null
function dragPhotoStart(idx) { _dragIdx = idx }
function dragPhotoDrop(targetIdx) {
  if (_dragIdx === null || _dragIdx === targetIdx) return
  const arr   = window._selectedPhotos
  const moved = arr.splice(_dragIdx, 1)[0]
  arr.splice(targetIdx, 0, moved)
  _dragIdx = null
  if (window._renderPhotoSelector) window._renderPhotoSelector()
}

function resetPhotoSelection() {
  window._selectedPhotos = null
  if (window._renderPhotoSelector) window._renderPhotoSelector()
  toast('Đã reset về 9 ảnh mới nhất', '')
}

function confirmPhotoSelection() {
  const count = (window._selectedPhotos||[]).length
  closeModal()
  // Cập nhật label trong footer modal báo cáo
  const lbl = document.getElementById('report-photo-count-label')
  if (lbl) lbl.textContent = `Ảnh thi công (${count})`
  toast(`✅ Đã chọn ${count} ảnh theo thứ tự mong muốn`, 'success')
}

function _handlePhotoClick(el) {
  const id    = el.dataset.pid
  const url   = el.dataset.url
  const label = decodeURIComponent(el.dataset.label || '')
  const date  = el.dataset.date
  togglePhotoSelect(id, url, label, date)
}
