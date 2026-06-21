// ═══════════════════════════════════════════════════════════
// PAGE: COMPARE WEEKS — VelaE&C v2
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
        <select class="form-input" id="cmp-week-a" style="width:150px">
          ${weekOptions(2)}
        </select>
      </div>
      <div>
        <div class="form-label">Tuần so sánh B (mới hơn)</div>
        <select class="form-input" id="cmp-week-b" style="width:150px">
          ${weekOptions(0)}
        </select>
      </div>
      <button class="btn btn-primary" onclick="loadCompare()">🔄 So sánh</button>
    </div>
    <div id="compare-result"></div>
  </div>`
}

// ─── Helpers ────────────────────────────────────────────────

function fmtVND(val) {
  if (!val && val !== 0) return '—'
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + ' tỷ'
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + ' tr'
  return val.toLocaleString('vi-VN') + ' đ'
}

// Lấy tất cả ancestor names của một task
function getAncestorPath(task, allTasks) {
  const parts = []
  let current = task
  while (current.parent_id) {
    const parent = allTasks.find(t => t.id === current.parent_id)
    if (!parent) break
    parts.unshift(parent.name)
    current = parent
  }
  return parts
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

  // Fetch progress 2 tuần
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

  // Chỉ lấy task lá có thay đổi THỰC SỰ
  // Điều kiện: cả 2 tuần đều có data VÀ delta != 0
  // HOẶC: chỉ 1 tuần có data (task mới xuất hiện / mới hoàn thành)
  const allTaskIds = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])]

  const changedRows = []

  allTaskIds.forEach(tid => {
    const task = STATE.tasks.find(t => t.id === tid)
    if (!task) return

    const pctA = mapA[tid]?.pct_complete ?? null
    const pctB = mapB[tid]?.pct_complete ?? null

    // Bỏ qua nếu cả 2 đều null (không có data)
    if (pctA === null && pctB === null) return

    // Tính delta — chỉ khi cả 2 có data
    let delta = null
    if (pctA !== null && pctB !== null) {
      delta = pctB - pctA
    } else if (pctA === null && pctB !== null) {
      delta = pctB // task mới xuất hiện tuần B
    } else if (pctA !== null && pctB === null) {
      delta = null // tuần B không báo cáo — không kết luận -100%
    }

    // Tính sản lượng thay đổi
    let sanLuongDelta = null
    let thanhTienDelta = null
    if (delta !== null && delta !== 0) {
      const unitPrice = task.unit_price || 0
      const khQty = task.kh_quantity || 0
      if (unitPrice && khQty) {
        sanLuongDelta = (delta / 100) * khQty
        thanhTienDelta = sanLuongDelta * unitPrice
      }
    }

    // Lấy path cha
    const ancestors = getAncestorPath(task, STATE.tasks)

    changedRows.push({
      task,
      ancestors,
      pctA,
      pctB,
      delta,
      sanLuongDelta,
      thanhTienDelta,
      noteA: mapA[tid]?.note || '',
      noteB: mapB[tid]?.note || ''
    })
  })

  if (!changedRows.length) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px">Không có thay đổi nào giữa 2 tuần này</div>'
    return
  }

  // Sort: tăng → không đổi → chỉ 1 tuần có data
  changedRows.sort((a, b) => {
    // Nhóm theo ancestors để task cùng cha đứng gần nhau
    const pathA = [...a.ancestors, a.task.name].join(' > ')
    const pathB = [...b.ancestors, b.task.name].join(' > ')
    return pathA.localeCompare(pathB, 'vi')
  })

  // Đếm tổng thành tiền tăng trong tuần
  const totalTangTuan = changedRows
    .filter(r => r.thanhTienDelta > 0)
    .reduce((sum, r) => sum + r.thanhTienDelta, 0)

  // Render
  const rows = changedRows.map(r => {
    const { task, ancestors, pctA, pctB, delta, sanLuongDelta, thanhTienDelta, noteB, noteA } = r

    // Màu delta
    let deltaColor = 'var(--gray4)'
    let deltaText = '—'
    if (delta === null) {
      deltaText = '<span style="color:var(--gray4);font-size:11px">Không báo</span>'
    } else if (delta > 0) {
      deltaColor = 'var(--green)'
      deltaText = `+${delta}%`
    } else if (delta < 0) {
      deltaColor = 'var(--red)'
      deltaText = `${delta}%`
    } else {
      deltaColor = 'var(--amber)'
      deltaText = '⚠️ Không đổi'
    }

    // Sản lượng & thành tiền
    const slText = sanLuongDelta != null
      ? `<span style="color:${delta > 0 ? 'var(--green)' : 'var(--red)'}">
           ${delta > 0 ? '+' : ''}${sanLuongDelta.toFixed(2)} ${task.unit || ''}
         </span>`
      : '—'

    const ttText = thanhTienDelta != null
      ? `<span style="color:${delta > 0 ? 'var(--green)' : 'var(--red)'}">
           ${delta > 0 ? '+' : ''}${fmtVND(thanhTienDelta)}
         </span>`
      : '—'

    // Path cha hiển thị
    const pathHtml = ancestors.length
      ? `<div style="font-size:10px;color:var(--gray4);line-height:1.3;margin-bottom:2px">
           ${ancestors.map(a => `<span>${a}</span>`).join(' <span style="opacity:.5">›</span> ')}
         </div>`
      : ''

    // Highlight row
    const rowBg = delta === 0 ? 'background:#FEF3C7' :
                  delta === null ? 'background:#F9FAFB' : ''

    const note = noteB || noteA

    return `<tr style="${rowBg}">
      <td style="max-width:280px">
        ${pathHtml}
        <span style="font-size:13px">${task.name}</span>
      </td>
      <td style="text-align:center">${pctA !== null ? pctA + '%' : '—'}</td>
      <td style="text-align:center">${pctB !== null ? pctB + '%' : '—'}</td>
      <td style="text-align:center;font-weight:700;color:${deltaColor}">${deltaText}</td>
      <td style="text-align:right">${slText}</td>
      <td style="text-align:right">${ttText}</td>
      <td style="font-size:12px;color:var(--gray5)">${note}</td>
    </tr>`
  }).join('')

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div style="font-size:13px;color:var(--gray5)">
        So sánh <strong>Tuần ${weekA}</strong> vs <strong>Tuần ${weekB}</strong>
        · <span style="color:var(--amber)">⚠️ Vàng = không có tiến triển</span>
        · <span style="color:var(--gray4)">Xám = tuần B chưa báo cáo</span>
      </div>
      ${totalTangTuan > 0 ? `
        <div style="background:var(--green-light,#D1FAE5);color:var(--green);padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px">
          📈 Sản lượng tăng tuần ${weekB}: +${fmtVND(totalTangTuan)}
        </div>` : ''}
    </div>
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr>
        <th style="min-width:220px">Công tác</th>
        <th style="text-align:center;width:80px">Tuần ${weekA}</th>
        <th style="text-align:center;width:80px">Tuần ${weekB}</th>
        <th style="text-align:center;width:100px">Thay đổi</th>
        <th style="text-align:right;width:100px">SL thay đổi</th>
        <th style="text-align:right;width:110px">Thành tiền</th>
        <th style="min-width:120px">Ghi chú</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      ${totalTangTuan > 0 ? `
      <tfoot>
        <tr style="background:var(--gray1,#F9FAFB);font-weight:700">
          <td colspan="5" style="text-align:right;padding-right:8px">Tổng sản lượng tăng tuần ${weekB}:</td>
          <td style="text-align:right;color:var(--green)">+${fmtVND(totalTangTuan)}</td>
          <td></td>
        </tr>
      </tfoot>` : ''}
    </table>
    </div>`
}
