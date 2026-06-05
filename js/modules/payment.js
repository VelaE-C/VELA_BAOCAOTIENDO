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
