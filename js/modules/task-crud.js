// ═══════════════════════════════════════════════════════════
// XÓA TASK (planner/admin only)
// ═══════════════════════════════════════════════════════════
async function deleteTask(taskId, taskName) {
  if (STATE.role === 'updater') { toast('Không có quyền xóa task', 'error'); return }

  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  // Tìm toàn bộ task con (cascade)
  const descendants = STATE.tasks.filter(t =>
    t.id === taskId || t.wbs_code.startsWith(task.wbs_code + '.')
  )
  const descCount = descendants.length
  const extraMsg = descCount > 1 ? `\n\nSẽ xóa ${descCount} task (bao gồm ${descCount-1} task con).` : ''

  if (!confirm(`Xóa task này?\n"${taskName}"${extraMsg}\n\nKhông thể hoàn tác.`)) return

  loading(true, `Đang xóa ${descCount} task...`)
  try {
    // Xóa con trước (sort by level desc), cha sau
    const sorted = [...descendants].sort((a,b) => b.outline_level - a.outline_level)
    for (const t of sorted) {
      await sb.from('task_progress').delete().eq('task_id', t.id)
      await sb.from('task_photos').delete().eq('task_id', t.id)
      await sb.from('task_predecessors').delete().or(`task_id.eq.${t.id},predecessor_id.eq.${t.id}`)
      await sb.from('baseline_log').delete().eq('task_id', t.id)
      const { error } = await sb.from('tasks').delete().eq('id', t.id)
      if (error) throw error
    }
    await loadProjectData(STATE.currentProject.id)
    toast(`Đã xóa ${descCount} task!`, 'success')
    navigate('wbs')
  } catch(e) {
    toast('Lỗi xóa: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}

// ═══════════════════════════════════════════════════════════
// THÊM CÔNG TÁC MỚI
// ═══════════════════════════════════════════════════════════
function openAddTaskModal(parentId = null) {
  if (STATE.role === 'updater') { toast('Không có quyền thêm task', 'error'); return }

  // Build parent options — show all summary tasks + root
  const summaryOptions = STATE.tasks
    .filter(t => t.is_summary)
    .sort((a,b) => a.sort_order - b.sort_order)
    .map(t => `<option value="${t.id}" ${t.id===parentId?'selected':''}>${'　'.repeat(t.outline_level-1)}${t.wbs_code} — ${t.name.slice(0,45)}</option>`)
    .join('')

  openModal('➕ Thêm công tác mới', `
    <div class="form-group">
      <label class="form-label">Loại task</label>
      <div style="display:flex;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="radio" name="task-type" value="leaf" checked id="type-leaf"> Công tác thực tế (leaf)
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="radio" name="task-type" value="summary" id="type-summary"> Hạng mục cha (summary)
        </label>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Thuộc hạng mục cha</label>
      <select class="form-input" id="new-task-parent">
        <option value="">— Cấp cao nhất (không có cha) —</option>
        ${summaryOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Tên công tác <span style="color:var(--red)">*</span></label>
      <input class="form-input" type="text" id="new-task-name" placeholder="VD: Thi công cọc khoan nhồi D800">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">KH Bắt đầu</label>
        <input class="form-input" type="date" id="new-task-start">
      </div>
      <div class="form-group">
        <label class="form-label">KH Kết thúc</label>
        <input class="form-input" type="date" id="new-task-finish">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Đơn vị</label>
        <select class="form-input" id="new-task-unit">
          ${['%','căn','m²','m³','m','cái','bộ','tấn','kg'].map(u=>`<option value="${u}">${u}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">KL Kế hoạch</label>
        <input class="form-input" type="number" id="new-task-qty" placeholder="VD: 66">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Ghi chú</label>
      <input class="form-input" type="text" id="new-task-note" placeholder="Tùy chọn">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" id="btn-save-task" onclick="this.disabled=true;this.textContent='⏳ Đang thêm...';saveNewTask()">➕ Thêm công tác</button>
  `)
}

async function saveNewTask() {
  const name = document.getElementById('new-task-name').value.trim()
  if (!name) { toast('Vui lòng nhập tên công tác', 'error'); return }

  const parentId  = document.getElementById('new-task-parent').value || null
  const kh_start  = document.getElementById('new-task-start').value || null
  const kh_finish = document.getElementById('new-task-finish').value || null
  const unit      = document.getElementById('new-task-unit').value || '%'
  const qty       = parseFloat(document.getElementById('new-task-qty').value) || null
  const isSummary = document.querySelector('input[name="task-type"]:checked')?.value === 'summary'

  const kh_duration = kh_start && kh_finish
    ? Math.round((new Date(kh_finish) - new Date(kh_start)) / 86400000) : null

  // Compute WBS code + outline_level + sort_order
  let wbs_code, outline_level, sort_order

  if (!parentId) {
    // Top-level: find max existing top-level task
    const topLevel = STATE.tasks.filter(t => !t.wbs_code.includes('.'))
    const maxNum = topLevel.reduce((m,t) => {
      const n = parseInt(t.wbs_code) || 0; return n > m ? n : m
    }, 0)
    wbs_code = String(maxNum + 1)
    outline_level = 1
    sort_order = STATE.tasks.length + 1
  } else {
    const parent = STATE.tasks.find(t => t.id === parentId)
    if (!parent) { toast('Không tìm thấy task cha', 'error'); return }

    // Find existing children of this parent
    const siblings = STATE.tasks.filter(t =>
      t.wbs_code.startsWith(parent.wbs_code + '.') &&
      t.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )
    const maxSib = siblings.reduce((m,t) => {
      const parts = t.wbs_code.split('.')
      const n = parseInt(parts[parts.length-1]) || 0
      return n > m ? n : m
    }, 0)
    wbs_code = parent.wbs_code + '.' + (maxSib + 1)
    outline_level = parent.outline_level + 1

    // sort_order: after last descendant of parent
    // Dùng số thập phân (maxSort + 0.5) thay vì shift toàn bộ → nhanh hơn, không conflict
    const descendants = STATE.tasks.filter(t =>
      t.wbs_code.startsWith(parent.wbs_code + '.')
    )
    const maxSort = descendants.reduce((m,t) => t.sort_order > m ? t.sort_order : m,
      parent.sort_order)
    sort_order = maxSort + 0.5  // Không cần shift các task khác
  }

  // Generate a unique msp_uid (use negative numbers for manually added tasks)
  const minUid = STATE.tasks.reduce((m,t) => t.msp_uid < m ? t.msp_uid : m, 0)
  const msp_uid = minUid - 1

  loading(true, 'Đang thêm công tác...')
  closeModal()
  try {
    const { data, error } = await sb.from('tasks').insert({
      project_id:        STATE.currentProject.id,
      msp_uid,
      msp_id:            msp_uid,
      wbs_code,
      outline_level,
      name,
      is_summary:        isSummary,
      is_milestone:      false,
      is_active:         true,
      kh_start,
      kh_finish,
      kh_duration_days:  kh_duration,
      sort_order,
      unit,
      planned_quantity:  qty,
    }).select().single()
    if (error) throw error

    // If adding leaf task to a summary parent, update parent is_summary = true
    if (parentId && !isSummary) {
      await sb.from('tasks').update({ is_summary: true }).eq('id', parentId)
    }

    await loadProjectData(STATE.currentProject.id)
    toast(`Đã thêm: "${name}"`, 'success')
    navigate('wbs')
  } catch(e) {
    toast('Lỗi thêm task: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}

// Sắp xếp lại thứ tự task con
async function reorderTask(taskId, direction) {
  if (STATE.role === 'updater') return
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  // Find siblings (same parent = same wbs depth & same prefix)
  const parts = task.wbs_code.split('.')
  const parentWbs = parts.slice(0,-1).join('.')
  const siblings = STATE.tasks
    .filter(t => {
      const p = t.wbs_code.split('.')
      return p.length === parts.length &&
             p.slice(0,-1).join('.') === parentWbs
    })
    .sort((a,b) => a.sort_order - b.sort_order)

  const idx = siblings.findIndex(t => t.id === taskId)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return

  const swapTask = siblings[swapIdx]
  const s1 = task.sort_order, s2 = swapTask.sort_order

  loading(true, 'Đang sắp xếp...')
  await sb.from('tasks').update({ sort_order: s2 }).eq('id', taskId)
  await sb.from('tasks').update({ sort_order: s1 }).eq('id', swapTask.id)
  loading(false)

  await loadProjectData(STATE.currentProject.id)
  navigate('wbs')
}

// Sửa tên task
async function renameTask(taskId, currentName) {
  if (STATE.role === 'updater') { toast('Không có quyền sửa task', 'error'); return }
  const newName = prompt('Tên mới:', currentName)
  if (!newName || newName === currentName) return

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('tasks').update({ name: newName }).eq('id', taskId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }

  // Log baseline change
  await sb.from('baseline_log').insert({
    task_id: taskId, project_id: STATE.currentProject.id,
    field_changed: 'name', old_value: currentName, new_value: newName,
    changed_by: STATE.user.email, reason: 'Sửa tên task trong app'
  })

  await loadProjectData(STATE.currentProject.id)
  toast('Đã đổi tên!', 'success')
  navigate('wbs')
}

// Sửa ngày KH của task
async function editTaskDates(taskId) {
  if (STATE.role === 'updater') { toast('Không có quyền sửa KH', 'error'); return }
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  openModal(`📅 Sửa ngày KH: ${task.name}`, `
    <div style="font-size:12px;color:var(--gray5);margin-bottom:14px">
      Thay đổi này sẽ được ghi vào Baseline Log.
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">KH Bắt đầu</label>
        <input class="form-input" type="date" id="edit-kh-start" value="${task.kh_start||''}">
      </div>
      <div class="form-group">
        <label class="form-label">KH Kết thúc</label>
        <input class="form-input" type="date" id="edit-kh-finish" value="${task.kh_finish||''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Lý do thay đổi (bắt buộc)</label>
      <input class="form-input" type="text" id="edit-kh-reason" placeholder="VD: CĐT yêu cầu đẩy nhanh, mặt bằng bàn giao trễ...">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveTaskDates('${taskId}')">💾 Lưu</button>
  `)
}

async function saveTaskDates(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  const newStart  = document.getElementById('edit-kh-start').value || null
  const newFinish = document.getElementById('edit-kh-finish').value || null
  const reason    = document.getElementById('edit-kh-reason').value.trim()

  if (!reason) { toast('Vui lòng nhập lý do thay đổi', 'error'); return }

  const newDur = newStart && newFinish
    ? Math.round((new Date(newFinish) - new Date(newStart)) / 86400000) : task.kh_duration_days

  loading(true, 'Đang lưu...')
  closeModal()
  try {
    const { error } = await sb.from('tasks')
      .update({ kh_start: newStart, kh_finish: newFinish, kh_duration_days: newDur })
      .eq('id', taskId)
    if (error) throw error

    // Log changes
    const logs = []
    if (newStart !== task.kh_start) logs.push({ field_changed:'kh_start', old_value:task.kh_start, new_value:newStart })
    if (newFinish !== task.kh_finish) logs.push({ field_changed:'kh_finish', old_value:task.kh_finish, new_value:newFinish })
    for (const log of logs) {
      await sb.from('baseline_log').insert({
        task_id: taskId, project_id: STATE.currentProject.id,
        ...log, changed_by: STATE.user.email, reason
      })
    }

    await loadProjectData(STATE.currentProject.id)
    toast('Đã lưu ngày KH mới!', 'success')
    navigate('wbs')
  } catch(e) {
    toast('Lỗi: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}
