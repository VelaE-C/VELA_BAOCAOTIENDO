// ═══════════════════════════════════════════════════════════
// HELPERS — dùng toàn app, không phụ thuộc module nào khác
// ═══════════════════════════════════════════════════════════

function toast(msg, type='') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = 'toast show' + (type ? ' '+type : '')
  setTimeout(() => t.className='toast', 3000)
}

function loading(show, msg='Đang xử lý...') {
  document.getElementById('loading').style.display = show ? 'flex' : 'none'
  document.getElementById('loading-msg').textContent = msg
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'})
}

function fmtDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'})
}

function getISOWeek(d) {
  const date = new Date(d)
  date.setHours(0,0,0,0)
  date.setDate(date.getDate() + 3 - (date.getDay()+6) % 7)
  const w1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date - w1)/86400000 - 3 + (w1.getDay()+6) % 7) / 7)
}

function statusBadge(status) {
  const map = {
    'done':             ['badge-blue','✅ Hoàn thành'],
    'on_track':         ['badge-green','🟢 Đúng TĐ'],
    'ahead':            ['badge-green','🟢 Vượt TĐ'],
    'delayed':          ['badge-amber','🟡 Chậm nhẹ'],
    'critical':         ['badge-red','🔴 Chậm nghiêm trọng'],
    'not_started':      ['badge-gray','⚫ Chưa BĐ'],
    'not_started_late': ['badge-red','🔴 Chưa BĐ - Trễ'],
    'in_progress':      ['badge-blue','🔵 Đang TH'],
  }
  const [cls, lbl] = map[status] || ['badge-gray', status]
  return `<span class="badge ${cls}">${lbl}</span>`
}

function openModal(title, body, foot='') {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = body
  document.getElementById('modal-foot').innerHTML = foot
  document.getElementById('modal').style.display = 'flex'
}

function closeModal() {
  document.getElementById('modal').style.display = 'none'
}
