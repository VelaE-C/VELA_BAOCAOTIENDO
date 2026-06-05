// ═══════════════════════════════════════════════════════════
// EXPORT WEEKLY REPORT (text-based)
// ═══════════════════════════════════════════════════════════
async function exportWeeklyReport() {
  const LOGO_URL = 'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png'
  const proj = STATE.currentProject
  if (!proj) { toast('Chưa có dự án', 'error'); return }

  const week = getISOWeek(new Date())
  const year = new Date().getFullYear()
  const { data: aiData } = await sb.from('ai_summaries')
    .select('*').eq('project_id', proj.id)
    .eq('week_number', week).eq('year', year)
    .order('created_at', { ascending: false }).limit(1)
  const aiSummary = aiData?.[0]?.summary_text || null

  if (!aiSummary) {
    toast('Chưa có AI tóm tắt tuần này. Hãy bấm "🤖 AI Tóm tắt" trước.', 'error')
    return
  }

  loading(true, 'Đang tạo PDF báo cáo tuần...')
  try {
    const tasks   = STATE.tasks
    const leaf    = tasks.filter(t => !t.is_summary)
    const done    = leaf.filter(t => (t.pct_complete||0) === 100)
    const inProg  = leaf.filter(t => t.tt_start && (t.pct_complete||0) < 100)
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
        <td style="padding:4px 6px;padding-left:${indent+6}px;font-weight:${fw};font-size:10px;max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</td>
        <td style="padding:4px 6px;font-size:9px;color:#64748B;text-align:center">${khStart}</td>
        <td style="padding:4px 6px;font-size:9px;color:#64748B;text-align:center">${khEnd}</td>
        <td style="padding:4px 6px;font-size:10px;font-weight:600;color:${pctColor};text-align:center">${pct}%</td>
        <td style="padding:4px 6px;font-size:9px;text-align:center">${statusStr}</td>
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
        quarters.push(`<span style="position:absolute;left:${pct2}%;font-size:8px;color:rgba(255,255,255,0.8);white-space:nowrap">Q${Math.floor(qc.getMonth()/3)+1}/${qc.getFullYear()}</span>`)
        qc = new Date(qc.getFullYear(), qc.getMonth()+3, 1)
      }
      ganttHtml = `
        <div style="display:flex;align-items:center;background:#1A2B4A;color:white;font-size:9px;padding:5px 8px;border-radius:4px 4px 0 0;position:relative;height:20px">
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
          <div style="width:70px;font-size:9px;font-weight:600;color:${dlyClr};text-align:center">${dlyTxt}</div>
        </div>`
      })
    }

    // Parse AI content to HTML
    const aiHtml = aiSummary.split('\n').map(line => {
      if (!line.trim()) return '<div style="height:6px"></div>'
      const clean = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').trim()
      if (line.startsWith('## ') || line.startsWith('# ')) {
        const heading = clean.replace(/^#+\s*/, '')
        return `<div style="margin:12px 0 6px;padding:5px 10px;background:#EFF6FF;border-left:3px solid #2563EB;border-radius:0 4px 4px 0;font-weight:700;font-size:11px;color:#1E3A8A">${heading}</div>`
      }
      return `<div style="font-size:10px;line-height:1.7;color:#1E293B;margin:2px 0">${clean}</div>`
    }).join('')

    // Build full HTML
    const barW = Math.max(2, totalPct)
    const barClr = totalPct >= 70 ? '#16A34A' : totalPct >= 40 ? '#D97706' : '#DC2626'
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; }
  body { background: white; width: 794px; }
</style>
</head><body>
<div id="pdf-content" style="width:794px;background:white;padding:0">
  <!-- HEADER -->
  <div style="background:#1A2B4A;padding:16px 24px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${LOGO_URL}" style="height:44px;width:auto" crossorigin="anonymous" onerror="this.style.display='none'">
      <div>
        <div style="color:#F97316;font-size:9px;letter-spacing:0.08em;margin-top:2px">PHÒNG KTTC — VELAE&C</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="color:white;font-size:15px;font-weight:700">BÁO CÁO TIẾN ĐỘ THI CÔNG</div>
      <div style="color:rgba(255,255,255,0.8);font-size:10px;margin-top:3px">${proj.name}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:9px;margin-top:2px">Tuần ${week}/${year} &nbsp;|&nbsp; Ngày lập: ${today}</div>
    </div>
  </div>

  <div style="padding:16px 24px">
    <!-- METRICS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div style="background:#2563EB;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${leaf.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Tổng công tác</div>
      </div>
      <div style="background:#16A34A;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${done.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Hoàn thành</div>
      </div>
      <div style="background:#D97706;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${inProg.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Đang thi công</div>
      </div>
      <div style="background:#DC2626;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${validLate.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Chậm tiến độ</div>
      </div>
    </div>

    <!-- PROGRESS BAR -->
    <div style="margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:#1A2B4A;margin-bottom:5px">TIẾN ĐỘ TỔNG THỂ: ${totalPct}%</div>
      <div style="background:#E2E8F0;border-radius:99px;height:8px;overflow:hidden">
        <div style="background:${barClr};width:${barW}%;height:100%;border-radius:99px"></div>
      </div>
    </div>

    <!-- AI SUMMARY -->
    <div style="margin-bottom:16px">
      <div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;letter-spacing:0.04em">
        🤖 PHÂN TÍCH AI — TUẦN ${week}/${year}
      </div>
      <div style="border:0.5px solid #E2E8F0;border-top:none;padding:12px;border-radius:0 0 4px 4px;background:#FAFAFA">
        ${aiHtml}
      </div>
    </div>

    <!-- TABLE -->
    <div style="margin-bottom:16px">
      <div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
        📋 TIẾN ĐỘ THEO HẠNG MỤC
      </div>
      <table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0">
        <thead>
          <tr style="background:#1E3A5F;color:white">
            <th style="padding:5px 6px;font-size:9px;text-align:left;font-weight:600">Hạng mục / Công tác</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:46px;font-weight:600">KH BD</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:46px;font-weight:600">KH KT</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:40px;font-weight:600">% HT</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:80px;font-weight:600">Trạng thái</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <!-- GANTT -->
    <div>
      <div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
        📅 SƠ ĐỒ GANTT TỔNG QUAN
      </div>
      <div style="border:0.5px solid #E2E8F0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">
        ${ganttHtml}
        <div style="padding:4px 8px;background:#F8FAFC;font-size:8px;color:#64748B;display:flex;gap:16px">
          <span><span style="display:inline-block;width:12px;height:6px;background:#93C5FD;border-radius:2px;vertical-align:middle;margin-right:3px"></span>KH</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:#86EFAC;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT đúng</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:#FCA5A5;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT trễ</span>
          <span><span style="display:inline-block;width:2px;height:10px;background:#F97316;vertical-align:middle;margin-right:3px"></span>Hôm nay</span>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:#F1F5F9;border-top:1px solid #E2E8F0;padding:8px 24px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:8px;color:#64748B">VelaE&C — Hệ thống theo dõi tiến độ thi công</span>
    <span style="font-size:8px;color:#64748B">Phát hành: Lê Trần Anh Toàn — 0978635450</span>
  </div>
</div>
</body></html>`

    // Render HTML → canvas → PDF using html2canvas
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;z-index:-1'
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
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: 794,
      logging: false
    })
    document.body.removeChild(container)

    const { jsPDF } = window.jspdf
    const pdfW = 210        // A4 width mm
    const pdfH = Math.round(canvas.height / canvas.width * pdfW)  // proportional height

    // Strategy: split at A4 boundaries but only at row boundaries
    // Use full-height custom page to avoid cutting rows
    const A4H = 297
    const imgData = canvas.toDataURL('image/jpeg', 0.93)

    if (pdfH <= A4H * 1.15) {
      // Short enough — single A4 page, scale to fit
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const scale = Math.min(1, A4H / pdfH)
      const drawH = pdfH * scale
      const drawW = pdfW * scale
      const offsetX = (pdfW - drawW) / 2
      pdf.addImage(imgData, 'JPEG', offsetX, 0, drawW, drawH)
      const fn = 'BC-TD_' + proj.code.replace(/[^a-zA-Z0-9]/g, '_') + '_Tuan' + week + '_' + year + '.pdf'
      pdf.save(fn)
    } else {
      // Multi-page: use custom page height = full content (no cutting)
      // Split into A4-sized slices by pixel rows
      const pdf = new jsPDF({ unit: 'mm', format: [pdfW, A4H] })
      const pxPerPage = Math.floor(canvas.height * A4H / pdfH)  // pixels per A4 page
      const totalPages = Math.ceil(canvas.height / pxPerPage)

      for (let pg = 0; pg < totalPages; pg++) {
        if (pg > 0) pdf.addPage([pdfW, A4H])
        const srcY = pg * pxPerPage
        const srcH = Math.min(pxPerPage, canvas.height - srcY)
        const sliceH_mm = srcH / canvas.height * pdfH

        // Create slice canvas
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = srcH
        const ctx2 = slice.getContext('2d')
        ctx2.fillStyle = '#ffffff'
        ctx2.fillRect(0, 0, slice.width, slice.height)
        ctx2.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

        pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pdfW, sliceH_mm)
      }
      const fn = 'BC-TD_' + proj.code.replace(/[^a-zA-Z0-9]/g, '_') + '_Tuan' + week + '_' + year + '.pdf'
      pdf.save(fn)
    }
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
      <td style="font-size:11px;color:var(--gray5)">${new Date(h.updated_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
      <td style="text-align:center;font-weight:600;color:var(--blue)">${h.actual_quantity != null ? h.actual_quantity + ' ' + (h.unit||'') : h.pct_complete + '%'}</td>
      <td style="text-align:center">${h.pct_complete}%</td>
      <td style="font-size:11px">${h.note||'—'}</td>
      <td style="font-size:11px;color:var(--gray4)">${h.updated_by?.split('@')[0]||'—'}</td>
      <td style="text-align:center">
        <button class="btn btn-secondary btn-sm" onclick="editProgress('${h.id}','${taskId}',${h.pct_complete},'${h.note||''}',${h.actual_quantity||'null'})">✏️</button>
        ${isAdmin ? `<button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteProgress('${h.id}','${taskId}')">🗑️</button>` : ''}
      </td>
    </tr>`) .join('')
  : '<tr><td colspan="6" style="text-align:center;color:var(--gray4);padding:20px">Chưa có lịch sử cập nhật</td></tr>'

  openModal(`📋 Lịch sử: ${task.name}`,`
    <div style="font-size:12px;color:var(--gray5);margin-bottom:12px">
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
      <div style="font-size:12px;font-weight:600;color:var(--gray7);margin-bottom:8px">➕ Nhập tay override</div>
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
    <div style="font-size:12px;color:var(--gray5);margin-bottom:14px">
      Chọn công tác con nào sẽ điều khiển % hoàn thành của "${task.name}".
      Nếu không chọn, hệ thống dùng trung bình có trọng số.
    </div>
    ${curKeyTask ? `<div style="padding:8px 12px;background:var(--lblue);border-radius:6px;font-size:12px;margin-bottom:12px">
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
          <div style="font-size:11px;color:var(--gray4)">${c.wbs_code} · ${c.pct_complete||0}% hoàn thành</div>
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
        ? '<div style="font-size:11px;color:var(--gray4);margin-top:4px">Tổng giá trị: <strong>' + ((task.unit_price * task.planned_quantity)/1e9).toFixed(3) + ' tỷ</strong></div>'
        : task.unit_price && task.unit === '%'
        ? '<div style="font-size:11px;color:var(--gray4);margin-top:4px">Giá trị công tác: <strong>' + (task.unit_price/1e9).toFixed(3) + ' tỷ</strong></div>'
        : ''}
    </div>

    ${task.is_summary ? `
    <div style="margin-top:4px;padding:10px;background:var(--lblue);border-radius:6px;font-size:12px;color:var(--gray6)">
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
