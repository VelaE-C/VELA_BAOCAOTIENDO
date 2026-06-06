// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const CFG = {
  SUPABASE_URL:  'https://gqelblpdujdqdddisjei.supabase.co',
  SUPABASE_KEY:  'sb_publishable_ze2HoQt8kAzb0WSkZqSbdA_qupIyCmu',
  GOOGLE_KEY:    'AIzaSyA0RIegBVbU_FBU5_kCT9IGNswN0f_1b68',
  SHEETS_ID:     '16eDdNcTfyt9QC82XnoERC3uORTpdG_mrjU9kd40DE0I',
  SHEET_TAB:     'TongHop',
  STORAGE_BUCKET:'site-photos',
}

// ═══════════════════════════════════════════════════════════
// SUPABASE INIT
// ═══════════════════════════════════════════════════════════
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
})

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let STATE = {
  user: null,
  role: null,
  projects: [],
  currentProject: null,
  tasks: [],
  progress: {},  // task_id -> latest progress
  photos: [],
}

// ═══════════════════════════════════════════════════════════
// ROLL-UP: Tính % task cha từ task con (giống MS Project)
// ═══════════════════════════════════════════════════════════
function computeRollupPct(tasks) {
  // Build a map: wbs_code -> task
  const map = {}
  tasks.forEach(t => { map[t.wbs_code] = t })

  // Work bottom-up: sort by outline_level desc
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(t => {
    if (!t.is_summary) return

    // KEY TASK: nếu có key_task_id → lấy % từ task đó
    if (t.key_task_id) {
      const keyTask = tasks.find(k => k.id === t.key_task_id)
      if (keyTask) {
        const kp = keyTask._rollup_pct !== undefined ? keyTask._rollup_pct : (keyTask.pct_complete || 0)
        t._rollup_pct = kp
        t._is_key_driven = true
        return
      }
    }

    // FALLBACK: weighted average by kh_duration_days
    const children = tasks.filter(c =>
      c.wbs_code.startsWith(t.wbs_code + '.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
    )
    if (!children.length) return

    let totalWeight = 0, weightedPct = 0
    children.forEach(c => {
      const w = c.kh_duration_days || 1
      const p = c._rollup_pct !== undefined ? c._rollup_pct : (c.pct_complete || 0)
      weightedPct += p * w
      totalWeight += w
    })
    t._rollup_pct = totalWeight > 0 ? Math.round(weightedPct / totalWeight) : 0
  })

  // Assign rollup_pct back — leaf tasks use pct_complete, summary use _rollup_pct
  tasks.forEach(t => {
    if (t.is_summary) {
      t.display_pct = t._rollup_pct !== undefined ? t._rollup_pct : (t.pct_complete || 0)
    } else {
      t.display_pct = t.pct_complete || 0
    }
  })
  return tasks
}

// ── Roll-up delay: cha = max delay của các con trực tiếp ────────────────
function computeRollupDelay(tasks) {
  // Build today once
  const today = new Date(); today.setHours(0,0,0,0)

  // Work bottom-up
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(parent => {
    if (!parent.is_summary) {
      // Leaf: tính delay trực tiếp, cache vào _delay
      const d = calcProgressDetail(parent)
      parent._delay = d.delayDays || 0
      parent._delayLabel = d.label
      parent._delayDetail = d
      return
    }

    // Summary: max delay của con trực tiếp
    const directChildren = tasks.filter(c =>
      c.wbs_code && parent.wbs_code &&
      c.wbs_code.startsWith(parent.wbs_code + '.') &&
      c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )

    if (!directChildren.length) {
      // Không có con → tính như leaf
      const d = calcProgressDetail(parent)
      parent._delay = d.delayDays || 0
      parent._delayLabel = d.label
      parent._delayDetail = d
      return
    }

    // Max delay trong con (đã được tính ở bước trước vì sort bottom-up)
    const maxDelay = directChildren.reduce((mx, c) => Math.max(mx, c._delay || 0), 0)
    const worstChild = directChildren.find(c => (c._delay || 0) === maxDelay)

    parent._delay = maxDelay
    if (maxDelay > 0) {
      const childLabel = worstChild?._delayDetail?.hasUnit
        ? `Trễ ${maxDelay} ngày · thiếu ${worstChild._delayDetail.missingQty} ${worstChild._delayDetail.unit}`
        : `Trễ ${maxDelay} ngày`
      parent._delayLabel = childLabel
      parent._delay = maxDelay
    } else {
      // Tất cả đúng hoặc sớm → lấy max "sớm" (delayDays âm = sớm)
      const minDelay = directChildren.reduce((mn,c) => Math.min(mn, c._delay||0), 0)
      if (minDelay < 0) {
        const bestChild = directChildren.find(c => (c._delay||0) === minDelay)
        const aheadDays = Math.abs(minDelay)
        parent._delayLabel = bestChild?._delayDetail?.hasUnit
          ? `Sớm ${aheadDays} ngày · dư ${bestChild._delayDetail.aheadQty||0} ${bestChild._delayDetail.unit}`
          : `Sớm ${aheadDays} ngày`
        parent._delay = minDelay  // âm = sớm
      } else {
        parent._delayLabel = 'Đúng KH'
        parent._delay = 0
      }
    }
    parent._delayDetail = { delayDays: parent._delay, label: parent._delayLabel, hasUnit: false }
  })

  return tasks
}

// ═══════════════════════════════════════════════════════════
// ROLLUP tt_start / tt_finish cho summary tasks từ con
// Chạy sau loadProjectData để Gantt hiện bar thực tế ở summary
// ═══════════════════════════════════════════════════════════
function computeRollupActualDates(tasks) {
  // Sort bottom-up
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(parent => {
    if (!parent.is_summary) return

    // Direct children only
    const children = tasks.filter(c =>
      c.wbs_code && parent.wbs_code &&
      c.wbs_code.startsWith(parent.wbs_code + '.') &&
      c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )
    if (!children.length) return

    // tt_start cha = MIN tt_start con (chỉ con có tt_start)
    const starts  = children.map(c => c._tt_start || c.tt_start).filter(Boolean).sort()
    // tt_finish cha = MAX tt_finish con (hoặc dùng today nếu đang thi công)
    const finishes = children.map(c => c._tt_finish || c.tt_finish).filter(Boolean).sort()

    parent._tt_start  = starts[0]  || null
    parent._tt_finish = finishes[finishes.length - 1] || null
  })

  // Assign lại để Gantt dùng được
  tasks.forEach(t => {
    if (t.is_summary) {
      t.tt_start  = t._tt_start  || t.tt_start  || null
      t.tt_finish = t._tt_finish || t.tt_finish || null
    }
  })
  return tasks
}

// ═══════════════════════════════════════════════════════════
// COMPUTE PARENT DATES từ task con (lưu vào DB)
// kh_start cha = MIN start con, kh_finish cha = MAX finish con
// ═══════════════════════════════════════════════════════════
async function recomputeParentDates(projectId) {
  const tasks = STATE.tasks
  if (!tasks.length) return

  // Sort summary tasks by level desc (bottom-up)
  const summaries = tasks
    .filter(t => t.is_summary)
    .sort((a,b) => b.outline_level - a.outline_level)

  const updates = []

  summaries.forEach(parent => {
    // Direct children only
    const children = tasks.filter(c =>
      c.wbs_code.startsWith(parent.wbs_code + '.') &&
      c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )
    if (!children.length) return

    const starts  = children.map(c => c.kh_start).filter(Boolean).sort()
    const finishes = children.map(c => c.kh_finish).filter(Boolean).sort()

    const newStart  = starts[0] || null
    const newFinish = finishes[finishes.length - 1] || null
    const newDur = newStart && newFinish
      ? Math.round((new Date(newFinish) - new Date(newStart)) / 86400000)
      : parent.kh_duration_days

    // Only update if changed
    if (newStart !== parent.kh_start || newFinish !== parent.kh_finish) {
      updates.push({ id: parent.id, kh_start: newStart, kh_finish: newFinish, kh_duration_days: newDur })
      // Update local state too so children calc correctly
      parent.kh_start  = newStart
      parent.kh_finish = newFinish
      parent.kh_duration_days = newDur
    }
  })

  if (!updates.length) {
    toast('Ngày KH cha đã chính xác, không cần cập nhật.', '')
    return
  }

  loading(true, `Đang cập nhật ${updates.length} hạng mục cha...`)
  try {
    for (const upd of updates) {
      const { error } = await sb.from('tasks')
        .update({ kh_start: upd.kh_start, kh_finish: upd.kh_finish, kh_duration_days: upd.kh_duration_days })
        .eq('id', upd.id)
      if (error) throw error
    }
    await loadProjectData(projectId)
    toast(`Đã cập nhật ${updates.length} hạng mục cha theo ngày con!`, 'success')
    navigate('wbs')
  } catch(e) {
    toast('Lỗi: ' + e.message, 'error')
  } finally {
    loading(false)
  }
}
