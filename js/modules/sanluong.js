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
    <div id="sl-chart" style="min-height:220px;overflow-x:auto"></div>
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
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:700px" id="sl-table">
        <thead>
          <tr style="background:var(--navy);color:white;font-size:11px;position:sticky;top:0;z-index:5">
            <th style="padding:9px 12px;text-align:left;min-width:220px">Hạng mục / Công tác</th>
            <th style="padding:9px 8px;text-align:center;width:60px">Đơn vị</th>
            <th style="padding:9px 8px;text-align:right;width:80px">KL KH</th>
            <th style="padding:9px 8px;text-align:right;width:80px">KL TH</th>
            <th style="padding:9px 8px;text-align:right;width:110px">Đơn giá (₫)</th>
            <th style="padding:9px 8px;text-align:right;width:130px">Giá trị HĐ (₫)</th>
            <th style="padding:9px 8px;text-align:right;width:130px">Sản lượng TH (₫)</th>
            <th style="padding:9px 8px;text-align:center;width:80px">% Đạt</th>
          </tr>
        </thead>
        <tbody id="sl-tbody"></tbody>
      </table>
    </div>
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
  document.querySelectorAll('#sl-tbody tr[data-level]').forEach(row => {
    const lv = parseInt(row.dataset.level)
    row.style.display = lv <= maxLevel ? '' : 'none'
  })
  // Update toggle arrows
  document.querySelectorAll('#sl-tbody tr[data-level]').forEach(row => {
    const lv = parseInt(row.dataset.level)
    const arrow = row.querySelector('.sl-arrow')
    if (arrow) {
      const wbs = row.dataset.wbs
      const hasChildren = document.querySelector(`#sl-tbody tr[data-parent-wbs="${wbs}"]`)
      if (hasChildren) arrow.textContent = lv < maxLevel ? '▼' : '▶'
    }
  })
}

function slToggleRow(wbs, level) {
  const children = document.querySelectorAll(`#sl-tbody tr[data-parent-wbs="${wbs}"]`)
  if (!children.length) return
  const firstChild = children[0]
  const isHidden = firstChild.style.display === 'none'
  const arrow = document.querySelector(`#sl-tbody tr[data-wbs="${wbs}"] .sl-arrow`)

  children.forEach(row => {
    row.style.display = isHidden ? '' : 'none'
    // Ẩn/hiện cháu theo trạng thái cha
    if (!isHidden) {
      const childWbs = row.dataset.wbs
      const grandChildren = document.querySelectorAll(`#sl-tbody tr[data-parent-wbs="${childWbs}"]`)
      grandChildren.forEach(r => r.style.display = 'none')
      const childArrow = row.querySelector('.sl-arrow')
      if (childArrow) childArrow.textContent = '▶'
    }
  })
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

  // Tính earned value lũy kế tại mỗi tuần
  const weekLabels = []
  const weeklyDelta = []
  const weeklyLuyKe = []

  let prevLuyKe = 0
  weeks.forEach(wKey => {
    const { week, year } = weekMap[wKey]
    weekLabels.push(`T${week}/${year}`)

    const luyKe = leafTasks.reduce((s, t) => {
      const pct = getPctAtWeek(t.id, week, year)
      const cv = (t.unit_price||0) * (t.planned_quantity||1)
      return s + cv * pct / 100
    }, 0)

    weeklyDelta.push(Math.max(0, luyKe - prevLuyKe))
    weeklyLuyKe.push(luyKe)
    prevLuyKe = luyKe
  })

  // Tổng giá trị HĐ
  const totalCV = STATE.tasks
    .filter(t => t.outline_level === 1)
    .reduce((s,t) => s + (t._contractValue||0), 0)

  renderSanLuongChart(chartEl, weekLabels, weeklyDelta, weeklyLuyKe, totalCV)
}

function renderSanLuongChart(el, labels, deltas, luyKe, totalCV) {
  const W = 800, H = 220, PAD_L = 80, PAD_R = 20, PAD_T = 20, PAD_B = 40
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const n = labels.length
  if (!n) { el.innerHTML = '<div style="color:var(--gray4);padding:20px;text-align:center">Không có dữ liệu</div>'; return }

  const maxVal = Math.max(...luyKe, 1)
  const barW = Math.max(8, Math.floor(chartW / n) - 6)

  const fmtB = v => {
    if (v >= 1e9) return (v/1e9).toFixed(1)+'tỷ'
    if (v >= 1e6) return (v/1e6).toFixed(0)+'tr'
    return Math.round(v).toLocaleString()
  }

  // Bars
  const bars = deltas.map((d, i) => {
    const x = PAD_L + i * (chartW / n) + (chartW/n - barW)/2
    const h = Math.max(2, Math.round(d / maxVal * chartH))
    const y = PAD_T + chartH - h
    return `<g>
      <title>Tuần ${labels[i]}: ${fmtB(d)}</title>
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#2563EB" rx="2" opacity="0.85"/>
      ${h > 18 ? `<text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="8" fill="var(--gray6)">${fmtB(d)}</text>` : ''}
    </g>`
  }).join('')

  // Line lũy kế
  const linePoints = luyKe.map((v, i) => {
    const x = PAD_L + i * (chartW / n) + chartW/(n*2)
    const y = PAD_T + chartH - Math.round(v / maxVal * chartH)
    return `${x},${y}`
  }).join(' ')

  // Đường HĐ
  const hdY = totalCV > 0 ? PAD_T + chartH - Math.round(totalCV / maxVal * chartH) : -1

  // X labels
  const xLabels = labels.map((lbl, i) => {
    const x = PAD_L + i * (chartW / n) + chartW/(n*2)
    const short = lbl.replace('/'+new Date().getFullYear(),'')
    return `<text x="${x}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--gray5)">${short}</text>`
  }).join('')

  // Y axis
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => {
    const y = PAD_T + chartH - r * chartH
    const val = r * maxVal
    return `
      <line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="var(--gray2)" stroke-width="0.5"/>
      <text x="${PAD_L-6}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--gray4)">${fmtB(val)}</text>`
  }).join('')

  const lastLuyKe = luyKe[luyKe.length-1] || 0
  const pctDat = totalCV > 0 ? Math.round(lastLuyKe/totalCV*100) : 0

  el.innerHTML = `
    <div style="font-size:12px;color:var(--gray5);margin-bottom:8px;display:flex;gap:16px;flex-wrap:wrap">
      <span>Lũy kế hiện tại: <strong style="color:var(--teal)">${fmtB(lastLuyKe)}</strong></span>
      <span>Giá trị HĐ: <strong style="color:var(--navy)">${fmtB(totalCV)}</strong></span>
      <span>Đạt: <strong style="color:${pctDat>=80?'var(--green)':pctDat>=50?'var(--amber)':'var(--red)'}">${pctDat}%</strong></span>
    </div>
    <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
      ${yTicks}
      <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+chartH}" stroke="var(--gray3)" stroke-width="1"/>
      ${hdY > 0 ? `<line x1="${PAD_L}" y1="${hdY}" x2="${W-PAD_R}" y2="${hdY}" stroke="var(--red)" stroke-width="1" stroke-dasharray="6 3" opacity="0.6"/>
      <text x="${W-PAD_R+2}" y="${hdY+3}" font-size="8" fill="var(--red)" opacity="0.8">HĐ</text>` : ''}
      ${bars}
      <polyline points="${linePoints}" fill="none" stroke="#D97706" stroke-width="2" stroke-linejoin="round"/>
      ${luyKe.map((v,i) => {
        const x = PAD_L + i*(chartW/n) + chartW/(n*2)
        const y = PAD_T + chartH - Math.round(v/maxVal*chartH)
        return `<circle cx="${x}" cy="${y}" r="3" fill="#D97706"/>`
      }).join('')}
      ${xLabels}
    </svg>`
}

// ── Bảng hạng mục ────────────────────────────────────────────
function renderSanLuongTable(tasks) {
  const tbody = document.getElementById('sl-tbody')
  if (!tbody) return

  const fmtN = v => (!v||v===0) ? '—' : Math.round(v).toLocaleString('vi-VN')
  const fmtM = v => (!v||v===0) ? '—' : Math.round(v).toLocaleString('vi-VN') + ' ₫'

  let totalCV = 0, totalEarned = 0

  const rows = tasks.map(t => {
    const cv      = t._contractValue || 0
    const earned  = t._earnedValue   || 0
    const pct     = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
    const indent  = (t.outline_level - 1) * 16
    const isMob   = window.innerWidth < 1024

    if (!t.is_summary) totalCV += cv, totalEarned += earned

    // Tìm wbs cha trực tiếp
    const parts = (t.wbs_code||'').split('.')
    const parentWbs = parts.length > 1 ? parts.slice(0,-1).join('.') : ''

    // Màu nền theo level
    const bgColor = t.outline_level===1 ? '#1A2B4A'
                  : t.outline_level===2 ? '#2563EB'
                  : t.outline_level===3 ? '#EEF2FF'
                  : t.outline_level===4 ? '#F8FAFC'
                  : 'white'
    const txtColor = t.outline_level<=2 ? 'white'
                   : t.outline_level===3 ? '#1E40AF'
                   : 'var(--gray7)'

    const hasChildren = tasks.some(c =>
      c.wbs_code && t.wbs_code &&
      c.wbs_code.startsWith(t.wbs_code+'.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length+1
    )

    // % bar
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
        ${hasChildren ? `<span class="sl-arrow" style="margin-right:4px;font-size:10px">▼</span>` : '<span style="margin-right:12px"></span>'}
        ${t.name}
      </td>
      <td style="padding:7px 8px;text-align:center;font-size:11px;color:${txtColor};opacity:.8">
        ${t.is_summary ? '' : (t.unit||'%')}
      </td>
      <td style="padding:7px 8px;text-align:right;font-size:11px;color:${txtColor};opacity:.8">
        ${t.is_summary ? '' : fmtN(t.planned_quantity)}
      </td>
      <td style="padding:7px 8px;text-align:right;font-size:11px;color:${txtColor};opacity:.8">
        ${t.is_summary ? '' : fmtN(t.actual_quantity)}
      </td>
      <td style="padding:7px 8px;text-align:right;font-size:11px;color:${txtColor};opacity:.8">
        ${t.is_summary ? '' : fmtM(t.unit_price)}
      </td>
      <td style="padding:7px 8px;text-align:right;font-size:12px;font-weight:500;color:${t.outline_level<=2?'#93C5FD':cv>0?'var(--navy)':'var(--gray3)'}">
        ${fmtM(cv)}
      </td>
      <td style="padding:7px 8px;text-align:right;font-size:12px;font-weight:600;color:${t.outline_level<=2?'#6EE7B7':earned>0?'var(--teal)':'var(--gray3)'}">
        ${cv>0 ? fmtM(earned) : '—'}
      </td>
      <td style="padding:7px 8px;text-align:center;min-width:70px">
        ${cv>0 ? pctBar : ''}
      </td>
    </tr>`
  }).join('')

  tbody.innerHTML = rows

  // Footer totals
  const rootCV = STATE.tasks.find(t=>t.outline_level===1)?._contractValue || totalCV
  const rootEarned = STATE.tasks.find(t=>t.outline_level===1)?._earnedValue || totalEarned
  const rootPct = rootCV > 0 ? Math.round(rootEarned/rootCV*100) : 0

  const el = id => document.getElementById(id)
  if (el('sl-total-cv'))     el('sl-total-cv').textContent = Math.round(rootCV).toLocaleString('vi-VN') + ' ₫'
  if (el('sl-total-earned')) el('sl-total-earned').textContent = Math.round(rootEarned).toLocaleString('vi-VN') + ' ₫'
  if (el('sl-total-pct'))    el('sl-total-pct').textContent = rootPct + '%'
}
