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
