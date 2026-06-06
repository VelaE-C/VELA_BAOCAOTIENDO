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
  <div class="card" id="dash-photos-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="card-title" style="margin-bottom:0">📷 Ảnh thi công tuần này</div>
      <span style="font-size:11px;color:var(--gray4)" id="dash-photos-count"></span>
    </div>
    <div class="card-sub">Tối đa 9 ảnh — tuần hiện tại</div>
    <div id="dash-photos-grid"></div>
  </div>
  <div class="card" id="dash-attendance-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="card-title" style="margin-bottom:0">Số lượng công nhân theo ngày</div>
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

  // Load attendance từ Supabase
  loadAttendanceData()
  // Load ảnh tuần này
  loadDashboardPhotos()
}


// ═══════════════════════════════════════════════════════════
// SỐ LƯỢNG CÔNG NHÂN THEO NGÀY — 30 ngày gần nhất
// Source: v_attendance_daily_summary, filter theo cn_by_project
// ═══════════════════════════════════════════════════════════
async function loadAttendanceData() {
  const el     = document.getElementById('dash-attendance-chart')
  const weekEl = document.getElementById('dash-attendance-week')
  if (!el) return

  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải quân số...</span>'

  try {
    const proj     = STATE.currentProject
    const projCode = (proj.code || '').trim()  // VD: "VEGACITY 62CAN" hoặc "IEC 29CAN"

    // Lấy 7 ngày gần nhất — toàn bộ, lọc theo cn_by_project phía client
    const { data: rows, error } = await sb
      .from('v_attendance_daily_summary')
      .select('report_date,week_number,year,total_cn,total_bch,total_ketcau,total_hoanthien,total_mep,total_congnhat,total_khac,cn_by_project')
      .order('report_date', { ascending: false })
      .limit(60)  // lấy 60 ngày để đảm bảo đủ 30 ngày có data

    if (error) throw error

    // Lọc theo dự án hiện tại từ cn_by_project JSON
    // VD: {"VEGACITY 62CAN": 50, "IEC 29CAN": 70}
    const filtered = (rows || [])
      .filter(r => {
        if (!r.cn_by_project) return false
        const map = typeof r.cn_by_project === 'string'
          ? JSON.parse(r.cn_by_project) : r.cn_by_project
        return Object.keys(map).some(k => k.includes(projCode.split(' ')[0]))
      })
      .slice(0, 30)

    if (!filtered.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có dữ liệu 30 ngày gần nhất cho dự án này</span>'
      return
    }

    // Đảo lại: cũ → mới (trái → phải)
    const data = [...filtered].reverse()

    // Lấy CN theo dự án từ cn_by_project
    const getCN = (r) => {
      if (!r.cn_by_project) return 0
      const map = typeof r.cn_by_project === 'string'
        ? JSON.parse(r.cn_by_project) : r.cn_by_project
      const key = Object.keys(map).find(k => k.includes(projCode.split(' ')[0]))
      return key ? (map[key] || 0) : 0
    }

    // Tính trung bình 30 ngày
    const cnList  = data.map(getCN)
    const avgCN7  = Math.round(cnList.reduce((s, v) => s + v, 0) / cnList.length)
    const maxCN   = Math.max(...cnList, 1)
    const today   = new Date().toISOString().slice(0, 10)

    // Lưu vào STATE để AI dùng
    const currentWeek = data[data.length - 1]
    STATE._attendanceData = {
      current: {
        ...currentWeek,
        total_cn: getCN(currentWeek),
        avg_cn_30day: avgCN7,
      },
      history: data.map(r => ({ ...r, cn_proj: getCN(r) })),
      avgCN7,
    }

    if (weekEl) weekEl.textContent = `TB 30 ngày: ${avgCN7} CN/ngày`

    // Vẽ SVG bar chart
    const W = 600, H = 160, PAD = 36, BAR_AREA = W - PAD - 10
    const barW = Math.max(8, Math.floor(BAR_AREA / data.length) - 4)
    const scaleH = H - 48

    const bars = data.map((d, i) => {
      const cn    = getCN(d)
      const h     = Math.max(4, Math.round((cn / maxCN) * scaleH))
      const x     = PAD + i * (BAR_AREA / data.length)
      const y     = H - 32 - h
      const isToday = d.report_date === today
      const isAvg = Math.abs(cn - avgCN7) <= 2

      const color = isToday  ? '#1D4ED8'
                  : cn > avgCN7 ? '#16A34A'
                  : cn < avgCN7 * 0.8 ? '#DC2626'
                  : '#60A5FA'

      // Format ngày dd/MM
      const dt  = new Date(d.report_date)
      const lbl = `${dt.getDate()}/${dt.getMonth()+1}`
      const dow = ['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()]

      return `
        <g>
          <title>${dow} ${lbl}: ${cn} CN${isToday?' (hôm nay)':''}</title>
          <rect x="${x}" y="${y}" width="${barW}" height="${h}"
            fill="${color}" rx="3" opacity="0.9"/>
          <text x="${x + barW/2}" y="${y - 4}" text-anchor="middle"
            font-size="11" fill="var(--gray7)" font-weight="500">${cn}</text>
          <text x="${x + barW/2}" y="${H - 16}" text-anchor="middle"
            font-size="9" fill="${isToday?'var(--blue)':'var(--gray5)'}"
            font-weight="${isToday?'700':'400'}">${lbl}</text>
          <text x="${x + barW/2}" y="${H - 6}" text-anchor="middle"
            font-size="8" fill="var(--gray4)">${dow}</text>
        </g>`
    }).join('')

    // Đường trung bình
    const avgY = H - 32 - Math.round((avgCN7 / maxCN) * scaleH)
    const avgLine = `
      <line x1="${PAD}" y1="${avgY}" x2="${W - 10}" y2="${avgY}"
        stroke="#D97706" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
      <text x="${W - 8}" y="${avgY + 4}" font-size="9" fill="#D97706"
        font-weight="600">TB</text>`

    el.innerHTML = `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;margin-bottom:4px">
        <line x1="${PAD}" y1="${H-32}" x2="${W-10}" y2="${H-32}"
          stroke="var(--gray2)" stroke-width="0.5"/>
        <text x="${PAD-4}" y="${H-32}" text-anchor="end"
          font-size="8" fill="var(--gray4)" dominant-baseline="middle">0</text>
        <text x="${PAD-4}" y="${H-32-scaleH}" text-anchor="end"
          font-size="8" fill="var(--gray4)" dominant-baseline="middle">${maxCN}</text>
        ${avgLine}
        ${bars}
      </svg>

      <div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:8px;border-top:1px solid var(--gray2);font-size:12px">
        <div>TB 30 ngày: <strong style="color:var(--blue);font-size:14px">${avgCN7}</strong> CN/ngày</div>
        <div style="color:var(--gray5)">—</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:3px">
            <span style="width:10px;height:10px;background:#1D4ED8;border-radius:2px;display:inline-block"></span>
            Hôm nay
          </span>
          <span style="display:flex;align-items:center;gap:3px">
            <span style="width:10px;height:10px;background:#16A34A;border-radius:2px;display:inline-block"></span>
            Trên TB
          </span>
          <span style="display:flex;align-items:center;gap:3px">
            <span style="width:10px;height:10px;background:#DC2626;border-radius:2px;display:inline-block"></span>
            Dưới TB 20%
          </span>
          <span style="display:flex;align-items:center;gap:3px">
            <span style="border-top:1px dashed #D97706;width:16px;display:inline-block"></span>
            Trung bình
          </span>
        </div>
      </div>

      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--gray5)">
        ${(() => {
          const last = data[data.length - 1]
          if (!last) return ''
          const map = typeof last.cn_by_project === 'string'
            ? JSON.parse(last.cn_by_project) : (last.cn_by_project || {})
          return [
            {l:'Kết cấu', v: last.total_ketcau||0, c:'#1D4ED8'},
            {l:'Hoàn thiện', v: last.total_hoanthien||0, c:'#0D9488'},
            {l:'MEP', v: last.total_mep||0, c:'#D97706'},
            {l:'Công nhật', v: last.total_congnhat||0, c:'#9333EA'},
          ].map(b =>
            `<span style="display:flex;align-items:center;gap:3px">
              <span style="width:8px;height:8px;background:${b.c};border-radius:2px;display:inline-block"></span>
              ${b.l}: <strong>${b.v}</strong>
            </span>`
          ).join('')
        })()}
        <span style="color:var(--gray4)">· BCH: <strong>${data[data.length-1]?.total_bch||0}</strong></span>
      </div>`

  } catch(e) {
    console.warn('Attendance load failed:', e.message)
    el.innerHTML = `<span style="color:var(--red);font-size:13px">Lỗi: ${e.message}</span>`
  }
}

// ═══════════════════════════════════════════════════════════
// ẢNH THI CÔNG TUẦN NÀY — từ task_photos
// ═══════════════════════════════════════════════════════════
async function loadDashboardPhotos() {
  const el      = document.getElementById('dash-photos-grid')
  const countEl = document.getElementById('dash-photos-count')
  if (!el) return

  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải ảnh...</span>'

  try {
    const proj    = STATE.currentProject
    const now     = new Date()
    const week    = getISOWeek(now)
    const year    = now.getFullYear()

    const { data: photos, error } = await sb
      .from('task_photos')
      .select('id,photo_url,taken_at,uploaded_by,task_id,week_number,year')
      .eq('project_id', proj.id)
      .eq('week_number', week)
      .eq('year', year)
      .order('taken_at', { ascending: false })
      .limit(9)

    if (error) throw error

    if (!photos || !photos.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có ảnh nào trong tuần này</span>'
      if (countEl) countEl.textContent = '0 ảnh'
      return
    }

    if (countEl) countEl.textContent = `Tuần ${week}/${year} · ${photos.length} ảnh`

    // Tìm tên task tương ứng
    const taskMap = {}
    STATE.tasks.forEach(t => { taskMap[t.id] = t.name })

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
        ${photos.map(p => {
          const taskName = taskMap[p.task_id] || ''
          const date = p.taken_at
            ? new Date(p.taken_at).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'})
            : ''
          const uploader = (p.uploaded_by || '').split('@')[0]
          return `
            <div style="position:relative;border-radius:8px;overflow:hidden;background:var(--gray1);aspect-ratio:4/3;cursor:pointer"
                 onclick="window.open('${p.photo_url}','_blank')">
              <img src="${p.photo_url}"
                   style="width:100%;height:100%;object-fit:cover;display:block"
                   loading="lazy"
                   onerror="this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray4);font-size:12px\'>Lỗi ảnh</div>'">
              <div style="position:absolute;bottom:0;left:0;right:0;
                background:linear-gradient(transparent,rgba(0,0,0,0.65));
                padding:8px 6px 5px;color:white">
                ${taskName ? `<div style="font-size:10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${taskName}</div>` : ''}
                <div style="font-size:9px;opacity:0.8">${date}${uploader ? ' · ' + uploader : ''}</div>
              </div>
            </div>`
        }).join('')}
      </div>
      ${photos.length === 9 ? `
        <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--gray4)">
          Hiển thị 9 ảnh gần nhất · <span style="color:var(--blue);cursor:pointer" onclick="navigate('photos')">Xem tất cả →</span>
        </div>` : ''}
    `
  } catch(e) {
    console.warn('Dashboard photos failed:', e.message)
    el.innerHTML = `<span style="color:var(--gray4);font-size:13px">Lỗi tải ảnh: ${e.message}</span>`
  }
}
