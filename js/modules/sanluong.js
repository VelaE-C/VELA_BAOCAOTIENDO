// ═══════════════════════════════════════════════════════════
// PAGE: SẢN LƯỢNG THỰC HIỆN
// ═══════════════════════════════════════════════════════════
function sanluong() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700">Sản lượng thực hiện</h2>
      <p style="font-size:13px;color:var(--gray4)" id="sl-proj-name">${STATE.currentProject?.name||''}</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="sl-weeks" class="form-input" style="width:160px;font-size:13px">
        <option value="8">8 tuần gần nhất</option>
        <option value="12" selected>12 tuần gần nhất</option>
        <option value="24">24 tuần gần nhất</option>
        <option value="0">Toàn bộ dự án</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="loadSanLuong()">🔄 Tải lại</button>
    </div>
  </div>

  <!-- Chart -->
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="card-title" style="margin:0">📊 Biểu đồ sản lượng theo tuần</div>
      <div style="display:flex;gap:14px;font-size:11px;color:var(--gray5);flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:4px">
          <span style="width:12px;height:12px;background:#2563EB;border-radius:2px;display:inline-block"></span> Sản lượng tuần
        </span>
        <span style="display:flex;align-items:center;gap:4px">
          <span style="width:20px;height:2px;background:#D97706;display:inline-block"></span> Lũy kế
        </span>
      </div>
    </div>
    <div id="sl-chart" style="min-height:260px;overflow-x:auto"></div>
  </div>

  <!-- Bảng hạng mục -->
  <div class="card" style="padding:0;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--gray2);flex-wrap:wrap;gap:8px">
      <div class="card-title" style="margin:0">📋 Sản lượng theo hạng mục</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="slCollapseLevel(1)" style="font-size:11px">Lv1</button>
        <button class="btn btn-secondary btn-sm" onclick="slCollapseLevel(2)" style="font-size:11px">Lv2</button>
        <button class="btn btn-secondary btn-sm" onclick="slCollapseLevel(3)" style="font-size:11px">Lv3</button>
        <button class="btn btn-secondary btn-sm" onclick="slCollapseLevel(99)" style="font-size:11px">Tất cả</button>
      </div>
    </div>
    <div id="sl-table-wrap"></div>
    <!-- Tổng footer -->
    <div id="sl-footer" style="background:var(--navy);color:white;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span style="font-size:13px;font-weight:700">TỔNG CỘNG</span>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <span style="font-size:12px">Giá trị HĐ: <strong id="sl-total-cv" style="color:#93C5FD">—</strong></span>
        <span style="font-size:12px">Sản lượng TH: <strong id="sl-total-earned" style="color:#6EE7B7">—</strong></span>
        <span style="font-size:12px">% Đạt: <strong id="sl-total-pct" style="color:#FCD34D">—</strong></span>
      </div>
    </div>
  </div>`
}

// ── Collapse theo level ──────────────────────────────────────
let _slExpandedLevels = 99
function slCollapseLevel(maxLevel) {
  _slExpandedLevels = maxLevel
  // Mobile: div list
  const mobList = document.getElementById('sl-mob-list')
  if (mobList) {
    mobList.querySelectorAll('[data-level]').forEach(row => {
      const lv = parseInt(row.dataset.level)
      row.style.display = lv <= maxLevel ? '' : 'none'
      const arrow = row.querySelector('.sl-arrow')
      if (arrow) {
        const wbs = row.dataset.wbs
        const hasChildren = mobList.querySelector(`[data-parent-wbs="${wbs}"]`)
        if (hasChildren) arrow.textContent = lv < maxLevel ? '▼' : '▶'
      }
    })
  }
  // Desktop: table rows
  const tbody = document.getElementById('sl-tbody')
  if (tbody) {
    tbody.querySelectorAll('tr[data-level]').forEach(row => {
      const lv = parseInt(row.dataset.level)
      row.style.display = lv <= maxLevel ? '' : 'none'
      const arrow = row.querySelector('.sl-arrow')
      if (arrow) {
        const wbs = row.dataset.wbs
        const hasChildren = tbody.querySelector(`tr[data-parent-wbs="${wbs}"]`)
        if (hasChildren) arrow.textContent = lv < maxLevel ? '▼' : '▶'
      }
    })
  }
}

function slToggleRow(wbs, level) {
  const tbody = document.getElementById('sl-tbody')
  if (!tbody) return
  const children = tbody.querySelectorAll(`tr[data-parent-wbs="${wbs}"]`)
  if (!children.length) return
  const isHidden = children[0].style.display === 'none'
  const arrow = tbody.querySelector(`tr[data-wbs="${wbs}"] .sl-arrow`)

  function setSubtree(parentWbs, show) {
    tbody.querySelectorAll(`tr[data-parent-wbs="${parentWbs}"]`).forEach(row => {
      row.style.display = show ? '' : 'none'
      const a = row.querySelector('.sl-arrow')
      if (!show && a) a.textContent = '▶'
      if (!show) setSubtree(row.dataset.wbs, false)
    })
  }

  setSubtree(wbs, isHidden)
  if (arrow) arrow.textContent = isHidden ? '▼' : '▶'
}

// Mobile toggle dùng div — ẩn/hiện đệ quy toàn bộ nhánh con
function slToggleRowMob(wbs) {
  const list = document.getElementById('sl-mob-list')
  if (!list) return
  const children = list.querySelectorAll(`[data-parent-wbs="${wbs}"]`)
  if (!children.length) return
  const isHidden = children[0].style.display === 'none'
  const arrow = list.querySelector(`[data-wbs="${wbs}"] .sl-arrow`)

  // Hàm ẩn/hiện đệ quy toàn bộ cháu
  function setSubtree(parentWbs, show) {
    list.querySelectorAll(`[data-parent-wbs="${parentWbs}"]`).forEach(row => {
      row.style.display = show ? '' : 'none'
      const childArrow = row.querySelector('.sl-arrow')
      if (!show && childArrow) childArrow.textContent = '▶'
      // Đệ quy ẩn cháu khi đang ẩn cha
      if (!show) setSubtree(row.dataset.wbs, false)
    })
  }

  setSubtree(wbs, isHidden)
  if (arrow) arrow.textContent = isHidden ? '▼' : '▶'
}

// ── Load data ────────────────────────────────────────────────
async function loadSanLuong() {
  if (!STATE.currentProject) return
  const proj = STATE.currentProject
  const nWeeks = parseInt(document.getElementById('sl-weeks')?.value || '12')

  // Rollup _contractValue và _earnedValue
  const tasks = STATE.tasks
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)
  sorted.forEach(t => {
    if (!t.is_summary) {
      t._contractValue = (t.unit_price||0) * (t.planned_quantity||1)
      t._earnedValue   = t._contractValue * (t.display_pct||0) / 100
      return
    }
    const children = tasks.filter(c =>
      c.wbs_code && t.wbs_code &&
      c.wbs_code.startsWith(t.wbs_code + '.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
    )
    t._contractValue = children.reduce((s,c) => s+(c._contractValue||0), 0)
    t._earnedValue   = children.reduce((s,c) => s+(c._earnedValue||0), 0)
  })

  // Load chart data
  await loadSanLuongChart(proj, nWeeks)

  // Render bảng
  renderSanLuongTable(tasks)
}

// ── Chart ────────────────────────────────────────────────────
async function loadSanLuongChart(proj, nWeeks) {
  const chartEl = document.getElementById('sl-chart')
  if (!chartEl) return
  chartEl.innerHTML = '<div style="color:var(--gray4);padding:20px;text-align:center">Đang tải...</div>'

  const curWeek = getISOWeek(new Date())
  const curYear = new Date().getFullYear()

  // Query task_progress theo tuần
  let query = sb.from('task_progress')
    .select('task_id, pct_complete, week_number, year, updated_at')
    .eq('project_id', proj.id)
    .order('year').order('week_number')

  if (nWeeks > 0) {
    // Lấy N tuần gần nhất
    let fromWeek = curWeek - nWeeks
    let fromYear = curYear
    if (fromWeek <= 0) { fromWeek += 52; fromYear-- }
    query = query.gte('week_number', fromWeek)
  }

  const { data: progData } = await query

  if (!progData?.length) {
    chartEl.innerHTML = '<div style="color:var(--gray4);padding:20px;text-align:center">Chưa có dữ liệu cập nhật tiến độ</div>'
    return
  }

  // Build task map: id → unit_price, planned_quantity
  const taskMap = {}
  STATE.tasks.forEach(t => { taskMap[t.id] = t })

  // Group by tuần — lấy pct mới nhất của mỗi task mỗi tuần
  const weekMap = {}
  progData.forEach(p => {
    const key = `${p.year}-W${String(p.week_number).padStart(2,'0')}`
    if (!weekMap[key]) weekMap[key] = { week: p.week_number, year: p.year, tasks: {} }
    // Giữ bản mới nhất (đã sort theo updated_at)
    weekMap[key].tasks[p.task_id] = p.pct_complete || 0
  })

  // Tính earned value mỗi tuần — lũy kế từ đầu dự án
  // Cần biết pct của từng task tại từng tuần (lấy bản mới nhất ≤ tuần đó)

  // Lấy tất cả progress để tính lũy kế chính xác
  const { data: allProg } = await sb.from('task_progress')
    .select('task_id, pct_complete, week_number, year')
    .eq('project_id', proj.id)
    .order('year').order('week_number').order('updated_at', { ascending: false })

  // Build: task_id → sorted history
  const taskHistory = {}
  ;(allProg||[]).forEach(p => {
    if (!taskHistory[p.task_id]) taskHistory[p.task_id] = []
    taskHistory[p.task_id].push(p)
  })

  // Tính pct của task tại tuần X (bản gần nhất ≤ tuần X)
  function getPctAtWeek(taskId, wk, yr) {
    const hist = taskHistory[taskId] || []
    let best = 0
    hist.forEach(p => {
      if (p.year < yr || (p.year === yr && p.week_number <= wk)) {
        best = Math.max(best, p.pct_complete||0)
      }
    })
    return best
  }

  // Sắp xếp tuần
  const weeks = Object.keys(weekMap).sort()
  const leafTasks = STATE.tasks.filter(t => !t.is_summary && (t.unit_price||0) > 0)

  // Helper: ISO week+year → Monday date
  function weekToDate(wk, yr) {
    const jan4 = new Date(yr, 0, 4)
    const dow = jan4.getDay() || 7
    const mon = new Date(jan4)
    mon.setDate(jan4.getDate() - dow + 1 + (wk-1)*7)
    return mon
  }
  function parseISO(s) {
    if (!s) return null
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y, m-1, d)
  }

  // PV lũy kế tại tuần T — tuyến tính theo thời gian
  function getPVatWeek(wk, yr) {
    const weekEnd = weekToDate(wk, yr)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return leafTasks.reduce((s, t) => {
      const cv = (t.unit_price||0) * (t.planned_quantity||1)
      if (!cv) return s
      const start  = parseISO(t.kh_start)
      const finish = parseISO(t.kh_finish)
      if (!start || !finish) return s
      if (weekEnd < start)   return s
      if (weekEnd >= finish)  return s + cv
      const ratio = Math.min(1, Math.max(0, (weekEnd - start)/(finish - start)))
      return s + cv * ratio
    }, 0)
  }

  // Tính EV và PV lũy kế tại mỗi tuần
  const weekLabels  = []
  const weeklyDelta = []
  const weeklyEV    = []
  const weeklyPV    = []

  let prevEV = 0
  weeks.forEach(wKey => {
    const { week, year } = weekMap[wKey]
    weekLabels.push('T' + week)
    const ev = leafTasks.reduce((s, t) => {
      const pct = getPctAtWeek(t.id, week, year)
      const cv  = (t.unit_price||0) * (t.planned_quantity||1)
      return s + cv * pct / 100
    }, 0)
    weeklyDelta.push(Math.max(0, ev - prevEV))
    weeklyEV.push(ev)
    weeklyPV.push(getPVatWeek(week, year))
    prevEV = ev
  })

  const totalCV = STATE.tasks
    .filter(t => t.outline_level === 1)
    .reduce((s,t) => s + (t._contractValue||0), 0)

  renderSanLuongChart(chartEl, weekLabels, weeklyDelta, weeklyEV, weeklyPV, totalCV)
}

function renderSanLuongChart(el, labels, deltas, ev, pv, totalCV) {
  const isMob  = typeof window !== 'undefined' && window.innerWidth < 1024
  // Mobile: cao hơn để dễ đọc
  const W = 800, H = isMob ? 380 : 280, PAD_L = isMob ? 72 : 80, PAD_R = 24, PAD_T = isMob ? 36 : 30, PAD_B = isMob ? 50 : 40
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const n = labels.length
  if (!n) { el.innerHTML = '<div style="color:var(--gray4);padding:20px;text-align:center">Không có dữ liệu</div>'; return }

  const maxVal = Math.max(...ev, ...pv, totalCV, 1)
  const barW   = Math.max(isMob?10:6, Math.floor(chartW / n) - (isMob?8:6))

  const fmtB = v => {
    if (!v) return '0'
    if (v >= 1e9) return (v/1e9).toFixed(1)+'tỷ'
    if (v >= 1e6) return Math.round(v/1e6)+'tr'
    return Math.round(v/1e3)+'k'
  }

  const xC = i => PAD_L + i*(chartW/n) + chartW/(n*2)
  const yC = v => PAD_T + chartH - Math.round(v/maxVal*chartH)

  // Bars EV tuần
  const bars = deltas.map((d, i) => {
    const x = PAD_L + i*(chartW/n) + (chartW/n - barW)/2
    const h = Math.max(2, Math.round(d/maxVal*chartH))
    const y = PAD_T + chartH - h
    return `<g><title>${labels[i]}: ${fmtB(d)}</title>
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#2563EB" rx="2" opacity="0.75"/>
      ${d>0?`<text x="${x+barW/2}" y="${y-5}" text-anchor="middle" font-size="${isMob?12:8}" fill="#1D4ED8" font-weight="700">${fmtB(d)}</text>`:''}
    </g>`
  }).join('')

  // Line EV lũy kế (cam)
  const evPoints = ev.map((v,i) => `${xC(i)},${yC(v)}`).join(' ')
  const evDots = ev.map((v,i) => {
    const isLast = i===n-1
    return `<g>
      <circle cx="${xC(i)}" cy="${yC(v)}" r="${isLast?4:3}" fill="#D97706"/>
      ${isLast?`<text x="${xC(i)}" y="${yC(v)-10}" text-anchor="middle" font-size="${isMob?13:9}" fill="#D97706" font-weight="700">${fmtB(v)}</text>`:''}
    </g>`
  }).join('')

  // Line PV lũy kế (xanh lá nét đứt)
  const pvPoints = pv.map((v,i) => `${xC(i)},${yC(v)}`).join(' ')
  const pvDots = pv.map((v,i) => {
    const isLast = i===n-1
    return `<g>
      <circle cx="${xC(i)}" cy="${yC(v)}" r="${isLast?4:2}" fill="#16A34A" opacity="0.8"/>
      ${isLast?`<text x="${xC(i)+6}" y="${yC(v)}" text-anchor="start" font-size="${isMob?13:9}" fill="#16A34A" font-weight="700">${fmtB(v)}</text>`:''}
    </g>`
  }).join('')

  // Đường HĐ tổng
  const hdY = totalCV > 0 ? yC(totalCV) : -1

  // Y ticks
  const tickFontSz = isMob ? 11 : 9
  const yTicks = [0,0.25,0.5,0.75,1].map(r => {
    const y = PAD_T + chartH - r*chartH
    return `<line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="var(--gray2)" stroke-width="0.5"/>
      <text x="${PAD_L-5}" y="${y+3}" text-anchor="end" font-size="${tickFontSz}" fill="var(--gray4)">${fmtB(r*maxVal)}</text>`
  }).join('')

  // X labels
  const xLabels = labels.map((lbl,i) =>
    `<text x="${xC(i)}" y="${H-8}" text-anchor="middle" font-size="${isMob?12:9}" fill="var(--gray5)" font-weight="${isMob?'500':'400'}">${lbl}</text>`
  ).join('')

  // SPI = EV / PV tại tuần cuối
  const lastEV = ev[n-1]||0
  const lastPV = pv[n-1]||0
  const spi = lastPV > 0 ? (lastEV/lastPV).toFixed(2) : null
  const spiColor = !spi ? '#64748B' : parseFloat(spi)>=1 ? '#16A34A' : parseFloat(spi)>=0.8 ? '#D97706' : '#DC2626'
  const pctDat = totalCV > 0 ? Math.round(lastEV/totalCV*100) : 0

  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:12px;margin-bottom:10px;align-items:center">
      <span style="display:flex;align-items:center;gap:5px">
        <span style="width:12px;height:10px;background:#2563EB;border-radius:2px;opacity:.75;display:inline-block"></span>
        <span style="color:var(--gray5)">SL tuần (EV)</span>
      </span>
      <span style="display:flex;align-items:center;gap:5px">
        <span style="width:20px;height:2px;background:#D97706;display:inline-block"></span>
        <span style="color:var(--gray5)">Lũy kế TH (EV): <strong style="color:#D97706">${fmtB(lastEV)}</strong></span>
      </span>
      <span style="display:flex;align-items:center;gap:5px">
        <span style="width:20px;height:2px;background:#16A34A;display:inline-block;border-top:2px dashed #16A34A;margin-top:2px"></span>
        <span style="color:var(--gray5)">Kế hoạch (PV): <strong style="color:#16A34A">${fmtB(lastPV)}</strong></span>
      </span>
      ${spi ? `<span style="padding:3px 10px;border-radius:20px;background:${spiColor}18;color:${spiColor};font-weight:700;font-size:12px">
        SPI = ${spi} ${parseFloat(spi)>=1?'✅':parseFloat(spi)>=0.8?'⚠️':'🔴'}
      </span>` : ''}
      <span style="color:var(--gray4)">HĐ: <strong style="color:var(--navy)">${fmtB(totalCV)}</strong></span>
      <span style="color:var(--gray4)">Đạt: <strong style="color:${pctDat>=80?'var(--green)':pctDat>=50?'var(--amber)':'var(--red)'}">${pctDat}%</strong></span>
    </div>
    <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
      ${yTicks}
      <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+chartH}" stroke="var(--gray3)" stroke-width="1"/>
      ${hdY>0?`<line x1="${PAD_L}" y1="${hdY}" x2="${W-PAD_R}" y2="${hdY}" stroke="#DC2626" stroke-width="1" stroke-dasharray="6 3" opacity="0.4"/>
        <text x="${W-PAD_R+2}" y="${hdY+3}" font-size="8" fill="#DC2626" opacity="0.7">HĐ</text>`:''}
      ${bars}
      <polyline points="${pvPoints}" fill="none" stroke="#16A34A" stroke-width="2" stroke-dasharray="6 3" opacity="0.8"/>
      ${pvDots}
      <polyline points="${evPoints}" fill="none" stroke="#D97706" stroke-width="2.5" stroke-linejoin="round"/>
      ${evDots}
      ${xLabels}
    </svg>`
}

// ── Bảng hạng mục ────────────────────────────────────────────
function renderSanLuongTable(tasks) {
  const mob = window.innerWidth < 900
  const wrap = document.getElementById('sl-table-wrap')
  if (!wrap) return

  const fmtN = v => (!v||v===0) ? '—' : Math.round(v).toLocaleString('vi-VN')
  const fmtM = v => (!v||v===0) ? '—' : Math.round(v).toLocaleString('vi-VN') + ' ₫'
  const fmtMshort = v => {
    if (!v || v===0) return '—'
    if (v >= 1e9) return (v/1e9).toFixed(1) + 'tỷ ₫'
    if (v >= 1e6) return Math.round(v/1e6) + 'tr ₫'
    return Math.round(v).toLocaleString('vi-VN') + ' ₫'
  }

  let totalCV = 0, totalEarned = 0

  if (mob) {
    // ── MOBILE: div list, không dùng table ───────────────────
    const rows = tasks.map(t => {
      const cv     = t._contractValue || 0
      const earned = t._earnedValue   || 0
      const pct    = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const indent = (t.outline_level - 1) * 10
      if (!t.is_summary) { totalCV += cv; totalEarned += earned }

      const parts = (t.wbs_code||'').split('.')
      const parentWbs = parts.length > 1 ? parts.slice(0,-1).join('.') : ''
      const hasChildren = tasks.some(c =>
        c.wbs_code && t.wbs_code &&
        c.wbs_code.startsWith(t.wbs_code+'.') &&
        c.wbs_code.split('.').length === t.wbs_code.split('.').length+1
      )
      const bgColor = t.outline_level===1 ? '#1A2B4A'
                    : t.outline_level===2 ? '#2563EB'
                    : t.outline_level===3 ? '#EEF2FF'
                    : t.outline_level===4 ? '#F8FAFC' : 'white'
      const txtColor = t.outline_level<=2 ? 'white'
                     : t.outline_level===3 ? '#1E40AF' : 'var(--gray7)'
      const pctColor = pct===100?'#16A34A':pct>50?'#2563EB':pct>0?'#D97706':'#CBD5E1'

      return `<div data-level="${t.outline_level}"
          data-wbs="${t.wbs_code||''}"
          data-parent-wbs="${parentWbs}"
          style="background:${bgColor};border-bottom:0.5px solid rgba(0,0,0,.1);
            padding:8px 10px;padding-left:${10+indent}px;
            cursor:${hasChildren?'pointer':'default'}"
          ${hasChildren ? `onclick="slToggleRowMob('${t.wbs_code}')"` : ''}>
        <!-- Dòng 1: tên + % -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${cv>0?4:0}px">
          <span style="font-size:${t.outline_level<=2?13:12}px;font-weight:${t.outline_level<=3?600:400};
            color:${txtColor};flex:1;min-width:0;word-break:break-word;line-height:1.4">
            ${hasChildren ? '<span class="sl-arrow" style="margin-right:4px;font-size:10px">▼</span>' : ''}
            ${t.name}
          </span>
          ${cv>0 ? `<span style="font-size:13px;font-weight:700;color:${pctColor};margin-left:8px;flex-shrink:0">${pct}%</span>` : ''}
        </div>
        ${cv>0 ? `
        <!-- Dòng 2: bar -->
        <div style="height:5px;background:rgba(255,255,255,.2);border-radius:3px;margin-bottom:4px">
          <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:3px"></div>
        </div>
        <!-- Dòng 3: giá trị -->
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:${t.outline_level<=2?'#93C5FD':'var(--gray5)'}">
            HĐ: ${fmtMshort(cv)}
          </span>
          <span style="font-size:11px;font-weight:600;color:${t.outline_level<=2?'#6EE7B7':'var(--teal)'}">
            TH: ${fmtMshort(earned)}
          </span>
        </div>` : ''}
      </div>`
    }).join('')

    wrap.innerHTML = `<div id="sl-mob-list">${rows}</div>`

  } else {
    // ── DESKTOP: table đầy đủ ────────────────────────────────
    const rows = tasks.map(t => {
      const cv     = t._contractValue || 0
      const earned = t._earnedValue   || 0
      const pct    = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const indent = (t.outline_level - 1) * 16
      if (!t.is_summary) { totalCV += cv; totalEarned += earned }

      const parts = (t.wbs_code||'').split('.')
      const parentWbs = parts.length > 1 ? parts.slice(0,-1).join('.') : ''
      const hasChildren = tasks.some(c =>
        c.wbs_code && t.wbs_code &&
        c.wbs_code.startsWith(t.wbs_code+'.') &&
        c.wbs_code.split('.').length === t.wbs_code.split('.').length+1
      )
      const bgColor = t.outline_level===1 ? '#1A2B4A'
                    : t.outline_level===2 ? '#2563EB'
                    : t.outline_level===3 ? '#EEF2FF'
                    : t.outline_level===4 ? '#F8FAFC' : 'white'
      const txtColor = t.outline_level<=2 ? 'white'
                     : t.outline_level===3 ? '#1E40AF' : 'var(--gray7)'
      const pctColor = pct===100?'var(--green)':pct>50?'var(--blue)':pct>0?'var(--amber)':'var(--gray3)'
      const pctBar = `<div style="height:4px;background:var(--gray2);border-radius:2px;margin-bottom:2px">
        <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:2px"></div></div>
        <span style="font-size:10px;font-weight:600;color:${pctColor}">${pct}%</span>`

      return `<tr data-level="${t.outline_level}"
          data-wbs="${t.wbs_code||''}"
          data-parent-wbs="${parentWbs}"
          style="background:${bgColor};border-bottom:0.5px solid rgba(0,0,0,.08);cursor:${hasChildren?'pointer':'default'}"
          ${hasChildren ? `onclick="slToggleRow('${t.wbs_code}',${t.outline_level})"` : ''}>
        <td style="padding:7px 8px;padding-left:${12+indent}px;font-size:${t.outline_level<=2?12:11}px;
          font-weight:${t.outline_level<=3?600:400};color:${txtColor};min-width:180px">
          ${hasChildren ? '<span class="sl-arrow" style="margin-right:4px;font-size:10px">▼</span>' : '<span style="margin-right:12px"></span>'}
          ${t.name}
        </td>
        <td style="padding:7px 8px;text-align:center;font-size:11px;color:${txtColor};opacity:.8">${t.is_summary?'':t.unit||'%'}</td>
        <td style="padding:7px 8px;text-align:right;font-size:11px;color:${txtColor};opacity:.8">${t.is_summary?'':fmtN(t.planned_quantity)}</td>
        <td style="padding:7px 8px;text-align:right;font-size:11px;color:${txtColor};opacity:.8">${t.is_summary?'':fmtN(t.actual_quantity)}</td>
        <td style="padding:7px 8px;text-align:right;font-size:11px;color:${txtColor};opacity:.8">${t.is_summary?'':fmtM(t.unit_price)}</td>
        <td style="padding:7px 8px;text-align:right;font-size:11px;font-weight:500;color:${t.outline_level<=2?'#93C5FD':cv>0?'var(--navy)':'var(--gray3)'}">${fmtM(cv)}</td>
        <td style="padding:7px 8px;text-align:right;font-size:11px;font-weight:600;color:${t.outline_level<=2?'#6EE7B7':earned>0?'var(--teal)':'var(--gray3)'}">${cv>0?fmtM(earned):'—'}</td>
        <td style="padding:7px 6px;text-align:center;width:72px">${cv>0?pctBar:''}</td>
      </tr>`
    }).join('')

    wrap.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--navy);color:white;font-size:11px;position:sticky;top:0;z-index:5">
        <th style="padding:9px 12px;text-align:left;min-width:220px">Hạng mục / Công tác</th>
        <th style="padding:9px 8px;text-align:center;width:60px">Đơn vị</th>
        <th style="padding:9px 8px;text-align:right;width:80px">KL KH</th>
        <th style="padding:9px 8px;text-align:right;width:80px">KL TH</th>
        <th style="padding:9px 8px;text-align:right;width:110px">Đơn giá (₫)</th>
        <th style="padding:9px 8px;text-align:right;width:130px">Giá trị HĐ (₫)</th>
        <th style="padding:9px 8px;text-align:right;width:130px">Sản lượng TH (₫)</th>
        <th style="padding:9px 8px;text-align:center;width:72px">% Đạt</th>
      </tr></thead>
      <tbody id="sl-tbody">${rows}</tbody>
    </table></div>`
  }

  // Footer totals
  const rootCV = STATE.tasks.find(t=>t.outline_level===1)?._contractValue || totalCV
  const rootEarned = STATE.tasks.find(t=>t.outline_level===1)?._earnedValue || totalEarned
  const rootPct = rootCV > 0 ? Math.round(rootEarned/rootCV*100) : 0

  const el = id => document.getElementById(id)
  if (el('sl-total-cv'))     el('sl-total-cv').textContent = Math.round(rootCV).toLocaleString('vi-VN') + ' ₫'
  if (el('sl-total-earned')) el('sl-total-earned').textContent = Math.round(rootEarned).toLocaleString('vi-VN') + ' ₫'
  if (el('sl-total-pct'))    el('sl-total-pct').textContent = rootPct + '%'
}
