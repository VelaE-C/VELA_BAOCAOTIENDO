// ═══════════════════════════════════════════════════════════
// PAGE: PHOTOS
// ═══════════════════════════════════════════════════════════
function photos() {
  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Ảnh hiện trường</h2>
  <div class="card">
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select class="form-input" id="photo-week-filter" style="width:160px" onchange="loadPhotos()">
        <option value="all">— Tất cả các tuần —</option>
        ${Array.from({length:12},(_,i) => {
          const w = getISOWeek(new Date()) - i
          return `<option value="${w}" ${i===0?'selected':''}>Tuần ${w}</option>`
        }).join('')}
      </select>
      <select class="form-input" id="photo-task-filter" style="width:200px" onchange="loadPhotos()">
        <option value="">Tất cả công tác</option>
        <option value="__general__">🚁 Ảnh tổng thể</option>
        ${STATE.tasks.filter(t=>!t.is_summary).slice(0,30).map(t =>
          `<option value="${t.id}">${t.name.slice(0,40)}</option>`
        ).join('')}
      </select>
      <button class="btn btn-primary btn-sm" onclick="openGeneralPhotoModal()" style="white-space:nowrap">
        🚁 Upload ảnh tổng thể
      </button>
    </div>
    <div id="photo-grid-main" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px"></div>
  </div>

  <!-- Modal upload ảnh tổng thể -->
  <div id="general-photo-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;align-items:center;justify-content:center;padding:20px">
    <div style="background:white;border-radius:12px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--gray2);display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-size:15px;font-weight:600">🚁 Upload ảnh tổng thể / Flycam</h3>
        <button onclick="document.getElementById('general-photo-modal').style.display='none'"
          style="background:none;border:none;font-size:20px;color:var(--gray4);cursor:pointer">✕</button>
      </div>
      <div style="padding:20px 24px">
        <div class="form-group">
          <label class="form-label">Ghi chú nội dung <span style="color:var(--red)">*</span></label>
          <input class="form-input" id="general-photo-caption" placeholder="VD: Tổng thể dự án, Flycam 10 căn BT19.25..." />
        </div>
        <div class="form-group">
          <label class="form-label">Chọn ảnh (có thể chọn nhiều)</label>
          <input type="file" id="general-photo-files" accept="image/*" multiple
            style="width:100%;padding:8px;border:1px solid var(--gray3);border-radius:8px;font-size:13px">
        </div>
        <div id="general-photo-preview" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px"></div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid var(--gray2);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" onclick="document.getElementById('general-photo-modal').style.display='none'">Hủy</button>
        <button class="btn btn-primary" id="btn-upload-general" onclick="uploadGeneralPhotos()">
          ⬆️ Upload
        </button>
      </div>
    </div>
  </div>`
}

// ═══════════════════════════════════════════════════════════
// UPLOAD ẢNH TỔNG THỂ
// ═══════════════════════════════════════════════════════════
function openGeneralPhotoModal() {
  document.getElementById('general-photo-caption').value = ''
  document.getElementById('general-photo-files').value = ''
  document.getElementById('general-photo-preview').innerHTML = ''
  document.getElementById('general-photo-modal').style.display = 'flex'

  // Preview khi chọn file
  document.getElementById('general-photo-files').onchange = function() {
    const preview = document.getElementById('general-photo-preview')
    preview.innerHTML = ''
    Array.from(this.files).slice(0,9).forEach(f => {
      const url = URL.createObjectURL(f)
      preview.innerHTML += `
        <div style="aspect-ratio:1;border-radius:6px;overflow:hidden;background:var(--gray1)">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover">
        </div>`
    })
  }
}

async function uploadGeneralPhotos() {
  const caption = document.getElementById('general-photo-caption').value.trim()
  const files   = document.getElementById('general-photo-files').files

  if (!caption) { toast('Vui lòng nhập ghi chú nội dung', 'error'); return }
  if (!files.length) { toast('Vui lòng chọn ít nhất 1 ảnh', 'error'); return }
  if (!STATE.currentProject) { toast('Chưa có dự án', 'error'); return }

  const btn = document.getElementById('btn-upload-general')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Đang upload...'

  const now     = new Date()
  const week    = getISOWeek(now)
  const year    = now.getFullYear()
  let uploaded  = 0, failed = 0

  for (const file of Array.from(files)) {
    try {
      // Nén ảnh nếu có imageCompression
      let uploadFile = file
      if (typeof imageCompression !== 'undefined' && file.type.startsWith('image/')) {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: true, fileType: 'image/jpeg'
        })
      }

      const ext  = uploadFile.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop()
      const path = `${STATE.currentProject.id}/general/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`
      const buf  = await uploadFile.arrayBuffer()

      const { error: upErr } = await sb.storage
        .from(CFG.STORAGE_BUCKET).upload(path, buf, {
          upsert: true, contentType: uploadFile.type || 'image/jpeg'
        })
      if (upErr) { failed++; continue }

      const { data: urlData } = sb.storage.from(CFG.STORAGE_BUCKET).getPublicUrl(path)
      const photoUrl = urlData?.publicUrl || `${CFG.SUPABASE_URL}/storage/v1/object/public/${CFG.STORAGE_BUCKET}/${path}`

      // Lưu vào task_photos với task_id = null, caption = ghi chú
      await sb.from('task_photos').insert({
        task_id:     null,
        project_id:  STATE.currentProject.id,
        week_number: week,
        year,
        photo_url:   photoUrl,
        caption,           // ghi chú nội dung
        uploaded_by: STATE.user.email,
        taken_at:    now.toISOString().slice(0,10),
      })
      uploaded++
    } catch(e) {
      console.error('Upload failed:', e)
      failed++
    }
  }

  btn.disabled = false
  btn.innerHTML = '⬆️ Upload'
  document.getElementById('general-photo-modal').style.display = 'none'

  if (uploaded > 0) toast(`Đã upload ${uploaded} ảnh tổng thể!`, 'success')
  if (failed > 0)   toast(`${failed} ảnh bị lỗi`, 'error')
  loadPhotos()
}

async function loadPhotos() {
  const el = document.getElementById('photo-grid-main')
  if (!el) return
  if (!STATE.currentProject) { el.innerHTML='<div style="color:var(--gray4);padding:20px">Chưa có dự án</div>'; return }
  el.innerHTML = '<span style="color:var(--gray4)">Đang tải...</span>'

  const weekVal = document.getElementById('photo-week-filter')?.value || String(getISOWeek(new Date()))
  const taskVal = document.getElementById('photo-task-filter')?.value

  let query = sb.from('task_photos')
    .select('*, tasks(name,wbs_code)')
    .eq('project_id', STATE.currentProject.id)

  if (weekVal !== 'all') {
    query = query.eq('week_number', parseInt(weekVal)).eq('year', new Date().getFullYear())
  }

  // Filter: ảnh tổng thể (task_id null) hoặc task cụ thể
  if (taskVal === '__general__') {
    query = query.is('task_id', null)
  } else if (taskVal) {
    query = query.eq('task_id', taskVal)
  }

  query = query.order('created_at', {ascending: false})
  const { data: photos } = await query

  if (!photos?.length) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px;text-align:center">Chưa có ảnh</div>'
    return
  }

  el.innerHTML = photos.map(p => {
    const displayUrl = p.photo_url
    const isGeneral  = !p.task_id
    const title      = isGeneral
      ? (p.caption || 'Ảnh tổng thể')
      : (p.tasks?.name || p.caption || '—')

    return `
    <div style="border-radius:var(--radius);overflow:hidden;border:1px solid var(--gray2);background:white;cursor:pointer"
         onclick="window.open('${displayUrl}','_blank','noopener')">
      <div style="width:100%;height:160px;background-image:url('${displayUrl}');background-size:cover;background-position:center;background-color:var(--gray1);position:relative">
        ${isGeneral ? `<div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);color:white;font-size:10px;padding:2px 8px;border-radius:4px">🚁 Tổng thể</div>` : ''}
        <div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.5);color:white;font-size:10px;padding:2px 8px;border-radius:4px">
          📷 Tuần ${p.week_number||''}
        </div>
      </div>
      <div style="padding:8px 10px">
        <div style="font-size:12px;font-weight:500;color:${isGeneral?'var(--teal)':'var(--gray7)'};margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
             title="${title}">${title.slice(0,38)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:var(--gray4)">📅 ${p.taken_at||''}</span>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="font-size:11px;color:var(--gray4)">${p.uploaded_by?.split('@')[0]||''}</span>
            ${['admin','planner'].includes(STATE.role) ? `
            <button onclick="event.stopPropagation();deletePhoto('${p.id}','${p.photo_url}')"
              style="background:#FEE2E2;border:none;color:#DC2626;font-size:11px;padding:2px 7px;border-radius:4px;cursor:pointer;line-height:1.4"
              title="Xóa ảnh này">🗑️</button>` : ''}
          </div>
        </div>
      </div>
    </div>`
  }).join('')
}

// ═══════════════════════════════════════════════════════════
// XÓA ẢNH HIỆN TRƯỜNG
// ═══════════════════════════════════════════════════════════
async function deletePhoto(photoId, photoUrl) {
  if (!['admin','planner'].includes(STATE.role)) {
    toast('Không có quyền xóa ảnh', 'error'); return
  }
  if (!confirm('Xóa ảnh này? Không thể hoàn tác.')) return

  loading(true, 'Đang xóa ảnh...')
  try {
    const { error: dbErr } = await sb.from('task_photos').delete().eq('id', photoId)
    if (dbErr) throw dbErr
    try {
      const urlParts = photoUrl.split('/storage/v1/object/public/' + CFG.STORAGE_BUCKET + '/')
      if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1])
        await sb.storage.from(CFG.STORAGE_BUCKET).remove([storagePath])
      }
    } catch(e) { console.warn('Storage remove failed:', e) }
    toast('Đã xóa ảnh!', 'success')
    loadPhotos()
  } catch(e) {
    toast('Lỗi xóa ảnh: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}
