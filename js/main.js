// ═══════════════════════════════════════════════════════════
// PAGE: WBS TREE
// ═══════════════════════════════════════════════════════════
function wbs() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h2 style="font-size:18px;font-weight:700">WBS — Cây tiến độ</h2>
      <p style="font-size:13px;color:var(--gray4)">${STATE.currentProject?.name || ''}</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="expandAll()">Mở rộng tất cả</button>
      <button class="btn btn-secondary btn-sm" onclick="collapseAll()">Thu gọn tất cả</button>
      ${STATE.role !== 'updater' ? `
        <button class="btn btn-secondary btn-sm" onclick="recomputeParentDates('${STATE.currentProject?.id}')">🔄 Sync ngày KH cha</button>
        <button class="btn btn-primary btn-sm" onclick="openAddTaskModal()">➕ Thêm công tác</button>
      ` : ''}
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div class="wbs-header">
      <div style="width:40px;flex-shrink:0"></div>
      <div class="wbs-name">Hạng mục / Công tác</div>
      <div class="wbs-kh-start">KH Bắt đầu</div>
      <div class="wbs-kh-end">KH Kết thúc</div>
      <div class="wbs-dur">Ngày KH</div>
      <div class="wbs-pct">Tiến độ</div>
      <div class="wbs-status" style="width:90px">Đơn vị/KH</div>
      <div class="wbs-status">Trạng thái</div>
    </div>
    <div class="wbs-tree" id="wbs-container"></div>
  </div>`
}

function initWbs() {
  const tasks = STATE.tasks
  if (!tasks.length) {
    document.getElementById('wbs-container').innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--gray4)">Chưa có dữ liệu. Vào Import để tải file MS Project.</div>'
    return
  }

  // Build tree structure
  const rows = tasks.map(t => {
    const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
    const delay = t.delay_days
    const indent = (t.outline_level - 1) * 20
    const hasChildren = tasks.some(c => c.wbs_code.startsWith(t.wbs_code + '.'))

    // Compute status for summary based on rolled-up pct
    let rowStatus = t.status
    if (t.is_summary && t._rollup_pct !== undefined) {
      const khEnd = t.kh_finish ? new Date(t.kh_finish) : null
      const now = new Date(); now.setHours(0,0,0,0)
      if (pct === 100) rowStatus = 'done'
      else if (khEnd && now > khEnd) rowStatus = 'critical'
      else if (pct > 0) rowStatus = 'in_progress'
      else rowStatus = 'not_started'
    }

    const barColor = pct === 100 ? 'on' : delay > 0 ? 'late' : 'on'

    return `
    <div class="wbs-row ${t.is_summary?'summary':''} level-${t.outline_level}"
         data-wbs="${t.wbs_code}" data-level="${t.outline_level}"
         data-has-children="${hasChildren}"
         onclick="wbsRowClick(this, '${t.id}')"
         style="padding-left:${indent}px">
      <div class="wbs-toggle">${hasChildren ? '▼' : ''}</div>
      <div class="wbs-name" title="${t.name}" style="display:flex;align-items:center;gap:6px">
        <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
        ${t.is_summary && t.key_task_id ? '<span title="Key Task đang active" style="font-size:11px;color:var(--amber)">🔑</span>' : ''}
        ${'${STATE.role}' !== 'updater' ? `
          <span onclick="event.stopPropagation();openTaskSettings('${t.id}')"
            title="Cài đặt đơn vị/KH"
            style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;cursor:pointer;color:var(--gray5);flex-shrink:0;background:var(--gray2)"
            class="wbs-settings-btn">⚙️</span>
          ${t.is_summary ? `<span onclick="event.stopPropagation();openKeyTaskModal('${t.id}')"
            title="Chọn Key Task"
            style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;cursor:pointer;color:var(--gray5);flex-shrink:0;background:var(--gray2)"
            class="wbs-settings-btn">🔑</span>` : ''}
          <span onclick="event.stopPropagation();editTaskDates('${t.id}')"
            title="Sửa ngày KH"
            style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;cursor:pointer;color:var(--gray5);flex-shrink:0;background:var(--gray2)"
            class="wbs-settings-btn">📅</span>
          <span onclick="event.stopPropagation();renameTask('${t.id}','${t.name.replace(/'/g,"\\'")}' )"
            title="Đổi tên"
            style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;cursor:pointer;color:var(--gray5);flex-shrink:0;background:var(--gray2)"
            class="wbs-settings-btn">✏️</span>
          <span onclick="event.stopPropagation();deleteTask('${t.id}','${t.name.replace(/'/g,"\\'")}' )"
            title="Xóa task này"
            style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;cursor:pointer;color:#DC2626;flex-shrink:0;background:#FEE2E2"
            class="wbs-settings-btn">🗑️</span>
        ` : ''}
      </div>
      <div class="wbs-kh-start">${fmtDateShort(t.kh_start)}</div>
      <div class="wbs-kh-end">${fmtDateShort(t.kh_finish)}</div>
      <div class="wbs-dur">${t.kh_duration_days ?? '—'}</div>
      <div class="wbs-pct">
        <div class="pct-bar">
          <div class="pct-fill ${barColor}" style="width:${pct}%"></div>
        </div>
        <div style="font-size:11px;color:${pct>0?'var(--gray7)':'var(--gray4)'};margin-top:2px;font-weight:${pct>0?500:400}">
          ${pct}%${t.is_summary && pct > 0 ? ' ⟳' : ''}
        </div>
      </div>
      <div class="wbs-status" style="width:90px;font-size:11px;color:var(--gray5);text-align:center">
        ${t.unit && t.unit !== '%' && t.planned_quantity
          ? `<span style="font-weight:500">${t.actual_quantity||0}/${t.planned_quantity} ${t.unit}</span>`
          : `<span>${t.unit||'%'}</span>`}
      </div>
      <div class="wbs-status" style="font-size:11px;text-align:center;padding:0 4px">
        ${(() => {
          // Task cha (summary): chỉ hiện % — không hiện badge trạng thái
          if (t.is_summary) {
            return ''
          }
          // Task lá: hiện đầy đủ
          const d = calcProgressDetail(t)
          if (d.done) return '<span class="badge badge-green" style="font-size:10px">✅ Xong</span>'
          if (d.delayDays === null || d.delayDays === undefined) return statusBadge(rowStatus)
          if (d.delayDays <= 0 && (d.aheadDays||0) > 0) {
            const aQty = d.hasUnit ? ' · dư '+(d.aheadQty||0)+' '+(d.unit||'') : ''
            return '<span class="badge badge-green" style="font-size:10px;white-space:normal;line-height:1.4">Sớm '+(d.aheadDays)+'ngày'+aQty+'</span>'
          }
          if (d.delayDays <= 0) return '<span class="badge badge-green" style="font-size:10px">🟢 Đúng KH</span>'
          const qty = d.hasUnit ? (d.missingQty||0)+' '+(d.unit||'') : (d.missingPct||0)+'%'
          return '<span class="badge badge-red" style="white-space:normal;line-height:1.4;font-size:10px">Trễ '+d.delayDays+'n<br>-'+qty+'</span>'
        })()}
      </div>
    </div>`
  }).join('')

  document.getElementById('wbs-container').innerHTML = rows
  // Default: show all
  expandAll()
}

function wbsRowClick(row, taskId) {
  const hasChildren = row.dataset.hasChildren === 'true'
  if (!hasChildren) {
    // Open update modal for leaf task
    openUpdateModal(taskId)
    return
  }
  // Toggle collapse
  const wbs = row.dataset.wbs
  const level = parseInt(row.dataset.level)
  const isCollapsed = row.classList.toggle('collapsed')
  row.querySelector('.wbs-toggle').textContent = isCollapsed ? '▶' : '▼'

  // Show/hide children
  document.querySelectorAll('.wbs-row').forEach(r => {
    if (r.dataset.wbs !== wbs && r.dataset.wbs?.startsWith(wbs + '.')) {
      r.style.display = isCollapsed ? 'none' : 'flex'
    }
  })
}

function expandAll() {
  document.querySelectorAll('.wbs-row').forEach(r => {
    r.style.display = 'flex'
    r.classList.remove('collapsed')
    const t = r.querySelector('.wbs-toggle')
    if (t && r.dataset.hasChildren==='true') t.textContent = '▼'
  })
}

function collapseAll() {
  collapseLevel(2)
}

function collapseLevel(fromLevel) {
  document.querySelectorAll('.wbs-row').forEach(r => {
    const lv = parseInt(r.dataset.level)
    if (lv >= fromLevel) {
      r.style.display = 'none'
      r.classList.add('collapsed')
    } else {
      r.style.display = 'flex'
    }
  })
}

// ═══════════════════════════════════════════════════════════
// PAGE: UPDATE (mobile-friendly form)
// ═══════════════════════════════════════════════════════════
function update() {
  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Cập nhật tiến độ thực tế</h2>
  <div class="card">
    <div class="card-title">Tìm công tác cần cập nhật</div>
    <input class="form-input" id="task-search" placeholder="🔍 Nhập tên công tác..." oninput="searchTasks(this.value)" style="margin-bottom:12px">
    <div id="task-search-results"></div>
  </div>`
}

function initUpdate() {
  // Show top tasks needing update (late or in progress)
  const needsUpdate = STATE.tasks.filter(t =>
    !t.is_summary && ['delayed','critical','in_progress','not_started_late'].includes(t.status)
  ).slice(0, 15)

  const el = document.getElementById('task-search-results')
  if (!el) return
  if (needsUpdate.length) {
    el.innerHTML = `
      <div style="font-size:12px;color:var(--gray4);margin-bottom:8px">Công tác cần cập nhật (${needsUpdate.length}):</div>
      ${needsUpdate.map(t => taskUpdateRow(t)).join('')}`
  }
}

function searchTasks(q) {
  const el = document.getElementById('task-search-results')
  if (!q.trim()) { initUpdate(); return }
  const results = STATE.tasks.filter(t =>
    !t.is_summary && t.name.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 20)
  el.innerHTML = results.length
    ? results.map(t => taskUpdateRow(t)).join('')
    : '<div style="color:var(--gray4);font-size:13px;padding:12px">Không tìm thấy</div>'
}

function taskUpdateRow(t) {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--gray2);border-radius:var(--radius);margin-bottom:6px;background:white">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:500;color:var(--gray8);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
      <div style="font-size:11px;color:var(--gray4)">WBS: ${t.wbs_code} · KH: ${fmtDateShort(t.kh_start)}→${fmtDateShort(t.kh_finish)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px">
      ${statusBadge(t.status)}
      <button class="btn btn-primary btn-sm" onclick="openUpdateModal('${t.id}')">Cập nhật</button>
    </div>
  </div>`
}

function openUpdateModal(taskId) {
  const t = STATE.tasks.find(x => x.id === taskId)
  if (!t) return

  const today = new Date().toISOString().slice(0,10)
  const curPct = t.pct_complete || 0

  // Tính trạng thái so với hôm nay
  const khEnd = t.kh_finish ? new Date(t.kh_finish) : null
  const now = new Date()
  now.setHours(0,0,0,0)
  const isLate = khEnd && now > khEnd && curPct < 100
  const daysLate = khEnd ? Math.round((now - khEnd) / 86400000) : 0

  const statusHtml = isLate
    ? `<span style="color:var(--red);font-weight:600">⚠️ Trễ ${daysLate} ngày so với KH kết thúc (${fmtDate(t.kh_finish)})</span>`
    : curPct === 100
    ? `<span style="color:var(--green);font-weight:600">✅ Đã hoàn thành</span>`
    : `<span style="color:var(--green)">🟢 Đang trong hạn KH</span>`

  openModal(`Cập nhật: ${t.name}`, `
    <div style="padding:10px 14px;background:var(--lblue);border-radius:var(--radius);font-size:12px;color:var(--gray6);margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div><strong>WBS:</strong> ${t.wbs_code} &nbsp;|&nbsp; <strong>KH:</strong> ${fmtDate(t.kh_start)} → ${fmtDate(t.kh_finish)} (${t.kh_duration_days} ngày)</div>
        <div>${statusHtml}</div>
      </div>
    </div>

    <div style="background:var(--gray1);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px;font-size:13px">
      <div style="color:var(--gray5);font-size:11px;margin-bottom:8px">📅 Ngày cập nhật</div>
      ${STATE.role === 'planner' || STATE.role === 'admin' ? `
      <!-- PLANNER: nhập ngày thủ công -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <div>
          <div style="font-size:11px;color:var(--gray5);margin-bottom:4px">Ngày bắt đầu TT</div>
          <input type="date" id="upd-tt-start-date" value="${t.tt_start||today}"
            style="width:100%;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:13px">
        </div>
        <div>
          <div style="font-size:11px;color:var(--gray5);margin-bottom:4px">
            Ngày hoàn thành TT <span style="color:var(--amber);font-size:10px">(chỉ điền khi 100%)</span>
          </div>
          <input type="date" id="upd-tt-finish-date" value="${t.tt_finish||''}"
            style="width:100%;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:13px">
        </div>
      </div>
      ` : `
      <!-- UPDATER: chỉ xem ngày, không chỉnh -->
      <div style="display:flex;gap:16px;margin-top:4px;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--gray5)">
          Bắt đầu TT: <strong style="color:var(--gray7)">${t.tt_start ? fmtDate(t.tt_start) : 'Chưa có'}</strong>
        </div>
        <div style="font-size:12px;color:var(--gray5)">
          Hoàn thành TT: <strong style="color:var(--gray7)">${t.tt_finish ? fmtDate(t.tt_finish) : '—'}</strong>
        </div>
        <div style="font-size:11px;color:var(--gray4)">
          Ghi nhận hôm nay: <strong>${new Date().toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}</strong>
        </div>
      </div>
      `}
    </div>

    ${t.unit && t.unit !== '%' && t.planned_quantity ? `
    <div class="form-group">
      <label class="form-label" style="font-size:13px;font-weight:600">
        Khối lượng thực tế (${t.unit}) — KH: ${t.planned_quantity} ${t.unit}
      </label>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <input type="number" id="upd-qty" min="0" max="${t.planned_quantity}" step="1"
          value="${t.actual_quantity||0}"
          oninput="
            const qty=parseFloat(this.value)||0;
            const plan=${t.planned_quantity};
            const pct=Math.min(100,Math.round(qty/plan*100));
            document.getElementById('upd-pct').value=pct;
            document.getElementById('pct-display').textContent=pct+'%';
            document.getElementById('pct-bar-fill').style.width=pct+'%';
            document.getElementById('pct-bar-fill').style.background=pct===100?'var(--green)':'var(--blue)';
          "
          style="width:100px;padding:8px;border:1px solid var(--gray3);border-radius:6px;font-size:16px;font-weight:600;text-align:center">
        <span style="font-size:15px;font-weight:500;color:var(--gray6)">/ ${t.planned_quantity} ${t.unit}</span>
        <span style="font-size:13px;color:var(--gray4)">= <strong id="pct-display" style="color:var(--green)">${curPct}%</strong></span>
      </div>
      <div class="pct-bar" style="height:8px;margin-top:10px;border-radius:4px">
        <div class="pct-fill" id="pct-bar-fill" style="width:${curPct}%;background:${curPct===100?'var(--green)':'var(--blue)'};height:100%;border-radius:4px;transition:width .2s"></div>
      </div>
      <input type="hidden" id="upd-pct" value="${curPct}">
    </div>
    ` : `
    <div class="form-group">
      <label class="form-label" style="font-size:13px;font-weight:600">
        % Hoàn thành lũy kế — hiện tại: <span style="color:var(--blue)">${curPct}%</span>
        → mới: <strong id="pct-display" style="color:var(--green)">${curPct}%</strong>
      </label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
        <input type="range" id="upd-pct" min="0" max="100" step="5" value="${curPct}"
          oninput="
            const v=parseInt(this.value);
            document.getElementById('pct-display').textContent=v+'%';
            document.getElementById('pct-number').value=v;
            document.getElementById('pct-bar-fill').style.width=v+'%';
            document.getElementById('pct-bar-fill').style.background=v===100?'var(--green)':v<${curPct}?'var(--red)':'var(--blue)';
          "
          style="flex:1;accent-color:var(--blue)">
        <input type="number" id="pct-number" min="0" max="100" value="${curPct}"
          oninput="
            const v=Math.min(100,Math.max(0,parseInt(this.value)||0));
            this.value=v;
            document.getElementById('upd-pct').value=v;
            document.getElementById('pct-display').textContent=v+'%';
            document.getElementById('pct-bar-fill').style.width=v+'%';
          "
          style="width:64px;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:14px;font-weight:600;text-align:center">
        <span style="font-size:13px;color:var(--gray5)">%</span>
      </div>
      <div class="pct-bar" style="height:8px;margin-top:8px;border-radius:4px">
        <div class="pct-fill" id="pct-bar-fill" style="width:${curPct}%;background:${curPct===100?'var(--green)':'var(--blue)'};height:100%;border-radius:4px;transition:width .2s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray4);margin-top:4px">
        <span>0%</span><span style="color:var(--amber)">KH kết thúc: ${fmtDate(t.kh_finish)}</span><span>100%</span>
      </div>
    </div>
    `}

    <div class="form-group">
      <label class="form-label">Ghi chú / Nguyên nhân lệch <span style="color:var(--gray4);font-weight:400">(nếu chậm bắt buộc điền)</span></label>
      <textarea class="form-input" id="upd-note" rows="2"
        placeholder="VD: Chờ vật tư thép, thời tiết mưa, thiếu nhân lực...">${t.note||''}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">📷 Ảnh hiện trường <span style="color:var(--gray4);font-weight:400">(tùy chọn, tối đa 5 ảnh)</span></label>
      <div class="photo-upload-area" onclick="document.getElementById('photo-input').click()">
        📷 Bấm để chọn ảnh từ máy / điện thoại
      </div>
      <input type="file" id="photo-input" accept="image/*" multiple style="display:none"
        onchange="previewPhotos(this)">
      <div class="photo-grid" id="photo-preview"></div>
    </div>
  `, `
    <button class="btn btn-secondary btn-sm" onclick="showProgressHistory('${taskId}')">📋 Lịch sử</button>
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveProgress('${taskId}')">💾 Lưu cập nhật</button>
  `)
}

let pendingPhotos = []

function previewPhotos(input) {
  pendingPhotos = Array.from(input.files).slice(0, 5)
  const grid = document.getElementById('photo-preview')
  grid.innerHTML = pendingPhotos.map((f, i) => `
    <div class="photo-thumb">
      <img src="${URL.createObjectURL(f)}" alt="ảnh ${i+1}">
      <button class="photo-remove" onclick="removePhoto(${i})">✕</button>
    </div>`).join('')
}

function removePhoto(i) {
  pendingPhotos.splice(i, 1)
  previewPhotos({ files: pendingPhotos })
}

async function saveProgress(taskId) {
  const pct     = parseInt(document.getElementById('upd-pct').value)
  const note    = document.getElementById('upd-note').value.trim()
  const task    = STATE.tasks.find(t => t.id === taskId)
  const now     = new Date()
  const today   = now.toISOString().slice(0,10)

  // Auto-compute TT dates (có thể bị override bởi input ngày thủ công)
  const ttStart = (task.tt_start && task.tt_start !== '') ? task.tt_start
                : (pct > 0 ? today : null)
  const ttEnd   = null  // sẽ được xử lý trong saveProgress theo role

  loading(true, 'Đang lưu tiến độ...')
  closeModal()

  try {
    // Save progress
    const qtyEl = document.getElementById('upd-qty')
  const actualQty = qtyEl ? parseFloat(qtyEl.value)||null : null

  // Admin/planner có thể chọn ngày thủ công
  const startInput  = document.getElementById('upd-tt-start-date')
  const finishInput = document.getElementById('upd-tt-finish-date')

  let finalStart = ttStart
  let finalEnd   = ttEnd

  if (STATE.role === 'planner' || STATE.role === 'admin') {
    // Planner/admin: dùng ngày từ input thủ công
    if (startInput?.value) finalStart = startInput.value
    if (finishInput?.value) {
      finalEnd = finishInput.value
    } else if (pct === 100) {
      // 100% nhưng không điền ngày hoàn thành → lấy ngày bắt đầu TT
      finalEnd = finalStart || today
    }
    // else: chưa xong, finalEnd = null (giữ nguyên)
  } else {
    // Updater: ngày hoàn toàn tự động
    // tt_start giữ nguyên nếu đã có, set hôm nay nếu lần đầu nhập
    finalStart = (task.tt_start && task.tt_start !== '') ? task.tt_start : (pct > 0 ? today : null)
    finalEnd   = pct === 100 ? today : null
  }

  const { error: progErr } = await sb.from('task_progress').insert({
      task_id:            taskId,
      project_id:         STATE.currentProject.id,
      tt_start:           finalStart,
      tt_finish:          finalEnd,
      pct_complete:       pct,
      actual_quantity:    actualQty,
      unit:               task.unit || '%',
      note,
      updated_by:         STATE.user.email,
      kh_start_snapshot:  task.kh_start,
      kh_finish_snapshot: task.kh_finish,
      week_number:        getISOWeek(now),
      year:               now.getFullYear(),
    })
    if (progErr) throw progErr

    // Upload photos
    if (pendingPhotos.length) {
      loading(true, `Đang upload ${pendingPhotos.length} ảnh...`)
      for (const file of pendingPhotos) {
        const ext  = file.name.split('.').pop()
        const path = `${STATE.currentProject.id}/${taskId}/${Date.now()}.${ext}`
        // Đọc file thành ArrayBuffer để upload raw binary, tránh multipart/form-data
        const arrayBuffer = await file.arrayBuffer()
        const { data: upData, error: upErr } = await sb.storage
          .from(CFG.STORAGE_BUCKET).upload(path, arrayBuffer, {
            upsert: true,
            contentType: file.type || 'image/jpeg',
          })
        if (upErr) { console.error('Upload error:', upErr); continue }

        // Lưu path thay vì URL — generate signed URL khi hiển thị
        const { data: urlData } = sb.storage.from(CFG.STORAGE_BUCKET).getPublicUrl(path)
        const photoUrl = urlData?.publicUrl || `${CFG.SUPABASE_URL}/storage/v1/object/public/${CFG.STORAGE_BUCKET}/${path}`
        await sb.from('task_photos').insert({
          task_id:       taskId,
          project_id:    STATE.currentProject.id,
          week_number:   getISOWeek(now),
          year:          now.getFullYear(),
          photo_url:     photoUrl,
          caption:       path,  // store path in caption for signed URL fallback
          uploaded_by:   STATE.user.email,
          taken_at:      now.toISOString().slice(0,10),
        })
      }
      pendingPhotos = []
    }

    await loadProjectData(STATE.currentProject.id)
    toast('Đã lưu tiến độ thành công!', 'success')
  } catch(e) {
    toast('Lỗi: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}

// ═══════════════════════════════════════════════════════════
// GANTT VIEW — đơn giản, layout giống WBS, 3 tab view
// ═══════════════════════════════════════════════════════════

let GANTT_VIEW = 'overview'
let GANTT_MONTH_OFFSET = 0
let GANTT_WEEK_OFFSET  = 0

function gantt() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700">Gantt — Tiến độ KH vs Thực tế</h2>
      <p style="font-size:13px;color:var(--gray4)">${STATE.currentProject?.name||''}</p>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary btn-sm" onclick="exportPDF()">📄 Xuất PDF</button>
      <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ In</button>
    </div>
  </div>

  <div class="gantt-view-tabs">
    <button class="gv-tab active" onclick="switchGanttView('overview',this)">📋 Tổng quan (theo quý)</button>
    <button class="gv-tab" onclick="switchGanttView('month',this)">📅 Theo tháng</button>
    <button class="gv-tab" onclick="switchGanttView('week',this)">🔍 Theo tuần</button>
  </div>

  <div class="gv-legend">
    <span class="gv-leg"><span class="gv-leg-box" style="background:#9DC3E6"></span>Kế hoạch (KH)</span>
    <span class="gv-leg"><span class="gv-leg-box" style="background:#A9D18E"></span>Thực tế — đúng/vượt</span>
    <span class="gv-leg"><span class="gv-leg-box" style="background:#F09595"></span>Thực tế — chậm</span>
    <span class="gv-leg"><span class="gv-leg-box" style="background:#D85A30;width:4px;height:14px;border-radius:1px"></span>Hôm nay (NOW)</span>
  </div>

  <div id="gantt-nav-row" style="display:none;justify-content:space-between;align-items:center;margin-bottom:8px">
    <button id="gantt-prev" onclick="ganttNav(-1)" style="padding:5px 14px;border:1px solid var(--gray2);border-radius:var(--radius);background:white;cursor:pointer;font-size:13px">‹ Trước</button>
    <span id="gantt-period-label" style="font-size:13px;font-weight:500"></span>
    <button id="gantt-next" onclick="ganttNav(1)" style="padding:5px 14px;border:1px solid var(--gray2);border-radius:var(--radius);background:white;cursor:pointer;font-size:13px">Sau ›</button>
  </div>

  <div id="gantt-content"></div>`
}

function switchGanttView(v, btn) {
  GANTT_VIEW = v
  GANTT_MONTH_OFFSET = 0
  GANTT_WEEK_OFFSET  = 0
  // Update tab active state
  document.querySelectorAll('.gv-tab').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  // Show/hide nav
  const nav = document.getElementById('gantt-nav-row')
  if (nav) nav.style.display = v !== 'overview' ? 'flex' : 'none'
  renderGantt()
}

function ganttNav(dir) {
  if (GANTT_VIEW === 'month') GANTT_MONTH_OFFSET += dir
  else GANTT_WEEK_OFFSET += dir
  renderGantt()
  // Update period label
  updateGanttNavLabel()
}

function updateGanttNavLabel() {
  const el = document.getElementById('gantt-period-label')
  if (!el) return
  const today = new Date()
  if (GANTT_VIEW === 'month') {
    const proj = STATE.currentProject
    const base = new Date(proj.start_date)
    const cur = new Date(base.getFullYear(), base.getMonth() + GANTT_MONTH_OFFSET, 1)
    const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
    el.textContent = `${months[cur.getMonth()]}–${months[(cur.getMonth()+2)%12]} / ${cur.getFullYear()}`
  } else {
    el.textContent = `Tuần ${getISOWeek(today) + GANTT_WEEK_OFFSET} (${GANTT_WEEK_OFFSET === 0 ? 'hiện tại' : GANTT_WEEK_OFFSET > 0 ? '+' + GANTT_WEEK_OFFSET + ' tuần' : GANTT_WEEK_OFFSET + ' tuần'})`
  }
}

function initGantt() {
  GANTT_VIEW = 'overview'
  GANTT_MONTH_OFFSET = 0
  GANTT_WEEK_OFFSET  = 0
  renderGantt()
}

function renderGantt() {
  const el = document.getElementById('gantt-content')
  if (!el) return
  if (!STATE.tasks.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray4)">Chưa có dữ liệu. Import MS Project trước.</div>'
    return
  }
  if (GANTT_VIEW === 'overview') renderGanttOverview(el)
  else if (GANTT_VIEW === 'month') renderGanttMonth(el)
  else renderGanttWeek(el)
  if (GANTT_VIEW !== 'overview') updateGanttNavLabel()
}

// ── HELPER: tính delay ────────────────────────────────────────────────────
function getGanttStatus(task) {
  const today   = new Date(); today.setHours(0,0,0,0)
  const khStart = task.kh_start  ? new Date(task.kh_start)  : null
  const khEnd   = task.kh_finish ? new Date(task.kh_finish) : null
  const pct     = task.display_pct !== undefined ? task.display_pct : (task.pct_complete||0)
  const hasUnit = task.unit && task.unit !== '%' && task.planned_quantity > 0

  if (pct === 100) return {status:'done', barClass:'ok'}

  // Summary: use rollup delay
  if (task.is_summary && task._delay !== undefined) {
    if (task._delay > 7)  return {status:'critical', barClass:'late'}
    if (task._delay > 0)  return {status:'delayed',  barClass:'late'}
    if (task._delay < 0)  return {status:'ahead',    barClass:'ahead'}
    return {status:'ok', barClass:'ok'}
  }

  if (!task.tt_start) {
    if (khStart && today > khStart) return {status:'not_started_late', barClass:'late'}
    return {status:'not_started', barClass:'ok'}
  }

  if (khEnd && today > khEnd && pct < 100) return {status:'late', barClass:'late'}

  if (!khStart || !khEnd) return {status:'ok', barClass:'ok'}

  const khDays      = Math.round((khEnd - khStart) / 86400000)
  const elapsedDays = Math.round((today - khStart) / 86400000)  // dùng KH start làm gốc
  if (khDays <= 0 || elapsedDays <= 0) return {status:'ok', barClass:'ok'}

  if (hasUnit && task.planned_quantity > 0) {
    const velocity    = task.planned_quantity / khDays
    const expectedQty = Math.round(velocity * Math.min(elapsedDays, khDays))
    const actQty      = (task.actual_quantity != null ? task.actual_quantity : 0)
    if (actQty < expectedQty * 0.9) return {status:'late', barClass:'late'}
  } else {
    const expectedPct = Math.min(100, Math.round(elapsedDays / khDays * 100))
    if (pct < expectedPct - 10) return {status:'late', barClass:'late'}
  }

  return {status:'ok', barClass:'ok'}
}

// ── Tam suất: tính lệch theo velocity ────────────────────────────────────
function calcProgressDetail(task) {
  // Summary tasks: use pre-computed rollup delay (max of children)
  if (task.is_summary && task._delayDetail !== undefined) {
    return task._delayDetail
  }
  const today   = new Date(); today.setHours(0,0,0,0)
  const khStart = task.kh_start  ? new Date(task.kh_start)  : null
  const khEnd   = task.kh_finish ? new Date(task.kh_finish) : null
  const ttFinish= task.tt_finish ? new Date(task.tt_finish) : null
  const pct     = task.display_pct !== undefined ? task.display_pct : (task.pct_complete||0)
  const hasUnit = task.unit && task.unit !== '%' && task.planned_quantity > 0
  const planQty = task.planned_quantity || 0
  const actQty  = (task.actual_quantity != null && task.actual_quantity !== undefined)
                  ? task.actual_quantity : 0   // fix undefined
  const khDays  = (khStart && khEnd) ? Math.round((khEnd - khStart) / 86400000) : 0

  // ── 1. Đã hoàn thành: so ngày TT xong vs KH xong ──────────────────────
  if (pct === 100 && ttFinish && khEnd) {
    const d = Math.round((ttFinish - khEnd) / 86400000)
    return {
      delayDays: d,
      label: d > 0  ? `Trễ ${d} ngày`
           : d < 0  ? `Hoàn thành sớm ${Math.abs(d)} ngày`
           : `Đúng KH`,
      done: true, hasUnit: false
    }
  }

  // ── 2. Chưa bắt đầu ────────────────────────────────────────────────────
  if (!task.tt_start) {
    // Nếu đã qua ngày KH bắt đầu mà chưa làm → tính số ngày trễ bắt đầu
    if (khStart && today > khStart) {
      const startDelay = Math.round((today - khStart) / 86400000)
      return { delayDays: startDelay, label: `Chưa BĐ · trễ ${startDelay} ngày`, done:false, hasUnit:false }
    }
    return { delayDays:null, label:'—', done:false, hasUnit:false }
  }

  if (!khStart || !khEnd || khDays <= 0)
    return { delayDays:null, label:'—', done:false, hasUnit:false }

  // ── 3. Đang thi công ────────────────────────────────────────────────────
  // Nếu tt_start < kh_start → bắt đầu sớm hơn KH
  const ttStartDate  = task.tt_start ? new Date(task.tt_start) : null
  const earlyStartDays = (ttStartDate && ttStartDate < khStart)
    ? Math.round((khStart - ttStartDate) / 86400000) : 0

  // elapsedDays tính từ KH start (gốc velocity), nhưng nếu bắt đầu sớm
  // thì kỳ vọng thực tế phải trừ đi số ngày sớm → kỳ vọng thấp hơn
  const elapsedDays = Math.round((today - khStart) / 86400000)

  // Nếu chưa đến ngày KH bắt đầu nhưng đã bắt đầu sớm
  if (elapsedDays <= 0 && earlyStartDays > 0) {
    // Đã bắt đầu trước KH, tính sớm theo số ngày đã làm trước KH
    const earlyElapsed = Math.round((today - ttStartDate) / 86400000)
    if (hasUnit && planQty > 0) {
      const velocity = planQty / khDays
      const earlyExpected = Math.round(velocity * earlyElapsed)
      const aheadQty  = Math.max(0, actQty - earlyExpected)
      const aheadDays = earlyStartDays + (aheadQty > 0 ? Math.round(aheadQty/velocity) : 0)
      return { delayDays: -aheadDays, aheadDays, aheadQty, unit: task.unit,
               label: `Sớm ${aheadDays} ngày${aheadQty>0?' · dư '+aheadQty+' '+task.unit:''}`,
               done:false, hasUnit:true }
    }
    return { delayDays: -earlyStartDays, aheadDays: earlyStartDays,
             label: `Bắt đầu sớm ${earlyStartDays} ngày`, done:false, hasUnit:false }
  }

  if (elapsedDays <= 0 && earlyStartDays === 0)
    return { delayDays:0, label:'Đúng KH', done:false, hasUnit:false }

  if (hasUnit && planQty > 0) {
    // ── Tam suất theo đơn vị (căn, m², m³...) ──────────────────────────
    const velocity    = planQty / khDays
    // Nếu bắt đầu sớm: tại thời điểm KH bắt đầu, task đã có earlyStartDays*velocity done
    const earlyBonus  = Math.round(velocity * earlyStartDays)
    const expectedQty = Math.max(0, Math.round(velocity * Math.min(elapsedDays, khDays)) - earlyBonus)
    const missingQty  = Math.max(0, expectedQty - actQty)
    const delayDays   = missingQty > 0 ? Math.round(missingQty / velocity) : 0

    let overrunDays = 0
    if (khEnd && today > khEnd && pct < 100) {
      overrunDays = Math.round((today - khEnd) / 86400000)
    }
    const totalDelay = Math.max(delayDays, overrunDays) - earlyStartDays

    // Tính buffer: dư so với kỳ vọng + bonus từ bắt đầu sớm
    const aheadQty  = Math.max(0, actQty - expectedQty)
    const aheadDays = aheadQty > 0
      ? Math.round(aheadQty / velocity) + earlyStartDays
      : earlyStartDays > 0 && missingQty === 0 ? earlyStartDays : 0

    return {
      delayDays:  totalDelay > 0 ? totalDelay : -aheadDays,
      missingQty: totalDelay > 0 ? missingQty : 0,
      aheadQty,
      aheadDays,
      unit: task.unit,
      label: totalDelay > 0
        ? `Trễ ${totalDelay} ngày · thiếu ${missingQty} ${task.unit}`
        : aheadDays > 0
        ? `Sớm ${aheadDays} ngày · dư ${aheadQty} ${task.unit}`
        : `Đúng KH`,
      done: false, hasUnit: true
    }
  } else {
    // ── Tam suất theo % ────────────────────────────────────────────────
    const velocityPct  = 100 / khDays
    const earlyBonusPct = velocityPct * earlyStartDays
    const expectedPct  = Math.max(0, Math.min(100, Math.round(velocityPct * Math.min(elapsedDays, khDays))) - Math.round(earlyBonusPct))
    const missingPct   = Math.max(0, expectedPct - pct)
    const delayDays    = missingPct > 0 ? Math.round(missingPct / velocityPct) : 0

    let overrunDays = 0
    if (khEnd && today > khEnd && pct < 100) {
      overrunDays = Math.round((today - khEnd) / 86400000)
    }
    const totalDelay = Math.max(delayDays, overrunDays) - earlyStartDays

    // Buffer % + bonus từ bắt đầu sớm
    const aheadPct  = Math.max(0, pct - expectedPct)
    const aheadDays = aheadPct > 0
      ? Math.round(aheadPct / velocityPct) + earlyStartDays
      : earlyStartDays > 0 && missingPct === 0 ? earlyStartDays : 0

    return {
      delayDays:  totalDelay > 0 ? totalDelay : -aheadDays,
      missingPct: totalDelay > 0 ? missingPct : 0,
      aheadPct,
      aheadDays,
      label: totalDelay > 0
        ? `Trễ ${totalDelay} ngày · thiếu ${missingPct}%`
        : aheadDays > 0
        ? `Sớm ${aheadDays} ngày · dư ${aheadPct}%`
        : `Đúng KH`,
      done: false, hasUnit: false
    }
  }
}

function calcDelayDays(task) {
  return calcProgressDetail(task).delayDays
}

// Tính timeline thực tế từ task (bỏ qua project.start/finish_date từ XML)
function getActualTimeline(tasks) {
  const dates = []
  tasks.forEach(t => {
    if (t.kh_start)  dates.push(new Date(t.kh_start))
    if (t.kh_finish) dates.push(new Date(t.kh_finish))
  })
  if (!dates.length) return null
  const minD = new Date(Math.min(...dates))
  const maxD = new Date(Math.max(...dates))
  // Add 5% padding on each side
  const total = maxD - minD
  const pad = Math.max(total * 0.02, 7 * 86400000) // min 7 days padding
  return {
    start: new Date(minD.getTime() - pad),
    end:   new Date(maxD.getTime() + pad),
    days:  Math.round((new Date(maxD.getTime() + pad) - new Date(minD.getTime() - pad)) / 86400000)
  }
}

function dateToPct(date, rangeStart, rangeDays) {
  if (!date) return null
  const d = new Date(date); d.setHours(0,0,0,0)
  const offset = Math.round((d - rangeStart)/86400000)
  return Math.max(0, Math.min(100, offset/rangeDays*100))
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 1: TỔNG QUAN — tất cả task, scroll dọc, layout giống WBS
// ══════════════════════════════════════════════════════════════════════════
function renderGanttOverview(el) {
  const proj = STATE.currentProject
  // Dùng timeline thực tế từ task thay vì project.start/finish_date từ XML
  const tl = getActualTimeline(STATE.tasks)
  if (!tl) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray4)">Không có dữ liệu</div>'; return }
  const rangeStart = tl.start
  const rangeEnd   = tl.end
  const rangeDays  = tl.days
  const today      = new Date(); today.setHours(0,0,0,0)
  const nowPct     = dateToPct(today, rangeStart, rangeDays)

  // Quarter labels — chỉ hiện các quý trong phạm vi thực tế
  const quarters = []
  let cur = new Date(rangeStart.getFullYear(), Math.floor(rangeStart.getMonth()/3)*3, 1)
  while (cur <= rangeEnd) {
    const qPct = dateToPct(cur, rangeStart, rangeDays)
    if (qPct >= 0 && qPct <= 100) quarters.push({ label: `Q${Math.floor(cur.getMonth()/3)+1} ${cur.getFullYear()}`, pct: qPct })
    cur = new Date(cur.getFullYear(), cur.getMonth()+3, 1)
  }

  const NAME_W = 340, PCT_W = 55, DELAY_W = 110

  // Build childMap for collapse logic
  const _childMap = {}
  STATE.tasks.forEach(t => {
    if (!t.wbs_code) return
    const parts = t.wbs_code.split('.')
    if (parts.length > 1) {
      const parentWbs = parts.slice(0,-1).join('.')
      if (!_childMap[parentWbs]) _childMap[parentWbs] = []
      _childMap[parentWbs].push(t.wbs_code)
    }
  })
  // Default: collapse level >= 4
  const _collapsed = new Set(
    STATE.tasks.filter(t => t.is_summary && t.outline_level >= 4).map(t => t.wbs_code)
  )


  let rows = ''
  STATE.tasks.forEach(t => {
    const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
    const {barClass} = getGanttStatus(t)
    const detail = calcProgressDetail(t)
    const delay = detail.delayDays
    const delayLabel = detail.label
    const delayColor = delay > 0 ? '#A32D2D' : delay < 0 ? '#0D6E4E' : 'var(--gray4)'

    const khL = dateToPct(t.kh_start, rangeStart, rangeDays)
    const khR = dateToPct(t.kh_finish, rangeStart, rangeDays)
    const khW = Math.max(0.3, (khR||0) - (khL||0))
    const ttL = t.tt_start ? dateToPct(t.tt_start, rangeStart, rangeDays) : null
    const ttR = t.tt_finish ? dateToPct(t.tt_finish, rangeStart, rangeDays)
                : (t.tt_start ? Math.min(100, dateToPct(today, rangeStart, rangeDays)) : null)
    const ttW = ttR !== null ? Math.max(0.3, ttR - ttL) : 0

    const indent = (t.outline_level-1)*14
    const pctBg = pct===100?'#DCFCE7':barClass==='late'?'#FEE2E2':pct===0?'var(--gray1)':'#DBEAFE'
    const pctFg = pct===100?'#166534':barClass==='late'?'#991B1B':pct===0?'var(--gray4)':'#1E40AF'
    const rowBg = t.is_summary ? '#F8FAFC' : 'white'
    const fw = t.outline_level <= 1 ? 700 : t.outline_level <= 2 ? 600 : t.is_summary ? 500 : 400
    const fs = t.outline_level <= 1 ? 13 : 12

    const _hasCh = !!_childMap[t.wbs_code]
    const _isColl = _collapsed.has(t.wbs_code)
    // Check if ancestor collapsed
    const _parts = (t.wbs_code||'').split('.')
    const _hidden = _parts.some((_,i) => {
      if (i===_parts.length-1) return false
      return _collapsed.has(_parts.slice(0,i+1).join('.'))
    })
    const _icon = _hasCh ? (_isColl ? '▶' : '▼') : ''

    rows += `<div class="gv-row" data-wbs="${t.wbs_code}" data-level="${t.outline_level}"
      style="min-height:${t.is_summary?28:24}px;background:${rowBg};${_hidden?'display:none':''}"
      onclick="${_hasCh ? `ganttToggleRow(this,'${t.wbs_code}')` : `openUpdateModal('${t.id}')`}"
      >
      <div class="gv-cell-name" style="width:${NAME_W}px;padding-left:${6+indent}px;font-weight:${fw};font-size:${fs}px;white-space:normal;line-height:1.4;padding-top:5px;padding-bottom:5px;display:flex;align-items:flex-start;gap:3px;cursor:${_hasCh?'pointer':'default'}" title="${t.name.replace(/"/g,"'")}">
        <span style="flex-shrink:0;width:12px;font-size:10px;margin-top:2px;color:var(--gray4)">${_icon}</span>
        <span>${t.name}</span>
      </div>
      <div class="gv-cell-small" style="width:${PCT_W}px">
        <span style="font-size:11px;font-weight:600;padding:1px 5px;border-radius:6px;background:${pctBg};color:${pctFg}">${pct}%</span>
      </div>
      <div class="gv-bars-cell">
        ${khL!==null?`<div class="gv-bar kh" style="left:${khL.toFixed(1)}%;width:${khW.toFixed(1)}%"></div>`:''}
        ${ttL!==null&&ttW>0?`<div class="gv-bar ${barClass}" style="left:${ttL.toFixed(1)}%;width:${ttW.toFixed(1)}%"></div>`:''}
        <div class="gv-now" style="left:${nowPct.toFixed(1)}%"></div>
        ${delay>0&&nowPct>=0&&nowPct<=100?`<span class="gv-delay-tag late" style="left:${Math.min(93,nowPct+0.5).toFixed(1)}%;top:12px">+${delay}d</span>`:''}
      </div>
      <div class="gv-cell-small" style="width:${DELAY_W}px;font-size:11px;font-weight:600;color:${delayColor};text-align:center">${delayLabel}</div>
    </div>`
  })

  el.innerHTML = `
  <div style="font-size:11px;color:var(--gray4);margin-bottom:6px">
    ${fmtDate(proj.start_date)} → ${fmtDate(proj.finish_date)} · ${rangeDays} ngày · ${STATE.tasks.length} công tác
  </div>
  <div class="gv-wrap">
    <div class="gv-head">
      <div class="gv-col-name" style="width:${NAME_W}px">Hạng mục / Công tác</div>
      <div class="gv-col-small" style="width:${PCT_W}px">% HT</div>
      <div class="gv-timeline-head" style="position:relative;overflow:hidden">
        ${quarters.map(q=>`<div class="gv-period" style="left:${q.pct.toFixed(1)}%;min-width:60px">${q.label}</div>`).join('')}
        <div class="gv-now" style="left:${nowPct.toFixed(1)}%">
          <div style="position:absolute;top:2px;left:3px;font-size:9px;color:#D85A30;font-weight:600">NOW</div>
        </div>
      </div>
      <div class="gv-col-small" style="width:${DELAY_W}px">Lệch tiến độ</div>
    </div>
    <div style="overflow-y:auto;max-height:calc(100vh - 340px)">${rows}</div>
  </div>`
}

// ── Toggle collapse/expand hàng Gantt ────────────────────────────────────
function ganttToggleRow(rowEl, wbsCode) {
  const container = rowEl.parentElement
  const allRows = container.querySelectorAll('.gv-row')
  const isNowCollapsed = rowEl.querySelector('span')?.textContent?.trim() === '▶'

  // Toggle icon
  const iconEl = rowEl.querySelector('span:first-child')
  if (iconEl) iconEl.textContent = isNowCollapsed ? '▼' : '▶'

  // Show/hide children
  allRows.forEach(r => {
    const rWbs = r.dataset.wbs
    if (!rWbs || rWbs === wbsCode) return
    if (rWbs.startsWith(wbsCode + '.')) {
      if (isNowCollapsed) {
        // Expand: only show direct children, keep deeper collapsed
        const rel = rWbs.slice(wbsCode.length + 1)
        if (!rel.includes('.')) {
          r.style.display = ''
        }
      } else {
        // Collapse all descendants
        r.style.display = 'none'
        // Reset their icons to collapsed
        const icon = r.querySelector('span:first-child')
        if (icon && (icon.textContent.trim() === '▼')) icon.textContent = '▶'
      }
    }
  })
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 2: THEO THÁNG
// ══════════════════════════════════════════════════════════════════════════
function renderGanttMonth(el) {
  const proj = STATE.currentProject
  // Dùng ngày task sớm nhất làm gốc (không phải project.start_date)
  const tl2 = getActualTimeline(STATE.tasks)
  const projStart = tl2 ? tl2.start : new Date(proj.start_date)
  const today = new Date(); today.setHours(0,0,0,0)

  const winStart = new Date(projStart.getFullYear(), projStart.getMonth() + GANTT_MONTH_OFFSET, 1)
  const winEnd   = new Date(winStart.getFullYear(), winStart.getMonth()+3, 0)
  const rangeDays = Math.round((winEnd - winStart)/86400000) + 1
  const nowPct    = dateToPct(today, winStart, rangeDays)

  const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
  const m0 = winStart.getMonth(), y0 = winStart.getFullYear()
  const periods = [0,1,2].map(i => {
    const m = (m0+i)%12, y = y0 + Math.floor((m0+i)/12)
    const ms = new Date(y, m, 1)
    return { label: `${months[m]}/${y}`, leftPct: dateToPct(ms, winStart, rangeDays), widthPct: new Date(y,m+1,0).getDate()/rangeDays*100 }
  })

  const tasks = STATE.tasks.filter(t => {
    if (!t.kh_start || !t.kh_finish) return false
    const s = new Date(t.kh_start), e = new Date(t.kh_finish)
    const inWin = s <= winEnd && e >= winStart
    const overdue = t.tt_start && (t.pct_complete||0) < 100 && e < winStart
    return inWin || overdue
  }).sort((a,b) => {
    const aO = a.tt_start && (a.pct_complete||0)<100 && new Date(a.kh_finish)<winStart
    const bO = b.tt_start && (b.pct_complete||0)<100 && new Date(b.kh_finish)<winStart
    if (aO&&!bO) return -1; if (!aO&&bO) return 1
    return new Date(a.kh_start)-new Date(b.kh_start)
  }).slice(0,50)

  const NAME_W=260, PCT_W=50, DELAY_W=110
  let rows = ''
  tasks.forEach(t => {
    const pct = t.pct_complete||0
    const {barClass} = getGanttStatus(t)
    const detail = calcProgressDetail(t)
    const delay = detail.delayDays
    const delayColor = delay>0?'#A32D2D':delay<0?'#3B6D11':'var(--gray4)'
    const indent = (t.outline_level-1)*12
    const isOverdue = t.tt_start && pct<100 && t.kh_finish && new Date(t.kh_finish)<winStart

    const khL = Math.max(0, dateToPct(t.kh_start, winStart, rangeDays)||0)
    const khR = Math.min(100, dateToPct(t.kh_finish, winStart, rangeDays)||0)
    const khW = Math.max(0.5, khR-khL)
    const ttL = t.tt_start ? Math.max(0, dateToPct(t.tt_start, winStart, rangeDays)) : null
    const ttRaw = t.tt_finish ? Math.min(100, dateToPct(t.tt_finish, winStart, rangeDays))
                : (t.tt_start ? Math.min(100, dateToPct(today, winStart, rangeDays)) : null)
    const ttW = ttRaw!==null ? Math.max(0.5, ttRaw-ttL) : 0
    const pctBg = pct===100?'#DCFCE7':barClass==='late'?'#FEE2E2':pct===0?'var(--gray1)':'#DBEAFE'
    const pctFg = pct===100?'#166534':barClass==='late'?'#991B1B':pct===0?'var(--gray4)':'#1E40AF'

    rows += `<div class="gv-row ${t.is_summary?'sum':''}" style="min-height:26px;cursor:pointer" onclick="${!t.is_summary?`openUpdateModal('${t.id}')`:''}" >
      <div class="gv-cell-name" style="width:${NAME_W}px;padding-left:${6+indent}px;font-weight:${t.is_summary?600:400};font-size:12px;display:flex;align-items:center;gap:4px" title="${t.name.replace(/"/g,"'")}">
        <span style="flex:1;white-space:normal;line-height:1.4">${t.name}</span>
        ${isOverdue?'<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#FEE2E2;color:#991B1B;flex-shrink:0;margin-top:2px">TRỄ</span>':''}
      </div>
      <div class="gv-cell-small" style="width:${PCT_W}px">
        <span style="font-size:11px;font-weight:600;padding:1px 5px;border-radius:6px;background:${pctBg};color:${pctFg}">${pct}%</span>
      </div>
      <div class="gv-bars-cell">
        ${khW>0?`<div class="gv-bar kh" style="left:${khL.toFixed(1)}%;width:${khW.toFixed(1)}%"></div>`:''}
        ${ttL!==null&&ttW>0?`<div class="gv-bar ${barClass}" style="left:${ttL.toFixed(1)}%;width:${ttW.toFixed(1)}%"></div>`:''}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"></div>`:''}
        ${delay>0&&nowPct>=0&&nowPct<=100?`<span class="gv-delay-tag late" style="left:${Math.min(92,nowPct+0.5).toFixed(1)}%;top:13px">${delay}d trễ</span>`:''}
      </div>
      <div class="gv-cell-small" style="width:${DELAY_W}px;font-size:11px;font-weight:600;color:${delayColor};text-align:center;white-space:normal;line-height:1.4">${detail.label}</div>
    </div>`
  })

  const periodLabel = `${months[m0]}–${months[(m0+2)%12]} / ${y0}`
  document.getElementById('gantt-period-label') && (document.getElementById('gantt-period-label').textContent = periodLabel)

  el.innerHTML = `
  <div class="gv-wrap">
    <div class="gv-head">
      <div class="gv-col-name" style="width:${NAME_W}px">Công tác</div>
      <div class="gv-col-small" style="width:${PCT_W}px">%</div>
      <div class="gv-timeline-head" style="position:relative;overflow:hidden">
        ${periods.map(p=>`<div class="gv-period" style="left:${p.leftPct.toFixed(1)}%;width:${p.widthPct.toFixed(1)}%">${p.label}</div>`).join('')}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"><div style="position:absolute;top:2px;left:3px;font-size:9px;color:#D85A30;font-weight:600">NOW</div></div>`:''}
      </div>
      <div class="gv-col-small" style="width:${DELAY_W}px">Lệch</div>
    </div>
    <div style="overflow-y:auto;max-height:calc(100vh - 380px)">${rows || '<div style="padding:30px;text-align:center;color:var(--gray4)">Không có công tác trong khoảng này</div>'}</div>
  </div>
  <div style="font-size:11px;color:var(--gray4);margin-top:6px;text-align:center">Click vào công tác để cập nhật tiến độ</div>`
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 3: THEO TUẦN
// ══════════════════════════════════════════════════════════════════════════
function renderGanttWeek(el) {
  const today = new Date(); today.setHours(0,0,0,0)
  const monday = new Date(today)
  monday.setDate(today.getDate() - (today.getDay()||7)+1 + GANTT_WEEK_OFFSET*7 - 14)
  const winStart = monday
  const winEnd   = new Date(monday); winEnd.setDate(monday.getDate()+41)
  const rangeDays = 42
  const nowPct   = dateToPct(today, winStart, rangeDays)

  const weekLabels = Array.from({length:6},(_,i) => {
    const ws = new Date(winStart); ws.setDate(winStart.getDate()+i*7)
    return { label:`T.${getISOWeek(ws)}
${ws.getDate()}/${ws.getMonth()+1}`, left:i/6*100 }
  })

  const tasks = STATE.tasks.filter(t => {
    if (!t.kh_start || !t.kh_finish || t.is_summary) return false
    const s = new Date(t.kh_start), e = new Date(t.kh_finish)
    const inWin = s <= winEnd && e >= winStart
    const overdue = t.tt_start && (t.pct_complete||0) < 100 && e < winStart
    return inWin || overdue
  }).sort((a,b) => {
    const aO = a.tt_start&&(a.pct_complete||0)<100&&new Date(a.kh_finish)<winStart
    const bO = b.tt_start&&(b.pct_complete||0)<100&&new Date(b.kh_finish)<winStart
    if(aO&&!bO) return -1; if(!aO&&bO) return 1
    return new Date(a.kh_start)-new Date(b.kh_start)
  }).slice(0,40)

  const winLabel = `Tuần ${getISOWeek(winStart)}–${getISOWeek(winEnd)} / ${winStart.getFullYear()}`
  document.getElementById('gantt-period-label') && (document.getElementById('gantt-period-label').textContent = winLabel)

  const NAME_W=240, PCT_W=50, DELAY_W=110
  let rows = ''
  tasks.forEach(t => {
    const pct = t.pct_complete||0
    const {barClass} = getGanttStatus(t)
    const detail = calcProgressDetail(t)
    const delay = detail.delayDays
    const delayColor = delay>0?'#A32D2D':delay<0?'#3B6D11':'var(--gray4)'
    const isOverdue = t.tt_start && pct<100 && t.kh_finish && new Date(t.kh_finish)<winStart

    const khL = Math.max(0, dateToPct(t.kh_start, winStart, rangeDays)||0)
    const khR = Math.min(100, dateToPct(t.kh_finish, winStart, rangeDays)||0)
    const khW = Math.max(0.5, khR-khL)
    const ttL = t.tt_start ? Math.max(0, dateToPct(t.tt_start, winStart, rangeDays)) : null
    const ttRaw = t.tt_finish ? Math.min(100, dateToPct(t.tt_finish, winStart, rangeDays))
                : (t.tt_start ? Math.min(100, dateToPct(today, winStart, rangeDays)) : null)
    const ttW = ttRaw!==null ? Math.max(0.5, ttRaw-ttL) : 0
    const pctBg = pct===100?'#DCFCE7':barClass==='late'?'#FEE2E2':pct===0?'var(--gray1)':'#DBEAFE'
    const pctFg = pct===100?'#166534':barClass==='late'?'#991B1B':pct===0?'var(--gray4)':'#1E40AF'

    rows += `<div class="gv-row" style="min-height:28px;cursor:pointer" onclick="openUpdateModal('${t.id}')">
      <div class="gv-cell-name" style="width:${NAME_W}px;font-size:12px;display:flex;align-items:center;gap:4px" title="${t.name.replace(/"/g,"'")}">
        <span style="flex:1;white-space:normal;line-height:1.4">${t.name}</span>
        ${isOverdue?'<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#FEE2E2;color:#991B1B;flex-shrink:0;margin-top:2px">TRỄ</span>':''}
      </div>
      <div class="gv-cell-small" style="width:${PCT_W}px">
        <span style="font-size:11px;font-weight:600;padding:1px 5px;border-radius:6px;background:${pctBg};color:${pctFg}">${pct}%</span>
      </div>
      <div class="gv-bars-cell">
        ${khW>0?`<div class="gv-bar kh" style="left:${khL.toFixed(1)}%;width:${khW.toFixed(1)}%"></div>`:''}
        ${ttL!==null&&ttW>0?`<div class="gv-bar ${barClass}" style="left:${ttL.toFixed(1)}%;width:${ttW.toFixed(1)}%"></div>`:''}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"></div>`:''}
        ${delay>0&&nowPct>=0&&nowPct<=100?`<span class="gv-delay-tag late" style="left:${Math.min(90,nowPct+0.5).toFixed(1)}%;top:14px">${delay}d trễ</span>`:''}
      </div>
      <div class="gv-cell-small" style="width:${DELAY_W}px;font-size:11px;font-weight:600;color:${delayColor};text-align:center;white-space:normal;line-height:1.4">${detail.label}</div>
    </div>`
  })

  el.innerHTML = `
  <div class="gv-wrap">
    <div class="gv-head">
      <div class="gv-col-name" style="width:${NAME_W}px">Công tác</div>
      <div class="gv-col-small" style="width:${PCT_W}px">%</div>
      <div class="gv-timeline-head" style="position:relative;overflow:hidden;min-height:40px">
        ${weekLabels.map(w=>`<div class="gv-period" style="left:${w.left.toFixed(1)}%;width:16.67%;white-space:pre;flex-direction:column;font-size:9px">${w.label}</div>`).join('')}
        ${nowPct>=0&&nowPct<=100?`<div class="gv-now" style="left:${nowPct.toFixed(1)}%"><div style="position:absolute;bottom:2px;left:3px;font-size:9px;color:#D85A30;font-weight:600">NOW</div></div>`:''}
      </div>
      <div class="gv-col-small" style="width:${DELAY_W}px">Lệch tiến độ</div>
    </div>
    <div style="overflow-y:auto;max-height:calc(100vh - 380px)">${rows || '<div style="padding:30px;text-align:center;color:var(--gray4)">Không có công tác trong 6 tuần này</div>'}</div>
  </div>
  <div style="font-size:11px;color:var(--gray4);margin-top:6px;text-align:center">Click vào công tác để cập nhật tiến độ trực tiếp</div>`
}


// ═══════════════════════════════════════════════════════════
// EXPORT WEEKLY REPORT (text-based)
// ═══════════════════════════════════════════════════════════
async function exportWeeklyReport() {
  const LOGO_URL = 'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png'
  const proj = STATE.currentProject
  if (!proj) { toast('Chưa có dự án', 'error'); return }

  const week = getISOWeek(new Date())
  const year = new Date().getFullYear()
  const { data: aiData } = await sb.from('ai_summaries')
    .select('*').eq('project_id', proj.id)
    .eq('week_number', week).eq('year', year)
    .order('created_at', { ascending: false }).limit(1)
  const aiSummary = aiData?.[0]?.summary_text || null

  if (!aiSummary) {
    toast('Chưa có AI tóm tắt tuần này. Hãy bấm "🤖 AI Tóm tắt" trước.', 'error')
    return
  }

  loading(true, 'Đang tạo PDF báo cáo tuần...')
  try {
    const tasks   = STATE.tasks
    const leaf    = tasks.filter(t => !t.is_summary)
    const done    = leaf.filter(t => (t.pct_complete||0) === 100)
    const inProg  = leaf.filter(t => t.tt_start && (t.pct_complete||0) < 100)
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalPct = rootTask ? (rootTask.display_pct||rootTask.pct_complete||0) : 0
    const today   = new Date().toLocaleDateString('vi-VN')

    // Build level 3 table rows
    const lvl3 = tasks.filter(t => t.is_summary && t.outline_level <= 3)  // level 1-2-3
    const tableRows = lvl3.map(t => {
      const pct   = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const delay = t._delay || 0
      const isLate  = delay > 0 && delay < 365
      const isAhead = delay < 0
      const statusStr = isLate  ? `<span style="color:#DC2626;font-weight:600">Trễ ${delay}d</span>`
                       : isAhead ? `<span style="color:#16A34A;font-weight:600">Sớm ${Math.abs(delay)}d</span>`
                       : '<span style="color:#64748B">Đúng KH</span>'
      const indent = (t.outline_level - 1) * 14
      const rowBg = isLate ? '#FEF2F2' : t.outline_level === 1 ? '#EFF6FF' : t.outline_level === 2 ? '#F8FAFC' : '#FFFFFF'
      const fw = t.outline_level <= 2 ? '600' : '400'
      const khStart = t.kh_start ? t.kh_start.slice(5).replace('-','/') : '--'
      const khEnd   = t.kh_finish ? t.kh_finish.slice(5).replace('-','/') : '--'
      const pctColor = pct === 100 ? '#16A34A' : isLate ? '#DC2626' : '#1E293B'
      return `<tr style="background:${rowBg};border-bottom:0.5px solid #E2E8F0">
        <td style="padding:4px 6px;padding-left:${indent+6}px;font-weight:${fw};font-size:10px;max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</td>
        <td style="padding:4px 6px;font-size:9px;color:#64748B;text-align:center">${khStart}</td>
        <td style="padding:4px 6px;font-size:9px;color:#64748B;text-align:center">${khEnd}</td>
        <td style="padding:4px 6px;font-size:10px;font-weight:600;color:${pctColor};text-align:center">${pct}%</td>
        <td style="padding:4px 6px;font-size:9px;text-align:center">${statusStr}</td>
      </tr>`
    }).join('')

    // Build Gantt mini rows
    const tl = getActualTimeline(tasks)
    let ganttHtml = ''
    if (tl) {
      const rangeMs = tl.end - tl.start
      const todayD = new Date(); todayD.setHours(0,0,0,0)
      const nowPct = Math.max(0, Math.min(100, Math.round((todayD - tl.start) / rangeMs * 100)))
      // Quarter labels
      const quarters = []
      let qc = new Date(tl.start.getFullYear(), Math.floor(tl.start.getMonth()/3)*3, 1)
      while (qc <= tl.end) {
        const pct2 = Math.max(0, Math.min(98, Math.round((qc - tl.start) / rangeMs * 100)))
        quarters.push(`<span style="position:absolute;left:${pct2}%;font-size:8px;color:rgba(255,255,255,0.8);white-space:nowrap">Q${Math.floor(qc.getMonth()/3)+1}/${qc.getFullYear()}</span>`)
        qc = new Date(qc.getFullYear(), qc.getMonth()+3, 1)
      }
      ganttHtml = `
        <div style="display:flex;align-items:center;background:#1A2B4A;color:white;font-size:9px;padding:5px 8px;border-radius:4px 4px 0 0;position:relative;height:20px">
          <div style="width:180px;flex-shrink:0;font-weight:600">Hạng mục</div>
          <div style="flex:1;position:relative">${quarters.join('')}
            <div style="position:absolute;top:-4px;bottom:-4px;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div>
          </div>
          <div style="width:70px;text-align:center;font-weight:600">Lệch</div>
        </div>`
      const ganttTasks = tasks.filter(t => t.is_summary && t.outline_level <= 3 && t.kh_start)
      ganttTasks.forEach((t, idx) => {
        const khL = Math.max(0,Math.min(100,Math.round((new Date(t.kh_start)-tl.start)/rangeMs*100)))
        const khR = Math.max(0,Math.min(100,Math.round((new Date(t.kh_finish||t.kh_start)-tl.start)/rangeMs*100)))
        const khW = Math.max(1, khR-khL)
        let ttBar = ''
        if (t.tt_start) {
          const ttL = Math.max(0,Math.min(100,Math.round((new Date(t.tt_start)-tl.start)/rangeMs*100)))
          const ttEnd = t.tt_finish ? new Date(t.tt_finish) : todayD
          const ttR = Math.max(0,Math.min(100,Math.round((ttEnd-tl.start)/rangeMs*100)))
          const ttW = Math.max(1,ttR-ttL)
          const ttClr = (t._delay||0) > 0 ? '#FCA5A5' : '#86EFAC'
          ttBar = `<div style="position:absolute;height:6px;top:13px;left:${ttL}%;width:${ttW}%;background:${ttClr};border-radius:2px"></div>`
        }
        const delay = t._delay||0
        const isLate2 = delay > 0 && delay < 365
        const isAhead2 = delay < 0
        const dlyClr = isLate2 ? '#DC2626' : isAhead2 ? '#16A34A' : '#64748B'
        const dlyTxt = isLate2 ? `+${delay}d` : isAhead2 ? `${delay}d` : '—'
        const rowBg2 = idx%2===0 ? '#F8FAFC' : '#FFFFFF'
        const fw2 = t.outline_level === 1 ? '700' : t.outline_level === 2 ? '600' : '400'
        const gIndent = (t.outline_level - 1) * 10
        ganttHtml += `<div style="display:flex;align-items:center;background:${rowBg2};border-bottom:0.5px solid #E2E8F0;height:22px">
          <div style="width:180px;flex-shrink:0;font-size:${t.outline_level===3?'8':'9'}px;font-weight:${fw2};padding:0 6px;padding-left:${6+gIndent}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</div>
          <div style="flex:1;position:relative;height:100%">
            <div style="position:absolute;height:6px;top:3px;left:${khL}%;width:${khW}%;background:#93C5FD;border-radius:2px"></div>
            ${ttBar}
            <div style="position:absolute;top:0;bottom:0;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div>
          </div>
          <div style="width:70px;font-size:9px;font-weight:600;color:${dlyClr};text-align:center">${dlyTxt}</div>
        </div>`
      })
    }

    // Parse AI content to HTML
    const aiHtml = aiSummary.split('\n').map(line => {
      if (!line.trim()) return '<div style="height:6px"></div>'
      const clean = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').trim()
      if (line.startsWith('## ') || line.startsWith('# ')) {
        const heading = clean.replace(/^#+\s*/, '')
        return `<div style="margin:12px 0 6px;padding:5px 10px;background:#EFF6FF;border-left:3px solid #2563EB;border-radius:0 4px 4px 0;font-weight:700;font-size:11px;color:#1E3A8A">${heading}</div>`
      }
      return `<div style="font-size:10px;line-height:1.7;color:#1E293B;margin:2px 0">${clean}</div>`
    }).join('')

    // Build full HTML
    const barW = Math.max(2, totalPct)
    const barClr = totalPct >= 70 ? '#16A34A' : totalPct >= 40 ? '#D97706' : '#DC2626'
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; }
  body { background: white; width: 794px; }
</style>
</head><body>
<div id="pdf-content" style="width:794px;background:white;padding:0">
  <!-- HEADER -->
  <div style="background:#1A2B4A;padding:16px 24px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${LOGO_URL}" style="height:44px;width:auto" crossorigin="anonymous" onerror="this.style.display='none'">
      <div>
        <div style="color:#F97316;font-size:9px;letter-spacing:0.08em;margin-top:2px">PHÒNG KTTC — VELAE&C</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="color:white;font-size:15px;font-weight:700">BÁO CÁO TIẾN ĐỘ THI CÔNG</div>
      <div style="color:rgba(255,255,255,0.8);font-size:10px;margin-top:3px">${proj.name}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:9px;margin-top:2px">Tuần ${week}/${year} &nbsp;|&nbsp; Ngày lập: ${today}</div>
    </div>
  </div>

  <div style="padding:16px 24px">
    <!-- METRICS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div style="background:#2563EB;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${leaf.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Tổng công tác</div>
      </div>
      <div style="background:#16A34A;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${done.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Hoàn thành</div>
      </div>
      <div style="background:#D97706;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${inProg.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Đang thi công</div>
      </div>
      <div style="background:#DC2626;border-radius:8px;padding:10px;text-align:center;color:white">
        <div style="font-size:22px;font-weight:700">${validLate.length}</div>
        <div style="font-size:9px;opacity:0.9;margin-top:2px">Chậm tiến độ</div>
      </div>
    </div>

    <!-- PROGRESS BAR -->
    <div style="margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:#1A2B4A;margin-bottom:5px">TIẾN ĐỘ TỔNG THỂ: ${totalPct}%</div>
      <div style="background:#E2E8F0;border-radius:99px;height:8px;overflow:hidden">
        <div style="background:${barClr};width:${barW}%;height:100%;border-radius:99px"></div>
      </div>
    </div>

    <!-- AI SUMMARY -->
    <div style="margin-bottom:16px">
      <div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;letter-spacing:0.04em">
        🤖 PHÂN TÍCH AI — TUẦN ${week}/${year}
      </div>
      <div style="border:0.5px solid #E2E8F0;border-top:none;padding:12px;border-radius:0 0 4px 4px;background:#FAFAFA">
        ${aiHtml}
      </div>
    </div>

    <!-- TABLE -->
    <div style="margin-bottom:16px">
      <div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
        📋 TIẾN ĐỘ THEO HẠNG MỤC
      </div>
      <table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0">
        <thead>
          <tr style="background:#1E3A5F;color:white">
            <th style="padding:5px 6px;font-size:9px;text-align:left;font-weight:600">Hạng mục / Công tác</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:46px;font-weight:600">KH BD</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:46px;font-weight:600">KH KT</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:40px;font-weight:600">% HT</th>
            <th style="padding:5px 6px;font-size:9px;text-align:center;width:80px;font-weight:600">Trạng thái</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <!-- GANTT -->
    <div>
      <div style="background:#1A2B4A;color:white;font-size:10px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">
        📅 SƠ ĐỒ GANTT TỔNG QUAN
      </div>
      <div style="border:0.5px solid #E2E8F0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">
        ${ganttHtml}
        <div style="padding:4px 8px;background:#F8FAFC;font-size:8px;color:#64748B;display:flex;gap:16px">
          <span><span style="display:inline-block;width:12px;height:6px;background:#93C5FD;border-radius:2px;vertical-align:middle;margin-right:3px"></span>KH</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:#86EFAC;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT đúng</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:#FCA5A5;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT trễ</span>
          <span><span style="display:inline-block;width:2px;height:10px;background:#F97316;vertical-align:middle;margin-right:3px"></span>Hôm nay</span>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:#F1F5F9;border-top:1px solid #E2E8F0;padding:8px 24px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:8px;color:#64748B">VelaE&C — Hệ thống theo dõi tiến độ thi công</span>
    <span style="font-size:8px;color:#64748B">Phát hành: Lê Trần Anh Toàn — 0978635450</span>
  </div>
</div>
</body></html>`

    // Render HTML → canvas → PDF using html2canvas
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;z-index:-1'
    container.innerHTML = htmlContent
    document.body.appendChild(container)

    // Wait for logo image to load
    const img = container.querySelector('img')
    if (img) {
      await new Promise(resolve => {
        if (img.complete) resolve()
        else { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 3000) }
      })
    }

    const canvas = await html2canvas(container.querySelector('#pdf-content'), {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: 794,
      logging: false
    })
    document.body.removeChild(container)

    const { jsPDF } = window.jspdf
    const pdfW = 210        // A4 width mm
    const pdfH = Math.round(canvas.height / canvas.width * pdfW)  // proportional height

    // Strategy: split at A4 boundaries but only at row boundaries
    // Use full-height custom page to avoid cutting rows
    const A4H = 297
    const imgData = canvas.toDataURL('image/jpeg', 0.93)

    if (pdfH <= A4H * 1.15) {
      // Short enough — single A4 page, scale to fit
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const scale = Math.min(1, A4H / pdfH)
      const drawH = pdfH * scale
      const drawW = pdfW * scale
      const offsetX = (pdfW - drawW) / 2
      pdf.addImage(imgData, 'JPEG', offsetX, 0, drawW, drawH)
      const fn = 'BC-TD_' + proj.code.replace(/[^a-zA-Z0-9]/g, '_') + '_Tuan' + week + '_' + year + '.pdf'
      pdf.save(fn)
    } else {
      // Multi-page: use custom page height = full content (no cutting)
      // Split into A4-sized slices by pixel rows
      const pdf = new jsPDF({ unit: 'mm', format: [pdfW, A4H] })
      const pxPerPage = Math.floor(canvas.height * A4H / pdfH)  // pixels per A4 page
      const totalPages = Math.ceil(canvas.height / pxPerPage)

      for (let pg = 0; pg < totalPages; pg++) {
        if (pg > 0) pdf.addPage([pdfW, A4H])
        const srcY = pg * pxPerPage
        const srcH = Math.min(pxPerPage, canvas.height - srcY)
        const sliceH_mm = srcH / canvas.height * pdfH

        // Create slice canvas
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = srcH
        const ctx2 = slice.getContext('2d')
        ctx2.fillStyle = '#ffffff'
        ctx2.fillRect(0, 0, slice.width, slice.height)
        ctx2.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

        pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pdfW, sliceH_mm)
      }
      const fn = 'BC-TD_' + proj.code.replace(/[^a-zA-Z0-9]/g, '_') + '_Tuan' + week + '_' + year + '.pdf'
      pdf.save(fn)
    }
    toast('Đã xuất PDF: ' + fn, 'success')

  } catch(e) {
    toast('Lỗi xuất PDF: ' + e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
  }
}
// ═══════════════════════════════════════════════════════════
// LỊCH SỬ PROGRESS — xem, sửa, xóa
// ═══════════════════════════════════════════════════════════
async function showProgressHistory(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  loading(true, 'Đang tải lịch sử...')
  const { data: history, error } = await sb.from('task_progress')
    .select('*')
    .eq('task_id', taskId)
    .order('updated_at', { ascending: false })
  loading(false)

  if (error) { toast('Lỗi tải lịch sử: ' + error.message, 'error'); return }

  const isAdmin = ['admin','planner'].includes(STATE.role)

  const rows = history?.length ? history.map(h => `
    <tr>
      <td style="font-size:11px;color:var(--gray5)">${new Date(h.updated_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
      <td style="text-align:center;font-weight:600;color:var(--blue)">${h.actual_quantity != null ? h.actual_quantity + ' ' + (h.unit||'') : h.pct_complete + '%'}</td>
      <td style="text-align:center">${h.pct_complete}%</td>
      <td style="font-size:11px">${h.note||'—'}</td>
      <td style="font-size:11px;color:var(--gray4)">${h.updated_by?.split('@')[0]||'—'}</td>
      <td style="text-align:center">
        <button class="btn btn-secondary btn-sm" onclick="editProgress('${h.id}','${taskId}',${h.pct_complete},'${h.note||''}',${h.actual_quantity||'null'})">✏️</button>
        ${isAdmin ? `<button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteProgress('${h.id}','${taskId}')">🗑️</button>` : ''}
      </td>
    </tr>`) .join('')
  : '<tr><td colspan="6" style="text-align:center;color:var(--gray4);padding:20px">Chưa có lịch sử cập nhật</td></tr>'

  openModal(`📋 Lịch sử: ${task.name}`,`
    <div style="font-size:12px;color:var(--gray5);margin-bottom:12px">
      KH: ${fmtDate(task.kh_start)} → ${fmtDate(task.kh_finish)} · Đơn vị: ${task.unit||'%'} · KH: ${task.planned_quantity||'—'}
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" style="min-width:500px">
        <thead><tr>
          <th>Thời gian</th><th style="text-align:center">KL thực tế</th>
          <th style="text-align:center">%</th><th>Ghi chú</th>
          <th>Người nhập</th><th style="text-align:center">Thao tác</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--gray2)">
      <div style="font-size:12px;font-weight:600;color:var(--gray7);margin-bottom:8px">➕ Nhập tay override</div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <div class="form-label">% hoặc số lượng</div>
          <input type="number" id="manual-pct" min="0" max="100" placeholder="${task.unit !== '%' ? 'Số lượng' : '%'}"
            style="width:90px;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:14px;font-weight:600">
        </div>
        <div>
          <div class="form-label">Ghi chú</div>
          <input type="text" id="manual-note" placeholder="Lý do nhập tay..."
            style="width:200px;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:13px">
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveManualProgress('${taskId}')">💾 Lưu ngay</button>
      </div>
    </div>
  `,`<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
}

async function editProgress(progressId, taskId, curPct, curNote, curQty) {
  const newPct = prompt(`Sửa % hoàn thành (hiện tại: ${curPct}%):`, curPct)
  if (newPct === null) return
  const newNote = prompt('Sửa ghi chú:', curNote)
  if (newNote === null) return

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('task_progress')
    .update({ pct_complete: parseInt(newPct), note: newNote, updated_at: new Date().toISOString() })
    .eq('id', progressId)
  loading(false)

  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã cập nhật!', 'success')
  await loadProjectData(STATE.currentProject.id)
  showProgressHistory(taskId)
}

async function deleteProgress(progressId, taskId) {
  if (!confirm('Xóa bản ghi này? Thao tác không thể hoàn tác.')) return

  loading(true, 'Đang xóa...')
  const { error } = await sb.from('task_progress').delete().eq('id', progressId)
  loading(false)

  if (error) { toast('Lỗi xóa: ' + error.message, 'error'); return }
  toast('Đã xóa bản ghi!', 'success')
  await loadProjectData(STATE.currentProject.id)
  showProgressHistory(taskId)
}

async function saveManualProgress(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  const rawVal = parseFloat(document.getElementById('manual-pct').value)
  const note = document.getElementById('manual-note').value.trim() || 'Nhập tay'
  if (isNaN(rawVal)) { toast('Vui lòng nhập giá trị', 'error'); return }

  const now = new Date()
  const today = now.toISOString().slice(0,10)
  let pct, actualQty = null

  if (task.unit && task.unit !== '%' && task.planned_quantity) {
    actualQty = rawVal
    pct = Math.min(100, Math.round(rawVal / task.planned_quantity * 100))
  } else {
    pct = Math.min(100, Math.max(0, Math.round(rawVal)))
  }

  const ttStart = (task.tt_start && task.tt_start !== '') ? task.tt_start : (pct > 0 ? today : null)
  const ttEnd = pct === 100 ? today : null

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('task_progress').insert({
    task_id: taskId, project_id: STATE.currentProject.id,
    tt_start: ttStart, tt_finish: ttEnd,
    pct_complete: pct, actual_quantity: actualQty,
    unit: task.unit || '%', note,
    updated_by: STATE.user.email,
    kh_start_snapshot: task.kh_start, kh_finish_snapshot: task.kh_finish,
    week_number: getISOWeek(now), year: now.getFullYear(),
  })
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã lưu!', 'success')
  await loadProjectData(STATE.currentProject.id)
  showProgressHistory(taskId)
}

// ═══════════════════════════════════════════════════════════
// KEY TASK — Planner chọn driving task cho task cha
// ═══════════════════════════════════════════════════════════
async function openKeyTaskModal(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task || !task.is_summary) return

  // Find all descendants
  const children = STATE.tasks.filter(t =>
    t.wbs_code.startsWith(task.wbs_code + '.') && !t.is_summary
  )

  const curKeyTask = task.key_task_id
    ? STATE.tasks.find(t => t.id === task.key_task_id)
    : null

  openModal(`🔑 Key Task: ${task.name}`, `
    <div style="font-size:12px;color:var(--gray5);margin-bottom:14px">
      Chọn công tác con nào sẽ điều khiển % hoàn thành của "${task.name}".
      Nếu không chọn, hệ thống dùng trung bình có trọng số.
    </div>
    ${curKeyTask ? `<div style="padding:8px 12px;background:var(--lblue);border-radius:6px;font-size:12px;margin-bottom:12px">
      ✅ Key Task hiện tại: <strong>${curKeyTask.name}</strong>
    </div>` : ''}
    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--gray2);border-radius:8px">
      <div onclick="setKeyTask('${taskId}',null)"
        style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray2);font-size:13px;color:var(--gray5);display:flex;align-items:center;gap:8px"
        onmouseover="this.style.background='var(--gray1)'" onmouseout="this.style.background='white'">
        <span>⚖️</span> <em>Dùng trung bình có trọng số (mặc định)</em>
      </div>
      ${children.map(c => `
      <div onclick="setKeyTask('${taskId}','${c.id}')"
        style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray2);font-size:13px;display:flex;align-items:center;gap:8px;background:${c.id===curKeyTask?.id?'var(--lblue)':'white'}"
        onmouseover="this.style.background='var(--gray1)'" onmouseout="this.style.background='${c.id===curKeyTask?.id?'var(--lblue)':'white'}'">
        <span>${c.id === curKeyTask?.id ? '🔑' : '○'}</span>
        <div>
          <div style="font-weight:500">${c.name}</div>
          <div style="font-size:11px;color:var(--gray4)">${c.wbs_code} · ${c.pct_complete||0}% hoàn thành</div>
        </div>
      </div>`).join('')}
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
}

async function setKeyTask(parentId, keyTaskId) {
  loading(true, 'Đang lưu...')
  const { error } = await sb.from('tasks')
    .update({ key_task_id: keyTaskId }).eq('id', parentId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }

  // Update local state
  const task = STATE.tasks.find(t => t.id === parentId)
  if (task) task.key_task_id = keyTaskId

  toast(keyTaskId ? 'Đã set Key Task!' : 'Đã về trung bình mặc định', 'success')
  closeModal()
  STATE.tasks = computeRollupPct(STATE.tasks)
  navigate('wbs')
}

// ═══════════════════════════════════════════════════════════
// TASK SETTINGS — Planner set đơn vị + kế hoạch
// ═══════════════════════════════════════════════════════════
async function openTaskSettings(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId)
  if (!task) return

  openModal(`⚙️ Cài đặt: ${task.name}`, `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Đơn vị đo lường</label>
        <select class="form-input" id="ts-unit" onchange="document.getElementById('ts-unit-custom').style.display=this.value==='other'?'':'none'">
          ${['%','căn','m²','m³','m','cái','bộ','tấn','kg'].map(u =>
            `<option value="${u}" ${task.unit===u?'selected':''}>${u}</option>`
          ).join('')}
          <option value="other" ${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?'selected':''}>Khác...</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Khối lượng kế hoạch</label>
        <input class="form-input" type="number" id="ts-qty" placeholder="VD: 66"
          value="${task.planned_quantity||''}">
      </div>
    </div>
    <div class="form-group" id="ts-unit-custom" style="${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?'':'display:none'}">
      <label class="form-label">Đơn vị tùy chỉnh</label>
      <input class="form-input" type="text" id="ts-unit-text" placeholder="VD: chuyến, lượt..."
        value="${!['%','căn','m²','m³','m','cái','bộ','tấn','kg'].includes(task.unit)?task.unit||'':''}">
    </div>
    <div class="form-group">
      <label class="form-label">
        ${task.unit && task.unit !== '%' ? 'Đơn giá HĐ (VND/' + (task.unit||'đvt') + ')' : 'Tổng giá trị công tác (VND) — dùng cho tính sản lượng theo %'}
      </label>
      <input class="form-input" type="number" id="ts-unit-price"
        placeholder="${task.unit && task.unit !== '%' ? 'VD: 15000000' : 'VD: 500000000'}"
        value="${task.unit_price||''}"
        style="font-size:14px;font-weight:500">
      ${task.unit_price && task.planned_quantity && task.unit !== '%'
        ? '<div style="font-size:11px;color:var(--gray4);margin-top:4px">Tổng giá trị: <strong>' + ((task.unit_price * task.planned_quantity)/1e9).toFixed(3) + ' tỷ</strong></div>'
        : task.unit_price && task.unit === '%'
        ? '<div style="font-size:11px;color:var(--gray4);margin-top:4px">Giá trị công tác: <strong>' + (task.unit_price/1e9).toFixed(3) + ' tỷ</strong></div>'
        : ''}
    </div>

    ${task.is_summary ? `
    <div style="margin-top:4px;padding:10px;background:var(--lblue);border-radius:6px;font-size:12px;color:var(--gray6)">
      💡 Task này là hạng mục cha — bạn cũng có thể <a href="#" onclick="closeModal();openKeyTaskModal('${taskId}');return false" style="color:var(--blue)">chọn Key Task</a> để điều khiển tiến độ.
    </div>` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveTaskSettings('${taskId}')">💾 Lưu</button>
  `)
}

async function saveTaskSettings(taskId) {
  const unitSel = document.getElementById('ts-unit').value
  const unit = unitSel === 'other'
    ? (document.getElementById('ts-unit-text').value.trim() || '%')
    : unitSel
  const planned_quantity = parseFloat(document.getElementById('ts-qty').value) || null
  const unit_price = parseFloat(document.getElementById('ts-unit-price').value) || null

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('tasks')
    .update({ unit, planned_quantity, unit_price }).eq('id', taskId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }

  const task = STATE.tasks.find(t => t.id === taskId)
  if (task) { task.unit = unit; task.planned_quantity = planned_quantity; task.unit_price = unit_price }
  toast('Đã lưu cài đặt!', 'success')
  closeModal()
  navigate('wbs')
}

// ═══════════════════════════════════════════════════════════
// PAGE: THANH TOÁN — nhập tiền nhận về theo dự án
// ═══════════════════════════════════════════════════════════
function paymentPage() {
  const projOptions = STATE.projects.map(p =>
    '<option value="' + p.id + '" ' + (p.id === STATE.currentProject?.id ? 'selected' : '') + '>'
    + p.code + ' — ' + p.name.slice(0,30) + '</option>'
  ).join('')

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <h2 style="font-size:18px;font-weight:700">💰 Theo dõi Thanh toán</h2>
      <p style="font-size:13px;color:var(--gray4)">Ghi nhận tiền nhận từ CĐT theo từng đợt</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select class="form-input" id="pay-proj-select" style="width:220px" onchange="loadPaymentData()">
        ${projOptions}
      </select>
      <button class="btn btn-primary btn-sm" onclick="openAddPaymentModal()">➕ Thêm đợt</button>
    </div>
  </div>

  <!-- Contract value setup -->
  <div class="card" style="padding:14px 18px;margin-bottom:16px" id="pay-contract-card">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--gray8)">Giá trị Hợp đồng</div>
        <div style="font-size:11px;color:var(--gray4);margin-top:2px">Nhập 1 lần khi setup dự án</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div id="pay-contract-display" style="font-size:18px;font-weight:700;color:var(--navy)">—</div>
        <button class="btn btn-secondary btn-sm" onclick="openContractValueModal()">✏️ Sửa</button>
      </div>
    </div>
    <div id="pay-summary-bar" style="margin-top:12px"></div>
  </div>

  <!-- Payment records table -->
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:14px 16px;border-bottom:1px solid var(--gray2);display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:13px;font-weight:600;color:var(--gray8)">Các đợt thanh toán</div>
      <div id="pay-total-badge" style="font-size:12px;color:var(--gray5)"></div>
    </div>
    <div id="pay-records-wrap">
      <div style="padding:30px;text-align:center;color:var(--gray4)">Đang tải...</div>
    </div>
  </div>`
}

async function initPayment() {
  await loadPaymentData()
}

async function loadPaymentData() {
  const sel = document.getElementById('pay-proj-select')
  const projId = sel ? sel.value : STATE.currentProject?.id
  if (!projId) return

  const proj = STATE.projects.find(p => p.id === projId)

  // Hiển thị contract value
  const cvEl = document.getElementById('pay-contract-display')
  if (cvEl) cvEl.textContent = proj?.contract_value ? fmtMoney(proj.contract_value) : 'Chưa nhập'

  // Load payments
  const { data: records, error } = await sb.from('payment_records')
    .select('*').eq('project_id', projId).order('received_date', {ascending: true})

  if (error) { toast('Lỗi tải dữ liệu: ' + error.message, 'error'); return }

  const totalReceived = (records||[]).reduce(function(s,r){ return s + (r.amount||0) }, 0)
  const contractValue = proj?.contract_value || 0
  const remaining = contractValue > 0 ? contractValue - totalReceived : null

  // Summary bar
  const sumBar = document.getElementById('pay-summary-bar')
  if (sumBar && contractValue > 0) {
    const recPct = Math.min(100, Math.round(totalReceived / contractValue * 100))
    sumBar.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:10px">'
      + '<div><div style="font-size:10px;color:var(--gray4);margin-bottom:2px">Đã nhận</div><div style="font-size:16px;font-weight:700;color:var(--blue)">' + fmtMoney(totalReceived) + '</div></div>'
      + '<div><div style="font-size:10px;color:var(--gray4);margin-bottom:2px">Còn phải thu</div><div style="font-size:16px;font-weight:700;color:var(--navy)">' + (remaining !== null ? fmtMoney(remaining) : '—') + '</div></div>'
      + '<div><div style="font-size:10px;color:var(--gray4);margin-bottom:2px">Tỷ lệ thu</div><div style="font-size:16px;font-weight:700;color:var(--teal)">' + recPct + '%</div></div>'
      + '</div>'
      + '<div class="pct-bar" style="height:8px;border-radius:4px"><div style="height:100%;width:' + recPct + '%;background:var(--blue);border-radius:4px;transition:width .3s"></div></div>'
      + '<div style="font-size:10px;color:var(--gray4);margin-top:4px">' + recPct + '% đã thu / ' + (100-recPct) + '% còn lại</div>'
  }

  const totalBadge = document.getElementById('pay-total-badge')
  if (totalBadge) totalBadge.textContent = 'Tổng đã nhận: ' + fmtMoney(totalReceived) + ' · ' + (records||[]).length + ' đợt'

  // Records table
  const wrap = document.getElementById('pay-records-wrap')
  if (!wrap) return

  if (!records?.length) {
    wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray4)">Chưa có đợt thanh toán nào.<br><span style="font-size:12px">Bấm "➕ Thêm đợt" để ghi nhận tạm ứng hoặc claim.</span></div>'
    return
  }

  let running = 0
  wrap.innerHTML = '<table class="tbl">'
    + '<thead><tr><th>Ngày nhận</th><th>Nội dung</th><th style="text-align:right">Số tiền</th><th style="text-align:right">Lũy kế</th><th></th></tr></thead>'
    + '<tbody>'
    + records.map(function(r) {
        running += (r.amount || 0)
        const isAdvance = r.description && r.description.toLowerCase().includes('tạm ứng')
        const typeColor = isAdvance ? 'var(--amber)' : 'var(--blue)'
        return '<tr>'
          + '<td style="font-size:12px;white-space:nowrap">' + (r.received_date ? new Date(r.received_date).toLocaleDateString('vi-VN') : '—') + '</td>'
          + '<td><div style="font-size:13px;color:var(--gray8)">' + (r.description||'—') + '</div>'
          + (r.note ? '<div style="font-size:11px;color:var(--gray4);margin-top:1px">' + r.note + '</div>' : '')
          + '</td>'
          + '<td style="text-align:right;font-size:13px;font-weight:600;color:' + typeColor + '">' + fmtMoney(r.amount) + '</td>'
          + '<td style="text-align:right;font-size:12px;color:var(--gray5)">' + fmtMoney(running) + '</td>'
          + '<td style="text-align:center">'
          + (STATE.role === 'admin' ? '<button onclick="deletePaymentRecord(\'' + r.id + '\')" style="background:#FEE2E2;border:none;color:#DC2626;font-size:11px;padding:2px 7px;border-radius:4px;cursor:pointer">🗑️</button>' : '')
          + '</td>'
          + '</tr>'
      }).join('')
    + '</tbody></table>'
}

function openContractValueModal() {
  const sel = document.getElementById('pay-proj-select')
  const projId = sel ? sel.value : STATE.currentProject?.id
  const proj = STATE.projects.find(p => p.id === projId)
  openModal('✏️ Giá trị Hợp đồng — ' + (proj?.code||''), `
    <div style="font-size:12px;color:var(--gray5);margin-bottom:14px">Nhập tổng giá trị hợp đồng với CĐT (trước VAT)</div>
    <div class="form-group">
      <label class="form-label">Giá trị HĐ (VND)</label>
      <input class="form-input" type="number" id="cv-input"
        value="${proj?.contract_value||''}"
        placeholder="VD: 85000000000"
        style="font-size:16px;font-weight:600">
      <div style="font-size:11px;color:var(--gray4);margin-top:6px" id="cv-preview"></div>
    </div>
    <script>
      document.getElementById('cv-input').oninput = function() {
        const v = parseFloat(this.value)
        document.getElementById('cv-preview').textContent = v ? '= ' + (v/1e9).toFixed(3) + ' tỷ VND' : ''
      }
    <\/script>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveContractValue('${projId}')">💾 Lưu</button>
  `)
  // Trigger preview
  setTimeout(function() {
    const inp = document.getElementById('cv-input')
    if (inp) inp.dispatchEvent(new Event('input'))
  }, 100)
}

async function saveContractValue(projId) {
  const val = parseFloat(document.getElementById('cv-input').value) || null
  loading(true, 'Đang lưu...')
  const { error } = await sb.from('projects').update({ contract_value: val }).eq('id', projId)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  // Update local state
  const proj = STATE.projects.find(p => p.id === projId)
  if (proj) proj.contract_value = val
  closeModal()
  toast('Đã lưu giá trị HĐ: ' + fmtMoney(val), 'success')
  loadPaymentData()
}

function openAddPaymentModal() {
  const sel = document.getElementById('pay-proj-select')
  const projId = sel ? sel.value : STATE.currentProject?.id
  const today = new Date().toISOString().slice(0,10)
  openModal('➕ Thêm đợt thanh toán', `
    <div class="form-group">
      <label class="form-label">Nội dung <span style="color:var(--red)">*</span></label>
      <input class="form-input" id="pay-desc" placeholder="VD: Tạm ứng đợt 1 / Claim đợt 2 — Nghiệm thu móng">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Ngày nhận tiền <span style="color:var(--red)">*</span></label>
        <input class="form-input" type="date" id="pay-date" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Số tiền thực nhận (VND) <span style="color:var(--red)">*</span></label>
        <input class="form-input" type="number" id="pay-amount" placeholder="VD: 17000000000" style="font-size:14px;font-weight:600">
        <div style="font-size:11px;color:var(--gray4);margin-top:4px" id="pay-amount-preview"></div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Ghi chú</label>
      <input class="form-input" id="pay-note" placeholder="VD: Đã trừ 5% bảo lãnh, chờ duyệt VAT...">
    </div>
    <script>
      document.getElementById('pay-amount').oninput = function() {
        const v = parseFloat(this.value)
        document.getElementById('pay-amount-preview').textContent = v ? '= ' + (v/1e9).toFixed(3) + ' tỷ VND' : ''
      }
    <\/script>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="savePaymentRecord('${projId}')">💾 Lưu</button>
  `)
}

async function savePaymentRecord(projId) {
  const desc   = document.getElementById('pay-desc').value.trim()
  const date   = document.getElementById('pay-date').value
  const amount = parseFloat(document.getElementById('pay-amount').value) || 0
  const note   = document.getElementById('pay-note').value.trim()

  if (!desc) { toast('Vui lòng nhập nội dung', 'error'); return }
  if (!date) { toast('Vui lòng chọn ngày nhận', 'error'); return }
  if (!amount) { toast('Vui lòng nhập số tiền', 'error'); return }

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('payment_records').insert({
    project_id:    projId,
    description:   desc,
    received_date: date,
    amount:        amount,
    note:          note || null,
    created_by:    STATE.user.email
  })
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  closeModal()
  toast('Đã lưu đợt thanh toán: ' + fmtMoney(amount), 'success')
  loadPaymentData()
}

async function deletePaymentRecord(id) {
  if (!confirm('Xóa đợt thanh toán này? Không thể hoàn tác.')) return
  loading(true, 'Đang xóa...')
  const { error } = await sb.from('payment_records').delete().eq('id', id)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast('Đã xóa!', 'success')
  loadPaymentData()
}
