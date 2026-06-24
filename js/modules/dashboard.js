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
  <div class="card" id="dash-finance-card" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="card-title" style="margin-bottom:0">💰 Tài chính dự án</div>
      <span style="font-size:11px;color:var(--gray4)" id="dash-finance-updated"></span>
    </div>
    <div id="dash-finance-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px"></div>
  </div>
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

  // Summary: desktop = table, mobile = gantt bar list
  const summaries = tasks.filter(t => t.is_summary && t.outline_level <= 3)
  const isMob = window.innerWidth < 1024

  if (isMob) {
    // ── MOBILE: Gantt bar dạng list ──────────────────────────
    document.getElementById('dash-summary-table').innerHTML = summaries.slice(0,15).map(t => {
      const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
      const delay = t._delay || 0
      const indent = (t.outline_level - 1) * 12

      const barColor = pct === 100 ? '#16A34A'
                     : delay > 7  ? '#DC2626'
                     : delay > 0  ? '#D97706'
                     : '#2563EB'

      const statusTxt = delay > 7  ? `<span style="color:#DC2626;font-size:10px;font-weight:600">Trễ ${delay}d</span>`
                      : delay > 0  ? `<span style="color:#D97706;font-size:10px;font-weight:600">+${delay}d</span>`
                      : delay < 0  ? `<span style="color:#16A34A;font-size:10px">Sớm ${Math.abs(delay)}d</span>`
                      : `<span style="color:#64748B;font-size:10px">Đúng KH</span>`

      const nameSize = t.outline_level <= 2 ? 13 : 12
      const nameBold = t.outline_level <= 2 ? 700 : 400
      const nameBg   = t.outline_level === 1 ? 'var(--navy)'
                     : t.outline_level === 2 ? 'var(--lblue)'
                     : 'transparent'
      const nameColor= t.outline_level === 1 ? 'white' : 'var(--gray8)'
      const namePad  = t.outline_level === 1 ? '8px 10px' : '6px 8px'

      return `
        <div style="padding:${namePad};padding-left:${10+indent}px;
          background:${nameBg};margin-bottom:1px;border-radius:4px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:${nameSize}px;font-weight:${nameBold};color:${nameColor};
              flex:1;min-width:0;word-break:break-word;line-height:1.3">${t.name}</span>
            <span style="font-size:14px;font-weight:700;color:${barColor};margin-left:8px;flex-shrink:0">${pct}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:var(--gray2);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width .3s"></div>
            </div>
            ${statusTxt}
          </div>
          <div style="font-size:10px;color:${t.outline_level===1?'rgba(255,255,255,.6)':'var(--gray4)'};margin-top:3px">
            ${fmtDateShort(t.kh_start)} → ${fmtDateShort(t.kh_finish)}
          </div>
        </div>`
    }).join('')
  } else {
    // ── DESKTOP: Table như cũ ────────────────────────────────
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
  }

  loadFinanceData()
  loadAttendanceData()
  loadDashboardPhotos()
}

// ═══════════════════════════════════════════════════════════
// SỐ LƯỢNG CÔNG NHÂN THEO NGÀY
// ═══════════════════════════════════════════════════════════
async function loadAttendanceData() {
  const el     = document.getElementById('dash-attendance-chart')
  const weekEl = document.getElementById('dash-attendance-week')
  if (!el) return
  el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Đang tải quân số...</span>'
  try {
    const proj     = STATE.currentProject
    const projCode = (proj.code || '').trim()
    const { data: rows, error } = await sb
      .from('v_attendance_daily_summary')
      .select('report_date,week_number,year,total_cn,total_bch,total_ketcau,total_hoanthien,total_mep,total_congnhat,total_khac,cn_by_project')
      .order('report_date', { ascending: false })
      .limit(60)
    if (error) throw error
    const filtered = (rows || [])
      .filter(r => {
        if (!r.cn_by_project) return false
        const map = typeof r.cn_by_project === 'string' ? JSON.parse(r.cn_by_project) : r.cn_by_project
        return Object.keys(map).some(k => k.includes(projCode.split(' ')[0]))
      })
      .slice(0, 30)
    if (!filtered.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có dữ liệu 30 ngày gần nhất cho dự án này</span>'
      return
    }
    const data = [...filtered].reverse()
    const getCN = (r) => {
      if (!r.cn_by_project) return 0
      const map = typeof r.cn_by_project === 'string' ? JSON.parse(r.cn_by_project) : r.cn_by_project
      const key = Object.keys(map).find(k => k.includes(projCode.split(' ')[0]))
      return key ? (map[key] || 0) : 0
    }
    const cnList = data.map(getCN)
    const avgCN7 = Math.round(cnList.reduce((s, v) => s + v, 0) / cnList.length)
    const maxCN  = Math.max(...cnList, 1)
    const today  = new Date().toISOString().slice(0, 10)
    const currentWeek = data[data.length - 1]
    STATE._attendanceData = {
      current: { ...currentWeek, total_cn: getCN(currentWeek), avg_cn_30day: avgCN7 },
      history: data.map(r => ({ ...r, cn_proj: getCN(r) })),
      avgCN7,
    }
    if (weekEl) weekEl.textContent = `TB 30 ngày: ${avgCN7} CN/ngày`
    const W = 600, H = 160, PAD = 36, BAR_AREA = W - PAD - 10
    const barW = Math.max(8, Math.floor(BAR_AREA / data.length) - 4)
    const scaleH = H - 48
    const bars = data.map((d, i) => {
      const cn = getCN(d)
      const h  = Math.max(4, Math.round((cn / maxCN) * scaleH))
      const x  = PAD + i * (BAR_AREA / data.length)
      const y  = H - 32 - h
      const isToday = d.report_date === today
      const color = isToday ? '#1D4ED8' : cn > avgCN7 ? '#16A34A' : cn < avgCN7 * 0.8 ? '#DC2626' : '#60A5FA'
      const dt  = new Date(d.report_date)
      const lbl = `${dt.getDate()}/${dt.getMonth()+1}`
      const dow = ['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()]
      return `<g><title>${dow} ${lbl}: ${cn} CN${isToday?' (hôm nay)':''}</title>
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="3" opacity="0.9"/>
        <text x="${x+barW/2}" y="${y-4}" text-anchor="middle" font-size="11" fill="var(--gray7)" font-weight="500">${cn}</text>
        <text x="${x+barW/2}" y="${H-16}" text-anchor="middle" font-size="9" fill="${isToday?'var(--blue)':'var(--gray5)'}" font-weight="${isToday?'700':'400'}">${lbl}</text>
        <text x="${x+barW/2}" y="${H-6}" text-anchor="middle" font-size="8" fill="var(--gray4)">${dow}</text>
      </g>`
    }).join('')
    const avgY = H - 32 - Math.round((avgCN7 / maxCN) * scaleH)
    const avgLine = `<line x1="${PAD}" y1="${avgY}" x2="${W-10}" y2="${avgY}" stroke="#D97706" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
      <text x="${W-8}" y="${avgY+4}" font-size="9" fill="#D97706" font-weight="600">TB</text>`
    el.innerHTML = `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;margin-bottom:4px">
        <line x1="${PAD}" y1="${H-32}" x2="${W-10}" y2="${H-32}" stroke="var(--gray2)" stroke-width="0.5"/>
        <text x="${PAD-4}" y="${H-32}" text-anchor="end" font-size="8" fill="var(--gray4)" dominant-baseline="middle">0</text>
        <text x="${PAD-4}" y="${H-32-scaleH}" text-anchor="end" font-size="8" fill="var(--gray4)" dominant-baseline="middle">${maxCN}</text>
        ${avgLine}${bars}
      </svg>
      <div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:8px;border-top:1px solid var(--gray2);font-size:12px">
        <div>TB 30 ngày: <strong style="color:var(--blue);font-size:14px">${avgCN7}</strong> CN/ngày</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:#1D4ED8;border-radius:2px;display:inline-block"></span>Hôm nay</span>
          <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:#16A34A;border-radius:2px;display:inline-block"></span>Trên TB</span>
          <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:#DC2626;border-radius:2px;display:inline-block"></span>Dưới TB 20%</span>
          <span style="display:flex;align-items:center;gap:3px"><span style="border-top:1px dashed #D97706;width:16px;display:inline-block"></span>Trung bình</span>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--gray5)">
        ${(() => {
          const last = data[data.length-1]; if (!last) return ''
          return [{l:'Kết cấu',v:last.total_ketcau||0,c:'#1D4ED8'},{l:'Hoàn thiện',v:last.total_hoanthien||0,c:'#0D9488'},{l:'MEP',v:last.total_mep||0,c:'#D97706'},{l:'Công nhật',v:last.total_congnhat||0,c:'#9333EA'}]
            .map(b=>`<span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;background:${b.c};border-radius:2px;display:inline-block"></span>${b.l}: <strong>${b.v}</strong></span>`).join('')
        })()}
        <span style="color:var(--gray4)">· BCH: <strong>${data[data.length-1]?.total_bch||0}</strong></span>
      </div>`
  } catch(e) {
    console.warn('Attendance load failed:', e.message)
    el.innerHTML = `<span style="color:var(--red);font-size:13px">Lỗi: ${e.message}</span>`
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
    const proj = STATE.currentProject
    const now = new Date(), week = getISOWeek(now), year = now.getFullYear()
    const { data: photos, error } = await sb.from('task_photos')
      .select('id,photo_url,taken_at,uploaded_by,task_id,week_number,year')
      .eq('project_id', proj.id).eq('week_number', week).eq('year', year)
      .order('taken_at', { ascending: false }).limit(9)
    if (error) throw error
    if (!photos || !photos.length) {
      el.innerHTML = '<span style="color:var(--gray4);font-size:13px">Chưa có ảnh nào trong tuần này</span>'
      if (countEl) countEl.textContent = '0 ảnh'; return
    }
    if (countEl) countEl.textContent = `Tuần ${week}/${year} · ${photos.length} ảnh`
    const taskMap = {}; STATE.tasks.forEach(t => { taskMap[t.id] = t.name })
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
        ${photos.map(p => {
          const taskName = taskMap[p.task_id] || ''
          const date = p.taken_at ? new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}) : ''
          const uploader = (p.uploaded_by||'').split('@')[0]
          return `<div style="position:relative;border-radius:8px;overflow:hidden;background:var(--gray1);aspect-ratio:4/3;cursor:pointer" onclick="window.open('${p.photo_url}','_blank')">
            <img src="${p.photo_url}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray4);font-size:12px\'>Lỗi ảnh</div>'">
            <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.65));padding:8px 6px 5px;color:white">
              ${taskName ? `<div style="font-size:10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${taskName}</div>` : ''}
              <div style="font-size:9px;opacity:0.8">${date}${uploader?' · '+uploader:''}</div>
            </div>
          </div>`
        }).join('')}
      </div>
      ${photos.length===9?`<div style="text-align:center;margin-top:8px;font-size:12px;color:var(--gray4)">Hiển thị 9 ảnh gần nhất · <span style="color:var(--blue);cursor:pointer" onclick="navigate('photos')">Xem tất cả →</span></div>`:''}`
  } catch(e) {
    console.warn('Dashboard photos failed:', e.message)
    el.innerHTML = `<span style="color:var(--gray4);font-size:13px">Lỗi tải ảnh: ${e.message}</span>`
  }
}

// ═══════════════════════════════════════════════════════════
// TÀI CHÍNH DỰ ÁN
// ═══════════════════════════════════════════════════════════
async function loadFinanceData() {
  const card = document.getElementById('dash-finance-card')
  const el   = document.getElementById('dash-finance-metrics')
  if (!el || !STATE.currentProject) return
  try {
    const proj = STATE.currentProject
    const { data: projData } = await sb.from('projects').select('contract_value').eq('id', proj.id).single()
    const contractValue = projData?.contract_value || 0
    const { data: payments } = await sb.from('payment_records').select('amount, received_date, note').eq('project_id', proj.id).order('received_date', { ascending: false })
    const totalReceived = (payments || []).reduce((s, p) => s + (p.amount || 0), 0)
    const tasks = STATE.tasks || [], leaf = tasks.filter(t => !t.is_summary)
    let earnedValue = 0
    if (contractValue > 0 && leaf.length > 0) {
      const unitValue = contractValue / leaf.length
      earnedValue = leaf.reduce((s, t) => { const taskVal = t.contract_value || unitValue; return s + taskVal * (t.pct_complete || 0) / 100 }, 0)
    }
    const remaining = contractValue > 0 ? contractValue - totalReceived : null
    const totalPct  = tasks.find(t => t.outline_level === 1)?.display_pct || 0
    const receiveRate = contractValue > 0 ? Math.round(totalReceived / contractValue * 100) : null
    const earnRate    = contractValue > 0 ? Math.round(earnedValue / contractValue * 100) : null
    if (contractValue === 0 && totalReceived === 0) { card.style.display = 'none'; return }
    card.style.display = 'block'
    const lastPayment = payments?.[0]
    const lastDate = lastPayment?.received_date ? new Date(lastPayment.received_date).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}) : null
    const updEl = document.getElementById('dash-finance-updated')
    if (updEl && lastDate) updEl.textContent = `Cập nhật: ${lastDate}`
    const payGap = receiveRate !== null && earnRate !== null ? earnRate - receiveRate : null
    el.innerHTML = [
      contractValue > 0 ? `<div class="metric-card"><div class="m-lbl">Giá trị hợp đồng</div><div class="m-val" style="font-size:18px;color:var(--navy)">${fmtMoneyFull(contractValue)}</div><div class="m-sub">Tổng giá trị HĐ</div></div>` : '',
      earnedValue > 0   ? `<div class="metric-card"><div class="m-lbl">Sản lượng thực hiện</div><div class="m-val" style="font-size:18px;color:var(--teal)">${fmtMoneyFull(earnedValue)}</div><div class="m-sub">${earnRate}% giá trị HĐ · TĐ ${totalPct}%</div></div>` : '',
      `<div class="metric-card"><div class="m-lbl">Đã nhận từ CĐT</div><div class="m-val" style="font-size:18px;color:var(--green)">${fmtMoneyFull(totalReceived)}</div><div class="m-sub">${receiveRate !== null ? receiveRate+'% giá trị HĐ' : '—'}</div></div>`,
      remaining !== null ? `<div class="metric-card"><div class="m-lbl">Còn phải nhận</div><div class="m-val" style="font-size:18px;color:${payGap !== null && payGap > 10 ? 'var(--amber)' : 'var(--gray7)'}">${fmtMoneyFull(remaining)}</div><div class="m-sub">${payGap !== null ? `SL vượt nhận ${payGap>0?'+':''}${payGap}%` : '—'}</div></div>` : '',
    ].filter(Boolean).join('')
    STATE._financeData = { contractValue, earnedValue, totalReceived, remaining, earnRate, receiveRate, payGap, payments: payments || [] }
  } catch(e) { console.warn('Finance load failed:', e.message) }
}
