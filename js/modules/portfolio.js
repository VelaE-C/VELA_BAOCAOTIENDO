// ═══════════════════════════════════════════════════════════
// PAGE: PORTFOLIO BGĐ — Tổng quan đa dự án (admin only)
// ═══════════════════════════════════════════════════════════
function portfolioPage() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700">Portfolio BGĐ</h2>
      <p style="font-size:13px;color:var(--gray4)">Tổng quan tất cả dự án đang thi công</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-secondary btn-sm" onclick="portfolioSelectAll(true)">Chọn tất cả</button>
      <button class="btn btn-secondary btn-sm" onclick="portfolioSelectAll(false)">Bỏ tất cả</button>
      <button class="btn btn-primary btn-sm" onclick="exportPortfolioPDF()">📄 Xuất PDF portfolio</button>
    </div>
  </div>

  <div id="port-summary-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px"></div>

  <div class="card" style="padding:0;overflow:hidden">
    <div style="overflow-x:auto">
      <table class="tbl" id="port-table" style="min-width:420px">
        <thead>
          <tr>
            <th style="width:32px;padding:9px 8px">
              <input type="checkbox" id="port-check-all" checked onchange="portfolioToggleAll(this.checked)" style="width:14px;height:14px;cursor:pointer">
            </th>
            <th>Dự án</th>
            <th style="min-width:180px">% Hoàn thành</th>
            <th style="min-width:90px">Trạng thái</th>
            <th style="min-width:90px">Còn lại</th>
            <th style="min-width:40px">Trend</th>
            <th style="min-width:160px">Rủi ro cần chú ý</th>
          </tr>
        </thead>
        <tbody id="port-tbody"></tbody>
      </table>
    </div>
  </div>

  <div style="margin-top:16px" id="port-finance-wrap">
    <div style="font-size:13px;font-weight:600;color:var(--gray7);margin-bottom:8px">Sản lượng & Tài chính</div>
    <div class="card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto"><table class="tbl" id="port-finance-table" style="min-width:500px">
        <thead><tr>
          <th>Dự án</th>
          <th style="text-align:right">Giá trị HĐ</th>
          <th style="text-align:right">Sản lượng thực</th>
          <th style="text-align:right">Đã nhận</th>
          <th style="text-align:right">Còn phải thu</th>
        </tr></thead>
        <tbody id="port-finance-tbody"></tbody>
      </table></div>
    </div>
  </div>

  <div style="margin-top:16px">
    <div style="font-size:13px;font-weight:600;color:var(--gray7);margin-bottom:8px">Sơ đồ timeline (Gantt mini)</div>
    <div class="card" style="padding:0;overflow:hidden">
      <div id="port-gantt"></div>
      <div style="display:flex;gap:14px;padding:8px 12px;background:var(--gray0);flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--gray5)"><span style="display:inline-block;width:20px;height:5px;border-radius:2px;background:#9DC3E6"></span>Kế hoạch</span>
        <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--gray5)"><span style="display:inline-block;width:20px;height:5px;border-radius:2px;background:#86EFAC"></span>Thực tế đúng/vượt</span>
        <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--gray5)"><span style="display:inline-block;width:20px;height:5px;border-radius:2px;background:#F09595"></span>Thực tế chậm</span>
        <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--gray5)"><span style="display:inline-block;width:4px;height:12px;border-radius:1px;background:#D85A30"></span>Hôm nay</span>
      </div>
    </div>
  </div>`
}

let _portSelected = {}

async function initPortfolio() {
  if (STATE.role !== 'admin') {
    toast('Chỉ admin mới xem được Portfolio BGĐ', 'error')
    navigate('dashboard')
    return
  }
  loading(true, 'Đang tải dữ liệu portfolio...')
  try {
    const { data: projs } = await sb.from('projects').select('*').order('code')
    if (!projs || !projs.length) {
      loading(false)
      const tb = document.getElementById('port-tbody')
      if (tb) tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray4);padding:30px">Chưa có dự án nào</td></tr>'
      return
    }
    const taskResults = await Promise.all(
      projs.map(p => sb.from('v_tasks_with_progress').select('*').eq('project_id', p.id).order('sort_order'))
    )
    // Load ai_summaries 2 tuần gần nhất để tính trend
    const curWeek = getISOWeek(new Date()), curYear = new Date().getFullYear()
    const prevWeek = curWeek > 1 ? curWeek - 1 : 52
    const prevYear = curWeek > 1 ? curYear : curYear - 1
    const { data: summaryHistory } = await sb.from('ai_summaries')
      .select('project_id, week_number, year, stats')
      .in('project_id', projs.map(p => p.id))
      .in('week_number', [curWeek, prevWeek])
      .order('created_at', { ascending: false })

    // Load payment records cho tất cả projects (đúng chỗ)
    const projIds = projs.map(p => p.id)
    let allPayments = []
    if (projIds.length) {
      const { data: pmtData } = await sb.from('payment_records')
        .select('*')
        .in('project_id', projIds)
        .order('received_date')
      allPayments = pmtData || []
    }

    const portfolioData = projs.map((proj, idx) => {
      const raw = taskResults[idx].data || []
      const tasks = computeRollupPct(raw)
      computeRollupDelay(tasks)
      const projPayments = allPayments.filter(p => p.project_id === proj.id)
      const d = buildProjSummary(proj, tasks, projPayments)

      // Override trend từ ai_summaries thực tế nếu có
      const curSummary  = (summaryHistory || []).find(s => s.project_id === proj.id && s.week_number === curWeek  && s.year === curYear)
      const prevSummary = (summaryHistory || []).find(s => s.project_id === proj.id && s.week_number === prevWeek && s.year === prevYear)
      if (curSummary?.stats && prevSummary?.stats) {
        try {
          const cs = typeof curSummary.stats  === 'string' ? JSON.parse(curSummary.stats)  : curSummary.stats
          const ps = typeof prevSummary.stats === 'string' ? JSON.parse(prevSummary.stats) : prevSummary.stats
          const delta = (cs.total_pct || 0) - (ps.total_pct || 0)
          d.trend      = delta > 2 ? 'up' : delta < -2 ? 'dn' : 'eq'
          d.trendDelta = delta
          d.trendSource = 'actual'
        } catch(e) { /* fallback to estimated trend */ }
      }
      return d
    })
    _portSelected = {}
    projs.forEach(p => { _portSelected[p.id] = true })
    renderPortfolioSummary(portfolioData)
    renderPortfolioTable(portfolioData)
    renderPortfolioFinance(portfolioData)
    renderPortfolioGantt(portfolioData)
    window._portfolioData = portfolioData
  } catch(e) {
    toast('Lỗi tải portfolio: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}

function buildProjSummary(proj, tasks, payments) {
  payments = payments || []
  const leaf = tasks.filter(t => !t.is_summary)
  const root = tasks.find(t => t.outline_level === 1)
  const totalPct = root
    ? (root.display_pct !== undefined ? root.display_pct : (root.pct_complete || 0))
    : (leaf.length ? Math.round(leaf.reduce((s, t) => s + (t.display_pct || t.pct_complete || 0), 0) / leaf.length) : 0)
  const tl = getActualTimeline(tasks)
  let timePct = 0
  if (tl) {
    const now = new Date(); now.setHours(0,0,0,0)
    timePct = Math.max(0, Math.min(100, Math.round((now - tl.start) / (tl.end - tl.start) * 100)))
  }
  const gap = timePct - totalPct
  const rag = totalPct === 0 && timePct < 5 ? 'gray'
    : gap > 15 ? 'red'
    : gap > 5  ? 'amber'
    : 'green'
  const validLate = leaf.filter(t => t._delay > 0 && t._delay < 365)
  const avgDelay = validLate.length
    ? Math.round(validLate.reduce((s, t) => s + t._delay, 0) / validLate.length) : 0
  const topRisks = [...validLate].sort((a, b) => (b._delay || 0) - (a._delay || 0)).slice(0, 2)

  // ── Deadline & days remaining ───────────────────────────────
  const now2 = new Date(); now2.setHours(0,0,0,0)
  const khEndDate = proj.finish_date ? new Date(proj.finish_date) : null
  const daysLeft = khEndDate ? Math.round((khEndDate - now2) / 86400000) : null
  const deadlineStr = khEndDate ? khEndDate.toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'}) : '—'

  // ── Trend: so ai_summaries tuần trước (lấy từ cache nếu có) ─
  // Dùng gap so với timePct để estimate trend:
  // Nếu HT% > 50% của TG% còn lại → đang cải thiện (up), ngược lại (dn)
  // Sẽ được override bởi dữ liệu thực từ ai_summaries nếu có
  const trend = gap > 20 ? 'dn' : gap > 10 ? 'dn' : gap < -5 ? 'up' : 'eq'

  // ── Earned Value (Sản lượng thực) ─────────────────────────
  const earnedValue = leaf.reduce(function(sum, t) {
    const price = t.unit_price || 0
    if (!price) return sum
    if (t.unit && t.unit !== '%') {
      return sum + (t.actual_quantity || 0) * price
    } else {
      return sum + (t.pct_complete || 0) / 100 * price
    }
  }, 0)

  // ── Payment summary ────────────────────────────────────────
  const contractValue = proj.contract_value || 0
  const totalReceived = payments.reduce(function(s,p){ return s + (p.amount||0) }, 0)
  const remaining = contractValue > 0 ? contractValue - totalReceived : null

  return { id: proj.id, code: proj.code, name: proj.name, khStart: proj.start_date, khEnd: proj.finish_date,
           tl, totalPct, timePct, rag, avgDelay, lateCount: validLate.length, topRisks, tasks, leaf,
           daysLeft, deadlineStr, trend, earnedValue, contractValue, totalReceived, remaining }
}

function renderPortfolioSummary(data) {
  const el = document.getElementById('port-summary-row')
  if (!el) return
  const total = data.length
  const red   = data.filter(d => d.rag === 'red').length
  const green = data.filter(d => d.rag === 'green').length
  const amber = data.filter(d => d.rag === 'amber').length
  const allLate = data.reduce((s, d) => s + d.lateCount, 0)
  el.innerHTML = `
    <div class="metric-card"><div class="m-lbl">Tổng dự án</div><div class="m-val" style="color:var(--blue)">${total}</div><div class="m-sub">đang thi công</div></div>
    <div class="metric-card"><div class="m-lbl">Cần chú ý</div><div class="m-val" style="color:var(--red)">${red}</div><div class="m-sub">TG% vượt HT% &gt;15%</div></div>
    <div class="metric-card"><div class="m-lbl">Đúng / vượt KH</div><div class="m-val" style="color:var(--green)">${green}</div><div class="m-sub">${amber} dự án theo dõi</div></div>
    <div class="metric-card"><div class="m-lbl">Công tác chậm</div><div class="m-val" style="color:${allLate > 20 ? 'var(--red)' : 'var(--amber)'}">${allLate}</div><div class="m-sub">trên toàn dự án</div></div>`
}

function renderPortfolioTable(data) {
  const tbody = document.getElementById('port-tbody')
  if (!tbody) return
  const ragBadge = function(rag) {
    if (rag === 'green') return '<span class="badge badge-green" style="font-size:11px">🟢 Đúng KH</span>'
    if (rag === 'amber') return '<span class="badge badge-amber" style="font-size:11px">🟡 Theo dõi</span>'
    if (rag === 'red')   return '<span class="badge badge-red" style="font-size:11px">🔴 Cần chú ý</span>'
    return '<span class="badge badge-gray" style="font-size:11px">⚫ Chưa BĐ</span>'
  }
  tbody.innerHTML = data.map(function(d) {
    const gap = d.timePct - d.totalPct
    const barColor = d.rag === 'green' ? 'var(--green)' : d.rag === 'red' ? 'var(--red)' : 'var(--amber)'
    const pctColor = d.rag === 'green' ? 'var(--green)' : d.rag === 'red' ? 'var(--red)' : 'var(--amber)'
    const timeMark = '<span style="font-size:10px;color:var(--gray4);margin-left:4px">▲' + d.timePct + '% TG</span>'
    const gapStr = gap > 3
      ? '<span style="font-size:10px;color:var(--red);font-weight:600;margin-left:4px">−' + gap + '%</span>'
      : gap < -3
      ? '<span style="font-size:10px;color:var(--green);font-weight:600;margin-left:4px">+' + Math.abs(gap) + '%</span>'
      : ''
    const risks = d.topRisks.length
      ? d.topRisks.map(function(t) {
          const n = t.name.length > 38 ? t.name.slice(0, 38) + '…' : t.name
          return '<div style="font-size:11px;color:var(--gray6);display:flex;align-items:baseline;gap:4px;line-height:1.6"><span style="color:var(--red);flex-shrink:0">●</span><span>' + n + ' <strong style="color:var(--red)">+' + t._delay + 'd</strong></span></div>'
        }).join('')
      : '<span style="font-size:11px;color:var(--gray4)">Không có rủi ro</span>'
    return '<tr data-proj-id="' + d.id + '">'
      + '<td style="padding:8px 8px;width:32px"><input type="checkbox" data-proj="' + d.id + '" checked onchange="portfolioToggleOne(\'' + d.id + '\',this.checked)" style="width:14px;height:14px;cursor:pointer"></td>'
      + '<td><div style="font-weight:600;font-size:13px;color:var(--gray8)">' + d.code + '</div><div style="font-size:11px;color:var(--gray4);margin-top:1px">' + d.name.slice(0, 35) + '</div></td>'
      + '<td><div style="display:flex;align-items:center;gap:8px"><div class="pct-bar" style="width:80px"><div class="pct-fill on" style="width:' + d.totalPct + '%;background:' + barColor + '"></div></div><span style="font-size:12px;font-weight:600;color:' + pctColor + '">' + d.totalPct + '%</span>' + timeMark + gapStr + '</div>'
      + (d.lateCount > 0 ? '<div style="font-size:10px;color:var(--gray4);margin-top:2px">' + d.lateCount + ' công tác chậm · TB +' + d.avgDelay + 'd</div>' : '')
      + '</td>'
      + '<td>' + ragBadge(d.rag) + '</td>'
      + '<td style="white-space:nowrap">'
      + (d.daysLeft !== null
          ? (d.daysLeft < 0
              ? '<span style="font-size:11px;font-weight:600;color:var(--red)">Đã quá ' + Math.abs(d.daysLeft) + ' ngày</span>'
              : d.daysLeft <= 30
              ? '<span style="font-size:11px;font-weight:600;color:var(--red)">' + d.daysLeft + ' ngày</span><div style="font-size:10px;color:var(--gray4)">' + d.deadlineStr + '</div>'
              : d.daysLeft <= 90
              ? '<span style="font-size:11px;font-weight:600;color:var(--amber)">' + d.daysLeft + ' ngày</span><div style="font-size:10px;color:var(--gray4)">' + d.deadlineStr + '</div>'
              : '<span style="font-size:11px;color:var(--gray5)">' + d.daysLeft + ' ngày</span><div style="font-size:10px;color:var(--gray4)">' + d.deadlineStr + '</div>')
          : '<span style="font-size:11px;color:var(--gray4)">—</span>')
      + '</td>'
      + '<td style="text-align:center">'
      + (d.trend === 'up'
          ? '<span title="Tốt hơn tuần trước' + (d.trendDelta ? ' (+' + d.trendDelta + '%)' : '') + '" style="font-size:16px">↑</span><div style="font-size:9px;color:var(--green);font-weight:600">' + (d.trendDelta ? '+' + d.trendDelta + '%' : '') + '</div>'
          : d.trend === 'dn'
          ? '<span title="Xấu hơn tuần trước' + (d.trendDelta ? ' (' + d.trendDelta + '%)' : '') + '" style="font-size:16px">↓</span><div style="font-size:9px;color:var(--red);font-weight:600">' + (d.trendDelta ? d.trendDelta + '%' : '') + '</div>'
          : '<span title="Không đổi" style="font-size:16px;color:var(--gray4)">→</span>')
      + '</td>'
      + '<td>' + risks + '</td>'
      + '</tr>'
  }).join('')
}

function renderPortfolioGantt(data) {
  const el = document.getElementById('port-gantt')
  if (!el) return
  const allDates = []
  data.forEach(function(d) {
    if (d.tl) { allDates.push(d.tl.start); allDates.push(d.tl.end) }
    else {
      if (d.khStart) allDates.push(new Date(d.khStart))
      if (d.khEnd)   allDates.push(new Date(d.khEnd))
    }
  })
  if (!allDates.length) { el.innerHTML = '<div style="padding:20px;color:var(--gray4);font-size:13px">Không có dữ liệu timeline</div>'; return }
  const minD = new Date(Math.min.apply(null, allDates.map(function(d){ return d.getTime() })))
  const maxD = new Date(Math.max.apply(null, allDates.map(function(d){ return d.getTime() })))
  const totalMs = maxD - minD
  const today = new Date(); today.setHours(0,0,0,0)
  const nowPct = Math.max(0, Math.min(100, (today - minD) / totalMs * 100))
  const quarters = []
  var qY = minD.getFullYear(), qQ = Math.floor(minD.getMonth() / 3)
  for (var i = 0; i < 20; i++) {
    var qd = new Date(qY, qQ * 3, 1)
    if (qd > maxD) break
    var pct2 = Math.max(0, Math.min(97, (qd - minD) / totalMs * 100))
    quarters.push('<span style="position:absolute;left:' + pct2.toFixed(1) + '%;font-size:9px;color:var(--gray4);top:4px;white-space:nowrap">Q' + (qQ+1) + '/' + qY + '</span>')
    qQ++; if (qQ > 3) { qQ = 0; qY++ }
  }
  const NAME_W = 120
  var html = '<div style="display:flex;align-items:center;background:var(--navy);color:white;min-height:24px">'
    + '<div style="width:' + NAME_W + 'px;flex-shrink:0;padding:4px 10px;font-size:10px;font-weight:600;border-right:1px solid rgba(255,255,255,.15)">Dự án</div>'
    + '<div style="flex:1;position:relative;height:24px;overflow:hidden">'
    + quarters.join('')
    + '<div style="position:absolute;top:0;bottom:0;left:' + nowPct.toFixed(1) + '%;width:1.5px;background:#F97316;z-index:2"></div>'
    + '<div style="position:absolute;top:3px;left:' + Math.min(97, nowPct + 0.3).toFixed(1) + '%;font-size:8px;color:#F97316;font-weight:700">NOW</div>'
    + '</div></div>'
  data.forEach(function(d, idx) {
    var rowBg = idx % 2 === 0 ? 'var(--gray0)' : 'white'
    var khStart = d.tl ? d.tl.start : (d.khStart ? new Date(d.khStart) : null)
    var khEnd   = d.tl ? d.tl.end   : (d.khEnd   ? new Date(d.khEnd)   : null)
    var khL = khStart ? Math.max(0, Math.min(100, (khStart - minD) / totalMs * 100)) : null
    var khR = khEnd   ? Math.max(0, Math.min(100, (khEnd   - minD) / totalMs * 100)) : null
    var khW = (khL !== null && khR !== null) ? Math.max(0.5, khR - khL) : 0
    var ttW = khW * d.totalPct / 100
    var barColor = d.rag === 'green' ? '#86EFAC' : d.rag === 'red' ? '#F09595' : '#EF9F27'
    html += '<div style="display:flex;align-items:center;border-bottom:0.5px solid var(--gray2);background:' + rowBg + '">'
      + '<div style="width:' + NAME_W + 'px;flex-shrink:0;padding:5px 10px;font-size:11px;font-weight:600;color:var(--gray7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-right:0.5px solid var(--gray2)">' + d.code + '</div>'
      + '<div style="flex:1;position:relative;height:28px">'
      + (khW > 0 && khL !== null ? '<div style="position:absolute;height:7px;top:4px;left:' + khL.toFixed(1) + '%;width:' + khW.toFixed(1) + '%;background:#9DC3E6;border-radius:2px"></div>' : '')
      + (khW > 0 && khL !== null && ttW > 0 ? '<div style="position:absolute;height:7px;top:15px;left:' + khL.toFixed(1) + '%;width:' + ttW.toFixed(1) + '%;background:' + barColor + ';border-radius:2px"></div>' : '')
      + '<div style="position:absolute;top:0;bottom:0;left:' + nowPct.toFixed(1) + '%;width:1.5px;background:#D85A30;z-index:2"></div>'
      + '</div></div>'
  })
  el.innerHTML = html
}

function portfolioToggleOne(projId, checked) {
  _portSelected[projId] = checked
  var allChecked = Object.values(_portSelected).every(function(v){ return v })
  var anyChecked = Object.values(_portSelected).some(function(v){ return v })
  var chkAll = document.getElementById('port-check-all')
  if (chkAll) { chkAll.checked = allChecked; chkAll.indeterminate = !allChecked && anyChecked }
}

function portfolioToggleAll(checked) {
  _portSelected = {}
  if (window._portfolioData) {
    window._portfolioData.forEach(function(d){ _portSelected[d.id] = checked })
  }
  document.querySelectorAll('input[data-proj]').forEach(function(cb){ cb.checked = checked })
  var chkAll = document.getElementById('port-check-all')
  if (chkAll) { chkAll.checked = checked; chkAll.indeterminate = false }
}

function portfolioSelectAll(v) { portfolioToggleAll(v) }

async function exportPortfolioPDF() {
  const data = window._portfolioData
  if (!data || !data.length) { toast('Chưa có dữ liệu portfolio', 'error'); return }
  const selected = data.filter(function(d){ return _portSelected[d.id] })
  if (!selected.length) { toast('Chưa chọn dự án nào để xuất', 'error'); return }
  loading(true, 'Đang tạo PDF portfolio...')
  try {
    const LOGO_URL = 'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png'
    const today = new Date().toLocaleDateString('vi-VN')
    const week  = getISOWeek(new Date())
    const year  = new Date().getFullYear()
    const ragText  = function(r){ return r==='green'?'Đúng KH':r==='amber'?'Theo dõi':r==='red'?'Cần chú ý':'Chưa BĐ' }
    const ragColor = function(r){ return r==='green'?'#166534':r==='amber'?'#92400E':r==='red'?'#991B1B':'#64748B' }
    const ragBg    = function(r){ return r==='green'?'#DCFCE7':r==='amber'?'#FEF3C7':r==='red'?'#FEE2E2':'#F1F5F9' }
    const tableRows = selected.map(function(d, idx) {
      const gap = d.timePct - d.totalPct
      const gapStr = gap > 3 ? '<span style="color:#DC2626;font-size:9px;font-weight:600"> −' + gap + '%</span>'
        : gap < -3 ? '<span style="color:#16A34A;font-size:9px;font-weight:600"> +' + Math.abs(gap) + '%</span>' : ''
      const pctColor = d.rag==='green'?'#16A34A':d.rag==='red'?'#DC2626':'#D97706'
      const rowBg = d.rag==='red' ? '#FEF2F2' : idx%2===0 ? '#F8FAFC' : '#FFFFFF'
      const risks = d.topRisks.length
        ? d.topRisks.map(function(t){ return '<div style="font-size:9px;color:#475569;line-height:1.6">● ' + t.name.slice(0,42) + ' <strong style="color:#DC2626">+' + t._delay + 'd</strong></div>' }).join('')
        : '<div style="font-size:9px;color:#94A3B8">Không có rủi ro</div>'
      return '<tr style="background:' + rowBg + ';border-bottom:0.5px solid #E2E8F0">'
        + '<td style="padding:5px 10px;font-weight:700;font-size:11px;color:#1E293B">' + d.code + '</td>'
        + '<td style="padding:5px 10px;font-size:10px;color:#64748B">' + d.name.slice(0,32) + '</td>'
        + '<td style="padding:5px 10px"><div style="display:flex;align-items:center;gap:5px"><div style="width:55px;height:5px;background:#E2E8F0;border-radius:3px;overflow:hidden;flex-shrink:0"><div style="width:' + d.totalPct + '%;height:100%;background:' + pctColor + ';border-radius:3px"></div></div><span style="font-size:11px;font-weight:700;color:' + pctColor + '">' + d.totalPct + '%</span><span style="font-size:9px;color:#94A3B8">▲' + d.timePct + '%TG</span>' + gapStr + '</div></td>'
        + '<td style="padding:5px 10px"><span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:10px;background:' + ragBg(d.rag) + ';color:' + ragColor(d.rag) + '">' + ragText(d.rag) + '</span></td>'
        + '<td style="padding:5px 10px;font-size:9px">'
        + (d.daysLeft !== null
            ? (d.daysLeft < 0
                ? '<span style="color:#DC2626;font-weight:600">Quá ' + Math.abs(d.daysLeft) + 'ngày</span>'
                : d.daysLeft <= 30
                ? '<span style="color:#DC2626;font-weight:600">' + d.daysLeft + 'ngày</span><div style="font-size:8px;color:#94A3B8">' + d.deadlineStr + '</div>'
                : d.daysLeft <= 90
                ? '<span style="color:#D97706;font-weight:600">' + d.daysLeft + 'ngày</span><div style="font-size:8px;color:#94A3B8">' + d.deadlineStr + '</div>'
                : '<span style="color:#64748B">' + d.daysLeft + 'ngày</span><div style="font-size:8px;color:#94A3B8">' + d.deadlineStr + '</div>')
            : '—')
        + '</td>'
        + '<td style="padding:5px 10px;text-align:center;font-size:13px">'
        + (d.trend === 'up'
            ? '<span style="color:#16A34A;font-weight:700">↑</span>' + (d.trendDelta ? '<div style="font-size:8px;color:#16A34A">+' + d.trendDelta + '%</div>' : '')
            : d.trend === 'dn'
            ? '<span style="color:#DC2626;font-weight:700">↓</span>' + (d.trendDelta ? '<div style="font-size:8px;color:#DC2626">' + d.trendDelta + '%</div>' : '')
            : '<span style="color:#94A3B8">→</span>')
        + '</td>'
        + '<td style="padding:5px 10px">' + risks + '</td>'
        + '</tr>'
    }).join('')
    const allDates2 = []
    selected.forEach(function(d){
      if (d.tl) { allDates2.push(d.tl.start); allDates2.push(d.tl.end) }
      else { if(d.khStart) allDates2.push(new Date(d.khStart)); if(d.khEnd) allDates2.push(new Date(d.khEnd)) }
    })
    var ganttHtml = ''
    if (allDates2.length) {
      var minD2 = new Date(Math.min.apply(null, allDates2.map(function(d){ return d.getTime() })))
      var maxD2 = new Date(Math.max.apply(null, allDates2.map(function(d){ return d.getTime() })))
      var totMs2 = maxD2 - minD2
      var todayD = new Date(); todayD.setHours(0,0,0,0)
      var nowP = Math.max(0, Math.min(100, (todayD - minD2) / totMs2 * 100))
      var qLabels2 = []
      var qY2 = minD2.getFullYear(), qQ2 = Math.floor(minD2.getMonth()/3)
      for (var ii=0; ii<20; ii++) {
        var qd2 = new Date(qY2, qQ2*3, 1); if(qd2 > maxD2) break
        var p3 = Math.max(0, Math.min(97, (qd2-minD2)/totMs2*100))
        qLabels2.push('<span style="position:absolute;left:' + p3.toFixed(1) + '%;font-size:8px;color:rgba(255,255,255,0.7);top:4px;white-space:nowrap">Q' + (qQ2+1) + '/' + qY2 + '</span>')
        qQ2++; if(qQ2>3){qQ2=0;qY2++}
      }
      ganttHtml = '<div style="display:flex;align-items:center;background:#1A2B4A;color:white;height:22px"><div style="width:120px;flex-shrink:0;padding:3px 8px;font-size:9px;font-weight:600;border-right:1px solid rgba(255,255,255,.15)">Dự án</div><div style="flex:1;position:relative;height:22px;overflow:hidden">' + qLabels2.join('') + '<div style="position:absolute;top:0;bottom:0;left:' + nowP.toFixed(1) + '%;width:1.5px;background:#F97316;z-index:2"></div><div style="position:absolute;top:3px;left:' + Math.min(97,nowP+0.3).toFixed(1) + '%;font-size:7px;color:#F97316;font-weight:700">NOW</div></div></div>'
      selected.forEach(function(d, idx2) {
        var rb2 = idx2%2===0?'#F8FAFC':'#FFFFFF'
        var khS2 = d.tl ? d.tl.start : (d.khStart?new Date(d.khStart):null)
        var khE2 = d.tl ? d.tl.end   : (d.khEnd  ?new Date(d.khEnd)  :null)
        var kL2 = khS2 ? Math.max(0,Math.min(100,(khS2-minD2)/totMs2*100)) : null
        var kR2 = khE2 ? Math.max(0,Math.min(100,(khE2-minD2)/totMs2*100)) : null
        var kW2 = (kL2!==null&&kR2!==null) ? Math.max(0.5,kR2-kL2) : 0
        var tW2 = kW2 * d.totalPct / 100
        var bClr2 = d.rag==='green'?'#86EFAC':d.rag==='red'?'#F09595':'#EF9F27'
        ganttHtml += '<div style="display:flex;align-items:center;border-bottom:0.5px solid #E2E8F0;background:' + rb2 + '"><div style="width:120px;flex-shrink:0;padding:4px 8px;font-size:10px;font-weight:600;color:#1E293B;border-right:0.5px solid #E2E8F0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.code + '</div><div style="flex:1;position:relative;height:24px">'
          + (kW2>0&&kL2!==null ? '<div style="position:absolute;height:6px;top:3px;left:' + kL2.toFixed(1) + '%;width:' + kW2.toFixed(1) + '%;background:#93C5FD;border-radius:2px"></div>' : '')
          + (kW2>0&&kL2!==null&&tW2>0 ? '<div style="position:absolute;height:6px;top:14px;left:' + kL2.toFixed(1) + '%;width:' + tW2.toFixed(1) + '%;background:' + bClr2 + ';border-radius:2px"></div>' : '')
          + '<div style="position:absolute;top:0;bottom:0;left:' + nowP.toFixed(1) + '%;width:1.5px;background:#D85A30;z-index:2"></div>'
          + '</div></div>'
      })
    }
    const totalP  = selected.length
    const redP    = selected.filter(function(d){ return d.rag==='red' }).length
    const greenP  = selected.filter(function(d){ return d.rag==='green' }).length
    const allLateP= selected.reduce(function(s,d){ return s+d.lateCount },0)
    const htmlContent = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI",Arial,sans-serif}</style></head><body>'
      + '<div id="pdf-wrap" style="width:794px;background:white">'
      + '<div style="background:#1A2B4A;padding:14px 20px;display:flex;align-items:center;justify-content:space-between">'
      + '<div style="display:flex;align-items:center;gap:10px"><img src="' + LOGO_URL + '" style="height:40px;width:auto" crossorigin="anonymous" onerror="this.style.display=\'none\'"></div>'
      + '<div style="text-align:right"><div style="color:white;font-size:15px;font-weight:700">BÁO CÁO PORTFOLIO DỰ ÁN</div><div style="color:rgba(255,255,255,0.7);font-size:10px;margin-top:3px">VelaE&amp;C — Phòng KTTC</div><div style="color:rgba(255,255,255,0.55);font-size:9px;margin-top:2px">Tuần ' + week + '/' + year + ' · Ngày lập: ' + today + ' · ' + selected.length + '/' + data.length + ' dự án</div></div>'
      + '</div>'
      + '<div style="padding:14px 20px">'
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">'
      + '<div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:#1E40AF">' + totalP + '</div><div style="font-size:9px;color:#1E40AF;margin-top:2px">Dự án báo cáo</div></div>'
      + '<div style="background:#FEE2E2;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:#991B1B">' + redP + '</div><div style="font-size:9px;color:#991B1B;margin-top:2px">Cần chú ý</div></div>'
      + '<div style="background:#DCFCE7;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:#166534">' + greenP + '</div><div style="font-size:9px;color:#166534;margin-top:2px">Đúng / vượt KH</div></div>'
      + '<div style="background:#FEF3C7;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:#92400E">' + allLateP + '</div><div style="font-size:9px;color:#92400E;margin-top:2px">Công tác chậm (tổng)</div></div>'
      + '</div>'
      + '<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:5px 10px;border-radius:4px 4px 0 0">TIẾN ĐỘ CÁC DỰ ÁN</div>'
      + '<table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0"><thead><tr style="background:#1E3A5F;color:white"><th style="padding:5px 10px;font-size:9px;text-align:left;width:55px">Mã DA</th><th style="padding:5px 10px;font-size:9px;text-align:left">Tên dự án</th><th style="padding:5px 10px;font-size:9px;text-align:left;width:140px">% Hoàn thành</th><th style="padding:5px 10px;font-size:9px;text-align:left;width:65px">Trạng thái</th><th style="padding:5px 10px;font-size:9px;text-align:left;width:70px">Còn lại</th><th style="padding:5px 10px;font-size:9px;text-align:center;width:38px">Trend</th><th style="padding:5px 10px;font-size:9px;text-align:left">Rủi ro cần chú ý</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>'
      // Finance section for PDF
      + '<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:5px 10px;border-radius:4px 4px 0 0">SẢN LƯỢNG & THANH TOÁN</div>'
      + '<table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0"><thead><tr style="background:#1E3A5F;color:white"><th style="padding:5px 10px;font-size:9px;text-align:left">Dự án</th><th style="padding:5px 10px;font-size:9px;text-align:right">Giá trị HĐ</th><th style="padding:5px 10px;font-size:9px;text-align:right">Sản lượng thực</th><th style="padding:5px 10px;font-size:9px;text-align:right">Đã nhận</th><th style="padding:5px 10px;font-size:9px;text-align:right">Còn phải thu</th></tr></thead><tbody>'
      + selected.map(function(d, idx) {
          const rb = idx%2===0?'#F8FAFC':'#FFFFFF'
          const evPct = d.contractValue>0 ? Math.round((d.earnedValue||0)/d.contractValue*100) : null
          const recPct = d.contractValue>0 ? Math.round((d.totalReceived||0)/d.contractValue*100) : null
          return '<tr style="background:' + rb + ';border-bottom:0.5px solid #E2E8F0">'
            + '<td style="padding:5px 10px;font-weight:600;font-size:10px">' + d.code + '</td>'
            + '<td style="padding:5px 10px;font-size:10px;text-align:right">' + (d.contractValue>0?fmtMoney(d.contractValue):'—') + '</td>'
            + '<td style="padding:5px 10px;font-size:10px;text-align:right;color:' + (d.earnedValue>0?'#16A34A':'#94A3B8') + ';font-weight:' + (d.earnedValue>0?'600':'400') + '">' + (d.earnedValue>0?fmtMoney(d.earnedValue):'Chưa có đơn giá') + (evPct!==null?' <span style="color:#94A3B8;font-weight:400">(' + evPct + '%)</span>':'') + '</td>'
            + '<td style="padding:5px 10px;font-size:10px;text-align:right;color:#1E40AF;font-weight:600">' + (d.totalReceived>0?fmtMoney(d.totalReceived):'—') + (recPct!==null?' <span style="color:#94A3B8;font-weight:400">(' + recPct + '%)</span>':'') + '</td>'
            + '<td style="padding:5px 10px;font-size:10px;text-align:right;color:#1A2B4A;font-weight:600">' + (d.remaining!==null&&d.remaining>0?fmtMoney(d.remaining):d.remaining===0?'✅ Đủ':'—') + '</td>'
            + '</tr>'
        }).join('')
      + '</tbody></table></div>'
      + '<div><div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:5px 10px;border-radius:4px 4px 0 0">SƠ ĐỒ TIMELINE — GANTT MINI</div>'
      + '<div style="border:0.5px solid #E2E8F0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">' + ganttHtml
      + '<div style="padding:4px 8px;background:#F8FAFC;font-size:8px;color:#64748B;display:flex;gap:14px"><span><span style="display:inline-block;width:12px;height:5px;background:#93C5FD;border-radius:2px;vertical-align:middle;margin-right:3px"></span>KH</span><span><span style="display:inline-block;width:12px;height:5px;background:#86EFAC;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT đúng/vượt</span><span><span style="display:inline-block;width:12px;height:5px;background:#F09595;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT chậm</span><span><span style="display:inline-block;width:2px;height:10px;background:#D85A30;vertical-align:middle;margin-right:3px"></span>Hôm nay</span></div>'
      + '</div></div></div>'
      + '<div style="background:#F1F5F9;border-top:1px solid #E2E8F0;padding:7px 20px;display:flex;justify-content:space-between"><span style="font-size:8px;color:#64748B">VelaE&amp;C — Hệ thống theo dõi tiến độ thi công</span><span style="font-size:8px;color:#64748B">Phát hành: Lê Trần Anh Toàn — 0978635450</span></div>'
      + '</div></body></html>'
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;z-index:-1'
    container.innerHTML = htmlContent
    document.body.appendChild(container)
    const imgEl = container.querySelector('img')
    if (imgEl) {
      await new Promise(function(resolve){
        if(imgEl.complete) resolve()
        else { imgEl.onload=resolve; imgEl.onerror=resolve; setTimeout(resolve,3000) }
      })
    }
    const canvas = await html2canvas(container.querySelector('#pdf-wrap'), { scale:2, useCORS:true, allowTaint:false, backgroundColor:'#ffffff', width:794, logging:false })
    document.body.removeChild(container)
    const { jsPDF } = window.jspdf
    const pdfW = 210, A4H = 297
    const pdfH = Math.round(canvas.height / canvas.width * pdfW)
    const imgData = canvas.toDataURL('image/jpeg', 0.93)
    const fn = 'Portfolio_VelaEC_Tuan' + week + '_' + year + '.pdf'
    if (pdfH <= A4H * 1.15) {
      const pdf = new jsPDF({ unit:'mm', format:'a4' })
      const sc = Math.min(1, A4H / pdfH)
      pdf.addImage(imgData,'JPEG',(pdfW-pdfW*sc)/2,0,pdfW*sc,pdfH*sc)
      pdf.save(fn)
    } else {
      const pdf = new jsPDF({ unit:'mm', format:[pdfW,A4H] })
      const pxPerPage = Math.floor(canvas.height * A4H / pdfH)
      const totalPages = Math.ceil(canvas.height / pxPerPage)
      for (var pg=0; pg<totalPages; pg++) {
        if(pg>0) pdf.addPage([pdfW,A4H])
        const srcY2=pg*pxPerPage, srcH2=Math.min(pxPerPage,canvas.height-srcY2)
        const sl=document.createElement('canvas'); sl.width=canvas.width; sl.height=srcH2
        const ctx3=sl.getContext('2d'); ctx3.fillStyle='#ffffff'; ctx3.fillRect(0,0,sl.width,sl.height)
        ctx3.drawImage(canvas,0,srcY2,canvas.width,srcH2,0,0,canvas.width,srcH2)
        pdf.addImage(sl.toDataURL('image/jpeg',0.93),'JPEG',0,0,pdfW,srcH2/canvas.height*pdfH)
      }
      pdf.save(fn)
    }
    toast('Đã xuất: ' + fn, 'success')
  } catch(e) {
    toast('Lỗi xuất PDF: ' + e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
  }
}



// ═══════════════════════════════════════════════════════════
// HELPER: Format tiền VND
// ═══════════════════════════════════════════════════════════
function fmtMoney(val) {
  if (!val && val !== 0) return '—'
  if (val >= 1e9) return (val/1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ'
  if (val >= 1e6) return (val/1e6).toFixed(1).replace(/\.?0+$/, '') + ' tr'
  return val.toLocaleString('vi-VN') + ' đ'
}

function fmtMoneyFull(val) {
  if (!val && val !== 0) return '—'
  return val.toLocaleString('vi-VN') + ' VND'
}

// ═══════════════════════════════════════════════════════════
// PORTFOLIO FINANCE TABLE
// ═══════════════════════════════════════════════════════════
function renderPortfolioFinance(data) {
  const tbody = document.getElementById('port-finance-tbody')
  if (!tbody) return

  let totalHD = 0, totalEV = 0, totalRec = 0, totalRem = 0

  tbody.innerHTML = data.map(function(d) {
    const hasFinance = d.contractValue > 0
    if (hasFinance) {
      totalHD  += d.contractValue
      totalEV  += d.earnedValue || 0
      totalRec += d.totalReceived || 0
      totalRem += d.remaining || 0
    }

    const evPct = d.contractValue > 0
      ? Math.round((d.earnedValue || 0) / d.contractValue * 100) : null
    const recPct = d.contractValue > 0
      ? Math.round((d.totalReceived || 0) / d.contractValue * 100) : null

    const evColor = evPct !== null
      ? (evPct < d.totalPct - 10 ? 'var(--amber)' : 'var(--green)') : 'var(--gray4)'

    return '<tr>'
      + '<td><div style="font-weight:600;font-size:13px">' + d.code + '</div>'
      + '<div style="font-size:11px;color:var(--gray4)">' + d.name.slice(0,30) + '</div></td>'
      + '<td style="text-align:right;font-size:13px;font-weight:500">'
      + (hasFinance ? fmtMoney(d.contractValue) : '<span style="color:var(--gray3);font-size:11px">Chưa nhập</span>')
      + '</td>'
      + '<td style="text-align:right">'
      + (d.earnedValue > 0
          ? '<span style="font-size:13px;font-weight:600;color:' + evColor + '">' + fmtMoney(d.earnedValue) + '</span>'
          + (evPct !== null ? '<div style="font-size:10px;color:var(--gray4)">' + evPct + '% HĐ</div>' : '')
          : '<span style="font-size:11px;color:var(--gray3)">Chưa có đơn giá</span>')
      + '</td>'
      + '<td style="text-align:right">'
      + (d.totalReceived > 0
          ? '<span style="font-size:13px;font-weight:600;color:var(--blue)">' + fmtMoney(d.totalReceived) + '</span>'
          + (recPct !== null ? '<div style="font-size:10px;color:var(--gray4)">' + recPct + '% HĐ</div>' : '')
          : '<span style="font-size:11px;color:var(--gray3)">—</span>')
      + '</td>'
      + '<td style="text-align:right">'
      + (d.remaining !== null && d.remaining > 0
          ? '<span style="font-size:13px;font-weight:600;color:var(--navy)">' + fmtMoney(d.remaining) + '</span>'
          : d.remaining === 0
          ? '<span style="font-size:12px;color:var(--green)">✅ Đã thu đủ</span>'
          : '<span style="font-size:11px;color:var(--gray3)">—</span>')
      + '</td>'
      + '</tr>'
  }).join('')

  // Footer tổng
  if (totalHD > 0) {
    tbody.innerHTML += '<tr style="background:var(--navy);color:white;font-weight:600">'
      + '<td style="padding:10px 12px;font-size:12px">TỔNG CỘNG</td>'
      + '<td style="text-align:right;padding:10px 12px">' + fmtMoney(totalHD) + '</td>'
      + '<td style="text-align:right;padding:10px 12px">' + fmtMoney(totalEV) + '</td>'
      + '<td style="text-align:right;padding:10px 12px">' + fmtMoney(totalRec) + '</td>'
      + '<td style="text-align:right;padding:10px 12px">' + fmtMoney(totalRem) + '</td>'
      + '</tr>'
  }
}
