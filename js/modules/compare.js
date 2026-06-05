// ═══════════════════════════════════════════════════════════
// PAGE: COMPARE WEEKS
// ═══════════════════════════════════════════════════════════
function compare() {
  const curWeek = getISOWeek(new Date())
  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">So sánh tiến độ tuần</h2>
  <div class="card">
    <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap">
      <div>
        <div class="form-label">Tuần so sánh A</div>
        <select class="form-input" id="cmp-week-a" style="width:120px">
          ${Array.from({length:10},(_,i) => `<option value="${curWeek-i}" ${i===1?'selected':''}>${i===0?'Tuần này':'Tuần '+(curWeek-i)}</option>`).join('')}
        </select>
      </div>
      <div>
        <div class="form-label">Tuần so sánh B</div>
        <select class="form-input" id="cmp-week-b" style="width:120px">
          ${Array.from({length:10},(_,i) => `<option value="${curWeek-i}" ${i===0?'selected':''}>Tuần ${curWeek-i}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" onclick="loadCompare()">🔄 So sánh</button>
    </div>
    <div id="compare-result"></div>
  </div>`
}

async function loadCompare() {
  const el = document.getElementById('compare-result')
  if (!el) return
  if (!STATE.currentProject) { el.innerHTML='<div style="color:var(--gray4);padding:20px">Chưa có dự án</div>'; return }
  el.innerHTML = '<span style="color:var(--gray4)">Đang tải...</span>'

  const weekA = parseInt(document.getElementById('cmp-week-a')?.value || getISOWeek(new Date())-1)
  const weekB = parseInt(document.getElementById('cmp-week-b')?.value || getISOWeek(new Date()))
  const yr = new Date().getFullYear()

  const { data: progA } = await sb.from('task_progress')
    .select('task_id, pct_complete, tt_start, tt_finish, note')
    .eq('project_id', STATE.currentProject.id)
    .eq('week_number', weekA).eq('year', yr)

  const { data: progB } = await sb.from('task_progress')
    .select('task_id, pct_complete, tt_start, tt_finish, note')
    .eq('project_id', STATE.currentProject.id)
    .eq('week_number', weekB).eq('year', yr)

  if (!progA?.length && !progB?.length) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px">Chưa có dữ liệu cho 2 tuần này</div>'
    return
  }

  const mapA = {}; (progA||[]).forEach(p => mapA[p.task_id] = p)
  const mapB = {}; (progB||[]).forEach(p => mapB[p.task_id] = p)

  const allTaskIds = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])]
  const rows = allTaskIds.map(tid => {
    const task = STATE.tasks.find(t => t.id === tid)
    if (!task) return ''
    const pctA = mapA[tid]?.pct_complete ?? null
    const pctB = mapB[tid]?.pct_complete ?? null
    const delta = (pctB??0) - (pctA??0)
    const noChange = pctA !== null && pctB !== null && delta === 0
    return `<tr ${noChange?'style="background:#FEF3C7"':''}>
      <td title="${task.name}">${task.name.slice(0,45)}</td>
      <td style="text-align:center">${pctA !== null ? pctA+'%' : '—'}</td>
      <td style="text-align:center">${pctB !== null ? pctB+'%' : '—'}</td>
      <td style="text-align:center;font-weight:600;color:${delta>0?'var(--green)':delta<0?'var(--red)':noChange?'var(--amber)':'var(--gray4)'}">
        ${delta > 0 ? '+'+delta+'%' : delta < 0 ? delta+'%' : noChange ? '⚠️ Không đổi' : '—'}
      </td>
      <td>${mapB[tid]?.note || mapA[tid]?.note || ''}</td>
    </tr>`
  }).join('')

  el.innerHTML = `
    <div style="font-size:13px;color:var(--gray5);margin-bottom:12px">
      So sánh <strong>Tuần ${weekA}</strong> vs <strong>Tuần ${weekB}</strong>
      · <span style="color:var(--amber)">⚠️ Vàng = không có tiến triển</span>
    </div>
    <table class="tbl">
      <thead><tr>
        <th>Công tác</th>
        <th style="text-align:center">Tuần ${weekA}</th>
        <th style="text-align:center">Tuần ${weekB}</th>
        <th style="text-align:center">Thay đổi</th>
        <th>Ghi chú</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}
