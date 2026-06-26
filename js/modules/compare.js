// ═══════════════════════════════════════════════════════════
// PAGE: COMPARE WEEKS — VelaE&C
// ═══════════════════════════════════════════════════════════
function compare() {
  const curWeek = getISOWeek(new Date())
  const weekOptions = (selectedIdx) =>
    Array.from({ length: 10 }, (_, i) => {
      const w = curWeek - i
      return `<option value="${w}" ${i === selectedIdx ? 'selected' : ''}>Tuần ${w}${i===0?' (này)':''}</option>`
    }).join('')

  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">So sánh tiến độ tuần</h2>
  <div class="card">
    <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap">
      <div>
        <div class="form-label">Tuần A (cũ hơn)</div>
        <select class="form-input" id="cmp-week-a" style="width:140px">${weekOptions(1)}</select>
      </div>
      <div>
        <div class="form-label">Tuần B (mới hơn)</div>
        <select class="form-input" id="cmp-week-b" style="width:140px">${weekOptions(0)}</select>
      </div>
      <button class="btn btn-primary" onclick="loadCompare()">🔄 So sánh</button>
    </div>
    <div id="compare-result"></div>
  </div>`
}

function fmtVND(val) {
  if (!val || isNaN(val)) return '—'
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1e9) return sign + (abs/1e9).toFixed(2) + ' tỷ'
  if (abs >= 1e6) return sign + (abs/1e6).toFixed(1) + ' tr'
  return val.toLocaleString('vi-VN') + ' đ'
}

async function loadCompare() {
  const el = document.getElementById('compare-result')
  if (!el || !STATE.currentProject) return
  el.innerHTML = '<span style="color:var(--gray4)">Đang tải...</span>'

  const weekA = parseInt(document.getElementById('cmp-week-a')?.value)
  const weekB = parseInt(document.getElementById('cmp-week-b')?.value)
  const yr    = new Date().getFullYear()

  if (weekA === weekB) {
    el.innerHTML = '<div style="color:var(--amber);padding:20px">⚠️ Chọn 2 tuần khác nhau</div>'
    return
  }

  // Fetch tiến độ 2 tuần — lấy bản mới nhất ≤ tuần đó (không bị mất data task đã 100%)
  // Logic: lấy bản ghi có week_number lớn nhất ≤ tuần T (BCH nhập thứ 7)
  // Nếu cùng tuần có nhiều bản → lấy updated_at mới nhất
  const [{ data: rawA }, { data: rawB }] = await Promise.all([
    sb.from('task_progress')
      .select('task_id, pct_complete, note, week_number, updated_at')
      .eq('project_id', STATE.currentProject.id)
      .lte('week_number', weekA).eq('year', yr)
      .order('week_number', { ascending: false })
      .order('updated_at', { ascending: false }),
    sb.from('task_progress')
      .select('task_id, pct_complete, note, week_number, updated_at')
      .eq('project_id', STATE.currentProject.id)
      .lte('week_number', weekB).eq('year', yr)
      .order('week_number', { ascending: false })
      .order('updated_at', { ascending: false })
  ])

  // Lấy bản mới nhất theo task_id (do sort desc, first = newest)
  const mapA = {}, mapB = {}
  ;(rawA||[]).forEach(p => { if (!mapA[p.task_id]) mapA[p.task_id] = p })
  ;(rawB||[]).forEach(p => { if (!mapB[p.task_id]) mapB[p.task_id] = p })

  // Tìm task lá có thay đổi giữa 2 tuần
  const allIds = new Set([...Object.keys(mapA), ...Object.keys(mapB)])
  const changedLeafIds = new Set()
  allIds.forEach(tid => {
    const task = STATE.tasks.find(t => t.id === tid)
    if (!task || task.is_summary) return
    const pctA = mapA[tid]?.pct_complete ?? null
    const pctB = mapB[tid]?.pct_complete ?? null
    if (pctA !== pctB && (pctA !== null || pctB !== null)) {
      changedLeafIds.add(tid)
    }
  })

  if (!changedLeafIds.size) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px">Không có công tác nào thay đổi giữa 2 tuần này</div>'
    return
  }

  // Tìm tất cả ancestor của changed leaf tasks (dùng wbs_code)
  const taskMap = {}
  STATE.tasks.forEach(t => { taskMap[t.id] = t })

  function getAncestors(task) {
    const ancestors = new Set()
    const parts = task.wbs_code?.split('.') || []
    for (let i = 1; i < parts.length; i++) {
      const parentWbs = parts.slice(0, i).join('.')
      const parent = STATE.tasks.find(t => t.wbs_code === parentWbs)
      if (parent) ancestors.add(parent.id)
    }
    return ancestors
  }

  const visibleIds = new Set(changedLeafIds)
  changedLeafIds.forEach(tid => {
    const task = taskMap[tid]
    if (task) getAncestors(task).forEach(aid => visibleIds.add(aid))
  })

  // Render cây WBS — chỉ hiện node trong visibleIds
  // FIX: tính totalTang theo delta EV thực (evB - evA), không dùng delta_pct × khQty
  let totalTang = 0, totalGiam = 0, rowCount = 0

  const rows = STATE.tasks
    .filter(t => visibleIds.has(t.id))
    .map(t => {
      const indent = (t.outline_level - 1) * 20
      const isSummary = t.is_summary

      if (isSummary) {
        const bgColor = t.outline_level === 1 ? '#1A2B4A'
                      : t.outline_level === 2 ? '#2563EB'
                      : '#EEF2FF'
        const txtColor = t.outline_level <= 2 ? 'white' : 'var(--navy)'
        return `
          <tr style="background:${bgColor}">
            <td colspan="8" style="padding:8px 12px;padding-left:${12+indent}px;
              font-size:13px;font-weight:700;color:${txtColor}">
              ${t.name}
            </td>
          </tr>`
      }

      // Task lá
      const pctA = mapA[t.id]?.pct_complete ?? null
      const pctB = mapB[t.id]?.pct_complete ?? null
      const note = mapB[t.id]?.note || mapA[t.id]?.note || ''
      const delta = (pctB ?? 0) - (pctA ?? 0)

      // ── FIX: Tính EV delta theo công thức EVM ──────────────
      // evA = contractValue × pctA / 100
      // evB = contractValue × pctB / 100
      // ttVal = evB - evA  (delta EV thực, nhất quán với sanluong.js)
      const unitPrice = t.unit_price || 0
      const khQty     = t.planned_quantity || 0
      const contractValue = unitPrice * (khQty || 1)

      let slText = '—', ttText = '—'
      let ttVal = null

      if (delta !== 0 && contractValue > 0) {
        const evA = contractValue * ((pctA ?? 0) / 100)
        const evB = contractValue * ((pctB ?? 0) / 100)
        ttVal = evB - evA  // delta EV thực

        const sign = ttVal > 0 ? '+' : ''
        const color = ttVal > 0 ? 'var(--green)' : 'var(--red)'

        // SL thay đổi: chỉ hiển thị nếu có KL đơn vị thực
        if (khQty > 0 && t.unit && t.unit !== '%') {
          const slDelta = (delta / 100) * khQty
          slText = `<span style="color:${color}">${sign}${slDelta.toFixed(2)} ${t.unit||''}</span>`
        }
        ttText = `<span style="color:${color};font-weight:600">${sign}${fmtVND(ttVal)}</span>`

        if (ttVal > 0) totalTang += ttVal
        else totalGiam += ttVal
      }

      // Delta badge
      let deltaBadge = '—'
      if (delta > 0)       deltaBadge = `<span style="color:#16A34A;font-weight:700">+${delta}%</span>`
      else if (delta < 0)  deltaBadge = `<span style="color:#DC2626;font-weight:700">${delta}%</span>`
      else if (pctA === null && pctB !== null) deltaBadge = `<span style="color:var(--blue);font-weight:700">+${pctB}% (mới)</span>`

      rowCount++
      return `
        <tr style="border-bottom:0.5px solid var(--gray2)">
          <td style="padding:7px 8px;padding-left:${12+indent}px;font-size:13px;color:var(--gray7);
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.name}">${t.name}</td>
          <td style="text-align:center;font-size:13px">${pctA !== null ? pctA+'%' : '—'}</td>
          <td style="text-align:center;font-size:13px">${pctB !== null ? pctB+'%' : '—'}</td>
          <td style="text-align:center;font-size:13px">${deltaBadge}</td>
          <td style="text-align:center;font-size:13px">${t.planned_quantity ? khQty+' '+(t.unit||'') : '—'}</td>
          <td style="text-align:right;font-size:13px">${slText}</td>
          <td style="text-align:right;font-size:13px;font-weight:600">${ttText}</td>
          <td style="font-size:12px;color:var(--gray5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${note}">${note}</td>
        </tr>`
    }).join('')

  // Summary bar: vẫn giữ Tăng / Giảm / Net
  const netVal = totalTang + totalGiam
  const summaryHtml = (totalTang > 0 || totalGiam < 0) ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${totalTang > 0 ? `<span style="background:#D1FAE5;color:#065F46;padding:5px 14px;border-radius:6px;font-size:13px;font-weight:700">📈 Tăng: +${fmtVND(totalTang)}</span>` : ''}
      ${totalGiam < 0 ? `<span style="background:#FEE2E2;color:#991B1B;padding:5px 14px;border-radius:6px;font-size:13px;font-weight:700">📉 Giảm: ${fmtVND(totalGiam)}</span>` : ''}
      ${totalTang > 0 && totalGiam < 0 ? `<span style="background:#EFF6FF;color:#1D4ED8;padding:5px 14px;border-radius:6px;font-size:13px;font-weight:700">⚖️ Net: ${netVal>=0?'+':''}${fmtVND(netVal)}</span>` : ''}
    </div>` : ''

  el.innerHTML = `
    <div style="font-size:13px;color:var(--gray5);margin-bottom:10px">
      So sánh <strong>Tuần ${weekA}</strong> → <strong>Tuần ${weekB}</strong>
      &nbsp;·&nbsp; <strong style="color:var(--blue)">${changedLeafIds.size}</strong> công tác thay đổi
    </div>
    ${summaryHtml}
    <div style="border:1px solid var(--gray2);border-radius:var(--radius);overflow:hidden;max-height:calc(100vh - 280px);overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup>
          <col style="width:35%">
          <col style="width:7%">
          <col style="width:7%">
          <col style="width:9%">
          <col style="width:8%">
          <col style="width:11%">
          <col style="width:12%">
          <col style="width:11%">
        </colgroup>
        <thead style="position:sticky;top:0;z-index:10">
          <tr style="background:var(--navy);color:white;font-size:13px">
            <th style="padding:10px 12px;text-align:left">Hạng mục / Công tác</th>
            <th style="padding:10px 8px;text-align:center">T.${weekA}</th>
            <th style="padding:10px 8px;text-align:center">T.${weekB}</th>
            <th style="padding:10px 8px;text-align:center">Thay đổi</th>
            <th style="padding:10px 8px;text-align:center">KL KH</th>
            <th style="padding:10px 8px;text-align:right">SL thay đổi</th>
            <th style="padding:10px 8px;text-align:right">Thành tiền</th>
            <th style="padding:10px 8px;text-align:left">Ghi chú</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        ${totalTang > 0 ? `
        <tfoot style="background:var(--gray1)">
          <tr>
            <td colspan="6" style="padding:10px 12px;text-align:right;font-weight:700;font-size:14px">
              Tổng sản lượng tăng tuần ${weekB}:
            </td>
            <td style="padding:10px 8px;text-align:right;font-weight:700;color:var(--green);font-size:14px">
              +${fmtVND(totalTang)}
            </td>
            <td></td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>`
}
