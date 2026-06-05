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
    <button class="btn btn-primary" onclick="saveNewTask()">➕ Thêm công tác</button>
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
    const descendants = STATE.tasks.filter(t =>
      t.wbs_code.startsWith(parent.wbs_code + '.')
    )
    const maxSort = descendants.reduce((m,t) => t.sort_order > m ? t.sort_order : m,
      parent.sort_order)
    sort_order = maxSort + 1

    // Shift sort_order of tasks after this position
    const toShift = STATE.tasks.filter(t => t.sort_order > maxSort && t.id !== parentId)
    for (const t of toShift) {
      await sb.from('tasks').update({ sort_order: t.sort_order + 1 }).eq('id', t.id)
    }
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

// ═══════════════════════════════════════════════════════════
// QUẢN LÝ USER
// ═══════════════════════════════════════════════════════════
function usersPage() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h2 style="font-size:18px;font-weight:700">Quản lý User</h2>
      <p style="font-size:13px;color:var(--gray4)">Tạo tài khoản và phân quyền — ${STATE.projects.length} dự án</p>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary" onclick="openBulkImportModal()">📥 Import hàng loạt (CSV)</button>
      <button class="btn btn-primary" onclick="openAddUserModal()">➕ Thêm 1 user</button>
    </div>
  </div>

  <div class="card" style="padding:12px 16px;background:var(--lblue);margin-bottom:12px;font-size:12px;color:var(--gray6)">
    💡 <strong>Cần deploy Edge Function</strong> để tạo user trong app. 
    Chưa deploy → dùng nút <strong>"Gán role theo UUID"</strong> sau khi tạo tài khoản trong 
    <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/auth/users" target="_blank" style="color:var(--blue)">Supabase Dashboard</a>.
    <span style="margin-left:8px;color:var(--gray4)">File Edge Function: <code>create-user.ts</code></span>
  </div>

  <div class="card" style="padding:0;overflow:hidden">
    <div id="users-table-wrap" style="padding:0">
      <div style="padding:30px;text-align:center;color:var(--gray4)">Đang tải...</div>
    </div>
  </div>`
}

async function initUsersPage() {
  if (STATE.role !== 'admin') {
    toast('Chỉ admin mới xem được trang này', 'error')
    navigate('dashboard')
    return
  }
  await loadUsersTable()
}

async function loadUsersTable() {
  const el = document.getElementById('users-table-wrap')
  if (!el) return

  // Load user_roles
  const { data: roles, error } = await sb.from('user_roles')
    .select('*').order('role')

  if (error) {
    el.innerHTML = `<div style="padding:20px;color:var(--red)">Lỗi: ${error.message}</div>`
    return
  }

  if (!roles?.length) {
    el.innerHTML = `<div style="padding:30px;text-align:center;color:var(--gray4)">
      Chưa có user nào. Bấm "Thêm user mới" để bắt đầu.
    </div>`
    return
  }

  const roleColors = { admin:'#FEF3C7|#92400E', planner:'#DBEAFE|#1E40AF', updater:'#DCFCE7|#166534' }
  const rows = roles.map(r => {
    const [bg,fg] = (roleColors[r.role]||'#F1F5F9|#475569').split('|')
    const projName = STATE.projects.find(p => p.id === r.project_id)?.name || '— Tất cả dự án —'
    return `<tr>
      <td style="padding:10px 14px">
        <div style="font-size:13px;font-weight:500;color:var(--gray8)">${r.email}</div>
        <div style="font-size:11px;color:var(--gray4);margin-top:2px">ID: ${r.user_id?.slice(0,16)}...</div>
      </td>
      <td style="padding:10px 14px">
        <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;background:${bg};color:${fg}">
          ${r.role}
        </span>
      </td>
      <td style="padding:10px 14px;font-size:12px;color:var(--gray5)">${projName}</td>
      <td style="padding:10px 14px;font-size:11px;color:var(--gray4)">${r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}</td>
      <td style="padding:10px 14px">
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="openEditRoleModal('${r.id}','${r.email}','${r.role}','${r.project_id||''}')">✏️ Sửa role</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUserRole('${r.id}','${r.email}')">🗑️</button>
        </div>
      </td>
    </tr>`
  }).join('')

  el.innerHTML = `
  <table class="tbl" style="width:100%">
    <thead><tr>
      <th>Email</th><th>Role</th><th>Dự án</th><th>Ngày thêm</th><th>Thao tác</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function openBulkImportModal() {
  const projOptions = STATE.projects.map(p =>
    '<option value="'+p.id+'">'+p.code+' — '+p.name.slice(0,25)+'</option>'
  ).join('')

  openModal('📥 Import hàng loạt từ CSV', `
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">Format file CSV:</div>
      <div style="background:var(--gray1);border-radius:var(--radius);padding:10px 14px;font-family:monospace;font-size:12px;color:var(--gray7)">
        email,password,role,project_code<br>
        nguyenvana@vela.com.vn,Vela@2026,updater,VEGACITY<br>
        tranthib@vela.com.vn,Vela@2026,planner,<br>
        <span style="color:var(--gray4)">(project_code để trống = xem tất cả dự án)</span>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Role hợp lệ: admin · planner · updater</label>
      <div class="drop-zone" id="csv-drop-zone" style="padding:24px"
           ondragover="event.preventDefault();this.classList.add('dragover')"
           ondragleave="this.classList.remove('dragover')"
           ondrop="handleCSVDrop(event)"
           onclick="document.getElementById('csv-file-input').click()">
        <div style="font-size:24px;margin-bottom:8px">📄</div>
        <div style="font-weight:500;color:var(--gray7)">Kéo thả file CSV vào đây</div>
        <div style="font-size:12px;color:var(--gray4);margin-top:4px">hoặc bấm để chọn file</div>
      </div>
      <input type="file" id="csv-file-input" accept=".csv" style="display:none"
             onchange="handleCSVFile(this)">
    </div>
    <div id="csv-preview"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" id="btn-import-users" style="display:none" onclick="runBulkImport()">
      ⬆️ Import
    </button>
  `)
}

let _csvUsers = []

function handleCSVDrop(e) {
  e.preventDefault()
  document.getElementById('csv-drop-zone').classList.remove('dragover')
  const file = e.dataTransfer.files[0]
  if (file) parseCSVFile(file)
}

function handleCSVFile(input) {
  if (input.files[0]) parseCSVFile(input.files[0])
}

async function parseCSVFile(file) {
  const text = await file.text()
  const rawLines = text.trim().split('\n').map(l => l.trim()).filter(l => l)
  const dataLines = rawLines[0].toLowerCase().includes('email') ? rawLines.slice(1) : rawLines

  _csvUsers = dataLines.map(function(line, i) {
    const cols = line.split(',').map(function(c){ return c.trim().replace(/^"|"$/g,'') })
    const email = cols[0]||'', password = cols[1]||'Vela@2026'
    const role  = ['admin','planner','updater'].includes(cols[2]) ? cols[2] : 'updater'
    const pcode = cols[3]||''
    const proj  = STATE.projects.find(function(p){ return p.code.toLowerCase()===pcode.toLowerCase() })
    return { row:i+2, email, password, role, project_code:pcode, project_id:proj?.id||null, valid:!!email&&email.includes('@') }
  }).filter(function(u){ return u.email })

  const valid   = _csvUsers.filter(function(u){ return u.valid }).length
  const invalid = _csvUsers.filter(function(u){ return !u.valid }).length

  const roleColor = function(r) {
    if (r==='admin')   return 'background:#FEF3C7;color:#92400E'
    if (r==='planner') return 'background:#DBEAFE;color:#1E40AF'
    return 'background:#DCFCE7;color:#166534'
  }

  let preview = ''
  _csvUsers.slice(0,10).forEach(function(u) {
    preview += '<tr style="background:'+(u.valid?'white':'#FEF2F2')+'">'
      + '<td style="padding:6px 10px;font-size:12px">'+u.email+'</td>'
      + '<td style="padding:6px 10px"><span style="padding:2px 7px;border-radius:8px;font-size:10px;font-weight:500;'+roleColor(u.role)+'">'+u.role+'</span></td>'
      + '<td style="padding:6px 10px;font-size:12px;color:var(--gray5)">'+(u.project_code||'Tất cả')+'</td>'
      + '<td style="padding:6px 10px;font-size:12px">'+(u.valid?'✅':'❌ Email lỗi')+'</td>'
      + '</tr>'
  })

  let html = '<div style="display:flex;gap:12px;margin:10px 0;font-size:12px">'
    + '<span style="color:var(--green)">✅ Hợp lệ: <strong>'+valid+'</strong></span>'
    + (invalid>0 ? '<span style="color:var(--red)">❌ Lỗi: <strong>'+invalid+'</strong></span>' : '')
    + '<span style="color:var(--gray4)">Tổng: '+_csvUsers.length+' dòng</span>'
    + '</div>'
    + '<div style="overflow-x:auto;border-radius:var(--radius);border:1px solid var(--gray2)">'
    + '<table style="width:100%;border-collapse:collapse">'
    + '<thead><tr style="background:var(--gray1)">'
    + '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--gray5)">Email</th>'
    + '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--gray5)">Role</th>'
    + '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--gray5)">Dự án</th>'
    + '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--gray5)">Trạng thái</th>'
    + '</tr></thead><tbody>'+preview+'</tbody></table></div>'
    + (_csvUsers.length>10 ? '<div style="font-size:11px;color:var(--gray4);margin-top:6px;text-align:center">...và '+(_csvUsers.length-10)+' user khác</div>' : '')

  document.getElementById('csv-preview').innerHTML = html

  if (valid > 0) {
    const btn = document.getElementById('btn-import-users')
    btn.style.display = 'inline-flex'
    btn.textContent = 'Import ' + valid + ' user'
  }
}

async function runBulkImport() {
  const validUsers = _csvUsers.filter(function(u){ return u.valid })
  if (!validUsers.length) { toast('Không có user hợp lệ', 'error'); return }

  closeModal()
  loading(true, 'Đang import ' + validUsers.length + ' users...')

  try {
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token

    const res = await fetch(CFG.SUPABASE_URL + '/functions/v1/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ users: validUsers })
    })

    if (!res.ok) throw new Error('Edge Function chưa deploy')

    const { results } = await res.json()
    const success = results.filter(function(r){ return r.status==='success' }).length
    const failed  = results.filter(function(r){ return r.status==='error' })

    loading(false)
    let failHtml = ''
    failed.forEach(function(f){ failHtml += '<div style="font-size:12px;padding:4px 0;color:var(--red)">❌ '+f.email+': '+f.error+'</div>' })

    openModal('📊 Kết quả import', `
      <div style="display:flex;gap:16px;margin-bottom:14px">
        <div style="padding:12px 20px;background:#DCFCE7;border-radius:var(--radius);text-align:center">
          <div style="font-size:24px;font-weight:700;color:#166534">${success}</div>
          <div style="font-size:12px;color:#166534">Thành công</div>
        </div>
        ${failed.length > 0 ? '<div style="padding:12px 20px;background:#FEE2E2;border-radius:var(--radius);text-align:center"><div style="font-size:24px;font-weight:700;color:#991B1B">'+failed.length+'</div><div style="font-size:12px;color:#991B1B">Thất bại</div></div>' : ''}
      </div>
      <div id="fail-list"></div>
    `, `<button class="btn btn-primary" onclick="closeModal();loadUsersTable()">Đóng & Cập nhật</button>`)
    if (failHtml) document.getElementById('fail-list').innerHTML = failHtml

  } catch(e) {
    loading(false)
    openModal('⚠️ Edge Function chưa deploy', `
      <div style="font-size:13px;line-height:1.8;color:var(--gray6)">
        <p style="margin-bottom:12px">Để import hàng loạt, cần deploy Edge Function <strong>create-user</strong>.</p>
        <div style="background:var(--gray1);border-radius:var(--radius);padding:12px;font-size:12px;margin-bottom:12px">
          <strong>Hướng dẫn (5 phút):</strong><br>
          1. Vào <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/functions" target="_blank" style="color:var(--blue)">Supabase → Edge Functions</a><br>
          2. Deploy new function → đặt tên <strong>create-user</strong><br>
          3. Paste nội dung file <strong>create-user.ts</strong> đã được gửi → Deploy<br>
          4. Quay lại app import lại
        </div>
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
  }
}

function openAddUserModal() {
  openModal('➕ Thêm user mới', `
    <div style="padding:10px 14px;background:var(--lblue);border-radius:var(--radius);font-size:12px;color:var(--gray6);margin-bottom:14px">
      <strong>Bước 1:</strong> Điền thông tin bên dưới<br>
      <strong>Bước 2:</strong> Nếu user chưa có tài khoản → app sẽ hướng dẫn tạo trong Supabase
    </div>
    <div class="form-group">
      <label class="form-label">Email <span style="color:var(--red)">*</span></label>
      <input class="form-input" type="email" id="new-user-email" placeholder="ten.chucvu@vela.com.vn">
    </div>
    <div class="form-group">
      <label class="form-label">Mật khẩu tạm <span style="color:var(--red)">*</span></label>
      <input class="form-input" type="text" id="new-user-password" placeholder="VD: Vela@2026" value="Vela@2026">
      <div style="font-size:11px;color:var(--gray4);margin-top:4px">User có thể đổi mật khẩu sau khi đăng nhập</div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-input" id="new-user-role">
          <option value="updater">Updater — Kỹ sư hiện trường</option>
          <option value="planner">Planner — KTTC văn phòng</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Giới hạn dự án</label>
        <select class="form-input" id="new-user-project">
          <option value="">— Xem tất cả dự án —</option>
          ${STATE.projects.map(p => `<option value="${p.id}">${p.code} — ${p.name.slice(0,30)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="add-user-status"></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
    <button class="btn btn-primary" onclick="createUser()">✅ Tạo user</button>
  `)
}

async function createUser() {
  const email    = document.getElementById('new-user-email').value.trim()
  const password = document.getElementById('new-user-password').value.trim()
  const role     = document.getElementById('new-user-role').value
  const projId   = document.getElementById('new-user-project').value || null
  const statusEl = document.getElementById('add-user-status')

  if (!email || !password) { toast('Vui lòng điền đủ email và mật khẩu', 'error'); return }

  statusEl.innerHTML = '<div style="color:var(--gray4);font-size:12px;margin-top:8px">⏳ Đang tạo tài khoản...</div>'

  // Try Edge Function first
  try {
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token

    const res = await fetch(`${CFG.SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, password, role, project_id: projId })
    })

    if (res.ok) {
      const data = await res.json()
      // Insert role
      await sb.from('user_roles').insert({
        user_id: data.user.id, email, role,
        project_id: projId || null
      })
      closeModal()
      toast(`Đã tạo user: ${email}`, 'success')
      await loadUsersTable()
      return
    }
  } catch(e) {
    console.warn('Edge Function not available:', e.message)
  }

  // Fallback: hướng dẫn manual
  statusEl.innerHTML = `
    <div style="margin-top:12px;padding:12px;background:#FEF3C7;border-radius:var(--radius);font-size:12px">
      <strong style="color:#92400E">⚠️ Edge Function chưa được deploy</strong><br>
      <div style="margin-top:6px;color:#78350F;line-height:1.8">
        Làm thủ công trong Supabase (mất ~1 phút):<br>
        1. Vào <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/auth/users" target="_blank" style="color:var(--blue)">Authentication → Users</a>
        → Add user → Create new user<br>
        2. Email: <strong>${email}</strong> · Password: <strong>${password}</strong><br>
        3. Copy UUID → quay lại đây bấm <strong>"Gán role theo UUID"</strong>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="openAssignRoleByUUID('${email}','${role}','${projId||''}')">
        Gán role theo UUID
      </button>
    </div>`
}

function openAssignRoleByUUID(email, role, projId) {
  closeModal()
  openModal('🔑 Gán role theo UUID', `
    <div style="font-size:12px;color:var(--gray5);margin-bottom:12px">
      Sau khi tạo user trong Supabase, copy UUID và dán vào đây:
    </div>
    <div class="form-group">
      <label class="form-label">UUID của user (từ Supabase Auth)</label>
      <input class="form-input" id="manual-uuid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
    </div>
    <div style="font-size:12px;color:var(--gray5)">Email: <strong>${email}</strong> · Role: <strong>${role}</strong></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="assignRoleByUUID('${email}','${role}','${projId}')">✅ Gán role</button>
  `)
}

async function assignRoleByUUID(email, role, projId) {
  const uuid = document.getElementById('manual-uuid').value.trim()
  if (!uuid || uuid.length < 30) { toast('UUID không hợp lệ', 'error'); return }

  loading(true, 'Đang gán role...')
  const { error } = await sb.from('user_roles').insert({
    user_id: uuid, email, role,
    project_id: projId || null
  })
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  closeModal()
  toast(`Đã gán role ${role} cho ${email}`, 'success')
  await loadUsersTable()
}

async function openEditRoleModal(id, email, currentRole, currentProjId) {
  openModal(`✏️ Sửa role: ${email}`, `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Role mới</label>
        <select class="form-input" id="edit-role">
          ${['updater','planner','admin'].map(r =>
            `<option value="${r}" ${r===currentRole?'selected':''}>${r}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Dự án</label>
        <select class="form-input" id="edit-proj">
          <option value="" ${!currentProjId?'selected':''}>— Tất cả —</option>
          ${STATE.projects.map(p =>
            `<option value="${p.id}" ${p.id===currentProjId?'selected':''}>${p.code} — ${p.name.slice(0,25)}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveEditRole('${id}','${email}')">💾 Lưu</button>
  `)
}

async function saveEditRole(id, email) {
  const role    = document.getElementById('edit-role').value
  const projId  = document.getElementById('edit-proj').value || null
  loading(true, 'Đang lưu...')
  const { error } = await sb.from('user_roles')
    .update({ role, project_id: projId }).eq('id', id)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  closeModal()
  toast(`Đã cập nhật role cho ${email}`, 'success')
  await loadUsersTable()
}

async function deleteUserRole(id, email) {
  if (!confirm(`Xóa quyền truy cập của ${email}?\nUser vẫn còn tài khoản nhưng sẽ không đăng nhập được vào app.`)) return
  loading(true, 'Đang xóa...')
  const { error } = await sb.from('user_roles').delete().eq('id', id)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  toast(`Đã xóa quyền của ${email}`, 'success')
  await loadUsersTable()
}

// ═══════════════════════════════════════════════════════════
// XÓA DỰ ÁN
// ═══════════════════════════════════════════════════════════
async function confirmDeleteProject() {
  const proj = STATE.currentProject
  if (!proj) return
  if (!['admin','planner'].includes(STATE.role)) {
    toast('Không có quyền xóa dự án', 'error'); return
  }

  openModal('🗑️ Xóa dự án', `
    <div style="padding:14px;background:#FEE2E2;border-radius:var(--radius);margin-bottom:14px">
      <div style="font-size:14px;font-weight:600;color:#991B1B;margin-bottom:6px">⚠️ Cảnh báo — Không thể hoàn tác!</div>
      <div style="font-size:13px;color:#7F1D1D">
        Xóa dự án <strong>"${proj.name}"</strong> sẽ xóa toàn bộ:
        <ul style="margin:6px 0 0 16px;line-height:2">
          <li>Tất cả tasks (${STATE.tasks.length} tasks)</li>
          <li>Toàn bộ tiến độ đã cập nhật</li>
          <li>Toàn bộ ảnh hiện trường</li>
          <li>Baseline log</li>
        </ul>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Nhập tên dự án để xác nhận xóa:</label>
      <input class="form-input" type="text" id="confirm-proj-name"
        placeholder="${proj.code}" style="border-color:#F87171">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-danger" onclick="deleteProject('${proj.id}','${proj.code}')">🗑️ Xác nhận xóa</button>
  `)
}

async function deleteProject(projectId, projectCode) {
  const input = document.getElementById('confirm-proj-name')?.value?.trim()
  if (input !== projectCode) {
    toast(`Tên không khớp. Nhập đúng: "${projectCode}"`, 'error'); return
  }
  closeModal()
  loading(true, 'Đang xóa toàn bộ dữ liệu dự án...')
  try {
    // Xóa theo thứ tự: photos → progress → predecessors → baseline → tasks → project
    loading(true, 'Xóa ảnh...')
    await sb.from('task_photos').delete().eq('project_id', projectId)

    loading(true, 'Xóa tiến độ...')
    await sb.from('task_progress').delete().eq('project_id', projectId)

    loading(true, 'Xóa predecessors...')
    await sb.from('task_predecessors').delete().eq('project_id', projectId)

    loading(true, 'Xóa baseline log...')
    await sb.from('baseline_log').delete().eq('project_id', projectId)

    loading(true, 'Xóa tasks...')
    await sb.from('tasks').delete().eq('project_id', projectId)

    loading(true, 'Xóa dự án...')
    const { error } = await sb.from('projects').delete().eq('id', projectId)
    if (error) throw error

    // Reload projects list
    const { data: projs } = await sb.from('projects').select('*').order('code')
    STATE.projects = projs || []
    STATE.currentProject = null
    STATE.tasks = []

    const sel = document.getElementById('proj-select')
    sel.innerHTML = STATE.projects.map(p =>
      `<option value="${p.id}">${p.code} — ${p.name}</option>`
    ).join('')

    if (STATE.projects.length > 0) {
      STATE.currentProject = STATE.projects[0]
      sel.value = STATE.currentProject.id
      await loadProjectData(STATE.currentProject.id)
      toast('Đã xóa dự án! Đang hiển thị dự án kế tiếp.', 'success')
      navigate('import')
    } else {
      toast('Đã xóa dự án!', 'success')
      navigate('import')
    }
  } catch(e) {
    toast('Lỗi xóa: ' + e.message, 'error')
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

