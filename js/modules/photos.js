// ═══════════════════════════════════════════════════════════
// PAGE: PHOTOS
// ═══════════════════════════════════════════════════════════
function photos() {
  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Ảnh hiện trường</h2>
  <div class="card">
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <select class="form-input" id="photo-week-filter" style="width:160px" onchange="loadPhotos()">
        <option value="all">— Tất cả các tuần —</option>
        ${Array.from({length:12},(_,i) => {
          const w = getISOWeek(new Date()) - i
          return `<option value="${w}" ${i===0?'selected':''}>Tuần ${w}</option>`
        }).join('')}
      </select>
      <select class="form-input" id="photo-task-filter" style="width:200px" onchange="loadPhotos()">
        <option value="">Tất cả công tác</option>
        ${STATE.tasks.filter(t=>!t.is_summary).slice(0,30).map(t =>
          `<option value="${t.id}">${t.name.slice(0,40)}</option>`
        ).join('')}
      </select>
    </div>
    <div id="photo-grid-main" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px"></div>
  </div>`
}

async function loadPhotos() {
  const el = document.getElementById('photo-grid-main')
  if (!el) return
  if (!STATE.currentProject) { el.innerHTML='<div style="color:var(--gray4);padding:20px">Chưa có dự án</div>'; return }
  el.innerHTML = '<span style="color:var(--gray4)">Đang tải...</span>'

  const weekVal = document.getElementById('photo-week-filter')?.value || String(getISOWeek(new Date()))
  const taskId = document.getElementById('photo-task-filter')?.value

  let query = sb.from('task_photos')
    .select('*, tasks(name,wbs_code)')
    .eq('project_id', STATE.currentProject.id)

  if (weekVal !== 'all') {
    query = query.eq('week_number', parseInt(weekVal)).eq('year', new Date().getFullYear())
  }
  query = query.order('created_at', {ascending: false})

  if (taskId) query = query.eq('task_id', taskId)
  const { data: photos } = await query

  if (!photos?.length) {
    el.innerHTML = '<div style="color:var(--gray4);padding:20px;text-align:center">Chưa có ảnh tuần này</div>'
    return
  }

  // Dùng public URL trực tiếp — CSS background-image không bị CORS
  const photosWithUrls = photos.map(p => ({ ...p, display_url: p.photo_url }))

  el.innerHTML = photosWithUrls.map(p => {
    const displayUrl = p.display_url || p.photo_url
    // Dùng CSS background-image thay vì <img> — không bị CORS block
    return `
    <div style="border-radius:var(--radius);overflow:hidden;border:1px solid var(--gray2);background:white;cursor:pointer"
         onclick="window.open('${displayUrl}','_blank','noopener')">
      <div style="
        width:100%;height:160px;
        background-image:url('${displayUrl}');
        background-size:cover;
        background-position:center;
        background-color:var(--gray1);
        position:relative;
      ">
        <div style="
          position:absolute;inset:0;
          display:flex;align-items:center;justify-content:center;
          background:rgba(0,0,0,0);
          transition:background .2s;
        " onmouseover="this.style.background='rgba(0,0,0,0.15)'"
           onmouseout="this.style.background='rgba(0,0,0,0)'">
          <span style="
            background:rgba(0,0,0,.5);color:white;
            font-size:11px;padding:4px 10px;border-radius:12px;
            opacity:0;transition:opacity .2s;
          " class="photo-view-label">🔍 Xem ảnh</span>
        </div>
        <div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.5);color:white;font-size:10px;padding:2px 8px;border-radius:4px">
          📷 Tuần ${p.week_number||''}
        </div>
      </div>
      <div style="padding:8px 10px">
        <div style="font-size:12px;font-weight:500;color:var(--gray7);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
             title="${p.tasks?.name||''}">
          ${p.tasks?.name?.slice(0,38) || '—'}
        </div>
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
    // Xóa record trong DB
    const { error: dbErr } = await sb.from('task_photos').delete().eq('id', photoId)
    if (dbErr) throw dbErr

    // Xóa file trong Storage
    try {
      const urlParts = photoUrl.split('/storage/v1/object/public/' + CFG.STORAGE_BUCKET + '/')
      if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1])
        await sb.storage.from(CFG.STORAGE_BUCKET).remove([storagePath])
      }
    } catch(e) {
      console.warn('Storage remove failed (DB record deleted):', e)
    }

    toast('Đã xóa ảnh!', 'success')
    loadPhotos()  // Reload gallery
  } catch(e) {
    toast('Lỗi xóa ảnh: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}
