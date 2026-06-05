// ═══════════════════════════════════════════════════════════
// PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════
function dashboard() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700;color:var(--gray8)">Dashboard Tổng quan</h2>
      <p style="font-size:13px;color:var(--gray4)">Cập nhật: ${new Date().toLocaleDateString('vi-VN')}</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="showAISummaryHistory()">📋 Lịch sử AI</button>
      ${STATE.role === 'admin' ? `
        <button class="btn btn-primary btn-sm" onclick="generateAISummary()">🤖 AI Tóm tắt tiến độ</button>
      ` : ''}
      <button class="btn btn-secondary btn-sm" onclick="exportWeeklyReport()">📄 Xuất báo cáo tuần</button>
    </div>
  </div>
  <div class="metrics-row" id="dash-metrics"></div>
  <div class="card">
    <div class="card-title">Tiến độ theo hạng mục lớn</div>
    <div class="card-sub">Chỉ hiển thị task cấp 2-3 (hạng mục tổng hợp)</div>
    <div id="dash-summary-table"></div>
  </div>
  <div class="card" id="dash-labor-card">
    <div class="card-title">Nhân công tuần này</div>
    <div class="card-sub">Nguồn: Google Sheets VELA Quân số — Tab TongHop</div>
    <div id="dash-labor"></div>
  </div>
  <div class="card" id="dash-attendance-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="card-title" style="margin-bottom:0">Quân số BCH theo tuần</div>
      <span style="font-size:11px;color:var(--gray4)" id="dash-attendance-week"></span>
    </div>
    <div class="card-sub">Nguồn: VELA ChamCong — Trung bình CN/ngày theo tuần</div>
    <div id="dash-attendance-chart" style="min-height:180px"></div>
  </div>`
}

async function loadDashboard() {
  const tasks = STATE.tasks
  if (!STATE.currentProject) { document.getElementById('dash-metrics').innerHTML='<div style="color:var(--gray4)">Chưa có dự án — vui lòng Import MS Project trước.</div>'; return }
  if (!tasks.length) { document.getElementById('dash-metrics').innerHTML='<div style="color:var(--gray4)">Chưa có dữ liệu. Vào Import để tải file MS Project.</div>'; return }

  const leaf = tasks.filter(t => !t.is_summary)
  const done = leaf.filter(t => t.pct_complete === 100).length
  const late = leaf.filter(t => ['critical','delayed','not_started_late'].includes(t.status)).length
  const onTrack = leaf.filter(t => ['on_track','ahead','done'].includes(t.status)).length
  const notStarted = leaf.filter(t => t.status?.includes('not_started') && !t.status.includes('late')).length
  const totalDelay = leaf.reduce((s,t) => s + Math.max(0, t.delay_days||0), 0)
  const avgDelay = late > 0 ? Math.round(totalDelay/late) : 0

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric-card">
      <div class="m-lbl">Tổng công tác</div>
      <div class="m-val" style="color:var(--blue)">${leaf.length}</div>
      <div class="m-sub">${done} hoàn thành</div>
    </div>
    <div class="metric-card">
      <div class="m-lbl">Chậm tiến độ</div>
      <div class="m-val" style="color:var(--red)">${late}</div>
      <div class="m-sub">Cần chú ý</div>
    </div>
    <div class="metric-card">
      <div class="m-lbl">Đúng / Vượt TĐ</div>
      <div class="m-val" style="color:var(--green)">${onTrack}</div>
      <div class="m-sub">Bình thường</div>
    </div>
    <div class="metric-card">
      <div class="m-lbl">Chưa bắt đầu</div>
      <div class="m-val" style="color:var(--gray5)">${notStarted}</div>
      <div class="m-sub">Theo kế hoạch</div>
    </div>
    <div class="metric-card">
      <div class="m-lbl">Trễ trung bình</div>
      <div class="m-val" style="color:${avgDelay>7?'var(--red)':'var(--amber)'}">${avgDelay > 0 ? '+'+avgDelay : 0}</div>
      <div class="m-sub">ngày (task chậm)</div>
    </div>`

  // Summary table — level 2-3 only
  const summaries = tasks.filter(t => t.is_summary && t.outline_level <= 3)
  document.getElementById('dash-summary-table').innerHTML = `
    <table class="tbl">
      <thead><tr>
        <th>Hạng mục</th><th>KH Bắt đầu</th><th>KH Kết thúc</th>
        <th>% Hoàn thành</th><th>Trạng thái</th><th>Lệch (ngày)</th>
      </tr></thead>
      <tbody>
        ${summaries.slice(0,12).map(t => {
          const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
          const delay = t.delay_days
          const dStyle = delay > 7 ? 'color:var(--red);font-weight:600' :
                         delay > 0 ? 'color:var(--amber);font-weight:600' :
                         delay < 0 ? 'color:var(--green)' : ''
          return `<tr>
            <td style="padding-left:${(t.outline_level-1)*16+12}px;font-weight:${t.outline_level<=2?600:400}">
              ${t.name}
            </td>
            <td>${fmtDateShort(t.kh_start)}</td>
            <td>${fmtDateShort(t.kh_finish)}</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="pct-bar" style="width:60px">
                  <div class="pct-fill ${pct===100?'on':delay>0?'late':'on'}" style="width:${pct}%"></div>
                </div>
                <span style="font-size:12px;color:var(--gray5)">${pct}%</span>
              </div>
            </td>
            <td style="font-size:11px">${
              t._delay > 7 ? '<span style="color:#991B1B;font-weight:500">Trễ '+t._delay+'d</span>'
              : t._delay > 0 ? '<span style="color:#D97706;font-weight:500">Chú ý +'+t._delay+'d</span>'
              : t._delay < 0 ? '<span style="color:#166534;font-weight:500">Sớm '+Math.abs(t._delay)+'d</span>'
              : '<span style="color:#64748B">Đúng KH</span>'
            }</td>
            <td style="${dStyle}">${t._delay != null ? (t._delay>0?'+'+t._delay:t._delay)+'d' : '—'}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  // Load labor from Sheets
  loadLaborData()
}

async function loadLaborData() {
  const el = document.getElementById('dash-labor')
  if (!el) return
  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải dữ liệu nhân công...</span>'

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.SHEETS_ID}/values/${CFG.SHEET_TAB}!A:E?key=${CFG.GOOGLE_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    const rows = (json.values || []).slice(1).filter(r => r[0]) // skip header

    // Get current week
    const now = new Date()
    const thisWeek = getISOWeek(now)
    const thisYear = now.getFullYear()

    const weekRows = rows.filter(r => {
      const d = new Date(r[0].split('/').reverse().join('-'))
      return getISOWeek(d) === thisWeek && d.getFullYear() === thisYear
    })

    if (!weekRows.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có dữ liệu tuần này</span>'
      return
    }

    const totalBCH = weekRows.reduce((s,r) => s + (parseInt(r[1])||0), 0)
    const totalCN  = weekRows.reduce((s,r) => s + (parseInt(r[2])||0), 0)
    const days     = weekRows.length

    // Parse project detail from column E
    const projMap = {}
    weekRows.forEach(r => {
      const detail = r[4] || ''
      detail.split('|').forEach(part => {
        const m = part.trim().match(/^(.+?):\s*(\d+)\s*CN/)
        if (m) projMap[m[1].trim()] = (projMap[m[1].trim()]||0) + parseInt(m[2])
      })
    })

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        <div class="metric-card">
          <div class="m-lbl">Tổng BCH cả tuần</div>
          <div class="m-val" style="color:var(--navy)">${totalBCH}</div>
          <div class="m-sub">${days} ngày có dữ liệu</div>
        </div>
        <div class="metric-card">
          <div class="m-lbl">Tổng CN cả tuần</div>
          <div class="m-val" style="color:var(--blue)">${totalCN}</div>
          <div class="m-sub">Tuần ${thisWeek}/${thisYear}</div>
        </div>
        <div class="metric-card">
          <div class="m-lbl">TB CN/ngày</div>
          <div class="m-val" style="color:var(--teal)">${Math.round(totalCN/days)}</div>
          <div class="m-sub">người/ngày</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--gray5);margin-bottom:8px;font-weight:500">Chi tiết theo dự án:</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${Object.entries(projMap).sort((a,b)=>b[1]-a[1]).map(([proj,cn]) =>
          `<div style="background:var(--gray1);border-radius:6px;padding:6px 12px;font-size:12px">
            <strong>${proj}</strong>: ${cn} CN
          </div>`
        ).join('')}
      </div>`
  } catch(e) {
    console.warn('Labor data load failed:', e.message)
    el.innerHTML = `<span style="color:var(--gray4);font-size:13px">Không tải được dữ liệu nhân công. Kiểm tra quyền Google Sheets API.</span>`
  }
}


// ═══════════════════════════════════════════════════════════
// QUÂN SỐ BCH — từ v_attendance_weekly (Supabase)
// ═══════════════════════════════════════════════════════════
async function loadAttendanceData() {
  const el = document.getElementById('dash-attendance-chart')
  const weekEl = document.getElementById('dash-attendance-week')
  if (!el) return

  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải quân số...</span>'

  try {
    const proj = STATE.currentProject
    const now = new Date()
    const thisWeek = getISOWeek(now)
    const thisYear = now.getFullYear()

    // Lấy 8 tuần gần nhất của dự án hiện tại
    const { data: rows, error } = await sb
      .from('v_attendance_weekly')
      .select('week_number,year,total_cn,total_bch,total_ketcau,total_hoanthien,total_mep,total_congnhat,avg_cn_per_day,project_id')
      .eq('project_id', proj.id)
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .limit(8)

    if (error) throw error

    if (!rows || !rows.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có dữ liệu quân số từ app ChamCong</span>'
      return
    }

    // Đảo lại để hiển thị cũ → mới (trái → phải)
    const data = [...rows].reverse()
    const current = rows[0] // tuần mới nhất

    if (weekEl) weekEl.textContent = `Tuần ${current.week_number}/${current.year}`

    // Lưu vào STATE để AI dùng
    STATE._attendanceData = { current, history: data }

    // Vẽ chart SVG bar chart
    const maxCN = Math.max(...data.map(d => d.total_cn || 0), 1)
    const W = 600, H = 140, PAD = 40, BAR_AREA = W - PAD
    const barW = Math.floor(BAR_AREA / data.length) - 6
    const scaleH = (H - 40)

    const bars = data.map((d, i) => {
      const cn = d.total_cn || 0
      const bch = d.total_bch || 0
      const h = Math.max(2, Math.round((cn / maxCN) * scaleH))
      const x = PAD + i * (BAR_AREA / data.length)
      const y = H - 28 - h
      const isThis = d.week_number === thisWeek && d.year === thisYear
      const barColor = isThis ? '#2563EB' : '#93C5FD'

      // Breakdown: kết cấu, hoàn thiện, MEP, công nhật
      const kc = d.total_ketcau || 0
      const ht = d.total_hoanthien || 0
      const mep = d.total_mep || 0
      const cnhat = d.total_congnhat || 0

      const tooltip = `T${d.week_number}: ${cn} CN (KC:${kc} HT:${ht} MEP:${mep} CN:${cnhat}) | BCH:${bch}`

      return `
        <g>
          <title>${tooltip}</title>
          <rect x="${x}" y="${y}" width="${barW}" height="${h}"
            fill="${barColor}" rx="3" opacity="${isThis ? 1 : 0.75}"/>
          <text x="${x + barW/2}" y="${y - 4}" text-anchor="middle"
            font-size="10" fill="var(--gray6)">${cn}</text>
          <text x="${x + barW/2}" y="${H - 14}" text-anchor="middle"
            font-size="9" fill="${isThis ? 'var(--blue)' : 'var(--gray4)'}"
            font-weight="${isThis ? '600' : '400'}">T${d.week_number}</text>
          ${isThis ? `<rect x="${x - 1}" y="${y - 1}" width="${barW + 2}" height="${h + 2}" fill="none" stroke="#2563EB" stroke-width="1.5" rx="3"/>` : ''}
        </g>`
    }).join('')

    // Legend breakdown tuần hiện tại
    const c = current
    const breakdown = [
      { label: 'Kết cấu', val: c.total_ketcau || 0, color: '#1D4ED8' },
      { label: 'Hoàn thiện', val: c.total_hoanthien || 0, color: '#0D9488' },
      { label: 'MEP', val: c.total_mep || 0, color: '#D97706' },
      { label: 'Công nhật', val: c.total_congnhat || 0, color: '#9333EA' },
    ]

    const legendHtml = breakdown.map(b =>
      `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--gray6)">
        <span style="width:10px;height:10px;border-radius:2px;background:${b.color};flex-shrink:0"></span>
        ${b.label}: <strong>${b.val}</strong>
      </div>`
    ).join('')

    el.innerHTML = `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
        <line x1="${PAD}" y1="${H-28}" x2="${W}" y2="${H-28}"
          stroke="var(--gray2)" stroke-width="0.5"/>
        ${bars}
        <text x="${PAD - 4}" y="${H - 28}" text-anchor="end"
          font-size="9" fill="var(--gray4)">0</text>
        <text x="${PAD - 4}" y="${H - 28 - scaleH}" text-anchor="end"
          font-size="9" fill="var(--gray4)">${maxCN}</text>
      </svg>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid var(--gray2)">
        <div style="font-size:12px;color:var(--gray6)">
          Tuần này: <strong style="color:var(--navy)">${c.total_cn || 0} CN</strong>
          · BCH: <strong>${c.total_bch || 0}</strong>
          · TB/ngày: <strong style="color:var(--blue)">${c.avg_cn_per_day || 0}</strong>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          ${legendHtml}
        </div>
      </div>`

  } catch(e) {
    console.warn('Attendance load failed:', e.message)
    el.innerHTML = `<span style="color:var(--gray4);font-size:13px">Lỗi tải quân số: ${e.message}</span>`
  }
}
