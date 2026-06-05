// ═══════════════════════════════════════════════════════════
// GANTT VIEW — đơn giản, layout giống WBS, 3 tab view
// ═══════════════════════════════════════════════════════════

let GANTT_VIEW = 'overview'
let GANTT_MONTH_OFFSET = 0
let GANTT_WEEK_OFFSET  = 0

function gantt() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700">Gantt — Tiến độ KH vs Thực tế</h2>
      <p style="font-size:13px;color:var(--gray4)">${STATE.currentProject?.name||''}</p>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary btn-sm" onclick="exportPDF()">📄 Xuất PDF</button>
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ In</button>
    </div>
  </div>

  <div class="gantt-view-tabs">
    <button class="gv-tab active" onclick="switchGanttView('overview',this)">📋 Tổng quan (theo quý)</button>
    <button class="gv-tab" onclick="switchGanttView('month',this)">📅 Theo tháng</button>
    <button class="gv-tab" onclick="switchGanttView('week',this)">🔍 Theo tuần</button>
  </div>

  <div class="gv-legend">
    <span class="gv-leg"><span class="gv-leg-box" style="background:#9DC3E6"></span>Kế hoạch (KH)</span>
    <span class="gv-leg"><span class="gv-leg-box" style="background:#A9D18E"></span>Thực tế — đúng/vượt</span>
    <span class="gv-leg"><span class="gv-leg-box" style="background:#F09595"></span>Thực tế — chậm</span>
    <span class="gv-leg"><span class="gv-leg-box" style="background:#D85A30;width:4px;height:14px;border-radius:1px"></span>Hôm nay (NOW)</span>
  </div>

  <div id="gantt-nav-row" style="display:none;justify-content:space-between;align-items:center;margin-bottom:8px">
    <button id="gantt-prev" onclick="ganttNav(-1)" style="padding:5px 14px;border:1px solid var(--gray2);border-radius:var(--radius);background:white;cursor:pointer;font-size:13px">‹ Trước</button>
    <span id="gantt-period-label" style="font-size:13px;font-weight:500"></span>
    <button id="gantt-next" onclick="ganttNav(1)" style="padding:5px 14px;border:1px solid var(--gray2);border-radius:var(--radius);background:white;cursor:pointer;font-size:13px">Sau ›</button>
  </div>

  <div id="gantt-content"></div>`
}

function switchGanttView(v, btn) {
  GANTT_VIEW = v
  GANTT_MONTH_OFFSET = 0
  GANTT_WEEK_OFFSET  = 0
  // Update tab active state
  document.querySelectorAll('.gv-tab').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  // Show/hide nav
  const nav = document.getElementById('gantt-nav-row')
  if (nav) nav.style.display = v !== 'overview' ? 'flex' : 'none'
  renderGantt()
}

function ganttNav(dir) {
  if (GANTT_VIEW === 'month') GANTT_MONTH_OFFSET += dir
  else GANTT_WEEK_OFFSET += dir
  renderGantt()
  // Update period label
  updateGanttNavLabel()
}

function updateGanttNavLabel() {
  const el = document.getElementById('gantt-period-label')
  if (!el) return
  const today = new Date()
  if (GANTT_VIEW === 'month') {
    const proj = STATE.currentProject
    const base = new Date(proj.start_date)
    const cur = new Date(base.getFullYear(), base.getMonth() + GANTT_MONTH_OFFSET, 1)
    const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
    el.textContent = `${months[cur.getMonth()]}–${months[(cur.getMonth()+2)%12]} / ${cur.getFullYear()}`
  } else {
    el.textContent = `Tuần ${getISOWeek(today) + GANTT_WEEK_OFFSET} (${GANTT_WEEK_OFFSET === 0 ? 'hiện tại' : GANTT_WEEK_OFFSET > 0 ? '+' + GANTT_WEEK_OFFSET + ' tuần' : GANTT_WEEK_OFFSET + ' tuần'})`
  }
}

function initGantt() {
  GANTT_VIEW = 'overview'
  GANTT_MONTH_OFFSET = 0
  GANTT_WEEK_OFFSET  = 0
  renderGantt()
}

function renderGantt() {
  const el = document.getElementById('gantt-content')
  if (!el) return
  if (!STATE.tasks.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray4)">Chưa có dữ liệu. Import MS Project trước.</div>'
    return
  }
  if (GANTT_VIEW === 'overview') renderGanttOverview(el)
  else if (GANTT_VIEW === 'month') renderGanttMonth(el)
  else renderGanttWeek(el)
  if (GANTT_VIEW !== 'overview') updateGanttNavLabel()
}

// ── HELPER: tính delay ────────────────────────────────────────────────────
function getGanttStatus(task) {
  const today   = new Date(); today.setHours(0,0,0,0)
  const khStart = task.kh_start  ? new Date(task.kh_start)  : null
  const khEnd   = task.kh_finish ? new Date(task.kh_finish) : null
  const pct     = task.display_pct !== undefined ? task.display_pct : (task.pct_complete||0)
  const hasUnit = task.unit && task.unit !== '%' && task.planned_quantity > 0

  if (pct === 100) return {status:'done', barClass:'ok'}

  // Summary: use rollup delay
  if (task.is_summary && task._delay !== undefined) {
    if (task._delay > 7)  return {status:'critical', barClass:'late'}
    if (task._delay > 0)  return {status:'delayed',  barClass:'late'}
    if (task._delay < 0)  return {status:'ahead',    barClass:'ahead'}
    return {status:'ok', barClass:'ok'}
  }

  if (!task.tt_start) {
    if (khStart && today > khStart) return {status:'not_started_late', barClass:'late'}
    return {status:'not_started', barClass:'ok'}
  }

  if (khEnd && today > khEnd && pct < 100) return {status:'late', barClass:'late'}

  if (!khStart || !khEnd) return {status:'ok', barClass:'ok'}

  const khDays      = Math.round((khEnd - khStart) / 86400000)
  const elapsedDays = Math.round((today - khStart) / 86400000)  // dùng KH start làm gốc
  if (khDays <= 0 || elapsedDays <= 0) return {status:'ok', barClass:'ok'}

  if (hasUnit && task.planned_quantity > 0) {
    const velocity    = task.planned_quantity / khDays
    const expectedQty = Math.round(velocity * Math.min(elapsedDays, khDays))
    const actQty      = (task.actual_quantity != null ? task.actual_quantity : 0)
    if (actQty < expectedQty * 0.9) return {status:'late', barClass:'late'}
  } else {
    const expectedPct = Math.min(100, Math.round(elapsedDays / khDays * 100))
    if (pct < expectedPct - 10) return {status:'late', barClass:'late'}
  }

  return {status:'ok', barClass:'ok'}
}

// ── Tam suất: tính lệch theo velocity ────────────────────────────────────
function calcProgressDetail(task) {
  // Summary tasks: use pre-computed rollup delay (max of children)
  if (task.is_summary && task._delayDetail !== undefined) {
    return task._delayDetail
  }
  const today   = new Date(); today.setHours(0,0,0,0)
  const khStart = task.kh_start  ? new Date(task.kh_start)  : null
  const khEnd   = task.kh_finish ? new Date(task.kh_finish) : null
  const ttFinish= task.tt_finish ? new Date(task.tt_finish) : null
  const pct     = task.display_pct !== undefined ? task.display_pct : (task.pct_complete||0)
  const hasUnit = task.unit && task.unit !== '%' && task.planned_quantity > 0
  const planQty = task.planned_quantity || 0
  const actQty  = (task.actual_quantity != null && task.actual_quantity !== undefined)
                  ? task.actual_quantity : 0   // fix undefined
  const khDays  = (khStart && khEnd) ? Math.round((khEnd - khStart) / 86400000) : 0

  // ── 1. Đã hoàn thành: so ngày TT xong vs KH xong ──────────────────────
  if (pct === 100 && ttFinish && khEnd) {
    const d = Math.round((ttFinish - khEnd) / 86400000)
    return {
      delayDays: d,
      label: d > 0  ? `Trễ ${d} ngày`
           : d < 0  ? `Hoàn thành sớm ${Math.abs(d)} ngày`
           : `Đúng KH`,
      done: true, hasUnit: false
    }
  }

  // ── 2. Chưa bắt đầu ────────────────────────────────────────────────────
  if (!task.tt_start) {
    // Nếu đã qua ngày KH bắt đầu mà chưa làm → tính số ngày trễ bắt đầu
    if (khStart && today > khStart) {
      const startDelay = Math.round((today - khStart) / 86400000)
      return { delayDays: startDelay, label: `Chưa BĐ · trễ ${startDelay} ngày`, done:false, hasUnit:false }
    }
    return { delayDays:null, label:'—', done:false, hasUnit:false }
  }

  if (!khStart || !khEnd || khDays <= 0)
    return { delayDays:null, label:'—', done:false, hasUnit:false }

  // ── 3. Đang thi công ────────────────────────────────────────────────────
  // Nếu tt_start < kh_start → bắt đầu sớm hơn KH
  const ttStartDate  = task.tt_start ? new Date(task.tt_start) : null
  const earlyStartDays = (ttStartDate && ttStartDate < khStart)
    ? Math.round((khStart - ttStartDate) / 86400000) : 0

  // elapsedDays tính từ KH start (gốc velocity), nhưng nếu bắt đầu sớm
  // thì kỳ vọng thực tế phải trừ đi số ngày sớm → kỳ vọng thấp hơn
  const elapsedDays = Math.round((today - khStart) / 86400000)

  // Nếu chưa đến ngày KH bắt đầu nhưng đã bắt đầu sớm
  if (elapsedDays <= 0 && earlyStartDays > 0) {
    // Đã bắt đầu trước KH, tính sớm theo số ngày đã làm trước KH
    const earlyElapsed = Math.round((today - ttStartDate) / 86400000)
    if (hasUnit && planQty > 0) {
      const velocity = planQty / khDays
      const earlyExpected = Math.round(velocity * earlyElapsed)
      const aheadQty  = Math.max(0, actQty - earlyExpected)
      const aheadDays = earlyStartDays + (aheadQty > 0 ? Math.round(aheadQty/velocity) : 0)
      return { delayDays: -aheadDays, aheadDays, aheadQty, unit: task.unit,
               label: `Sớm ${aheadDays} ngày${aheadQty>0?' · dư '+aheadQty+' '+task.unit:''}`,
               done:false, hasUnit:true }
    }
    return { delayDays: -earlyStartDays, aheadDays: earlyStartDays,
             label: `Bắt đầu sớm ${earlyStartDays} ngày`, done:false, hasUnit:false }
  }

  if (elapsedDays <= 0 && earlyStartDays === 0)
    return { delayDays:0, label:'Đúng KH', done:false, hasUnit:false }

  if (hasUnit && planQty > 0) {
    // ── Tam suất theo đơn vị (căn, m², m³...) ──────────────────────────
    const velocity    = planQty / khDays
    // Nếu bắt đầu sớm: tại thời điểm KH bắt đầu, task đã có earlyStartDays*velocity done
    const earlyBonus  = Math.round(velocity * earlyStartDays)
    const expectedQty = Math.max(0, Math.round(velocity * Math.min(elapsedDays, khDays)) - earlyBonus)
    const missingQty  = Math.max(0, expectedQty - actQty)
    const delayDays   = missingQty > 0 ? Math.round(missingQty / velocity) : 0

    let overrunDays = 0
    if (khEnd && today > khEnd && pct < 100) {
      overrunDays = Math.round((today - khEnd) / 86400000)
    }
    const totalDelay = Math.max(delayDays, overrunDays) - earlyStartDays

    // Tính buffer: dư so với kỳ vọng + bonus từ bắt đầu sớm
    const aheadQty  = Math.max(0, actQty - expectedQty)
    const aheadDays = aheadQty > 0
      ? Math.round(aheadQty / velocity) + earlyStartDays
      : earlyStartDays > 0 && missingQty === 0 ? earlyStartDays : 0

    return {
      delayDays:  totalDelay > 0 ? totalDelay : -aheadDays,
      missingQty: totalDelay > 0 ? missingQty : 0,
      aheadQty,
      aheadDays,
      unit: task.unit,
      label: totalDelay > 0
        ? `Trễ ${totalDelay} ngày · thiếu ${missingQty} ${task.unit}`
        : aheadDays > 0
        ? `Sớm ${aheadDays} ngày · dư ${aheadQty} ${task.unit}`
        : `Đúng KH`,
      done: false, hasUnit: true
    }
  } else {
    // ── Tam suất theo % ────────────────────────────────────────────────
    const velocityPct  = 100 / khDays
    const earlyBonusPct = velocityPct * earlyStartDays
    const expectedPct  = Math.max(0, Math.min(100, Math.round(velocityPct * Math.min(elapsedDays, khDays))) - Math.round(earlyBonusPct))
    const missingPct   = Math.max(0, expectedPct - pct)
    const delayDays    = missingPct > 0 ? Math.round(missingPct / velocityPct) : 0

    let overrunDays = 0
    if (khEnd && today > khEnd && pct < 100) {
      overrunDays = Math.round((today - khEnd) / 86400000)
    }
    const totalDelay = Math.max(delayDays, overrunDays) - earlyStartDays

    // Buffer % + bonus từ bắt đầu sớm
    const aheadPct  = Math.max(0, pct - expectedPct)
    const aheadDays = aheadPct > 0
      ? Math.round(aheadPct / velocityPct) + earlyStartDays
      : earlyStartDays > 0 && missingPct === 0 ? earlyStartDays : 0

    return {
      delayDays:  totalDelay > 0 ? totalDelay : -aheadDays,
      missingPct: totalDelay > 0 ? missingPct : 0,
      aheadPct,
      aheadDays,
      label: totalDelay > 0
        ? `Trễ ${totalDelay} ngày · thiếu ${missingPct}%`
        : aheadDays > 0
        ? `Sớm ${aheadDays} ngày · dư ${aheadPct}%`
        : `Đúng KH`,
      done: false, hasUnit: false
    }
  }
}

function calcDelayDays(task) {
  return calcProgressDetail(task).delayDays
}

// Tính timeline thực tế từ task (bỏ qua project.start/finish_date từ XML)
function getActualTimeline(tasks) {
  const dates = []
  tasks.forEach(t => {
    if (t.kh_start)  dates.push(new Date(t.kh_start))
    if (t.kh_finish) dates.push(new Date(t.kh_finish))
  })
  if (!dates.length) return null
  const minD = new Date(Math.min(...dates))
  const maxD = new Date(Math.max(...dates))
  // Add 5% padding on each side
  const total = maxD - minD
  const pad = Math.max(total * 0.02, 7 * 86400000) // min 7 days padding
  return {
    start: new Date(minD.getTime() - pad),
    end:   new Date(maxD.getTime() + pad),
    days:  Math.round((new Date(maxD.getTime() + pad) - new Date(minD.getTime() - pad)) / 86400000)
  }
}

function dateToPct(date, rangeStart, rangeDays) {
  if (!date) return null
  const d = new Date(date); d.setHours(0,0,0,0)
  const offset = Math.round((d - rangeStart)/86400000)
  return Math.max(0, Math.min(100, offset/rangeDays*100))
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 1: TỔNG QUAN — tất cả task, scroll dọc, layout giống WBS
// ══════════════════════════════════════════════════════════════════════════
function renderGanttOverview(el) {
  const proj = STATE.currentProject
  // Dùng timeline thực tế từ task thay vì project.start/finish_date từ XML
  const tl = getActualTimeline(STATE.tasks)
  if (!tl) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray4)">Không có dữ liệu</div>'; return }
  const rangeStart = tl.start
  const rangeEnd   = tl.end
  const rangeDays  = tl.days
  const today      = new Date(); today.setHours(0,0,0,0)
  const nowPct     = dateToPct(today, rangeStart, rangeDays)

  // Quarter labels — chỉ hiện các quý trong phạm vi thực tế
  const quarters = []
  let cur = new Date(rangeStart.getFullYear(), Math.floor(rangeStart.getMonth()/3)*3, 1)
  while (cur <= rangeEnd) {
    const qPct = dateToPct(cur, rangeStart, rangeDays)
    if (qPct >= 0 && qPct <= 100) quarters.push({ label: `Q${Math.floor(cur.getMonth()/3)+1} ${cur.getFullYear()}`, pct: qPct })
    cur = new Date(cur.getFullYear(), cur.getMonth()+3, 1)
  }

  const NAME_W = 340, PCT_W = 55, DELAY_W = 110

  // Build childMap for collapse logic
  const _childMap = {}
  STATE.tasks.forEach(t => {
    if (!t.wbs_code) return
    const parts = t.wbs_code.split('.')
    if (parts.length > 1) {
      const parentWbs = parts.slice(0,-1).join('.')
      if (!_childMap[parentWbs]) _childMap[parentWbs] = []
      _childMap[parentWbs].push(t.wbs_code)
    }
  })
  // Default: collapse level >= 4
  const _collapsed = new Set(
    STATE.tasks.filter(t => t.is_summary && t.outline_level >= 4).map(t => t.wbs_code)
  )


  let rows = ''
  STATE.tasks.forEach(t => {
    const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
    const {barClass} = getGanttStatus(t)
    const detail = calcProgressDetail(t)
    const delay = detail.delayDays
    const delayLabel = detail.label
    const delayColor = delay > 0 ? '#A32D2D' : delay < 0 ? '#0D6E4E' : 'var(--gray4)'

    const khL = dateToPct(t.kh_start, rangeStart, rangeDays)
    const khR = dateToPct(t.kh_finish, rangeStart, rangeDays)
    const khW = Math.max(0.3, (khR||0) - (khL||0))
    const ttL = t.tt_start ? dateToPct(t.tt_start, rangeStart, rangeDays) : null
    const ttR = t.tt_finish ? dateToPct(t.tt_finish, rangeStart, rangeDays)
                : (t.tt_start ? Math.min(100, dateToPct(today, rangeStart, rangeDays)) : null)
    const ttW = ttR !== null ? Math.max(0.3, ttR - ttL) : 0

    const indent = (t.outline_level-1)*14
    const pctBg = pct===100?'#DCFCE7':barClass==='late'?'#FEE2E2':pct===0?'var(--gray1)':'#DBEAFE'
    const pctFg = pct===100?'#166534':barClass==='late'?'#991B1B':pct===0?'var(--gray4)':'#1E40AF'
    const rowBg = t.is_summary ? '#F8FAFC' : 'white'
    const fw = t.outline_level <= 1 ? 700 : t.outline_level <= 2 ? 600 : t.is_summary ? 500 : 400
    const fs = t.outline_level <= 1 ? 13 : 12

    const _hasCh = !!_childMap[t.wbs_code]
    const _isColl = _collapsed.has(t.wbs_code)
    // Check if ancestor collapsed
    const _parts = (t.wbs_code||'').split('.')
    const _hidden = _parts.some((_,i) => {
      if (i===_parts.length-1) return false
      return _collapsed.has(_parts.slice(0,i+1).join('.'))
    })
    const _icon = _hasCh ? (_isColl ? '▶' : '▼') : ''

    rows += `<div class="gv-row" data-wbs="${t.wbs_code}" data-level="${t.outline_level}"
      style="min-height:${t.is_summary?28:24}px;background:${rowBg};${_hidden?'display:none':''}"
      onclick="${_hasCh ? `ganttToggleRow(this,'${t.wbs_code}')` : `openUpdateModal('${t.id}')`}"
      >
      <div class="gv-cell-name" style="width:${NAME_W}px;padding-left:${6+indent}px;font-weight:${fw};font-size:${fs}px;white-space:normal;line-height:1.4;padding-top:5px;padding-bottom:5px;display:flex;align-items:flex-start;gap:3px;cursor:${_hasCh?'pointer':'default'}" title="${t.name.replace(/"/g,"'")}">
        <span style="flex-shrink:0;width:12px;font-size:10px;margin-top:2px;color:var(--gray4)">${_icon}</span>
        <span>${t.name}</span>
      </div>
      <div class="gv-cell-small" style="width:${PCT_W}px">
        <span style="font-size:11px;font-weight:600;padding:1px 5px;border-radius:6px;background:${pctBg};color:${pctFg}">${pct}%</span>
      </div>
      <div class="gv-bars-cell">
        ${khL!==null?`<div class="gv-bar kh" style="left:${khL.toFixed(1)}%;width:${khW.toFixed(1)}%"></div>`:''}
        ${ttL!==null&&ttW>0?`<div class="gv-bar ${barClass}" style="left:${ttL.toFixed(1)}%;width:${ttW.toFixed(1)}%"></div>`:''}
        <div class="gv-now" style="left:${nowPct.toFixed(1)}%"></div>
        ${delay>0&&nowPct>=0&&nowPct<=100?`<span class="gv-delay-tag late" style="left:${Math.min(93,nowPct+0.5).toFixed(1)}%;top:12px">+${delay}d</span>`:''}
      </div>
      <div class="gv-cell-small" style="width:${DELAY_W}px;font-size:11px;font-weight:600;color:${delayColor};text-align:center">${delayLabel}</div>
    </div>`
  })

  el.innerHTML = `
  <div style="font-size:11px;color:var(--gray4);margin-bottom:6px">
    ${fmtDate(proj.start_date)} → ${fmtDate(proj.finish_date)} · ${rangeDays} ngày · ${STATE.tasks.length} công tác
  </div>
  <div class="gv-wrap">
    <div class="gv-head">
      <div class="gv-col-name" style="width:${NAME_W}px">Hạng mục / Công tác</div>
      <div class="gv-col-small" style="width:${PCT_W}px">% HT</div>
      <div class="gv-timeline-head" style="position:relative;overflow:hidden">
        ${quarters.map(q=>`<div class="gv-period" style="left:${q.pct.toFixed(1)}%;min-width:60px">${q.label}</div>`).join('')}
        <div class="gv-now" style="left:${nowPct.toFixed(1)}%">
          <div style="position:absolute;top:2px;left:3px;font-size:9px;color:#D85A30;font-weight:600">NOW</div>
        </div>
      </div>
      <div class="gv-col-small" style="width:${DELAY_W}px">Lệch tiến độ</div>
    </div>
    <div style="overflow-y:auto;max-height:calc(100vh - 340px)">${rows}</div>
  </div>`
}

// ── Toggle collapse/expand hàng Gantt ────────────────────────────────────
function ganttToggleRow(rowEl, wbsCode) {
  const container = rowEl.parentElement
  const allRows = container.querySelectorAll('.gv-row')
  const isNowCollapsed = rowEl.querySelector('span')?.textContent?.trim() === '▶'

  // Toggle icon
  const iconEl = rowEl.querySelector('span:first-child')
  if (iconEl) iconEl.textContent = isNowCollapsed ? '▼' : '▶'

  // Show/hide children
  allRows.forEach(r => {
    const rWbs = r.dataset.wbs
    if (!rWbs || rWbs === wbsCode) return
    if (rWbs.startsWith(wbsCode + '.')) {
      if (isNowCollapsed) {
        // Expand: only show direct children, keep deeper collapsed
        const rel = rWbs.slice(wbsCode.length + 1)
        if (!rel.includes('.')) {
          r.style.display = ''
        }
      } else {
        // Collapse all descendants
        r.style.display = 'none'
        // Reset their icons to collapsed
        const icon = r.querySelector('span:first-child')
        if (icon && (icon.textContent.trim() === '▼')) icon.textContent = '▶'
      }
    }
  })
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 2: THEO THÁNG
// ══════════════════════════════════════════════════════════════════════════
function renderGanttMonth(el) {
  const proj = STATE.currentProject
  // Dùng ngày task sớm nhất làm gốc (không phải project.start_date)
  const tl2 = getActualTimeline(STATE.tasks)
  const projStart = tl2 ? tl2.start : new Date(proj.start_date)
  const today = new Date(); today.setHours(0,0,0,0)

  const winStart = new Date(projStart.getFullYear(), projStart.getMonth() + GANTT_MONTH_OFFSET, 1)
  const winEnd   = new Date(winStart.getFullYear(), winStart.getMonth()+3, 0)
  const rangeDays = Math.round((winEnd - winStart)/86400000) + 1
  const nowPct    = dateToPct(today, winStart, rangeDays)

  const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
  const m0 = winStart.getMonth(), y0 = winStart.getFullYear()
  const periods = [0,1,2].map(i => {
    const m = (m0+i)%12, y = y0 + Math.floor((m0+i)/12)
    const ms = new Date(y, m, 1)
    return { label: `${months[m]}/${y}`, leftPct: dateToPct(ms, winStart, rangeDays), widthPct: new Date(y,m+1,0).getDate()/rangeDays*100 }
  })

  const tasks = STATE.tasks.filter(t => {
    if (!t.kh_start || !t.kh_finish) return false
    const s = new Date(t.kh_start), e = new Date(t.kh_finish)
    const inWin = s <= winEnd && e >= winStart
    const overdue = t.tt_start && (t.pct_complete||0) < 100 && e < winStart
    return inWin || overdue
  }).sort((a,b) => {
    const aO = a.tt_start && (a.pct_complete||0)<100 && new Date(a.kh_finish)<winStart
    const bO = b.tt_start && (b.pct_complete||0)<100 && new Date(b.kh_finish)<winStart
    if (aO&&!bO) return -1; if (!aO&&bO) return 1
    return new Date(a.kh_start)-new Date(b.kh_start)
  }).slice(0,50)

  const NAME_W=260, PCT_W=50, DELAY_W=110
  let rows = ''
  tasks.forEach(t => {
    const pct = t.pct_complete||0
    const {barClass} = getGanttStatus(t)
    const detail = calcProgressDetail(t)
    const delay = detail.delayDays
    const delayColor = delay>0?'#A32D2D':delay<0?'#3B6D11':'var(--gray4)'
    const indent = (t.outline_level-1)*12
    const isOverdue = t.tt_start && pct<100 && t.kh_finish && new Date(t.kh_finish)<winStart

    const khL = Math.max(0, dateToPct(t.kh_start, winStart, rangeDays)||0)
    const khR = Math.min(100, dateToPct(t.kh_finish, winStart, rangeDays)||0)
    const khW = Math.max(0.5, khR-khL)
    const ttL = t.tt_start ? Math.max(0, dateToPct(t.tt_start, winStart, rangeDays)) : null
    const ttRaw = t.tt_finish ? Math.min(100, dateToPct(t.tt_finish, winStart, rangeDays))
                : (t.tt_start ? Math.min(100, dateToPct(today, winStart, rangeDays)) : null)
    const ttW = ttRaw!==null ? Math.max(0.5, ttRaw-ttL) : 0
    const pctBg = pct===100?'#DCFCE7':barClass==='late'?'#FEE2E2':pct===0?'var(--gray1)':'#DBEAFE'
    const pctFg = pct===100?'#166534':barClass==='late'?'#991B1B':pct===0?'var(--gray4)':'#1E40AF'

    rows += `<div class="gv-row ${t.is_summary?'sum':''}" style="min-height:26px;cursor:pointer" onclick="${!t.is_summary?`openUpdateModal('${t.id}')`:''}" >
      <div class="gv-cell-name" style="width:${NAME_W}px;padding-left:${6+indent}px;font-weight:${t.is_summary?600:400};font-size:12px;display:flex;align-items:center;gap:4px" title="${t.name.replace(/"/g,"'")}">
        <span style="flex:1;white-space:normal;line-height:1.4">${t.name}</span>
        ${isOverdue?'<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#FEE2E2;color:#991B1B;flex-shrink:0;margin-top:2px">TRỄ</span>':''}
      </div>
      <div class="gv-cell-small" style="width:${PCT_W}px">
        <span style="font-size:11px;font-weight:600;padding:1px 5px;border-radius:6px;background:${pctBg};color:${pctFg}">${pct}%</span>
      </div>
      <div class="gv-bars-cell">
        ${khW>0?`<div class="gv-bar kh" style="left:${khL.toFixed(1)}%;width:${khW.toFixed(1)}%"></div>`:''}
        ${ttL!==null&&ttW>0?`<div class="gv-bar ${barClass}" style="left:${ttL.toFixed(1)}%;width:${ttW.toFixed(1)}%"></div>`:''}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"></div>`:''}
        ${delay>0&&nowPct>=0&&nowPct<=100?`<span class="gv-delay-tag late" style="left:${Math.min(92,nowPct+0.5).toFixed(1)}%;top:13px">${delay}d trễ</span>`:''}
      </div>
      <div class="gv-cell-small" style="width:${DELAY_W}px;font-size:11px;font-weight:600;color:${delayColor};text-align:center;white-space:normal;line-height:1.4">${detail.label}</div>
    </div>`
  })

  const periodLabel = `${months[m0]}–${months[(m0+2)%12]} / ${y0}`
  document.getElementById('gantt-period-label') && (document.getElementById('gantt-period-label').textContent = periodLabel)

  el.innerHTML = `
  <div class="gv-wrap">
    <div class="gv-head">
      <div class="gv-col-name" style="width:${NAME_W}px">Công tác</div>
      <div class="gv-col-small" style="width:${PCT_W}px">%</div>
      <div class="gv-timeline-head" style="position:relative;overflow:hidden">
        ${periods.map(p=>`<div class="gv-period" style="left:${p.leftPct.toFixed(1)}%;width:${p.widthPct.toFixed(1)}%">${p.label}</div>`).join('')}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"><div style="position:absolute;top:2px;left:3px;font-size:9px;color:#D85A30;font-weight:600">NOW</div></div>`:''}
      </div>
      <div class="gv-col-small" style="width:${DELAY_W}px">Lệch</div>
    </div>
    <div style="overflow-y:auto;max-height:calc(100vh - 380px)">${rows || '<div style="padding:30px;text-align:center;color:var(--gray4)">Không có công tác trong khoảng này</div>'}</div>
  </div>
  <div style="font-size:11px;color:var(--gray4);margin-top:6px;text-align:center">Click vào công tác để cập nhật tiến độ</div>`
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 3: THEO TUẦN
// ══════════════════════════════════════════════════════════════════════════
function renderGanttWeek(el) {
  const today = new Date(); today.setHours(0,0,0,0)
  const monday = new Date(today)
  monday.setDate(today.getDate() - (today.getDay()||7)+1 + GANTT_WEEK_OFFSET*7 - 14)
  const winStart = monday
  const winEnd   = new Date(monday); winEnd.setDate(monday.getDate()+41)
  const rangeDays = 42
  const nowPct   = dateToPct(today, winStart, rangeDays)

  const weekLabels = Array.from({length:6},(_,i) => {
    const ws = new Date(winStart); ws.setDate(winStart.getDate()+i*7)
    return { label:`T.${getISOWeek(ws)}
${ws.getDate()}/${ws.getMonth()+1}`, left:i/6*100 }
  })

  const tasks = STATE.tasks.filter(t => {
    if (!t.kh_start || !t.kh_finish || t.is_summary) return false
    const s = new Date(t.kh_start), e = new Date(t.kh_finish)
    const inWin = s <= winEnd && e >= winStart
    const overdue = t.tt_start && (t.pct_complete||0) < 100 && e < winStart
    return inWin || overdue
  }).sort((a,b) => {
    const aO = a.tt_start&&(a.pct_complete||0)<100&&new Date(a.kh_finish)<winStart
    const bO = b.tt_start&&(b.pct_complete||0)<100&&new Date(b.kh_finish)<winStart
    if(aO&&!bO) return -1; if(!aO&&bO) return 1
    return new Date(a.kh_start)-new Date(b.kh_start)
  }).slice(0,40)

  const winLabel = `Tuần ${getISOWeek(winStart)}–${getISOWeek(winEnd)} / ${winStart.getFullYear()}`
  document.getElementById('gantt-period-label') && (document.getElementById('gantt-period-label').textContent = winLabel)

  const NAME_W=240, PCT_W=50, DELAY_W=110
  let rows = ''
  tasks.forEach(t => {
    const pct = t.pct_complete||0
    const {barClass} = getGanttStatus(t)
    const detail = calcProgressDetail(t)
    const delay = detail.delayDays
    const delayColor = delay>0?'#A32D2D':delay<0?'#3B6D11':'var(--gray4)'
    const isOverdue = t.tt_start && pct<100 && t.kh_finish && new Date(t.kh_finish)<winStart

    const khL = Math.max(0, dateToPct(t.kh_start, winStart, rangeDays)||0)
    const khR = Math.min(100, dateToPct(t.kh_finish, winStart, rangeDays)||0)
    const khW = Math.max(0.5, khR-khL)
    const ttL = t.tt_start ? Math.max(0, dateToPct(t.tt_start, winStart, rangeDays)) : null
    const ttRaw = t.tt_finish ? Math.min(100, dateToPct(t.tt_finish, winStart, rangeDays))
                : (t.tt_start ? Math.min(100, dateToPct(today, winStart, rangeDays)) : null)
    const ttW = ttRaw!==null ? Math.max(0.5, ttRaw-ttL) : 0
    const pctBg = pct===100?'#DCFCE7':barClass==='late'?'#FEE2E2':pct===0?'var(--gray1)':'#DBEAFE'
    const pctFg = pct===100?'#166534':barClass==='late'?'#991B1B':pct===0?'var(--gray4)':'#1E40AF'

    rows += `<div class="gv-row" style="min-height:28px;cursor:pointer" onclick="openUpdateModal('${t.id}')">
      <div class="gv-cell-name" style="width:${NAME_W}px;font-size:12px;display:flex;align-items:center;gap:4px" title="${t.name.replace(/"/g,"'")}">
        <span style="flex:1;white-space:normal;line-height:1.4">${t.name}</span>
        ${isOverdue?'<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#FEE2E2;color:#991B1B;flex-shrink:0;margin-top:2px">TRỄ</span>':''}
      </div>
      <div class="gv-cell-small" style="width:${PCT_W}px">
        <span style="font-size:11px;font-weight:600;padding:1px 5px;border-radius:6px;background:${pctBg};color:${pctFg}">${pct}%</span>
      </div>
      <div class="gv-bars-cell">
        ${khW>0?`<div class="gv-bar kh" style="left:${khL.toFixed(1)}%;width:${khW.toFixed(1)}%"></div>`:''}
        ${ttL!==null&&ttW>0?`<div class="gv-bar ${barClass}" style="left:${ttL.toFixed(1)}%;width:${ttW.toFixed(1)}%"></div>`:''}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"></div>`:''}
        ${delay>0&&nowPct>=0&&nowPct<=100?`<span class="gv-delay-tag late" style="left:${Math.min(90,nowPct+0.5).toFixed(1)}%;top:14px">${delay}d trễ</span>`:''}
      </div>
      <div class="gv-cell-small" style="width:${DELAY_W}px;font-size:11px;font-weight:600;color:${delayColor};text-align:center;white-space:normal;line-height:1.4">${detail.label}</div>
    </div>`
  })

  el.innerHTML = `
  <div class="gv-wrap">
    <div class="gv-head">
      <div class="gv-col-name" style="width:${NAME_W}px">Công tác</div>
      <div class="gv-col-small" style="width:${PCT_W}px">%</div>
      <div class="gv-timeline-head" style="position:relative;overflow:hidden;min-height:40px">
        ${weekLabels.map(w=>`<div class="gv-period" style="left:${w.left.toFixed(1)}%;width:16.67%;white-space:pre;flex-direction:column;font-size:9px">${w.label}</div>`).join('')}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"><div style="position:absolute;bottom:2px;left:3px;font-size:9px;color:#D85A30;font-weight:600">NOW</div></div>`:''}
      </div>
      <div class="gv-col-small" style="width:${DELAY_W}px">Lệch tiến độ</div>
    </div>
    <div style="overflow-y:auto;max-height:calc(100vh - 380px)">${rows || '<div style="padding:30px;text-align:center;color:var(--gray4)">Không có công tác trong 6 tuần này</div>'}</div>
  </div>
  <div style="font-size:11px;color:var(--gray4);margin-top:6px;text-align:center">Click vào công tác để cập nhật tiến độ trực tiếp</div>`
}
