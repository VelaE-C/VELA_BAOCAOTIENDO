// ═══════════════════════════════════════════════════════════
// PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════
function dashboard() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700;color:var(--gray8)">Dashboard Tổng quan</h2>
      <p style="font-size:13px;color:var(--gray4)">Cập nhật: ${new Date().toLocaleDateString('vi-VN')}</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="showAISummaryHistory()">📋 Lịch sử AI</button>
      ${STATE.role === 'admin' ? `<button class="btn btn-primary btn-sm" onclick="generateAISummary()">🤖 AI Tóm tắt tiến độ</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="exportWeeklyReport()">📄 Xuất báo cáo tuần</button>
    </div>
  </div>

  <!-- Tài chính -->
  <div class="card" id="dash-finance-card" style="display:none;margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-title" style="margin-bottom:0">💰 Tài chính dự án</div>
      <span style="font-size:11px;color:var(--gray4)" id="dash-finance-updated"></span>
    </div>
    <div id="dash-finance-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px"></div>
  </div>

  <!-- Bảng Tiến độ & Sản lượng -->
  <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
    <div style="padding:14px 16px;border-bottom:1px solid var(--gray2)">
      <div class="card-title" style="margin:0">📊 Tiến độ & Sản lượng theo hạng mục</div>
      <div class="card-sub" style="margin:4px 0 0">Hạng mục cấp 2-3 · Bar = % sản lượng thực hiện</div>
    </div>
    <div id="dash-summary-table"></div>
  </div>

  <!-- Các mốc tiến độ -->
  <div class="card" id="dash-milestone-card" style="display:none;margin-bottom:16px;padding:0;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--gray2);display:flex;justify-content:space-between;align-items:center">
      <div class="card-title" style="margin:0">🏁 Các mốc tiến độ</div>
      <span style="font-size:11px;color:var(--gray4);cursor:pointer" onclick="navigate('milestone')">Xem chi tiết →</span>
    </div>
    <div id="dash-milestone-table"></div>
  </div>

  <!-- Chart sản lượng tuần -->
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="card-title" style="margin:0">📈 Sản lượng 12 tuần gần nhất</div>
      <div style="display:flex;gap:14px;font-size:11px;color:var(--gray5)">
        <span style="display:flex;align-items:center;gap:4px">
          <span style="width:10px;height:10px;background:#2563EB;border-radius:2px;display:inline-block"></span>Tuần
        </span>
        <span style="display:flex;align-items:center;gap:4px">
          <span style="width:16px;height:2px;background:#D97706;display:inline-block"></span>Lũy kế TH (EV)
        </span>
        <span style="display:flex;align-items:center;gap:4px">
          <span style="width:16px;height:2px;background:#16A34A;border-top:2px dashed #16A34A;display:inline-block"></span>Kế hoạch (PV)
        </span>
      </div>
    </div>
    <div id="dash-sl-chart" style="min-height:180px"></div>
  </div>

  <!-- Ảnh hiện trường -->
  <div class="card" id="dash-photos-card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="card-title" style="margin-bottom:0">📷 Ảnh thi công tuần này</div>
      <span style="font-size:11px;color:var(--gray4)" id="dash-photos-count"></span>
    </div>
    <div class="card-sub">Tối đa 9 ảnh — tuần hiện tại</div>
    <div id="dash-photos-grid"></div>
  </div>

  <!-- Quân số -->
  <div class="card" id="dash-attendance-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="card-title" style="margin-bottom:0">👷 Số lượng công nhân theo ngày</div>
      <span style="font-size:11px;color:var(--gray4)" id="dash-attendance-week"></span>
    </div>
    <div class="card-sub">Nguồn: VELA ChamCong — TB CN/ngày theo tuần</div>
    <div id="dash-attendance-chart" style="min-height:180px"></div>
  </div>`
}

async function loadDashboard() {
  const tasks = STATE.tasks
  if (!STATE.currentProject) return
  if (!tasks.length) return

  if (tasks[0]._contractValue === undefined) {
    if (typeof computeRollupMoney === 'function') computeRollupMoney(tasks)
  }

  const summaries = tasks.filter(t => t.is_summary && t.outline_level <= 3)

  const fmtShort = v => {
    if (!v || v === 0) return '—'
    if (v >= 1e9) return (v/1e9).toFixed(1) + 'tỷ'
    if (v >= 1e6) return Math.round(v/1e6) + 'tr'
    return Math.round(v/1e3) + 'k'
  }

  const rows = summaries.slice(0, 15).map(t => {
    const pct    = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
    const cv     = t._contractValue || 0
    const ev     = t._earnedValue   || 0
    const delay  = t._delay || 0
    const indent = (t.outline_level - 1) * 12
    const barColor   = pct === 100 ? '#16A34A' : getDelayColor(delay)
    const nameBold   = t.outline_level <= 2 ? 700 : 500
    const nameSz     = t.outline_level <= 2 ? 13 : 12
    const nameColor  = t.outline_level === 1 ? 'var(--navy)' : t.outline_level === 2 ? 'var(--blue)' : 'var(--gray7)'
    const rowBg      = t.outline_level === 1 ? '#F8FAFC' : 'white'
    const delayColor = getDelayColor(delay)
    const delayLabel = delay > 0 ? `trễ ${delay}d` : delay < 0 ? `sớm ${Math.abs(delay)}d` : 'đúng KH'
    return `
    <div style="display:flex;align-items:stretch;border-bottom:1px solid var(--gray2);background:${rowBg}">
      <div style="flex:1;min-width:0;padding:10px 12px;padding-left:${14+indent}px">
        <div style="font-size:${nameSz}px;font-weight:${nameBold};color:${nameColor};word-break:break-word;line-height:1.4;margin-bottom:3px">${t.name}</div>
        <div style="font-size:11px;color:var(--gray4);margin-bottom:7px">
          ${fmtDateShort(t.kh_start)} → ${fmtDateShort(t.kh_finish)}
          ${delay !== 0 ? `<span style="color:${delayColor};font-weight:600;margin-left:4px">(${delayLabel})</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:7px;background:var(--gray2);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:4px"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:${barColor};width:32px;text-align:right;flex-shrink:0">${pct}%</span>
        </div>
      </div>
      ${cv > 0 ? `
      <div style="flex-shrink:0;width:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid var(--gray2);padding:8px 6px;background:${rowBg}">
        <span style="font-size:18px;font-weight:800;color:${barColor};line-height:1.2">${fmtShort(ev)}</span>
        <span style="font-size:9px;color:var(--gray3);margin:2px 0">─────</span>
        <span style="font-size:13px;font-weight:500;color:#1A2B4A;line-height:1.2">${fmtShort(cv)}</span>
      </div>` : ''}
    </div>`
  }).join('')

  document.getElementById('dash-summary-table').innerHTML = rows || '<div style="padding:20px;color:var(--gray4)">Không có dữ liệu</div>'

  loadFinanceData()
  loadDashboardMilestone()
  loadDashboardSLChart()
  loadDashboardPhotos()
  loadAttendanceData()
}

// ═══════════════════════════════════════════════════════════
// CHART SẢN LƯỢNG 12 TUẦN — Dashboard (có PV line)
// ═══════════════════════════════════════════════════════════
async function loadDashboardSLChart() {
  const el = document.getElementById('dash-sl-chart')
  if (!el || !STATE.currentProject) return
  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải...</span>'

  try {
    const now = new Date()
    const curWeek = getISOWeek(now)
    const curYear = now.getFullYear()

    const { data: allProg } = await sb.from('task_progress')
      .select('task_id, pct_complete, week_number, year')
      .eq('project_id', STATE.currentProject.id)
      .order('year').order('week_number').order('updated_at', { ascending: false })

    if (!allProg?.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có dữ liệu cập nhật tiến độ</span>'
      return
    }

    const taskHistory = {}
    allProg.forEach(p => {
      if (!taskHistory[p.task_id]) taskHistory[p.task_id] = []
      taskHistory[p.task_id].push(p)
    })

    // Logic nhất quán: bản ghi week_number lớn nhất ≤ tuần T
    function getPctAtWeek(taskId, wk, yr) {
      const hist = taskHistory[taskId] || []
      let best = null, bestWk = -1
      hist.forEach(p => {
        if (p.year < yr || (p.year === yr && p.week_number <= wk)) {
          if (p.week_number > bestWk) { bestWk = p.week_number; best = p.pct_complete ?? 0 }
        }
      })
      return best ?? 0
    }

    // Hàm tính PV tại cuối tuần — nhất quán với sanluong.js
    function weekToEndDate(wk, yr) {
      const d = new Date(yr, 0, 4)
      const dow = d.getDay() || 7
      d.setDate(d.getDate() - dow + 1 + (wk - 1) * 7 + 6)
      return d
    }

    const leafTasks = STATE.tasks.filter(t => !t.is_summary && (t.unit_price || 0) > 0)
    const weeks = []
    for (let i = 11; i >= 0; i--) {
      let wk = curWeek - i, yr = curYear
      if (wk <= 0) { wk += 52; yr-- }
      weeks.push({ wk, yr, label: `T${wk}` })
    }

    const weeklyDelta = [], weeklyEV = [], weeklyPV = []
    let prevEV = 0

    weeks.forEach(({ wk, yr }) => {
      const ev = leafTasks.reduce((s, t) => {
        const pct = getPctAtWeek(t.id, wk, yr)
        return s + (t.unit_price||0) * (t.planned_quantity||1) * pct / 100
      }, 0)

      const weekEnd = weekToEndDate(wk, yr)
      const pv = leafTasks.reduce((s, t) => {
        const cv = (t.unit_price||0) * (t.planned_quantity||1)
        if (!cv) return s
        const start = t.kh_start ? new Date(t.kh_start) : null
        const finish = t.kh_finish ? new Date(t.kh_finish) : null
        if (!start || !finish) return s
        if (weekEnd < start) return s
        if (weekEnd >= finish) return s + cv
        return s + cv * (weekEnd - start) / (finish - start)
      }, 0)

      weeklyDelta.push(ev - prevEV)
      weeklyEV.push(ev)
      weeklyPV.push(pv)
      prevEV = ev
    })

    const totalCV = STATE.tasks.filter(t => t.outline_level === 1).reduce((s, t) => s + (t._contractValue||0), 0)
    const labels  = weeks.map(w => w.label)
    const W = 700, H = 200, PAD_L = 70, PAD_R = 20, PAD_T = 24, PAD_B = 36
    const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
    const n = labels.length
    // maxVal không dùng totalCV — tránh scale quá lớn
    const maxVal = Math.max(...weeklyEV, ...weeklyPV, ...weeklyDelta.map(Math.abs), 1)
    const barW   = Math.max(10, Math.floor(chartW / n) - 6)

    const fmtB = v => {
      if (!v || v === 0) return '0'
      if (v >= 1e9) return (v/1e9).toFixed(1) + 'tỷ'
      if (v >= 1e6) return Math.round(v/1e6) + 'tr'
      return Math.round(v/1e3) + 'k'
    }

    const xC = i => PAD_L + i*(chartW/n) + chartW/(n*2)
    const yC = v => PAD_T + chartH - Math.round(v/maxVal*chartH)

    const prevLabels = labels.map((lbl, i) => i > 0 ? labels[i-1] : 'đầu dự án')
    const bars = weeklyDelta.map((d, i) => {
      const isNeg = d < 0, absD = Math.abs(d)
      const barH  = Math.max(2, Math.round(absD/maxVal*chartH))
      const x     = PAD_L + i*(chartW/n) + (chartW/n - barW)/2
      const y     = isNeg ? PAD_T + chartH : PAD_T + chartH - barH
      const barClr = isNeg ? '#DC2626' : '#2563EB'
      const lblClr = isNeg ? '#DC2626' : '#1D4ED8'
      const tooltip = d !== 0
        ? `${labels[i]}: EV ${isNeg?'':'+'}${fmtB(d)} so với ${prevLabels[i]}${isNeg?' ⚠️ Kiểm tra BCH':''}`
        : `${labels[i]}: Không phát sinh`
      return `<g><title>${tooltip}</title>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${barClr}" rx="2" opacity="0.85"/>
        ${d !== 0 ? `<text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="9" fill="${lblClr}" font-weight="600">${isNeg?'-':''}${fmtB(absD)}${isNeg?' ▼':''}</text>` : ''}
      </g>`
    }).join('')

    // EV line
    const evPoints = weeklyEV.map((v,i) => `${xC(i)},${yC(v)}`).join(' ')
    const evDots   = weeklyEV.map((v,i) => {
      const isLast = i===n-1
      return `<g>
        <circle cx="${xC(i)}" cy="${yC(v)}" r="${isLast?4:3}" fill="#D97706"/>
        ${isLast ? `<text x="${xC(i)}" y="${yC(v)-8}" text-anchor="middle" font-size="10" fill="#D97706" font-weight="700">${fmtB(v)}</text>` : ''}
      </g>`
    }).join('')

    // PV line — thêm mới
    const pvPoints = weeklyPV.map((v,i) => `${xC(i)},${yC(v)}`).join(' ')
    const pvDots   = weeklyPV.map((v,i) => {
      const isLast = i===n-1
      return `<g>
        <circle cx="${xC(i)}" cy="${yC(v)}" r="${isLast?5:3}" fill="#16A34A" opacity="1"/>
        ${isLast ? `<text x="${xC(i)}" y="${yC(v)-10}" text-anchor="middle" font-size="10" fill="#16A34A" font-weight="700">${fmtB(v)}</text>` : ''}
      </g>`
    }).join('')

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => {
      const y = PAD_T + chartH - r*chartH
      return `<line x1="${PAD_L}" y1="${y}" x2="${W-PAD_R}" y2="${y}" stroke="var(--gray2)" stroke-width="0.5"/>
        <text x="${PAD_L-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--gray4)">${fmtB(r*maxVal)}</text>`
    }).join('')

    const xLabels = labels.map((lbl, i) => {
      const x = xC(i)
      return `<text x="${x}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--gray5)">${lbl}</text>`
    }).join('')

    const lastEV = weeklyEV[n-1] || 0
    const lastPV = weeklyPV[n-1] || 0
    const spi    = lastPV > 0 ? (lastEV/lastPV).toFixed(2) : null
    const spiClr = !spi ? '#64748B' : parseFloat(spi)>=1 ? '#16A34A' : parseFloat(spi)>=0.8 ? '#D97706' : '#DC2626'
    const pctDat = totalCV > 0 ? Math.round(lastEV/totalCV*100) : 0

    el.innerHTML = `
      <div style="display:flex;gap:16px;font-size:12px;color:var(--gray5);margin-bottom:8px;flex-wrap:wrap;align-items:center">
        <span>Lũy kế TH (EV): <strong style="color:#D97706">${fmtB(lastEV)}</strong></span>
        ${lastPV > 0 ? `<span>Kế hoạch (PV): <strong style="color:#16A34A">${fmtB(lastPV)}</strong></span>` : ''}
        ${spi ? `<span style="padding:2px 8px;border-radius:10px;background:${spiClr}20;color:${spiClr};font-weight:700;font-size:11px">SPI = ${spi}</span>` : ''}
        ${totalCV > 0 ? `<span>HD: <strong style="color:var(--navy)">${fmtB(totalCV)}</strong></span><span>Đạt: <strong style="color:${pctDat>=80?'var(--green)':pctDat>=50?'var(--amber)':'var(--red)'}">${pctDat}%</strong></span>` : ''}
      </div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
        ${yTicks}
        <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T+chartH}" stroke="var(--gray3)" stroke-width="1"/>
        ${bars}
        <polyline points="${pvPoints}" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-dasharray="8 3" opacity="1"/>
        ${pvDots}
        <polyline points="${evPoints}" fill="none" stroke="#D97706" stroke-width="2" stroke-linejoin="round"/>
        ${evDots}
        ${xLabels}
      </svg>`
  } catch(e) {
    el.innerHTML = `<span style="color:var(--gray4);font-size:13px">Lỗi: ${e.message}</span>`
    console.warn('SL chart error:', e)
  }
}

// ═══════════════════════════════════════════════════════════
// ẢNH THI CÔNG TUẦN NÀY
// ═══════════════════════════════════════════════════════════
async function loadDashboardPhotos() {
  const el = document.getElementById('dash-photos-grid')
  const countEl = document.getElementById('dash-photos-count')
  if (!el) return
  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải ảnh...</span>'
  try {
    const now = new Date(), week = getISOWeek(now), year = now.getFullYear()
    const { data: photos, error } = await sb.from('task_photos')
      .select('id,photo_url,taken_at,uploaded_by,task_id')
      .eq('project_id', STATE.currentProject.id)
      .eq('week_number', week).eq('year', year)
      .order('taken_at', { ascending: false }).limit(9)
    if (error) throw error
    if (!photos?.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có ảnh nào trong tuần này</span>'
      if (countEl) countEl.textContent = '0 ảnh'; return
    }
    if (countEl) countEl.textContent = `Tuần ${week}/${year} · ${photos.length} ảnh`
    const taskMap = {}; STATE.tasks.forEach(t => { taskMap[t.id] = t.name })
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
      ${photos.map(p => {
        const taskName = taskMap[p.task_id] || ''
        const date = p.taken_at ? new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}) : ''
        const uploader = (p.uploaded_by||'').split('@')[0]
        return `<div style="position:relative;border-radius:8px;overflow:hidden;background:var(--gray1);aspect-ratio:4/3;cursor:pointer" onclick="window.open('${p.photo_url}','_blank')">
          <img src="${p.photo_url}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.parentElement.innerHTML='<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray4);font-size:12px&quot;>Lỗi ảnh</div>'">
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.65));padding:8px 6px 5px;color:white">
            ${taskName ? `<div style="font-size:10px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${taskName}</div>` : ''}
            <div style="font-size:9px;opacity:.8">${date}${uploader?' · '+uploader:''}</div>
          </div>
        </div>`
      }).join('')}
    </div>
    ${photos.length===9?`<div style="text-align:center;margin-top:8px;font-size:12px;color:var(--gray4)">Hiển thị 9 ảnh gần nhất · <span style="color:var(--blue);cursor:pointer" onclick="navigate('photos')">Xem tất cả →</span></div>`:''}`
  } catch(e) {
    el.innerHTML = `<span style="color:var(--gray4);font-size:13px">Lỗi: ${e.message}</span>`
  }
}

// ═══════════════════════════════════════════════════════════
// QUÂN SỐ CÔNG NHÂN
// ═══════════════════════════════════════════════════════════
async function loadAttendanceData() {
  const el = document.getElementById('dash-attendance-chart')
  const weekEl = document.getElementById('dash-attendance-week')
  if (!el) return
  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải quân số...</span>'
  try {
    const proj = STATE.currentProject
    const projCode = (proj.code || '').trim()
    const { data: rows, error } = await sb.from('v_attendance_daily_summary')
      .select('report_date,week_number,year,total_cn,total_bch,total_ketcau,total_hoanthien,total_mep,total_congnhat,cn_by_project')
      .order('report_date', { ascending: false }).limit(60)
    if (error) throw error
    const filtered = (rows||[]).filter(r => {
      if (!r.cn_by_project) return false
      const map = typeof r.cn_by_project==='string' ? JSON.parse(r.cn_by_project) : r.cn_by_project
      return Object.keys(map).some(k => k.includes(projCode.split(' ')[0]))
    }).slice(0, 30)
    if (!filtered.length) { el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có dữ liệu</span>'; return }
    const data = [...filtered].reverse()
    const getCN = r => {
      if (!r.cn_by_project) return 0
      const map = typeof r.cn_by_project==='string' ? JSON.parse(r.cn_by_project) : r.cn_by_project
      const key = Object.keys(map).find(k => k.includes(projCode.split(' ')[0]))
      return key ? (map[key]||0) : 0
    }
    const cnList = data.map(getCN)
    const avgCN  = Math.round(cnList.reduce((s,v)=>s+v,0)/cnList.length)
    const maxCN  = Math.max(...cnList, 1)
    const today  = new Date().toISOString().slice(0,10)
    STATE._attendanceData = { current: { ...data[data.length-1], total_cn: getCN(data[data.length-1]), avg_cn_30day: avgCN }, history: data.map(r=>({...r,cn_proj:getCN(r)})), avgCN }
    if (weekEl) weekEl.textContent = `TB 30 ngày: ${avgCN} CN/ngày`
    const W=600,H=160,PAD=36,BA=W-PAD-10,scaleH=H-48
    const barW = Math.max(8,Math.floor(BA/data.length)-4)
    const bars = data.map((d,i)=>{
      const cn=getCN(d),h=Math.max(4,Math.round(cn/maxCN*scaleH)),x=PAD+i*(BA/data.length),y=H-32-h
      const isToday=d.report_date===today
      const color=isToday?'#1D4ED8':cn>avgCN?'#16A34A':cn<avgCN*.8?'#DC2626':'#60A5FA'
      const dt=new Date(d.report_date),lbl=`${dt.getDate()}/${dt.getMonth()+1}`,dow=['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()]
      return `<g><title>${dow} ${lbl}: ${cn} CN</title>
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="3" opacity=".9"/>
        <text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="11" fill="var(--gray7)" font-weight="500">${cn}</text>
        <text x="${x+barW/2}" y="${H-16}" text-anchor="middle" font-size="9" fill="${isToday?'var(--blue)':'var(--gray5)'}" font-weight="${isToday?700:400}">${lbl}</text>
        <text x="${x+barW/2}" y="${H-6}" text-anchor="middle" font-size="8" fill="var(--gray4)">${dow}</text>
      </g>`
    }).join('')
    const avgY=H-32-Math.round(avgCN/maxCN*scaleH)
    el.innerHTML=`<svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;margin-bottom:4px">
      <line x1="${PAD}" y1="${H-32}" x2="${W-10}" y2="${H-32}" stroke="var(--gray2)" stroke-width=".5"/>
      <text x="${PAD-4}" y="${H-32}" text-anchor="end" font-size="8" fill="var(--gray4)" dominant-baseline="middle">0</text>
      <text x="${PAD-4}" y="${H-32-scaleH}" text-anchor="end" font-size="8" fill="var(--gray4)" dominant-baseline="middle">${maxCN}</text>
      <line x1="${PAD}" y1="${avgY}" x2="${W-10}" y2="${avgY}" stroke="#D97706" stroke-width="1" stroke-dasharray="4 3" opacity=".7"/>
      <text x="${W-8}" y="${avgY+4}" font-size="9" fill="#D97706" font-weight="600">TB</text>
      ${bars}
    </svg>
    <div style="display:flex;flex-wrap:wrap;gap:10px;padding-top:8px;border-top:1px solid var(--gray2);font-size:12px">
      <div>TB 30 ngày: <strong style="color:var(--blue)">${avgCN}</strong> CN/ngày</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;background:#1D4ED8;border-radius:2px;display:inline-block"></span>Hôm nay</span>
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;background:#16A34A;border-radius:2px;display:inline-block"></span>Trên TB</span>
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;background:#DC2626;border-radius:2px;display:inline-block"></span>Dưới TB 20%</span>
      </div>
    </div>`
  } catch(e) {
    el.innerHTML = `<span style="color:var(--red);font-size:13px">Lỗi: ${e.message}</span>`
  }
}


// ═══════════════════════════════════════════════════════════
// CÁC MỐC TIẾN ĐỘ — Dashboard (compact bảng ngang)
// ═══════════════════════════════════════════════════════════
async function loadDashboardMilestone() {
  const card  = document.getElementById('dash-milestone-card')
  const table = document.getElementById('dash-milestone-table')
  if (!card || !table || !STATE.currentProject) return

  // Load milestone groups
  const { data: groups } = await sb
    .from('milestone_groups')
    .select('*')
    .eq('project_id', STATE.currentProject.id)
    .order('sort_order')

  if (!groups?.length) { card.style.display = 'none'; return }

  // Load task links
  const { data: links } = await sb
    .from('milestone_tasks')
    .select('milestone_id, task_id')
    .in('milestone_id', groups.map(g => g.id))

  const linkMap = {}
  ;(links || []).forEach(l => {
    if (!linkMap[l.milestone_id]) linkMap[l.milestone_id] = []
    linkMap[l.milestone_id].push(l.task_id)
  })

  const fmtQty = v => Number.isInteger(v) ? v : parseFloat(v.toFixed(1))

  const rows = groups.map(g => {
    const taskIds = linkMap[g.id] || []
    const tasks   = STATE.tasks.filter(t => taskIds.includes(t.id))
    const unit    = g.unit || 'căn'

    if (!tasks.length) {
      return `<tr style="border-bottom:0.5px solid var(--gray2)">
        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:var(--gray7);width:200px">${g.name}</td>
        <td colspan="4" style="padding:10px 14px;font-size:12px;color:var(--gray4)">Chưa có task — <span style="color:var(--blue);cursor:pointer" onclick="navigate('milestone')">Thêm task</span></td>
      </tr>`
    }

    let completedQty = 0, notStartedQty = 0, totalQty = 0, inProgressCnt = 0
    tasks.forEach(t => {
      const pct    = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
      const qty    = t.planned_quantity || 1
      const actual = t.actual_quantity != null
        ? t.actual_quantity
        : Math.round(qty * pct / 100)
      totalQty += qty
      completedQty += actual
      if (pct > 0 && pct < 100) inProgressCnt++
      if (pct === 0) notStartedQty += qty
    })

    const donePct  = totalQty > 0 ? Math.round(completedQty / totalQty * 100) : 0
    const barColor = donePct === 100 ? '#16A34A' : donePct >= 60 ? '#0D9488' : donePct >= 30 ? '#D97706' : '#2563EB'

    return `<tr style="border-bottom:0.5px solid var(--gray2)" onmouseover="this.style.background='var(--gray1)'" onmouseout="this.style.background='white'">
      <!-- Tên mốc -->
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:var(--gray8);width:180px;white-space:nowrap">${g.name}</td>
      <!-- Progress bar + % -->
      <td style="padding:10px 14px;min-width:160px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:7px;background:var(--gray2);border-radius:4px;overflow:hidden">
            <div style="width:${donePct}%;height:100%;background:${barColor};border-radius:4px;transition:width .4s"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:${barColor};width:34px;text-align:right;flex-shrink:0">${donePct}%</span>
        </div>
      </td>
      <!-- Đã thực hiện -->
      <td style="padding:10px 10px;text-align:center;white-space:nowrap">
        <span style="font-size:13px;font-weight:700;color:#16A34A">${fmtQty(completedQty)}</span>
        <span style="font-size:10px;color:var(--gray4)"> / ${fmtQty(totalQty)} ${unit}</span>
        <div style="font-size:10px;color:#16A34A">✅ đã thực hiện</div>
      </td>
      <!-- Đang dở — ẩn trên mobile -->
      <td style="padding:10px 10px;text-align:center;white-space:nowrap;display:var(--dash-hide-mobile)">
        <span style="font-size:13px;font-weight:700;color:#D97706">${inProgressCnt}</span>
        <span style="font-size:10px;color:var(--gray4)"> task</span>
        <div style="font-size:10px;color:#D97706">⚙️ đang dở</div>
      </td>
      <!-- Chưa bắt đầu — ẩn trên mobile -->
      <td style="padding:10px 10px;text-align:center;white-space:nowrap;display:var(--dash-hide-mobile)">
        <span style="font-size:13px;font-weight:700;color:var(--gray4)">${fmtQty(notStartedQty)}</span>
        <span style="font-size:10px;color:var(--gray4)"> ${unit}</span>
        <div style="font-size:10px;color:var(--gray4)">○ chưa bắt đầu</div>
      </td>
    </tr>`
  }).join('')

  const isMobDash = window.innerWidth < 1024
  const dashHideMobile = isMobDash ? 'none' : 'table-cell'
  // Inject CSS var vào document
  document.documentElement.style.setProperty('--dash-hide-mobile', dashHideMobile)
  table.innerHTML = `<div style="overflow-x:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--gray1);font-size:11px;color:var(--gray5)">
          <th style="padding:7px 14px;text-align:left;font-weight:600">Mốc công việc</th>
          <th style="padding:7px 14px;text-align:left;font-weight:600;min-width:120px">Tiến độ</th>
          <th style="padding:7px 10px;text-align:center;font-weight:600">✅ Đã thực hiện</th>
          <th style="padding:7px 10px;text-align:center;font-weight:600;display:var(--dash-hide-mobile)">⚙️ Đang dở</th>
          <th style="padding:7px 10px;text-align:center;font-weight:600;display:var(--dash-hide-mobile)">○ Chưa bắt đầu</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`

  card.style.display = 'block'
}

// ═══════════════════════════════════════════════════════════
// TÀI CHÍNH DỰ ÁN
// ═══════════════════════════════════════════════════════════
async function loadFinanceData() {
  const card = document.getElementById('dash-finance-card')
  const el   = document.getElementById('dash-finance-metrics')
  if (!el || !STATE.currentProject) return
  try {
    const { data: projData } = await sb.from('projects').select('contract_value').eq('id', STATE.currentProject.id).single()
    const contractValue = projData?.contract_value || 0
    const { data: payments } = await sb.from('payment_records').select('amount,received_date,note').eq('project_id', STATE.currentProject.id).order('received_date',{ascending:false})
    const totalReceived = (payments||[]).reduce((s,p)=>s+(p.amount||0),0)
    const tasks = STATE.tasks||[], leaf = tasks.filter(t=>!t.is_summary)
    let earnedValue = 0
    if (contractValue > 0 && leaf.length > 0) {
      const unitValue = contractValue/leaf.length
      earnedValue = leaf.reduce((s,t)=>{const tv=t.contract_value||unitValue;return s+tv*(t.pct_complete||0)/100},0)
    }
    const remaining = contractValue > 0 ? contractValue-totalReceived : null
    const totalPct  = tasks.find(t=>t.outline_level===1)?.display_pct||0
    const receiveRate = contractValue > 0 ? Math.round(totalReceived/contractValue*100) : null
    const earnRate    = contractValue > 0 ? Math.round(earnedValue/contractValue*100) : null
    if (contractValue===0 && totalReceived===0) { card.style.display='none'; return }
    card.style.display = 'block'
    const lastDate = payments?.[0]?.received_date ? new Date(payments[0].received_date).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}) : null
    const updEl = document.getElementById('dash-finance-updated')
    if (updEl && lastDate) updEl.textContent = `Cập nhật: ${lastDate}`
    const payGap = receiveRate!==null&&earnRate!==null ? earnRate-receiveRate : null
    el.innerHTML = [
      contractValue>0?`<div class="metric-card"><div class="m-lbl">Giá trị hợp đồng</div><div class="m-val" style="font-size:18px;color:var(--navy)">${fmtMoneyFull(contractValue)}</div><div class="m-sub">Tổng giá trị HĐ</div></div>`:'',
      earnedValue>0?`<div class="metric-card"><div class="m-lbl">Sản lượng thực hiện</div><div class="m-val" style="font-size:18px;color:var(--teal)">${fmtMoneyFull(earnedValue)}</div><div class="m-sub">${earnRate}% giá trị HĐ · TĐ ${totalPct}%</div></div>`:'',
      `<div class="metric-card"><div class="m-lbl">Đã nhận từ CĐT</div><div class="m-val" style="font-size:18px;color:var(--green)">${fmtMoneyFull(totalReceived)}</div><div class="m-sub">${receiveRate!==null?receiveRate+'% giá trị HĐ':'—'}</div></div>`,
      remaining!==null?`<div class="metric-card"><div class="m-lbl">Còn phải nhận</div><div class="m-val" style="font-size:18px;color:${payGap!==null&&payGap>10?'var(--amber)':'var(--gray7)'}">${fmtMoneyFull(remaining)}</div><div class="m-sub">${payGap!==null?`SL vượt nhận ${payGap>0?'+':''}${payGap}%`:'—'}</div></div>`:''
    ].filter(Boolean).join('')
    STATE._financeData = { contractValue, earnedValue, totalReceived, remaining, earnRate, receiveRate, payGap, payments: payments||[] }
  } catch(e) { console.warn('Finance load failed:', e.message) }
}
