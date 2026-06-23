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
      <button class="btn btn-secondary btn-sm" onclick="exportWbsExcel()" style="background:#E8F5E9;color:#1B5E20;border-color:#A5D6A7">📊 Xuất Excel</button>
      ${STATE.role !== 'updater' ? `
        <button class="btn btn-secondary btn-sm" onclick="openBulkReschedule()" style="background:#FEF3C7;color:#92400E;border-color:#FDE68A">📅 Điều chỉnh tiến độ</button>
        <button class="btn btn-secondary btn-sm" onclick="openBulkUnitPrice()" style="background:#DCFCE7;color:#166534;border-color:#BBF7D0">💰 Nhập đơn giá</button>
        <button class="btn btn-primary btn-sm" onclick="openAddTaskModal()">➕ Thêm công tác</button>
      ` : ''}
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div class="wbs-header" style="position:sticky;top:0;z-index:10">
      <div style="width:40px;flex-shrink:0"></div>
      <div class="wbs-name">Hạng mục / Công tác</div>
      <div class="wbs-kh-start">KH Bắt đầu</div>
      <div class="wbs-kh-end">KH Kết thúc</div>
      <div class="wbs-dur">Ngày KH</div>
      <div class="wbs-pct">Tiến độ</div>
      <div class="wbs-status" style="width:90px">Đơn vị/KH</div>
      <div class="wbs-status">Trạng thái</div>
      <div style="width:110px;text-align:right;padding:0 8px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,.8)">Giá trị HĐ (VND)</div>
      <div style="width:110px;text-align:right;padding:0 8px;flex-shrink:0;font-size:11px;font-weight:600;color:rgba(255,255,255,.8)">Sản lượng TH (VND)</div>
    </div>
    <div class="wbs-tree" id="wbs-container" style="height:calc(100vh - 230px);overflow-y:auto"></div>
  </div>`
}

function initWbs() {
  const tasks = STATE.tasks
  if (!tasks.length) {
    document.getElementById('wbs-container').innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--gray4)">Chưa có dữ liệu. Vào Import để tải file MS Project.</div>'
    return
  }

  // Rollup contract value VÀ earned value TRƯỚC khi render
  // earnedValue rollup trực tiếp từ con — không dùng display_pct của summary
  const sortedForRollup = [...STATE.tasks].sort((a,b) => b.outline_level - a.outline_level)
  sortedForRollup.forEach(t => {
    if (!t.is_summary) {
      t._contractValue = (t.unit_price||0) * (t.planned_quantity||1)
      t._earnedValue   = t._contractValue * (t.display_pct||0) / 100
      return
    }
    const children = STATE.tasks.filter(c =>
      c.wbs_code && t.wbs_code &&
      c.wbs_code.startsWith(t.wbs_code + '.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
    )
    t._contractValue = children.reduce((s, c) => s + (c._contractValue||0), 0)
    // Earned value = rollup trực tiếp từ con (không qua display_pct)
    t._earnedValue   = children.reduce((s, c) => s + (c._earnedValue||0), 0)
  })

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
          ${!t.is_summary ? `<span onclick="event.stopPropagation();editTaskDates('${t.id}')"
            title="Sửa ngày KH (chỉ task lá)"
            style="opacity:0;font-size:12px;padding:2px 5px;border-radius:4px;cursor:pointer;color:var(--gray5);flex-shrink:0;background:var(--gray2)"
            class="wbs-settings-btn">📅</span>` : ''}
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
        ${(() => {
          // Tính % theo tiền nếu có unit_price, fallback về pct thông thường
          const cv = t.is_summary ? (t._contractValue||0) : (t.unit_price||0)*(t.planned_quantity||1)
          const earned = cv * pct / 100
          // % tài chính = sản lượng TH / giá trị HĐ (chỉ khi cv > 0)
          const pctMoney = cv > 0 ? Math.round(earned / cv * 100) : pct
          const displayPct = pctMoney  // dùng % tài chính nếu có, không thì % thường
          const barColorFinal = displayPct === 100 ? 'on' : (t._delay||0) > 0 ? 'late' : 'on'
          const moneyTag = cv > 0 && !t.is_summary
            ? '<span style="font-size:9px;color:var(--teal);margin-left:2px">₫</span>' : ''
          return '<div class="pct-bar"><div class="pct-fill ' + barColorFinal + '" style="width:' + displayPct + '%"></div></div>'
            + '<div style="font-size:11px;color:' + (displayPct>0?'var(--gray7)':'var(--gray4)') + ';margin-top:2px;font-weight:' + (displayPct>0?500:400) + ';display:flex;align-items:center;justify-content:center;gap:2px">'
            + displayPct + '%' + (t.is_summary && displayPct > 0 ? ' ⟳' : '') + moneyTag + '</div>'
        })()}
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
      ${(() => {
        // Dùng _contractValue đã rollup (tính trước khi render)
        const cv         = t.is_summary ? (t._contractValue||0) : (t.unit_price||0)*(t.planned_quantity||1)
        // Dùng _earnedValue đã rollup từ con (chính xác hơn cv×pct/100)
        const earnedVal  = t._earnedValue !== undefined
          ? t._earnedValue
          : cv * (t.display_pct||0) / 100
        const fmtM = v => (!v || v === 0) ? '—' : v.toLocaleString('vi-VN') + ' ₫'
        return `
          <div style="width:110px;text-align:right;padding:0 8px;flex-shrink:0;font-size:11px;
            color:${cv>0?'var(--navy)':'var(--gray3)'};font-weight:${cv>0?'500':'400'}">
            ${fmtM(cv)}
          </div>
          <div style="width:110px;text-align:right;padding:0 8px;flex-shrink:0;font-size:11px;
            font-weight:500;color:${earnedVal>0?'var(--teal)':'var(--gray3)'}">
            ${cv>0 ? fmtM(earnedVal) : '—'}
          </div>`
      })()}
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
      ${!t.is_summary ? `<button class="btn btn-primary btn-sm" onclick="openUpdateModal('${t.id}')">Cập nhật</button>` : '<span style="font-size:11px;color:var(--gray4);font-style:italic">Tự tính từ con</span>'}
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
          <input type="date" id="upd-tt-start-date" value="${toISO(t.tt_start)||today}"
            style="width:100%;padding:6px 8px;border:1px solid var(--gray3);border-radius:6px;font-size:13px">
        </div>
        <div>
          <div style="font-size:11px;color:var(--gray5);margin-bottom:4px">
            Ngày hoàn thành TT <span style="color:var(--amber);font-size:10px">(chỉ điền khi 100%)</span>
          </div>
          <input type="date" id="upd-tt-finish-date" value="${toISO(t.tt_finish)||''}"
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
          style="flex:1;accent-color:var(--blue);height:6px">
        <input type="number" id="pct-number" min="0" max="100" value="${curPct}"
          oninput="
            const v=Math.min(100,Math.max(0,parseInt(this.value)||0));
            this.value=v;
            document.getElementById('upd-pct').value=v;
            document.getElementById('pct-display').textContent=v+'%';
            document.getElementById('pct-bar-fill').style.width=v+'%';
          "
          style="width:80px;padding:8px 10px;border:2px solid var(--gray3);border-radius:6px;font-size:18px;font-weight:700;text-align:center;color:var(--navy)">
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
// BULK RESCHEDULE — Điều chỉnh tiến độ hàng loạt
// ═══════════════════════════════════════════════════════════

// ── Helpers format ngày DD/MM/YYYY ──────────────────────────
// Normalize bất kỳ format ngày nào về YYYY-MM-DD cho input type="date"
function toISO(dateStr) {
  if (!dateStr) return ''
  // Đã là ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0,10)
  // DD/MM/YYYY
  const m1 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // MM/DD/YYYY (browser format)
  const m2 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`
  return ''
}

function fmtDMY(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'})
}

function parseDMYtoISO(str) {
  // Chấp nhận DD/MM/YYYY hoặc DD-MM-YYYY
  if (!str) return ''
  const parts = str.split(/[/\-]/)
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  if (!d || !m || !y || y.length < 4) return ''
  const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  const date = new Date(iso)
  return isNaN(date) ? '' : iso
}

function parseBulkDate(inp) {
  const iso = parseDMYtoISO(inp.value)
  inp.dataset.iso = iso
  // Highlight đỏ nếu không parse được (và có nội dung)
  inp.style.borderColor = (!iso && inp.value.length > 0) ? 'var(--red)' : ''
  const row = inp.closest('tr')
  if (row) { calcRowDelta(row); updateBulkPreview() }
}

function openBulkReschedule() {
  if (!STATE.currentProject) { toast('Chưa có dự án', 'error'); return }

  // Giữ đúng thứ tự sort_order từ STATE.tasks (đã sorted sẵn)
  const tasks = [...STATE.tasks].sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
  if (!tasks.length) { toast('Chưa có dữ liệu công tác', 'error'); return }

  // Build tree rows cho bảng
  const rows = tasks.map(t => {
    const indent = (t.outline_level - 1) * 16
    const isSummary = t.is_summary
    return `
      <tr data-task-id="${t.id}"
          data-level="${t.outline_level}"
          data-wbs="${t.wbs_code}"
          data-summary="${isSummary}"
          data-start="${t.kh_start||''}"
          data-finish="${t.kh_finish||''}"
          style="background:${isSummary?'var(--gray1)':'white'}">
        <td style="padding:5px 8px;text-align:center">
          <input type="checkbox" class="bulk-cb" data-task-id="${t.id}"
            data-summary="${isSummary}" data-wbs="${t.wbs_code}"
            onchange="bulkCbChange(this)">
        </td>
        <td style="padding:5px 8px;font-size:12px;padding-left:${8+indent}px;
          font-weight:${isSummary?'600':'400'};color:${isSummary?'var(--navy)':'var(--gray7)'}">
          ${isSummary?'▼ ':''}${t.name}
        </td>
        <td style="padding:5px 8px;font-size:11px;color:var(--gray5);text-align:center">
          ${t.kh_start ? fmtDateShort(t.kh_start) : '—'}
        </td>
        <td style="padding:5px 8px;font-size:11px;color:var(--gray5);text-align:center">
          ${t.kh_finish ? fmtDateShort(t.kh_finish) : '—'}
        </td>
        <td style="padding:5px 8px;font-size:11px;color:var(--blue);text-align:center;font-weight:500">
          ${t.kh_duration_days || '—'}
        </td>
        <td style="padding:4px 6px;text-align:center">
          ${isSummary
            ? `<span style="font-size:10px;color:var(--gray4);font-style:italic">Tự tính từ con</span>`
            : `<input type="text" class="bulk-new-start form-input"
                data-task-id="${t.id}"
                style="padding:3px 6px;font-size:11px;width:90px;text-align:center"
                placeholder="DD/MM/YYYY"
                value="${t.kh_start ? fmtDMY(t.kh_start) : ''}"
                data-iso="${t.kh_start||''}"
                disabled
                oninput="parseBulkDate(this)" onchange="recalcDuration(this)">`
          }
        </td>
        <td style="padding:4px 6px;text-align:center">
          ${isSummary
            ? `<span style="font-size:10px;color:var(--gray4);font-style:italic"></span>`
            : `<input type="text" class="bulk-new-finish form-input"
                data-task-id="${t.id}"
                style="padding:3px 6px;font-size:11px;width:90px;text-align:center"
                placeholder="DD/MM/YYYY"
                value="${t.kh_finish ? fmtDMY(t.kh_finish) : ''}"
                data-iso="${t.kh_finish||''}"
                disabled
                oninput="parseBulkDate(this)" onchange="recalcDuration(this)">`
          }
        </td>
        <td class="bulk-delta" data-task-id="${t.id}"
          style="padding:5px 8px;font-size:11px;text-align:center;color:var(--gray4)">—</td>
      </tr>`
  }).join('')

  openModal('📅 Điều chỉnh tiến độ hàng loạt', `
    <div style="min-height:60vh">
      <!-- Bước 1: Thông tin đợt điều chỉnh -->
      <div style="background:var(--lblue);border-radius:var(--radius);padding:14px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;color:var(--blue);margin-bottom:10px">
          📋 Bước 1: Thông tin đợt điều chỉnh
        </div>
        <div class="form-row" style="grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group" style="margin:0">
            <label class="form-label">Tên đợt điều chỉnh <span style="color:var(--red)">*</span></label>
            <input class="form-input" id="bulk-revision-name"
              placeholder="VD: Lần 1 - CĐT cập nhật thiết kế">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Ngày hiệu lực</label>
            <input class="form-input" id="bulk-effective-date" type="date"
              value="${new Date().toISOString().slice(0,10)}">
          </div>
        </div>
        <div class="form-group" style="margin-top:10px;margin-bottom:0">
          <label class="form-label">Lý do điều chỉnh <span style="color:var(--red)">*</span></label>
          <input class="form-input" id="bulk-reason"
            placeholder="VD: CĐT yêu cầu đẩy nhanh, mặt bằng bàn giao trễ...">
        </div>
      </div>

      <!-- Bước 2: Dịch ngày chung -->
      <div style="background:#FEFCE8;border:1px solid #FDE68A;border-radius:var(--radius);padding:12px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;color:#92400E;margin-bottom:8px">
          ⚡ Bước 2: Dịch ngày nhanh (áp dụng cho tất cả task được chọn)
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px">
            <label style="font-size:12px;color:var(--gray6)">Dịch</label>
            <input type="number" id="bulk-delta-days" class="form-input"
              style="width:80px;padding:6px 8px" value="0" min="-999" max="999">
            <label style="font-size:12px;color:var(--gray6)">ngày</label>
            <span style="font-size:11px;color:var(--gray4)">(âm = sớm hơn, dương = trễ hơn)</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="applyBulkDelta()"
            style="background:#FEF3C7;color:#92400E;border-color:#FDE68A">
            ▶ Áp dụng cho task đã chọn
          </button>
          <button class="btn btn-secondary btn-sm" onclick="resetBulkDates()"
            style="font-size:11px">↩ Reset về cũ</button>
        </div>
      </div>

      <!-- Bước 3: Bảng tasks -->
      <div style="font-size:13px;font-weight:600;color:var(--gray7);margin-bottom:8px;
        display:flex;justify-content:space-between;align-items:center">
        <span>📋 Bước 3: Chọn và chỉnh sửa từng công tác</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="bulkSelectAll(true)">Chọn tất cả</button>
          <button class="btn btn-secondary btn-sm" onclick="bulkSelectAll(false)">Bỏ chọn</button>
          <span id="bulk-selected-count" style="font-size:11px;color:var(--blue);padding:4px 8px;
            background:var(--lblue);border-radius:6px;font-weight:500">0 task đã chọn</span>
        </div>
      </div>
      <div style="max-height:calc(95vh - 360px);overflow-y:auto;border:1px solid var(--gray2);border-radius:var(--radius)">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--navy);color:white;font-size:11px;position:sticky;top:0;z-index:1">
              <th style="padding:7px 8px;width:32px"></th>
              <th style="padding:7px 8px;text-align:left">Hạng mục / Công tác</th>
              <th style="padding:7px 8px;text-align:center;width:85px">KH BD cũ</th>
              <th style="padding:7px 8px;text-align:center;width:85px">KH KT cũ</th>
              <th style="padding:7px 8px;text-align:center;width:55px">Số ngày</th>
              <th style="padding:7px 8px;text-align:center;width:130px">KH BD mới</th>
              <th style="padding:7px 8px;text-align:center;width:130px">KH KT mới</th>
              <th style="padding:7px 8px;text-align:center;width:55px">Δ ngày</th>
            </tr>
          </thead>
          <tbody id="bulk-task-tbody">${rows}</tbody>
        </table>
      </div>
    </div>
  `, `
    <div style="display:flex;align-items:center;gap:8px;width:100%;justify-content:space-between">
      <span id="bulk-preview-text" style="font-size:12px;color:var(--gray5)">
        Chưa có thay đổi nào
      </span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" id="btn-bulk-save" onclick="saveBulkReschedule()">
          💾 Lưu điều chỉnh
        </button>
      </div>
    </div>
  `)

  // Modal lớn hơn
  const mb = document.querySelector('.modal')
  mb.style.maxWidth  = '60vw'
  mb.style.width     = '60vw'
  mb.style.maxHeight = '95vh'
  updateBulkPreview()
}

// ── Checkbox logic: chọn cha → chọn con ─────────────────────
function bulkCbChange(cb) {
  const taskId  = cb.dataset.taskId
  const wbsCode = cb.dataset.wbs
  const checked = cb.checked

  // Nếu là summary → chọn/bỏ tất cả con
  if (cb.dataset.summary === 'true') {
    document.querySelectorAll('.bulk-cb').forEach(c => {
      if (c.dataset.wbs !== wbsCode && c.dataset.wbs.startsWith(wbsCode + '.')) {
        c.checked = checked
        toggleBulkRow(c, checked)
      }
    })
  }
  toggleBulkRow(cb, checked)
  updateBulkCounter()
  updateBulkPreview()
}

function toggleBulkRow(cb, enabled) {
  const row = cb.closest('tr')
  if (!row) return
  // Summary task không có input ngày — bỏ qua
  if (cb.dataset.summary === 'true') return
  row.querySelectorAll('.bulk-new-start, .bulk-new-finish').forEach(inp => {
    inp.disabled = !enabled
    if (enabled) inp.style.background = 'white'
    else inp.style.background = 'var(--gray1)'
  })
  if (enabled) calcRowDelta(row)
}

function bulkSelectAll(val) {
  document.querySelectorAll('.bulk-cb').forEach(cb => {
    cb.checked = val
    toggleBulkRow(cb, val)
  })
  updateBulkCounter()
  updateBulkPreview()
}

function updateBulkCounter() {
  const count = document.querySelectorAll('.bulk-cb:checked').length
  const el = document.getElementById('bulk-selected-count')
  if (el) el.textContent = count + ' task đã chọn'
}

// ── Áp dụng delta ngày ─────────────────────────────────────
function applyBulkDelta() {
  const delta = parseInt(document.getElementById('bulk-delta-days')?.value || '0')
  if (isNaN(delta) || delta === 0) { toast('Nhập số ngày cần dịch', ''); return }

  document.querySelectorAll('.bulk-cb:checked').forEach(cb => {
    const row   = cb.closest('tr')
    if (!row) return
    // Bỏ qua summary task — ngày tự tính từ con
    if (cb.dataset.summary === 'true') return
    const oldStart  = row.dataset.start
    const oldFinish = row.dataset.finish

    const newStart  = oldStart  ? shiftDate(oldStart,  delta) : ''
    const newFinish = oldFinish ? shiftDate(oldFinish, delta) : ''

    const startInp  = row.querySelector('.bulk-new-start')
    const finishInp = row.querySelector('.bulk-new-finish')
    if (startInp)  { startInp.value = fmtDMY(newStart);  startInp.dataset.iso = newStart }
    if (finishInp) { finishInp.value = fmtDMY(newFinish); finishInp.dataset.iso = newFinish }
    calcRowDelta(row)
  })
  updateBulkPreview()
  toast(`Đã dịch ${delta > 0 ? '+' : ''}${delta} ngày cho ${document.querySelectorAll('.bulk-cb:checked').length} task`, 'success')
}

function resetBulkDates() {
  document.querySelectorAll('#bulk-task-tbody tr').forEach(row => {
    const oldStart  = row.dataset.start
    const oldFinish = row.dataset.finish
    const startInp  = row.querySelector('.bulk-new-start')
    const finishInp = row.querySelector('.bulk-new-finish')
    if (startInp)  { startInp.value = fmtDMY(oldStart);  startInp.dataset.iso = oldStart  || '' }
    if (finishInp) { finishInp.value = fmtDMY(oldFinish); finishInp.dataset.iso = oldFinish || '' }
    const deltaEl = row.querySelector('.bulk-delta')
    if (deltaEl) { deltaEl.textContent = '—'; deltaEl.style.color = 'var(--gray4)' }
  })
  updateBulkPreview()
}

function shiftDate(dateStr, days) {
  if (!dateStr) return ''
  // Parse ISO string trực tiếp tránh timezone offset
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m-1, d)
  date.setDate(date.getDate() + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth()+1).padStart(2,'0')
  const dd = String(date.getDate()).padStart(2,'0')
  return `${yy}-${mm}-${dd}`
}

function calcRowDelta(row) {
  const oldFinish = row.dataset.finish
  const finishInp = row.querySelector('.bulk-new-finish')
  const deltaEl   = row.querySelector('.bulk-delta')
  if (!deltaEl || !finishInp) return

  const newFinish = finishInp.dataset.iso || finishInp.value
  if (!oldFinish || !newFinish) { deltaEl.textContent = '—'; return }

  const delta = Math.round((new Date(newFinish) - new Date(oldFinish)) / 86400000)
  if (delta === 0) {
    deltaEl.textContent = '—'
    deltaEl.style.color = 'var(--gray4)'
  } else {
    deltaEl.textContent = (delta > 0 ? '+' : '') + delta + 'd'
    deltaEl.style.color = delta > 0 ? 'var(--red)' : 'var(--green)'
    deltaEl.style.fontWeight = '600'
  }
}

// Tính lại số ngày khi thay đổi ngày BD hoặc KT mới
function recalcDuration(inp) {
  const row       = inp.closest('tr')
  if (!row) return
  const startInp  = row.querySelector('.bulk-new-start')
  const finishInp = row.querySelector('.bulk-new-finish')
  const durCell   = row.querySelector('.bulk-dur-new')
  if (!startInp || !finishInp) return

  // Tính số ngày mới
  if (startInp.value && finishInp.value && durCell) {
    const days = Math.round((new Date(finishInp.value) - new Date(startInp.value)) / 86400000)
    durCell.textContent = days >= 0 ? days + 'd' : '—'
    durCell.style.color = 'var(--blue)'
  }
  calcRowDelta(row)
  updateBulkPreview()
}

function updateBulkPreview() {
  const el = document.getElementById('bulk-preview-text')
  if (!el) return
  let changed = 0
  document.querySelectorAll('.bulk-cb:checked').forEach(cb => {
    const row = cb.closest('tr')
    if (!row) return
    const oldStart  = row.dataset.start
    const oldFinish = row.dataset.finish
    const newStart  = row.querySelector('.bulk-new-start')?.value
    const newFinish = row.querySelector('.bulk-new-finish')?.value
    if (newStart !== oldStart || newFinish !== oldFinish) changed++
  })
  el.textContent = changed > 0
    ? `✏️ ${changed} công tác sẽ được cập nhật ngày KH`
    : 'Chưa có thay đổi nào'
  el.style.color = changed > 0 ? 'var(--blue)' : 'var(--gray5)'
}

// ── Lưu toàn bộ điều chỉnh ─────────────────────────────────
async function saveBulkReschedule() {
  const revName   = document.getElementById('bulk-revision-name')?.value.trim()
  const reason    = document.getElementById('bulk-reason')?.value.trim()
  const effDate   = document.getElementById('bulk-effective-date')?.value
  const deltaDays = parseInt(document.getElementById('bulk-delta-days')?.value || '0')

  if (!revName) { toast('Vui lòng nhập tên đợt điều chỉnh', 'error'); return }
  if (!reason)  { toast('Vui lòng nhập lý do điều chỉnh', 'error');   return }

  // Collect changes
  const changes = []
  document.querySelectorAll('.bulk-cb:checked').forEach(cb => {
    const row       = cb.closest('tr')
    if (!row) return
    const taskId    = cb.dataset.taskId
    const oldStart  = row.dataset.start  || null
    const oldFinish = row.dataset.finish || null
    const newStart  = row.querySelector('.bulk-new-start')?.dataset.iso  || null
    const newFinish = row.querySelector('.bulk-new-finish')?.dataset.iso || null
    if (newStart !== oldStart || newFinish !== oldFinish) {
      changes.push({ taskId, oldStart, oldFinish, newStart, newFinish })
    }
  })

  if (!changes.length) { toast('Chưa có thay đổi nào để lưu', ''); return }

  const btn = document.getElementById('btn-bulk-save')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...'
  loading(true, `Đang lưu ${changes.length} thay đổi...`)

  try {
    const proj = STATE.currentProject

    // 1. Tạo revision record
    const { data: rev, error: revErr } = await sb.from('schedule_revisions').insert({
      project_id:     proj.id,
      revision_name:  revName,
      reason,
      effective_date: effDate || null,
      delta_days:     isNaN(deltaDays) ? null : deltaDays,
      affected_count: changes.length,
      created_by:     STATE.user.email,
    }).select().single()
    if (revErr) throw revErr

    // 2. Lưu baseline_log cho từng task + update tasks table
    for (const c of changes) {
      // Lưu lịch sử
      await sb.from('baseline_log').insert({
        task_id:      c.taskId,
        project_id:   proj.id,
        changed_by:   STATE.user.email,
        old_start:    c.oldStart,
        old_finish:   c.oldFinish,
        new_start:    c.newStart,
        new_finish:   c.newFinish,
        reason,
        revision_id:  rev.id,
      })

      // Tính lại duration
      let newDur = null
      if (c.newStart && c.newFinish) {
        newDur = Math.round((new Date(c.newFinish) - new Date(c.newStart)) / 86400000)
      }

      // Update task
      await sb.from('tasks').update({
        kh_start:          c.newStart,
        kh_finish:         c.newFinish,
        kh_duration_days:  newDur,
      }).eq('id', c.taskId)
    }

    // 3. Tính lại ngày cha từ min/max ngày con
    loading(true, 'Đang cập nhật ngày hạng mục cha...')
    const allTasks = (await sb.from('tasks')
      .select('id,wbs_code,outline_level,kh_start,kh_finish,is_summary')
      .eq('project_id', proj.id)
      .order('sort_order')).data || []

    // Bottom-up: tính min start và max finish cho summary tasks
    const sorted = [...allTasks].sort((a,b) => b.outline_level - a.outline_level)
    const parentUpdates = []

    sorted.forEach(parent => {
      if (!parent.is_summary) return
      const children = allTasks.filter(c =>
        c.wbs_code && parent.wbs_code &&
        c.wbs_code.startsWith(parent.wbs_code + '.') &&
        c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
      )
      if (!children.length) return
      // Sort string ISO YYYY-MM-DD trực tiếp — tránh timezone bug
      const starts  = children.map(c => c.kh_start).filter(Boolean).sort()
      const finishes = children.map(c => c.kh_finish).filter(Boolean).sort()
      const newStart  = starts[0] || null
      const newFinish = finishes[finishes.length-1] || null
      if (newStart !== parent.kh_start || newFinish !== parent.kh_finish) {
        // Tính duration bằng cách parse ISO string tránh timezone offset
        let dur = null
        if (newStart && newFinish) {
          const [sy,sm,sd] = newStart.split('-').map(Number)
          const [ey,em,ed] = newFinish.split('-').map(Number)
          const s = new Date(sy,sm-1,sd)
          const e = new Date(ey,em-1,ed)
          dur = Math.round((e - s) / 86400000)
        }
        parentUpdates.push({ id: parent.id, kh_start: newStart, kh_finish: newFinish, kh_duration_days: dur })
        // Update local để vòng lặp tiếp theo dùng đúng
        parent.kh_start  = newStart
        parent.kh_finish = newFinish
      }
    })

    for (const upd of parentUpdates) {
      await sb.from('tasks').update({
        kh_start: upd.kh_start, kh_finish: upd.kh_finish, kh_duration_days: upd.kh_duration_days
      }).eq('id', upd.id)
    }

    // 4. Reload và đóng modal
    await loadProjectData(proj.id)
    closeModal()
    navigate('wbs')
    const parentMsg = parentUpdates.length > 0 ? ` · ${parentUpdates.length} hạng mục cha đã cập nhật` : ''
    toast(`✅ Đã lưu đợt điều chỉnh "${revName}" — ${changes.length} công tác${parentMsg}`, 'success')

  } catch(e) {
    toast('Lỗi: ' + e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Lưu điều chỉnh' }
  }
}

// ═══════════════════════════════════════════════════════════
// BULK NHẬP ĐƠN GIÁ — Nhập đơn giá hàng loạt cho task lá
// ═══════════════════════════════════════════════════════════
function openBulkUnitPrice() {
  if (!STATE.currentProject) { toast('Chưa có dự án', 'error'); return }

  // STATE.tasks đã sort theo sort_order — giữ nguyên thứ tự
  const allTasks = [...STATE.tasks]
  if (!allTasks.length) { toast('Chưa có công tác nào', 'error'); return }

  // Tính rollup _contractValue VÀ _earnedValue TRƯỚC khi build rows
  allTasks.sort((a,b) => b.outline_level - a.outline_level).forEach(t => {
    if (!t.is_summary) {
      t._contractValue = (t.unit_price||0) * (t.planned_quantity||1)
      t._earnedValue   = t._contractValue * (t.display_pct||0) / 100
      return
    }
    const children = allTasks.filter(c =>
      c.wbs_code && t.wbs_code &&
      c.wbs_code.startsWith(t.wbs_code + '.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
    )
    t._contractValue = children.reduce((s,c) => s + (c._contractValue||0), 0)
    t._earnedValue   = children.reduce((s,c) => s + (c._earnedValue||0), 0)
  })
  // Khôi phục sort_order gốc
  allTasks.sort((a,b) => (a.sort_order||0) - (b.sort_order||0))

  // Tính tổng hiện tại (chỉ từ task lá)
  const currentTotal = allTasks.filter(t=>!t.is_summary).reduce((s,t) => {
    const qty = t.planned_quantity || 1
    return s + (t.unit_price||0) * qty
  }, 0)

  const rows = allTasks.map(t => {
    const indent = Math.max(0, (t.outline_level - 1)) * 14
    const qty = t.planned_quantity || (t.is_summary ? null : 1)
    const qtyDisplay = qty ? qty + ' ' + (t.unit||'') : (t.is_summary ? '' : '—')
    const contractVal = t.is_summary
      ? (t._contractValue || 0)
      : (t.unit_price||0) * (qty||1)
    const fmtM = v => v > 0 ? v.toLocaleString('vi-VN') + ' ₫' : ''

    if (t.is_summary) {
      const bgColor = t.outline_level===1 ? '#1A2B4A'
                    : t.outline_level===2 ? '#2563EB'
                    : t.outline_level===3 ? '#EEF2FF'
                    : '#F1F5F9'
      const txtColor = t.outline_level<=2 ? 'white'
                     : t.outline_level===3 ? '#1E40AF'
                     : 'var(--navy)'
      const valColor = t.outline_level<=2 ? '#93C5FD'
                     : t.outline_level===3 ? '#1E40AF'
                     : 'var(--navy)'
      return `
        <tr style="background:${bgColor}">
          <td colspan="3" style="padding:6px 8px;padding-left:${8+indent}px;
            font-size:12px;font-weight:600;color:${txtColor}"
            title="${t.name}">
            ▸ ${t.name}
          </td>
          <td style="padding:6px 8px;text-align:right;font-size:12px;font-weight:600;color:${valColor}">
            ${contractVal>0 ? fmtM(contractVal) : ''}
          </td>
        </tr>`
    }

    return `
      <tr data-task-id="${t.id}" style="border-bottom:0.5px solid var(--gray2)">
        <td style="padding:5px 8px;font-size:12px;padding-left:${8+indent}px;
          color:var(--gray7);max-width:400px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
          title="${t.name}">
          ${t.name}
        </td>
        <td style="padding:4px 6px;text-align:center;font-size:11px;color:var(--blue);font-weight:500;white-space:nowrap">
          ${qtyDisplay}
        </td>
        <td style="padding:4px 6px;text-align:center">
          <div style="display:flex;align-items:center;gap:4px;justify-content:center">
            <input type="number" class="up-input form-input"
              data-task-id="${t.id}"
              data-qty="${qty||1}"
              style="padding:6px 12px;font-size:15px;width:200px;text-align:right;font-weight:500"
              value="${t.unit_price||''}"
              placeholder="0"
              min="0" step="1000"
              oninput="updateUPRow(this)">
            <span style="font-size:11px;color:var(--gray5)">₫</span>
          </div>
        </td>
        <td class="up-contract" data-task-id="${t.id}"
          style="padding:5px 8px;text-align:right;font-size:12px;font-weight:500;
          color:${contractVal>0?'var(--navy)':'var(--gray3)'}">
          ${fmtM(contractVal)}
        </td>
      </tr>`
  }).join('')

  const fmtT = v => v > 0 ? v.toLocaleString('vi-VN') + ' ₫' : '0 ₫'

  openModal('💰 Nhập đơn giá hàng loạt', `
    <div style="min-height:50vh">
      <div style="background:var(--lblue);border-radius:var(--radius);padding:12px 16px;margin-bottom:12px;
        display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:13px;color:var(--blue)">
          Nhập đơn giá (VND) cho từng công tác.<br>
          <span style="font-size:11px;color:var(--gray5)">Sản lượng TH = Đơn giá × Khối lượng KH × % hoàn thành</span>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--gray5)">Tổng giá trị HĐ</div>
          <div id="up-total" style="font-size:16px;font-weight:700;color:var(--navy)">${fmtT(currentTotal)}</div>
        </div>
      </div>

      <div style="max-height:calc(95vh - 280px);overflow-y:auto;border:1px solid var(--gray2);border-radius:var(--radius)">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--navy);color:white;font-size:11px;position:sticky;top:0;z-index:1">
              <th style="padding:7px 8px;text-align:left">Hạng mục / Công tác</th>
              <th style="padding:7px 8px;text-align:center;width:100px">Khối lượng KH</th>
              <th style="padding:7px 8px;text-align:center;width:260px">Đơn giá (VND)</th>
              <th style="padding:7px 8px;text-align:right;width:180px">Giá trị HĐ (VND)</th>
            </tr>
          </thead>
          <tbody id="up-tbody">${rows}</tbody>
        </table>
      </div>
      <div style="background:var(--navy);color:white;border-radius:0 0 var(--radius) var(--radius);
        display:flex;justify-content:space-between;align-items:center;padding:8px 14px">
        <span style="font-size:12px;font-weight:600">TỔNG GIÁ TRỊ HỢP ĐỒNG</span>
        <span id="up-total-foot" style="font-size:14px;font-weight:700;color:#93C5FD">${fmtT(currentTotal)}</span>
      </div>
    </div>
  `, `
    <div style="display:flex;align-items:center;gap:8px;width:100%;justify-content:space-between">
      <span style="font-size:12px;color:var(--gray5)" id="up-changed-count">Chưa có thay đổi</span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" id="btn-up-save" onclick="saveBulkUnitPrice()">
          💾 Lưu đơn giá
        </button>
      </div>
    </div>
  `)

  const m = document.querySelector('.modal')
  m.style.maxWidth  = '60vw'
  m.style.width     = '60vw'
  m.style.maxHeight = '95vh'
}

function updateUPRow(inp) {
  const taskId  = inp.dataset.taskId
  const task    = STATE.tasks.find(t => t.id === inp.dataset.taskId)
  const qty     = parseFloat(inp.dataset.qty) || task?.planned_quantity || 1
  const price   = parseFloat(inp.value) || 0
  const val     = price * qty

  // Update contract cell
  const cell = document.querySelector(`.up-contract[data-task-id="${taskId}"]`)
  if (cell) {
    cell.textContent = val > 0 ? val.toFixed(0) + ' M' : '—'
    cell.style.color = val > 0 ? 'var(--navy)' : 'var(--gray3)'
  }

  // Update tổng
  let total = 0
  document.querySelectorAll('.up-input').forEach(i => {
    const p = parseFloat(i.value) || 0
    const q = parseFloat(i.dataset.qty) || 1
    total += p * q
  })
  const fmtT = v => v > 0 ? v.toLocaleString('vi-VN') + ' ₫' : '0 ₫'
  const totalEl = document.getElementById('up-total')
  const totalFoot = document.getElementById('up-total-foot')
  if (totalEl) totalEl.textContent = fmtT(total)
  if (totalFoot) totalFoot.textContent = fmtT(total)

  // Đếm thay đổi
  let changed = 0
  document.querySelectorAll('.up-input').forEach(i => {
    const task = STATE.tasks.find(t => t.id === i.dataset.taskId)
    const oldPrice = task?.unit_price || 0
    const newPrice = parseFloat(i.value) || 0
    if (oldPrice !== newPrice) changed++
  })
  const countEl = document.getElementById('up-changed-count')
  if (countEl) countEl.textContent = changed > 0
    ? `✏️ ${changed} công tác sẽ được cập nhật đơn giá`
    : 'Chưa có thay đổi'
}

async function saveBulkUnitPrice() {
  const changes = []
  document.querySelectorAll('.up-input').forEach(inp => {
    const taskId  = inp.dataset.taskId
    const task    = STATE.tasks.find(t => t.id === taskId)
    const oldPrice = task?.unit_price || 0
    const newPrice = parseFloat(inp.value) || 0
    if (oldPrice !== newPrice) changes.push({ taskId, newPrice })
  })

  if (!changes.length) { toast('Chưa có thay đổi nào', ''); return }

  const btn = document.getElementById('btn-up-save')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...'
  loading(true, `Đang lưu ${changes.length} đơn giá...`)

  try {
    for (const c of changes) {
      const { error } = await sb.from('tasks')
        .update({ unit_price: c.newPrice })
        .eq('id', c.taskId)
      if (error) throw error
    }

    await loadProjectData(STATE.currentProject.id)
    closeModal()
    navigate('wbs')
    toast(`✅ Đã lưu ${changes.length} đơn giá`, 'success')
  } catch(e) {
    toast('Lỗi: ' + e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Lưu đơn giá' }
  }
}


// ═══════════════════════════════════════════════════════════
// XUẤT EXCEL WBS
// ═══════════════════════════════════════════════════════════
async function exportWbsExcel() {
  if (!STATE.tasks.length) { toast('Chưa có dữ liệu', 'error'); return }
  toast('Đang tạo file Excel...', '')

  try {
    // Dùng SheetJS (XLSX) qua CDN
    if (typeof XLSX === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
    }

    const proj = STATE.currentProject
    const tasks = STATE.tasks

    // Rollup _contractValue
    const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)
    sorted.forEach(t => {
      if (!t.is_summary) {
        t._contractValue = (t.unit_price||0) * (t.planned_quantity||1)
        return
      }
      const children = tasks.filter(c =>
        c.wbs_code && t.wbs_code &&
        c.wbs_code.startsWith(t.wbs_code + '.') &&
        c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
      )
      t._contractValue = children.reduce((s,c) => s + (c._contractValue||0), 0)
    })

    // Build rows
    const headers = [
      'WBS', 'Hạng mục / Công tác', 'Cấp độ',
      'KH Bắt đầu', 'KH Kết thúc', 'Ngày KH',
      'Tiến độ (%)', 'Đơn vị', 'KL Kế hoạch', 'KL Thực hiện',
      'Đơn giá (VND)', 'Giá trị HĐ (VND)', 'Sản lượng TH (VND)',
      'Trạng thái'
    ]

    const dataRows = tasks.map(t => {
      const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete || 0)
      const cv  = t._contractValue || 0
      const earned = cv * pct / 100

      // Trạng thái text
      let status = ''
      if (t.is_summary) {
        status = pct === 100 ? 'Hoàn thành' : pct > 0 ? 'Đang TH' : 'Chưa BĐ'
      } else {
        const d = t._delayDetail
        if (d?.done) status = 'Xong'
        else if (d?.delayDays > 0) status = `Trễ ${d.delayDays} ngày`
        else if (d?.delayDays < 0) status = `Sớm ${Math.abs(d.delayDays)} ngày`
        else status = 'Đúng KH'
      }

      return [
        t.wbs_code || '',
        '  '.repeat(t.outline_level - 1) + t.name,
        t.outline_level,
        t.kh_start || '',
        t.kh_finish || '',
        t.kh_duration_days || '',
        pct,
        t.unit || '%',
        t.planned_quantity || '',
        t.actual_quantity || '',
        t.unit_price || '',
        cv || '',
        cv > 0 ? Math.round(earned) : '',
        status
      ]
    })

    // Tạo workbook
    const wb = XLSX.utils.book_new()
    const wsData = [headers, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Định dạng cột
    ws['!cols'] = [
      {wch:12}, {wch:55}, {wch:6},
      {wch:12}, {wch:12}, {wch:8},
      {wch:10}, {wch:8}, {wch:10}, {wch:10},
      {wch:16}, {wch:18}, {wch:18},
      {wch:18}
    ]

    // Màu theo level — giống WBS panel
    const levelColors = {
      0: { bg: '1A2B4A', fg: 'FFFFFF', bold: true },  // header
      1: { bg: '1A2B4A', fg: 'FFFFFF', bold: true },  // lv1 root
      2: { bg: '2563EB', fg: 'FFFFFF', bold: true },  // lv2
      3: { bg: 'EEF2FF', fg: '1E40AF', bold: true },  // lv3
      4: { bg: 'F1F5F9', fg: '334155', bold: true },  // lv4
      5: { bg: 'FFFFFF', fg: '374151', bold: false }, // lv5 leaf
      6: { bg: 'FFFFFF', fg: '374151', bold: false }, // lv6 leaf
    }

    const range = XLSX.utils.decode_range(ws['!ref'])

    // Tô màu header row (row 0)
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({r: 0, c})
      if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' }
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { patternType: 'solid', fgColor: { rgb: '1A2B4A' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }
        }
      }
    }

    // Tô màu data rows theo level
    tasks.forEach((t, i) => {
      const rowIdx = i + 1  // +1 vì header ở row 0
      const lv = Math.min(t.outline_level, 6)
      const clr = levelColors[lv] || levelColors[5]

      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({r: rowIdx, c})
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' }

        const isMoneyCol = c >= 10  // Đơn giá, Giá trị HĐ, Sản lượng TH
        const isPctCol   = c === 6

        ws[cellRef].s = {
          font: {
            bold: clr.bold,
            color: { rgb: clr.fg },
            sz: 10
          },
          fill: {
            patternType: 'solid',
            fgColor: { rgb: clr.bg }
          },
          alignment: {
            horizontal: isMoneyCol ? 'right' : isPctCol ? 'center' : 'left',
            vertical: 'center'
          },
          border: {
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        }
      }
    })

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' }

    XLSX.utils.book_append_sheet(wb, ws, 'WBS Tiến độ')

    // Xuất file
    const fileName = (proj?.code || 'WBS') + '_TienDo_' + new Date().toISOString().slice(0,10) + '.xlsx'
    XLSX.writeFile(wb, fileName)
    toast('Đã xuất Excel: ' + fileName, 'success')

  } catch(e) {
    toast('Lỗi xuất Excel: ' + e.message, 'error')
    console.error(e)
  }
}
