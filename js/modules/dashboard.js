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
