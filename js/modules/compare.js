// ═══════════════════════════════════════════════════════════
// PAGE: COMPARE WEEKS — VelaE&C v3
// ═══════════════════════════════════════════════════════════

function compare() {
  const curWeek = getISOWeek(new Date())
  const weekOptions = (selectedIdx) =>
    Array.from({ length: 10 }, (_, i) => {
      const w = curWeek - i
      const label = i === 0 ? `Tuần này (${w})` : `Tuần ${w}`
      return `<option value="${w}" ${i === selectedIdx ? 'selected' : ''}>${label}</option>`
    }).join('')

  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">So sánh tiến độ tuần</h2>
  <div class="card">
    <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap">
      <div>
        <div class="form-label">Tuần so sánh A (cũ hơn)</div>
        <select class="form-input" id="cmp-week-a" style="width:160px">${weekOptions(2)}</select>
      </div>
      <div>
        <div class="form-label">Tuần so sánh B (mới hơn)</div>
        <select class="form-input" id="cmp-week-b" style="width:160px">${weekOptions(0)}</select>
      </div>
      <button class="btn btn-primary" onclick="loadCompare()">🔄 So sánh</button>
    </div>
    <div id="compare-result"></div>
  </div>`
}

// ─── Helpers ────────────────────────────────────────────────

function fmtVND(val) {
  if (val == null || isNaN(val)) return '—'
  const abs = Math.abs(val)
  const prefix = val < 0 ? '-' : ''
  if (abs >= 1e9) return prefix + (abs / 1e9).toFixed(2) + ' tỷ'
  if (abs >= 1e6) return prefix + (abs / 1e6).toFixed(1) + ' tr'
  return val.toLocaleString('vi-VN') + ' đ'
}

// Build map: task_id → [children task_ids] và task_id → parent
function buildTree(tasks) {
  const childrenMap = {}   // parent_id → [task]
  const taskMap = {}       // id → task
  tasks.forEach(t => {
    taskMap[t.id] = t
    if (!childrenMap[t.parent_id || '__root__']) childrenMap[t.parent_id || '__root__'] = []
    childrenMap[t.parent_id || '__root__'].push(t)
  })
  return { childrenMap, taskMap }
}

// ─── Main load ──────────────────────────────────────────────

async function loadCompare() {
  const el = document.getElementById('compare-result')
  if (!el) return
  if (!STATE.currentProject) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px">Chưa có dự án</div>'
    return
  }
  el.innerHTML = '<span style="color:var(--gray4)">Đang tải...</span>'

  const weekA = parseInt(document.getElementById('cmp-week-a')?.value)
  const weekB = parseInt(document.getElementById('cmp-week-b')?.value)
  const yr = new Date().getFullYear()

  if (weekA === weekB) {
    el.innerHTML = '<div style="color:var(--amber);padding:20px">⚠️ Vui lòng chọn 2 tuần khác nhau</div>'
    return
  }

  // Fetch progress 2 tuần song song
  const [{ data: progA }, { data: progB }] = await Promise.all([
    sb.from('task_progress')
      .select('task_id, pct_complete, note')
      .eq('project_id', STATE.currentProject.id)
      .eq('week_number', weekA).eq('year', yr),
    sb.from('task_progress')
      .select('task_id, pct_complete, note')
      .eq('project_id', STATE.currentProject.id)
      .eq('week_number', weekB).eq('year', yr)
  ])

  if (!progA?.length && !progB?.length) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px">Chưa có dữ liệu cho 2 tuần này</div>'
    return
  }

  const mapA = {}; (progA || []).forEach(p => mapA[p.task_id] = p)
  const mapB = {}; (progB || []).forEach(p => mapB[p.task_id] = p)

  // Set task lá có cập nhật trong ít nhất 1 tuần
  const activeLeafIds = new Set([...Object.keys(mapA), ...Object.keys(mapB)])

  // Build set các task cha cần hiện (ancestors của leaf đang active)
  const { childrenMap, taskMap } = buildTree(STATE.tasks)

  // Tìm tất cả ancestor ids của 1 task
  function getAncestorIds(taskId) {
    const ids = new Set()
    let cur = taskMap[taskId]
    while (cur && cur.parent_id) {
      ids.add(cur.parent_id)
      cur = taskMap[cur.parent_id]
    }
    return ids
  }

  const visibleParentIds = new Set()
  activeLeafIds.forEach(tid => {
    if (!taskMap[tid]) return
    getAncestorIds(tid).forEach(aid => visibleParentIds.add(aid))
  })

  // Render đệ quy theo cây WBS
  let totalTang = 0    // tổng thành tiền tăng
  let totalGiam = 0    // tổng thành tiền giảm
  let rowCount = 0

  function renderNode(task, depth) {
    const isLeaf = !childrenMap[task.id] || childrenMap[task.id].length === 0
    const isActive = activeLeafIds.has(task.id)
    const isVisibleParent = visibleParentIds.has(task.id)

    // Ẩn node không liên quan
    if (!isActive && !isVisibleParent) return ''

    if (!isLeaf || !isActive) {
      // Render task cha — chỉ làm header nhóm
      const children = (childrenMap[task.id] || [])
        .map(c => renderNode(c, depth + 1)).join('')

      if (!children) return '' // không có con nào visible

      const indent = depth * 20
      return `
        <tr style="background:var(--gray1,#F8F9FA)">
          <td colspan="7" style="padding-left:${12 + indent}px;font-weight:700;font-size:13px;color:var(--gray6,#374151)">
            ${'▶'.repeat(depth === 0 ? 1 : 0)} ${task.name}
          </td>
        </tr>
        ${children}`
    }

    // Render task lá có data
    const pctA = mapA[task.id]?.pct_complete ?? null
    const pctB = mapB[task.id]?.pct_complete ?? null
    const note = mapB[task.id]?.note || mapA[task.id]?.note || ''

    // Tính delta
    let delta = null
    if (pctA !== null && pctB !== null) delta = pctB - pctA
    else if (pctA === null && pctB !== null) delta = pctB
    // pctA có, pctB null → delta = null (không báo)

    // Tính sản lượng & thành tiền
    let slText = '—', ttText = '—'
    let ttVal = null
    const unitPrice = task.unit_price || 0
    const khQty    = task.kh_quantity || 0
    if (delta !== null && delta !== 0 && unitPrice && khQty) {
      const slDelta = (delta / 100) * khQty
      ttVal = slDelta * unitPrice
      const slSign = delta > 0 ? '+' : ''
      const ttColor = delta > 0 ? 'var(--green)' : 'var(--red)'
      slText = `<span style="color:${ttColor}">${slSign}${slDelta.toFixed(2)} ${task.unit || ''}</span>`
      ttText = `<span style="color:${ttColor}">${slSign}${fmtVND(ttVal)}</span>`
      if (ttVal > 0) totalTang += ttVal
      else totalGiam += ttVal
    }

    // Delta display
    let deltaHtml = '—'
    let deltaColor = 'var(--gray4)'
    if (delta === null) {
      deltaHtml = '<span style="color:var(--gray4);font-size:11px">Không báo</span>'
    } else if (delta > 0) {
      deltaColor = 'var(--green)'; deltaHtml = `+${delta}%`
    } else if (delta < 0) {
      deltaColor = 'var(--red)'; deltaHtml = `${delta}%`
    } else {
      deltaColor = 'var(--amber)'; deltaHtml = '⚠️ Không đổi'
    }

    const rowBg = delta === 0 ? 'background:#FEF3C7' :
                  delta === null && pctA !== null ? 'background:#F9FAFB' : ''
    const indent = depth * 20

    rowCount++
    return `<tr style="${rowBg}">
      <td style="padding-left:${12 + indent}px;font-size:13px">${task.name}</td>
      <td style="text-align:center">${pctA !== null ? pctA + '%' : '—'}</td>
      <td style="text-align:center">${pctB !== null ? pctB + '%' : '—'}</td>
      <td style="text-align:center;font-weight:700;color:${deltaColor}">${deltaHtml}</td>
      <td style="text-align:right">${slText}</td>
      <td style="text-align:right">${ttText}</td>
      <td style="font-size:12px;color:var(--gray5)">${note}</td>
    </tr>`
  }

  // Lấy root tasks (không có parent hoặc parent không tồn tại trong tasks)
  const taskIds = new Set(STATE.tasks.map(t => t.id))
  const roots = STATE.tasks.filter(t => !t.parent_id || !taskIds.has(t.parent_id))

  // Sort theo outline_order nếu có
  const sortTasks = arr => [...arr].sort((a, b) =>
    (a.outline_order ?? a.outline_number ?? 0) > (b.outline_order ?? b.outline_number ?? 0) ? 1 : -1
  )

  const bodyRows = sortTasks(roots).map(t => renderNode(t, 0)).join('')

  if (!rowCount) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px">Không có công tác nào được cập nhật trong 2 tuần này</div>'
    return
  }

  // Summary bar
  const summaryParts = []
  if (totalTang > 0) summaryParts.push(
    `<span style="background:#D1FAE5;color:#065F46;padding:5px 12px;border-radius:6px;font-weight:700">
      📈 Tăng: +${fmtVND(totalTang)}
    </span>`
  )
  if (totalGiam < 0) summaryParts.push(
    `<span style="background:#FEE2E2;color:#991B1B;padding:5px 12px;border-radius:6px;font-weight:700">
      📉 Giảm: ${fmtVND(totalGiam)}
    </span>`
  )
  const netVal = totalTang + totalGiam
  if (totalTang > 0 && totalGiam < 0) summaryParts.push(
    `<span style="background:#EFF6FF;color:#1D4ED8;padding:5px 12px;border-radius:6px;font-weight:700">
      ⚖️ Net: ${netVal >= 0 ? '+' : ''}${fmtVND(netVal)}
    </span>`
  )

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div style="font-size:13px;color:var(--gray5)">
        So sánh <strong>Tuần ${weekA}</strong> vs <strong>Tuần ${weekB}</strong>
        &nbsp;·&nbsp;<span style="color:var(--amber)">⚠️ Vàng = không tiến triển</span>
        &nbsp;·&nbsp;<span style="color:var(--gray4)">Xám = tuần B chưa báo</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${summaryParts.join('')}</div>
    </div>
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr>
        <th style="min-width:240px">Hạng mục / Công tác</th>
        <th style="text-align:center;width:80px">Tuần ${weekA}</th>
        <th style="text-align:center;width:80px">Tuần ${weekB}</th>
        <th style="text-align:center;width:110px">Thay đổi</th>
        <th style="text-align:right;width:110px">SL thay đổi</th>
        <th style="text-align:right;width:120px">Thành tiền</th>
        <th style="min-width:120px">Ghi chú</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      ${(totalTang > 0 || totalGiam < 0) ? `
      <tfoot>
        <tr style="background:var(--gray1,#F3F4F6)">
          <td colspan="5" style="text-align:right;font-weight:700;padding-right:8px;font-size:13px">
            Tổng sản lượng tăng tuần ${weekB}:
          </td>
          <td style="text-align:right;font-weight:700;color:var(--green);font-size:13px">
            ${totalTang > 0 ? '+' + fmtVND(totalTang) : '—'}
          </td>
          <td></td>
        </tr>
        ${totalGiam < 0 ? `
        <tr style="background:var(--gray1,#F3F4F6)">
          <td colspan="5" style="text-align:right;font-weight:700;padding-right:8px;font-size:13px">
            Tổng sản lượng giảm tuần ${weekB}:
          </td>
          <td style="text-align:right;font-weight:700;color:var(--red);font-size:13px">
            ${fmtVND(totalGiam)}
          </td>
          <td></td>
        </tr>` : ''}
      </tfoot>` : ''}
    </table>
    </div>`
}
