// ═══════════════════════════════════════════════════════════
// PAGE: IMPORT MS PROJECT
// ═══════════════════════════════════════════════════════════
function importPage() {
  return `
  <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Import từ MS Project</h2>
  <div class="card">
    <div class="card-title">Tạo dự án mới từ file XML</div>
    <div class="card-sub">Export từ MS Project: File → Save As → XML (*.xml)</div>
    <div class="form-row" style="margin-bottom:14px">
      <div class="form-group">
        <label class="form-label">Mã dự án (viết tắt)</label>
        <input class="form-input" id="imp-code" placeholder="VD: OASIS, VEGA, VCN...">
      </div>
      <div class="form-group">
        <label class="form-label">Tên đầy đủ</label>
        <input class="form-input" id="imp-name" placeholder="VD: OASIS - Tiến Độ Thi Công">
      </div>
    </div>
    <div class="drop-zone" id="drop-zone"
         ondragover="event.preventDefault();this.classList.add('dragover')"
         ondragleave="this.classList.remove('dragover')"
         ondrop="handleDrop(event)"
         onclick="document.getElementById('xml-input').click()">
      <div class="dz-icon">📂</div>
      <h3>Kéo thả file XML vào đây</h3>
      <p>hoặc bấm để chọn file · Hỗ trợ file .xml từ MS Project</p>
    </div>
    <input type="file" id="xml-input" accept=".xml" style="display:none" onchange="handleFileSelect(this)">
    <div id="import-preview" style="margin-top:16px"></div>
  </div>`
}

function initImport() {}

function handleDrop(e) {
  e.preventDefault()
  document.getElementById('drop-zone').classList.remove('dragover')
  const file = e.dataTransfer.files[0]
  if (file) processXmlFile(file)
}

function handleFileSelect(input) {
  const file = input.files[0]
  if (file) processXmlFile(file)
}

async function processXmlFile(file) {
  const code = document.getElementById('imp-code').value.trim().toUpperCase()
  const name = document.getElementById('imp-name').value.trim()

  if (!code) { toast('Vui lòng nhập mã dự án', 'error'); return }

  const prev = document.getElementById('import-preview')
  prev.innerHTML = '<span style="color:var(--gray4)">Đang đọc file...</span>'

  const xmlText = await file.text()
  const parsed = parseMspXml(xmlText, code, name)
  const m = parsed.meta

  prev.innerHTML = `
    <div style="background:var(--lblue);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px">
      <div style="font-size:14px;font-weight:600;color:var(--navy);margin-bottom:8px">✅ Đọc file thành công</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:13px">
        <div><div style="color:var(--gray4);font-size:11px">Tổng tasks</div><strong>${m.total_tasks}</strong></div>
        <div><div style="color:var(--gray4);font-size:11px">Công tác thực tế</div><strong>${m.leaf_tasks}</strong></div>
        <div><div style="color:var(--gray4);font-size:11px">Predecessor</div><strong>${m.total_preds}</strong></div>
        <div><div style="color:var(--gray4);font-size:11px">Số level WBS</div><strong>${m.levels.join(',')}</strong></div>
      </div>
      <div style="font-size:12px;color:var(--gray5);margin-top:8px">
        ${parsed.project.start_date} → ${parsed.project.finish_date}
      </div>
    </div>
    <button class="btn btn-primary" onclick="uploadToSupabase(window._parsedData)">
      ⬆️ Upload lên Supabase
    </button>`

  window._parsedData = parsed
}

async function uploadToSupabase(parsed) {
  loading(true, 'Đang upload project...')
  try {
    const { tasks, predecessors, project } = parsed

    // Upsert project
    const { data: projData, error: pErr } = await sb.from('projects')
      .upsert({ code: project.code, name: project.name, msp_name: project.msp_name,
                start_date: project.start_date, finish_date: project.finish_date,
                updated_at: new Date().toISOString() }, { onConflict: 'code' })
      .select('id').single()
    if (pErr) throw pErr
    const projectId = projData.id

    // Upsert tasks in batches
    loading(true, `Uploading ${tasks.length} tasks...`)
    const BATCH = 50
    for (let i = 0; i < tasks.length; i += BATCH) {
      const batch = tasks.slice(i, i+BATCH).map(t => ({
        project_id: projectId, msp_uid: t.msp_uid, msp_id: t.msp_id,
        wbs_code: t.wbs_code, outline_level: t.outline_level, name: t.name,
        is_summary: t.is_summary, is_milestone: t.is_milestone, is_active: t.is_active,
        kh_start: t.kh_start, kh_finish: t.kh_finish, kh_duration_days: t.kh_duration_days,
        sort_order: t.sort_order, updated_at: new Date().toISOString()
      }))
      const { error } = await sb.from('tasks').upsert(batch, { onConflict: 'project_id,msp_uid' })
      if (error) throw error
    }

    // Get task UUID map
    const { data: taskList } = await sb.from('tasks').select('id,msp_uid').eq('project_id', projectId)
    const uidToId = {}
    taskList.forEach(t => { uidToId[t.msp_uid] = t.id })

    // Predecessors
    loading(true, `Uploading ${predecessors.length} predecessors...`)
    await sb.from('task_predecessors').delete().eq('project_id', projectId)
    const predRows = predecessors
      .filter(p => uidToId[p.task_msp_uid] && uidToId[p.predecessor_msp_uid])
      .map(p => ({ project_id: projectId, task_id: uidToId[p.task_msp_uid],
                   predecessor_id: uidToId[p.predecessor_msp_uid],
                   link_type: p.link_type, lag_days: p.lag_days }))
    for (let i = 0; i < predRows.length; i += BATCH) {
      const { error } = await sb.from('task_predecessors').insert(predRows.slice(i, i+BATCH))
      if (error) throw error
    }

    // Reload
    const { data: projs } = await sb.from('projects').select('*').order('code')

    STATE.projects = projs || []
    const sel = document.getElementById('proj-select')
    sel.innerHTML = STATE.projects.map(p =>
      `<option value="${p.id}" ${p.id===projectId?'selected':''}>${p.code} — ${p.name}</option>`
    ).join('')
    STATE.currentProject = STATE.projects.find(p => p.id === projectId)
    await loadProjectData(projectId)

    toast(`Import thành công: ${tasks.length} tasks, ${predecessors.length} predecessors!`, 'success')
    navigate('wbs')
  } catch(e) {
    toast('Lỗi import: ' + e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
  }
}

// ═══════════════════════════════════════════════════════════
// MS PROJECT XML PARSER (client-side)
// ═══════════════════════════════════════════════════════════
const LINK_TYPES = {'0':'FF','1':'FS','2':'SF','3':'SS'}

function parseMspXml(xmlStr, code, name) {
  const NS = 'http://schemas.microsoft.com/project'
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml')
  const root = doc.documentElement

  function txt(el, tag) {
    const found = el.getElementsByTagNameNS(NS, tag)
    return found.length ? found[0].textContent.trim() : ''
  }
  function parseDur(s) {
    if (!s) return null
    const m = s.match(/PT(\d+)H/)
    return m ? Math.round(parseInt(m[1])/8) : null
  }
  function parseLag(s) { return Math.round(parseInt(s||'0')/4800*10)/10 }

  const project = {
    code: code.toUpperCase(),
    name: name || txt(root,'Name') || code,
    msp_name: txt(root,'Name'),
    start_date: (txt(root,'StartDate')||'').slice(0,10) || null,
    finish_date: (txt(root,'FinishDate')||'').slice(0,10) || null,
  }

  const allTasks = [...root.getElementsByTagNameNS(NS,'Task')]
  const uidMap = {}, tasks = [], predecessors = []

  allTasks.forEach((t, sortOrder) => {
    const uid = parseInt(txt(t,'UID')||'0')
    if (uid === 0) return
    const task = {
      msp_uid: uid, msp_id: parseInt(txt(t,'ID')||'0'),
      wbs_code: txt(t,'WBS'), outline_level: parseInt(txt(t,'OutlineLevel')||'0'),
      name: txt(t,'Name'), is_summary: txt(t,'Summary')==='1',
      is_milestone: txt(t,'Milestone')==='1', is_active: txt(t,'Active')!=='0',
      kh_start: (txt(t,'Start')||'').slice(0,10)||null,
      kh_finish: (txt(t,'Finish')||'').slice(0,10)||null,
      kh_duration_days: parseDur(txt(t,'Duration')),
      sort_order: sortOrder, _preds: []
    }
    ;[...t.getElementsByTagNameNS(NS,'PredecessorLink')].forEach(pl => {
      const puid = parseInt(txt(pl,'PredecessorUID')||'0')
      if (puid > 0) task._preds.push({
        pred_uid: puid,
        link_type: LINK_TYPES[txt(pl,'Type')]||'FS',
        lag_days: parseLag(txt(pl,'LinkLag'))
      })
    })
    uidMap[uid] = task; tasks.push(task)
  })

  tasks.forEach(task => {
    task._preds.forEach(p => {
      if (uidMap[p.pred_uid]) predecessors.push({
        task_msp_uid: task.msp_uid, predecessor_msp_uid: p.pred_uid,
        link_type: p.link_type, lag_days: p.lag_days
      })
    })
    delete task._preds
  })

  return { project, tasks, predecessors, meta: {
    parsed_at: new Date().toISOString(),
    total_tasks: tasks.length,
    summary_tasks: tasks.filter(t=>t.is_summary).length,
    leaf_tasks: tasks.filter(t=>!t.is_summary).length,
    total_preds: predecessors.length,
    levels: [...new Set(tasks.map(t=>t.outline_level))].sort()
  }}
}
