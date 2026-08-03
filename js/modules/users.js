// ═══════════════════════════════════════════════════════════
// QUẢN LÝ USER
// ═══════════════════════════════════════════════════════════
function usersPage() {
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h2 style="font-size:18px;font-weight:700">Quản lý User & Dự án</h2>
      <p style="font-size:13px;color:var(--gray4)">Tạo tài khoản, phân quyền và quản lý dự án</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${STATE.role==='admin'?`<button class="btn btn-secondary btn-sm" onclick="openCreateProjectModal()">🏗️ Tạo dự án</button>`:''}
      <button class="btn btn-secondary" onclick="openBulkImportModal()">📥 Import CSV</button>
      <button class="btn btn-primary" onclick="openAddUserModal()">➕ Thêm user</button>
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
  </div>

  <!-- Quản lý dự án -->
  <div class="card" style="margin-top:16px;padding:0;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--gray2);display:flex;justify-content:space-between;align-items:center">
      <div class="card-title" style="margin:0">🏗️ Danh sách dự án</div>
      ${STATE.role==='admin'?`<button class="btn btn-primary btn-sm" onclick="openCreateProjectModal()">➕ Tạo dự án mới</button>`:''}
    </div>
    <div id="project-list-admin" style="padding:12px">
      <div style="color:var(--gray4);text-align:center;padding:16px">Đang tải...</div>
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
  await loadAdminProjects()
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
// QUẢN LÝ DỰ ÁN — Tạo / Sửa / Xóa
// ═══════════════════════════════════════════════════════════
async function loadAdminProjects() {
  const el = document.getElementById('project-list-admin')
  if (!el) return

  const { data: projects } = await sb.from('projects')
    .select('*').order('created_at', { ascending: false })

  if (!projects?.length) {
    el.innerHTML = '<div style="color:var(--gray4);padding:16px;text-align:center">Chưa có dự án nào</div>'
    return
  }

  const fmtD = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
  const rows = projects.map(p => `
    <tr style="border-bottom:0.5px solid var(--gray2)">
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:var(--navy)">${p.code || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;color:var(--gray7)">${p.name}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--gray5);text-align:center">${fmtD(p.start_date)}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--gray5);text-align:center">${fmtD(p.finish_date)}</td>
      <td style="padding:8px 12px;text-align:center">
        ${p.contract_value
          ? `<span style="font-size:12px;color:var(--teal);font-weight:600">${(p.contract_value/1e9).toFixed(1)}tỷ</span>`
          : '<span style="font-size:11px;color:var(--gray4)">—</span>'}
      </td>
      <td style="padding:8px 12px;text-align:center">
        <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${p.start_date?'#DCFCE7':'#FEF3C7'};color:${p.start_date?'#166534':'#92400E'}">
          ${p.start_date ? '✅ Có tiến độ' : '⏳ Chờ import'}
        </span>
      </td>
      <td style="padding:8px 12px;text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button onclick="openEditProjectInfoModal('${p.id}','${(p.code||'').replace(/'/g,"\\'")}','${p.name.replace(/'/g,"\\'")}','${p.contract_value||''}')"
            class="btn btn-secondary btn-sm" style="font-size:11px">✏️</button>
        </div>
      </td>
    </tr>`).join('')

  el.innerHTML = `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--navy);color:white;font-size:12px">
          <th style="padding:8px 12px;text-align:left">Mã DA</th>
          <th style="padding:8px 12px;text-align:left">Tên dự án</th>
          <th style="padding:8px 12px;text-align:center">Ngày BĐ</th>
          <th style="padding:8px 12px;text-align:center">Ngày KT</th>
          <th style="padding:8px 12px;text-align:center">Giá trị HĐ</th>
          <th style="padding:8px 12px;text-align:center">Trạng thái</th>
          <th style="padding:8px 12px;text-align:center">Thao tác</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}

function openCreateProjectModal() {
  openModal('🏗️ Tạo dự án mới', `
    <div style="font-size:13px;color:var(--gray5);margin-bottom:14px;padding:10px;background:var(--lblue);border-radius:6px">
      💡 Tạo dự án trống để app CHAMCONG có thể chọn ngay.<br>
      Import tiến độ XML sau khi có file từ MS Project.
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Mã dự án (viết tắt) <span style="color:var(--red)">*</span></label>
        <input class="form-input" id="cp-code" placeholder="VD: GENBYTE, KN, VCN2..." style="text-transform:uppercase">
      </div>
      <div class="form-group">
        <label class="form-label">Giá trị hợp đồng (VND)</label>
        <input class="form-input" type="number" id="cp-value" placeholder="VD: 50000000000">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Tên đầy đủ <span style="color:var(--red)">*</span></label>
      <input class="form-input" id="cp-name" placeholder="VD: GenByte Factory — Nhà xưởng sản xuất">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Ngày bắt đầu KH</label>
        <input class="form-input" type="date" id="cp-start">
      </div>
      <div class="form-group">
        <label class="form-label">Ngày kết thúc KH</label>
        <input class="form-input" type="date" id="cp-finish">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="createEmptyProject()">💾 Tạo dự án</button>
  `)
  setTimeout(() => {
    document.getElementById('cp-code')?.addEventListener('input', function() {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')
    })
    document.getElementById('cp-code')?.focus()
  }, 100)
}

async function createEmptyProject() {
  const code  = document.getElementById('cp-code')?.value.trim().toUpperCase()
  const name  = document.getElementById('cp-name')?.value.trim()
  const start = document.getElementById('cp-start')?.value || null
  const finish= document.getElementById('cp-finish')?.value || null
  const value = parseFloat(document.getElementById('cp-value')?.value) || null

  if (!code) { toast('Vui lòng nhập mã dự án', 'error'); return }
  if (!name)  { toast('Vui lòng nhập tên dự án', 'error'); return }

  // Kiểm tra code trùng
  const { data: existing } = await sb.from('projects').select('id').eq('code', code).maybeSingle()
  if (existing) { toast('Mã dự án đã tồn tại: ' + code, 'error'); return }

  loading(true, 'Đang tạo dự án...')
  const { data, error } = await sb.from('projects').insert({
    code, name, msp_name: name,
    start_date: start, finish_date: finish, contract_value: value,
  }).select().single()
  loading(false)

  if (error) { toast('Lỗi: ' + error.message, 'error'); return }

  closeModal()
  toast(`✅ Đã tạo dự án ${code}`, 'success')

  // Reload selector + admin list
  const { data: projs } = await sb.from('projects').select('*').order('code')
  STATE.projects = projs || []
  const sel = document.getElementById('proj-select') || document.getElementById('project-select')
  if (sel) {
    sel.innerHTML = STATE.projects.map(p =>
      `<option value="${p.id}" ${p.id===STATE.currentProject?.id?'selected':''}>
        ${p.code ? p.code+' — ' : ''}${p.name}
      </option>`
    ).join('')
  }
  await loadAdminProjects()
}

function openEditProjectInfoModal(id, code, name, value) {
  openModal('✏️ Sửa thông tin dự án', `
    <div class="form-group">
      <label class="form-label">Mã dự án</label>
      <input class="form-input" id="ep-code" value="${code}" style="text-transform:uppercase">
    </div>
    <div class="form-group">
      <label class="form-label">Tên đầy đủ</label>
      <input class="form-input" id="ep-name" value="${name}">
    </div>
    <div class="form-group">
      <label class="form-label">Giá trị hợp đồng (VND)</label>
      <input class="form-input" type="number" id="ep-value" value="${value}">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
    <button class="btn btn-primary" onclick="saveProjectInfo('${id}')">💾 Lưu</button>
  `)
}

async function saveProjectInfo(id) {
  const code  = document.getElementById('ep-code')?.value.trim().toUpperCase()
  const name  = document.getElementById('ep-name')?.value.trim()
  const value = parseFloat(document.getElementById('ep-value')?.value) || null
  if (!name) { toast('Vui lòng nhập tên', 'error'); return }

  loading(true, 'Đang lưu...')
  const { error } = await sb.from('projects')
    .update({ code, name, msp_name: name, contract_value: value })
    .eq('id', id)
  loading(false)
  if (error) { toast('Lỗi: ' + error.message, 'error'); return }
  closeModal()
  toast('Đã cập nhật dự án', 'success')

  // Refresh selector
  const { data: projs } = await sb.from('projects').select('*').order('code')
  STATE.projects = projs || []
  const sel = document.getElementById('proj-select') || document.getElementById('project-select')
  if (sel) {
    sel.innerHTML = STATE.projects.map(p =>
      `<option value="${p.id}" ${p.id===STATE.currentProject?.id?'selected':''}>
        ${p.code ? p.code+' — ' : ''}${p.name}
      </option>`
    ).join('')
  }
  await loadAdminProjects()
}
