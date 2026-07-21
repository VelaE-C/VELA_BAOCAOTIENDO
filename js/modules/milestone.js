// ═══════════════════════════════════════════════════════════
// PAGE: BÁO CÁO CÁC MỐC — VelaE&C
// ═══════════════════════════════════════════════════════════

function milestonePage() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700;color:var(--gray8)">🏁 Báo cáo các mốc</h2>
      <p style="font-size:13px;color:var(--gray4)">${STATE.currentProject?.name || ''}</p>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" onclick="openAddMilestoneModal()">➕ Thêm mốc</button>
    </div>
  </div>
  <div id="milestone-content">
    <div style="padding:40px;text-align:center;color:var(--gray4)">Đang tải...</div>
  </div>`
}

async function initMilestone() {
  await loadMilestoneData()
}

// ── Load và render toàn bộ ─────────────────────────────────
async function loadMilestoneData() {
  const el = document.getElementById('milestone-content')
  if (!el || !STATE.currentProject) return

  const projId = STATE.currentProject.id

  // Load milestone groups
  const { data: groups, error } = await sb
    .from('milestone_groups')
    .select('*')
    .eq('project_id', projId)
    .order('sort_order')

  if (error) { el.innerHTML = '<div style="color:var(--red);padding:20px">Lỗi: ' + error.message + '</div>'; return }

  if (!groups?.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--gray4)">
        <div style="font-size:48px;margin-bottom:12px">🏁</div>
        <div style="font-size:15px;font-weight:600;color:var(--gray6);margin-bottom:8px">Chưa có mốc nào</div>
        <div style="font-size:13px;margin-bottom:20px">Tạo mốc để tổng hợp tiến độ theo loại công việc</div>
        <button class="btn btn-primary" onclick="openAddMilestoneModal()">➕ Thêm mốc đầu tiên</button>
      </div>`
    return
  }

  // Load tất cả task links của project này
  const { data: links } = await sb
    .from('milestone_tasks')
    .select('milestone_id, task_id')
    .in('milestone_id', groups.map(g => g.id))

  const linkMap = {}
  ;(links || []).forEach(l => {
    if (!linkMap[l.milestone_id]) linkMap[l.milestone_id] = []
    linkMap[l.milestone_id].push(l.task_id)
  })

  // Render từng mốc
  el.innerHTML = groups.map(g => renderMilestoneCard(g, linkMap[g.id] || [])).join('')
}

// ── Render 1 card mốc ─────────────────────────────────────
function renderMilestoneCard(group, taskIds) {
  const tasks = STATE.tasks.filter(t => taskIds.includes(t.id))

  // Tính số liệu theo KL thực tế (planned_quantity × pct)
  let completedQty = 0, notStartedQty = 0, totalQty = 0

  tasks.forEach(t => {
    const pct    = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
    const qty    = t.planned_quantity || 1

    let actual
    if (t.actual_quantity != null && t.actual_quantity > 0) {
      // BCH đã nhập KL thực tế → dùng trực tiếp (16 căn, không chia %)
      actual = t.actual_quantity
    } else if (t.unit && t.unit !== '%' && qty > 1) {
      // Có đơn vị KL nhưng chưa nhập actual → tính từ pct, làm tròn số nguyên
      actual = Math.round(qty * pct / 100)
    } else {
      // Đơn vị % hoặc không có KL → không có ý nghĩa số lẻ
      actual = Math.round(qty * pct / 100)
    }

    totalQty     += qty
    completedQty += actual
    if (pct === 0) notStartedQty += qty
  })

  const remainingQty = Math.max(0, totalQty - completedQty)
  const donePct = totalQty > 0 ? Math.round(completedQty / totalQty * 100) : 0
  const unit = group.unit || 'căn'
  // Làm tròn đẹp
  const fmtQty = v => Number.isInteger(v) ? v : parseFloat(v.toFixed(1))

  // Màu theo % hoàn thành
  const color = donePct === 100 ? '#16A34A' : donePct >= 60 ? '#0D9488' : donePct >= 30 ? '#D97706' : '#2563EB'

  // Rows task
  const taskRows = tasks.length > 0 ? tasks.map(t => {
    const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
    const qty = t.planned_quantity || 1
    const qtyDone = Math.round(qty * pct / 100 * 100) / 100
    const barColor = pct === 100 ? '#16A34A' : pct > 0 ? '#2563EB' : '#E2E8F0'
    const status = pct === 100
      ? '<span style="color:#16A34A;font-weight:600;font-size:11px">✅ Xong</span>'
      : pct > 0
        ? '<span style="color:#D97706;font-weight:600;font-size:11px">⚙️ Đang làm</span>'
        : '<span style="color:#94A3B8;font-size:11px">○ Chưa bắt đầu</span>'

    return `
      <tr style="border-bottom:0.5px solid var(--gray2)">
        <td style="padding:7px 10px;font-size:12px;color:var(--gray7);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.name}">${t.name}</td>
        <td style="padding:7px 8px;font-size:11px;color:var(--gray4);white-space:nowrap">${t.wbs_code || '—'}</td>
        <td style="padding:7px 8px;min-width:100px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:5px;background:var(--gray2);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${barColor};width:28px;text-align:right">${pct}%</span>
          </div>
        </td>
        <td style="padding:7px 8px;text-align:center;font-size:12px">${qtyDone > 0 ? qtyDone : '—'} / ${qty} ${t.unit || unit}</td>
        <td style="padding:7px 8px;text-align:center">${status}</td>
        <td style="padding:7px 8px;text-align:center">
          <button onclick="removeMilestoneTask('${group.id}','${t.id}')"
            style="background:none;border:none;color:var(--gray3);cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px"
            onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray3)'"
            title="Bỏ khỏi mốc">✕</button>
        </td>
      </tr>`
  }).join('') : `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--gray4);font-size:12px">Chưa có task nào — bấm "Chọn task" để thêm</td></tr>`

  return `
  <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden" id="mc-${group.id}">
    <!-- Header mốc -->
    <div style="padding:14px 16px;background:var(--navy);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:15px;font-weight:700;color:white">${group.name}</div>
        ${group.description ? `<div style="font-size:11px;color:rgba(255,255,255,.6)">${group.description}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-sm" onclick="openAddTaskToMilestone('${group.id}')"
          style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);font-size:12px">
          + Chọn task
        </button>
        <button onclick="openEditMilestoneModal('${group.id}','${group.name.replace(/'/g,"\\'")}','${(group.description||'').replace(/'/g,"\\'")}','${group.unit||''}')"
          style="background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:14px;padding:4px 8px"
          title="Sửa mốc">✏️</button>
        <button onclick="deleteMilestoneGroup('${group.id}')"
          style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:14px;padding:4px 8px"
          title="Xóa mốc">🗑️</button>
      </div>
    </div>

    <!-- Summary bar -->
    <div style="padding:12px 16px;background:#F8FAFC;border-bottom:1px solid var(--gray2);display:flex;gap:20px;flex-wrap:wrap;align-items:center">
      <!-- Progress circle text -->
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:28px;font-weight:800;color:${color}">${donePct}%</div>
        <div style="font-size:11px;color:var(--gray5);line-height:1.4">hoàn<br>thành</div>
      </div>
      <!-- Divider -->
      <div style="width:1px;height:36px;background:var(--gray2)"></div>
      <!-- Stats -->
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:800;color:#16A34A">${fmtQty(completedQty)}</div>
          <div style="font-size:10px;color:var(--gray4)">✅ Đã thực hiện (${unit})</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--gray4)">${fmtQty(remainingQty)}</div>
          <div style="font-size:10px;color:var(--gray4)">○ Còn lại (${unit})</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--navy)">${fmtQty(totalQty)}</div>
          <div style="font-size:10px;color:var(--gray4)">Tổng ${unit}</div>
        </div>
      </div>
      <!-- Progress bar -->
      <div style="flex:1;min-width:160px">
        <div style="height:8px;background:var(--gray2);border-radius:4px;overflow:hidden;margin-bottom:4px">
          <div style="height:100%;width:${donePct}%;background:${color};border-radius:4px;transition:width .4s"></div>
        </div>
        <div style="font-size:10px;color:var(--gray4)">${fmtQty(completedQty)} / ${fmtQty(totalQty)} ${unit} đã thực hiện · còn lại ${fmtQty(remainingQty)} ${unit}</div>
      </div>
    </div>

    <!-- Task table -->
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--gray1);font-size:11px;color:var(--gray5)">
            <th style="padding:7px 10px;text-align:left;font-weight:600">Công tác / Task</th>
            <th style="padding:7px 8px;text-align:left;font-weight:600">WBS</th>
            <th style="padding:7px 8px;text-align:left;font-weight:600;min-width:120px">Tiến độ</th>
            <th style="padding:7px 8px;text-align:center;font-weight:600">KL TH / KH</th>
            <th style="padding:7px 8px;text-align:center;font-weight:600">Trạng thái</th>
            <th style="padding:7px 8px;text-align:center;font-weight:600"></th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
    </div>
  </div>`
}

// ── Modal: Tạo mốc mới ────────────────────────────────────
function openAddMilestoneModal() {
  openModal('➕ Thêm mốc mới', `
    <div class="form-group">
      <label class="form-label">Tên mốc <span style="color:var(--red)">*</span></label>
      <input class="form-input" id="mg-name" placeholder="VD: Thi công móng, Đổ sàn trệt, Xây tường tầng 1...">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Đơn vị hiển thị</label>
        <input class="form-input" id="mg-unit" placeholder="VD: căn, m², tầng" value="căn">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Mô tả (tùy chọn)</label>
      <input class="form-input" id="mg-desc" placeholder="VD: Tính khi đã đổ BT xong và nghiệm thu">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveMilestoneGroup()">💾 Tạo mốc</button>
  `)
  setTimeout(() => document.getElementById('mg-name')?.focus(), 100)
}

async function saveMilestoneGroup() {
  const name = document.getElementById('mg-name')?.value.trim()
  const unit = document.getElementById('mg-unit')?.value.trim() || 'căn'
  const desc = document.getElementById('mg-desc')?.value.trim() || null

  if (!name) { toast('Vui lòng nhập tên mốc', 'error'); return }

  // Lấy sort_order cao nhất hiện tại
  const { data: existing } = await sb.from('milestone_groups')
    .select('sort_order').eq('project_id', STATE.currentProject.id)
    .order('sort_order', { ascending: false }).limit(1)
  const nextOrder = (existing?.[0]?.sort_order || 0) + 1

  loading(true, 'Đang tạo mốc...')
  const { error } = await sb.from('milestone_groups').insert({
    project_id:  STATE.currentProject.id,
    name,
    unit,
    description: desc,
    sort_order:  nextOrder,
    created_by:  STATE.user?.email
  })
  loading(false)

  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  closeModal()
  toast('Đã tạo mốc: ' + name, 'success')
  await loadMilestoneData()
}

// ── Modal: Sửa mốc ────────────────────────────────────────
function openEditMilestoneModal(id, name, desc, unit) {
  openModal('✏️ Sửa mốc', `
    <div class="form-group">
      <label class="form-label">Tên mốc <span style="color:var(--red)">*</span></label>
      <input class="form-input" id="mg-edit-name" value="${name}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Đơn vị hiển thị</label>
        <input class="form-input" id="mg-edit-unit" value="${unit || 'căn'}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Mô tả</label>
      <input class="form-input" id="mg-edit-desc" value="${desc}">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="updateMilestoneGroup('${id}')">💾 Lưu</button>
  `)
}

async function updateMilestoneGroup(id) {
  const name = document.getElementById('mg-edit-name')?.value.trim()
  const unit = document.getElementById('mg-edit-unit')?.value.trim() || 'căn'
  const desc = document.getElementById('mg-edit-desc')?.value.trim() || null
  if (!name) { toast('Vui lòng nhập tên mốc', 'error'); return }

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('milestone_groups').update({ name, unit, description: desc }).eq('id', id)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  closeModal()
  toast('Đã cập nhật mốc', 'success')
  await loadMilestoneData()
}

async function deleteMilestoneGroup(id) {
  if (!confirm('Xóa mốc này? Các task đã gán sẽ bị gỡ liên kết.')) return
  loading(true, 'Đang xóa...')
  await sb.from('milestone_tasks').delete().eq('milestone_id', id)
  const { error } = await sb.from('milestone_groups').delete().eq('id', id)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã xóa mốc', 'success')
  await loadMilestoneData()
}

// ── Modal: Chọn task gán vào mốc ─────────────────────────
async function openAddTaskToMilestone(milestoneId) {
  // Lấy danh sách task đã gán rồi
  const { data: existing } = await sb.from('milestone_tasks')
    .select('task_id').eq('milestone_id', milestoneId)
  const assignedIds = new Set((existing || []).map(e => e.task_id))

  // Build breadcrumb path cho mỗi task lá: "Villa 1B > Kết cấu > Móng"
  const taskMap = {}
  STATE.tasks.forEach(t => { taskMap[t.wbs_code] = t })

  function getBreadcrumb(task) {
    const parts = (task.wbs_code || '').split('.')
    const ancestors = []
    for (let i = 1; i < parts.length; i++) {
      const parentWbs = parts.slice(0, i).join('.')
      const parent = taskMap[parentWbs]
      if (parent && parent.is_summary) ancestors.push(parent.name)
    }
    return ancestors.join(' › ')
  }

  // Hiện tất cả task (cả cha lẫn con) để user thấy context
  // Task cha: làm header nhóm (không tick được)
  // Task lá: tick được
  const rows = STATE.tasks.map(t => {
    const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
    const isSummary = t.is_summary

    if (isSummary) {
      // Header nhóm — indent theo level
      const indent = Math.max(0, (t.outline_level - 1)) * 16
      const bg = t.outline_level === 1 ? '#1A2B4A' : t.outline_level === 2 ? '#2563EB' : '#EEF2FF'
      const tc = t.outline_level <= 2 ? 'white' : 'var(--navy)'
      return `<div style="padding:5px 12px 5px ${12+indent}px;background:${bg};font-size:11px;font-weight:700;color:${tc};border-bottom:0.5px solid rgba(255,255,255,.1)"
        data-summary="1">${t.name}</div>`
    }

    // Task lá — có thể tick
    const checked = assignedIds.has(t.id)
    const indent = Math.max(0, (t.outline_level - 1)) * 16
    const breadcrumb = getBreadcrumb(t)
    const pctClr = pct===100 ? '#16A34A' : pct>0 ? '#D97706' : '#94A3B8'
    const rowBg = checked ? '#EFF6FF' : 'white'

    return `<label data-name="${t.name.toLowerCase()} ${breadcrumb.toLowerCase()}"
      style="display:flex;align-items:center;gap:10px;padding:7px 12px 7px ${12+indent}px;
        border-bottom:0.5px solid var(--gray2);cursor:pointer;background:${rowBg};transition:background .1s"
      onmouseover="if(!this.querySelector('input').checked)this.style.background='#F8FAFC'"
      onmouseout="this.style.background=this.querySelector('input').checked?'#EFF6FF':'white'">
      <input type="checkbox" value="${t.id}" ${checked ? 'checked' : ''}
        style="width:15px;height:15px;accent-color:var(--blue);flex-shrink:0;cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:var(--gray8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</div>
        ${breadcrumb ? `<div style="font-size:10px;color:var(--gray4);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📍 ${breadcrumb}</div>` : ''}
        <div style="font-size:10px;color:var(--gray4)">${t.wbs_code || ''} · ${t.planned_quantity || '—'} ${t.unit || ''}</div>
      </div>
      <span style="font-size:12px;font-weight:700;color:${pctClr};flex-shrink:0;min-width:32px;text-align:right">${pct}%</span>
    </label>`
  }).join('')

  openModal('📋 Chọn task cho mốc', `
    <div style="font-size:12px;color:var(--gray5);margin-bottom:10px;padding:0 4px">
      Tick chọn các task lá cần tổng hợp vào mốc này. Task đã tick (nền xanh) đang được gán.
    </div>
    <div style="margin-bottom:10px;padding:0 4px">
      <input class="form-input" id="task-search" placeholder="🔍 Tìm task..." style="font-size:13px"
        oninput="filterMilestoneTasks(this.value)">
    </div>
    <div id="task-list" style="max-height:55vh;overflow-y:auto;border:1px solid var(--gray2);border-radius:var(--radius)">
      ${rows}
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--gray4);padding:0 4px">
      Đã chọn: <span id="selected-count">${assignedIds.size}</span> task
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveMilestoneTasks('${milestoneId}')">💾 Lưu</button>
  `)

  // Update count realtime
  setTimeout(() => {
    document.querySelectorAll('#task-list input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const count = document.querySelectorAll('#task-list input[type=checkbox]:checked').length
        const el = document.getElementById('selected-count')
        if (el) el.textContent = count
      })
    })
  }, 100)

  const m = document.querySelector('.modal')
  if (m) { m.style.maxWidth = '620px'; m.style.maxHeight = '90vh' }
}

function filterMilestoneTasks(q) {
  const lower = q.toLowerCase().trim()
  const items = document.querySelectorAll('#task-list label, #task-list div[data-summary]')

  if (!lower) {
    // Reset — hiện tất cả
    items.forEach(el => el.style.display = '')
    return
  }

  // Ẩn/hiện label theo search
  const labels = document.querySelectorAll('#task-list label')
  labels.forEach(lbl => {
    const name = lbl.dataset.name || ''
    lbl.style.display = name.includes(lower) ? '' : 'none'
  })

  // Ẩn header cha nếu không có task con nào visible bên dưới
  const summaries = document.querySelectorAll('#task-list div[data-summary]')
  summaries.forEach(div => {
    // Tìm tất cả label anh em phía sau cho đến header kế tiếp
    let el = div.nextElementSibling
    let hasVisible = false
    while (el && !el.dataset?.summary) {
      if (el.tagName === 'LABEL' && el.style.display !== 'none') { hasVisible = true; break }
      el = el.nextElementSibling
    }
    div.style.display = hasVisible ? '' : 'none'
  })
}

async function saveMilestoneTasks(milestoneId) {
  const checkboxes = document.querySelectorAll('#task-list input[type=checkbox]')
  const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value)

  loading(true, 'Đang lưu...')
  // Xóa toàn bộ links cũ rồi insert lại
  await sb.from('milestone_tasks').delete().eq('milestone_id', milestoneId)

  if (selectedIds.length > 0) {
    const inserts = selectedIds.map(tid => ({
      milestone_id: milestoneId,
      task_id: tid,
      project_id: STATE.currentProject.id
    }))
    const { error } = await sb.from('milestone_tasks').insert(inserts)
    if (error) { loading(false); toast('Lỗi: ' + error.message, 'error'); return }
  }

  loading(false)
  closeModal()
  toast('Đã lưu ' + selectedIds.length + ' task cho mốc', 'success')
  await loadMilestoneData()
}

async function removeMilestoneTask(milestoneId, taskId) {
  const { error } = await sb.from('milestone_tasks')
    .delete().eq('milestone_id', milestoneId).eq('task_id', taskId)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã gỡ task khỏi mốc', '')
  await loadMilestoneData()
}
