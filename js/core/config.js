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
  progress: {},
  photos: [],
}

// ═══════════════════════════════════════════════════════════
// DELAY COLOR — dùng chung toàn app
// ═══════════════════════════════════════════════════════════
function getDelayColor(delayDays) {
  if (delayDays > 14) return '#DC2626'   // đỏ: nghiêm trọng
  if (delayDays >= 7) return '#D97706'   // cam: cần chú ý
  return '#16A34A'                        // xanh lá: đúng KH / sớm / trễ nhẹ ≤6d
}

function getDelayLabel(delayDays) {
  if (delayDays > 0) return `Trễ ${delayDays}d`
  if (delayDays < 0) return `Sớm ${Math.abs(delayDays)}d`
  return 'Đúng KH'
}

function getDelayBadgeHtml(delayDays, pct) {
  if (pct === 100) return '<span class="badge badge-green" style="font-size:10px">✅ Xong</span>'
  const color = getDelayColor(delayDays)
  const label = getDelayLabel(delayDays)
  const bg    = delayDays > 14 ? '#FEE2E2' : delayDays >= 7 ? '#FEF3C7' : '#DCFCE7'
  const fc    = delayDays > 14 ? '#991B1B' : delayDays >= 7 ? '#92400E' : '#166534'
  return `<span style="display:inline-flex;align-items:center;padding:3px 7px;border-radius:12px;
    font-size:10px;font-weight:600;background:${bg};color:${fc};white-space:nowrap">${label}</span>`
}

// ═══════════════════════════════════════════════════════════
// ROLLUP TIỀN — tính _contractValue và _earnedValue cho toàn bộ cây
// Chạy TRƯỚC computeRollupPct để % tiền dùng được cho tất cả panel
// ═══════════════════════════════════════════════════════════
function computeRollupMoney(tasks) {
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(t => {
    if (!t.is_summary) {
      // Task lá: contractValue = unit_price × planned_quantity
      t._contractValue = (t.unit_price || 0) * (t.planned_quantity || 1)

      // Task lá: earnedValue ưu tiên theo tiền, fallback theo KL, fallback pct
      if (t._contractValue > 0) {
        // TH1: có giá → earned = contractValue × pct / 100
        t._earnedValue = t._contractValue * (t.pct_complete || 0) / 100
      } else if (t.planned_quantity > 0 && t.unit && t.unit !== '%') {
        // TH2: có KL + đơn vị → earned tính theo KL thực / KL kế hoạch
        const klPct = Math.min(100, Math.round((t.actual_quantity || 0) / t.planned_quantity * 100))
        t._klPct = klPct  // lưu lại để dùng riêng
        t._earnedValue = 0  // không có tiền nên không đóng góp vào tiền cha
      } else {
        t._earnedValue = 0
        t._klPct = t.pct_complete || 0
      }
      return
    }

    // Task cha: rollup từ con trực tiếp
    const children = tasks.filter(c =>
      c.wbs_code && t.wbs_code &&
      c.wbs_code.startsWith(t.wbs_code + '.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
    )
    t._contractValue = children.reduce((s, c) => s + (c._contractValue || 0), 0)
    t._earnedValue   = children.reduce((s, c) => s + (c._earnedValue  || 0), 0)
  })

  return tasks
}

// ═══════════════════════════════════════════════════════════
// ROLL-UP: Tính % task cha từ task con
// Ưu tiên % tiền nếu có _contractValue > 0
// Fallback về weighted average by duration nếu không có tiền
// ═══════════════════════════════════════════════════════════
function computeRollupPct(tasks) {
  // Bước 1: rollup tiền trước
  computeRollupMoney(tasks)

  const map = {}
  tasks.forEach(t => { map[t.wbs_code] = t })

  // Bước 2: tính display_pct bottom-up
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(t => {
    if (!t.is_summary) {
      // Task lá
      if ((t.unit_price || 0) > 0 && t._contractValue > 0) {
        // TH1: có giá → % theo tiền
        t.display_pct = Math.min(100, Math.round(t._earnedValue / t._contractValue * 100))
      } else if (t.planned_quantity > 0 && t.unit && t.unit !== '%') {
        // TH2: có KL + đơn vị → % theo KL
        t.display_pct = Math.min(100, Math.round((t.actual_quantity || 0) / t.planned_quantity * 100))
      } else {
        // Fallback: pct_complete
        t.display_pct = t.pct_complete || 0
      }
      t._rollup_pct = t.display_pct
      return
    }

    // KEY TASK override
    if (t.key_task_id) {
      const keyTask = tasks.find(k => k.id === t.key_task_id)
      if (keyTask) {
        const kp = keyTask._rollup_pct !== undefined ? keyTask._rollup_pct : (keyTask.pct_complete || 0)
        t._rollup_pct = kp
        t.display_pct = kp
        t._is_key_driven = true
        return
      }
    }

    const children = tasks.filter(c =>
      c.wbs_code && t.wbs_code &&
      c.wbs_code.startsWith(t.wbs_code + '.') &&
      c.wbs_code.split('.').length === t.wbs_code.split('.').length + 1
    )
    if (!children.length) {
      t.display_pct = t.pct_complete || 0
      t._rollup_pct = t.display_pct
      return
    }

    if (t._contractValue > 0) {
      // TH1: task cha có tổng tiền → % = earnedValue / contractValue
      t._rollup_pct = Math.min(100, Math.round(t._earnedValue / t._contractValue * 100))
    } else {
      // TH2: không có tiền → weighted average by duration (như cũ)
      let totalWeight = 0, weightedPct = 0
      children.forEach(c => {
        const w = c.kh_duration_days || 1
        const p = c._rollup_pct !== undefined ? c._rollup_pct : (c.pct_complete || 0)
        weightedPct += p * w
        totalWeight += w
      })
      t._rollup_pct = totalWeight > 0 ? Math.round(weightedPct / totalWeight) : 0
    }
    t.display_pct = t._rollup_pct
  })

  return tasks
}

// ── Roll-up delay ────────────────────────────────────────────────────────
function computeRollupDelay(tasks) {
  const today = new Date(); today.setHours(0,0,0,0)
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(parent => {
    if (!parent.is_summary) {
      const d = calcProgressDetail(parent)
      parent._delay = d.delayDays || 0
      parent._delayLabel = d.label
      parent._delayDetail = d
      return
    }

    const directChildren = tasks.filter(c =>
      c.wbs_code && parent.wbs_code &&
      c.wbs_code.startsWith(parent.wbs_code + '.') &&
      c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )

    if (!directChildren.length) {
      const d = calcProgressDetail(parent)
      parent._delay = d.delayDays || 0
      parent._delayLabel = d.label
      parent._delayDetail = d
      return
    }

    const parentPct = parent.display_pct !== undefined ? parent.display_pct : (parent.pct_complete || 0)
    if (parentPct === 100) {
      const khEnd    = parent.kh_finish ? new Date(parent.kh_finish) : null
      const ttFinish = parent.tt_finish ? new Date(parent.tt_finish) : null
      if (ttFinish && khEnd) {
        const d = Math.round((ttFinish - khEnd) / 86400000)
        const label = d > 0 ? `Trễ ${d} ngày` : d < 0 ? `Hoàn thành sớm ${Math.abs(d)} ngày` : `Đúng KH`
        parent._delay = d
        parent._delayLabel = label
        parent._delayDetail = { delayDays: d, label, done: true, hasUnit: false }
      } else {
        parent._delay = 0
        parent._delayLabel = 'Đúng KH'
        parent._delayDetail = { delayDays: 0, label: 'Đúng KH', done: true, hasUnit: false }
      }
      return
    }

    const maxDelay = directChildren.reduce((mx, c) => Math.max(mx, c._delay || 0), 0)
    const worstChild = directChildren.find(c => (c._delay || 0) === maxDelay)
    parent._delay = maxDelay

    if (maxDelay > 0) {
      parent._delayLabel = worstChild?._delayDetail?.hasUnit
        ? `Trễ ${maxDelay} ngày · thiếu ${worstChild._delayDetail.missingQty} ${worstChild._delayDetail.unit}`
        : `Trễ ${maxDelay} ngày`
    } else {
      const minDelay = directChildren.reduce((mn,c) => Math.min(mn, c._delay||0), 0)
      if (minDelay < 0) {
        const bestChild = directChildren.find(c => (c._delay||0) === minDelay)
        const aheadDays = Math.abs(minDelay)
        parent._delayLabel = bestChild?._delayDetail?.hasUnit
          ? `Sớm ${aheadDays} ngày · dư ${bestChild._delayDetail.aheadQty||0} ${bestChild._delayDetail.unit}`
          : `Sớm ${aheadDays} ngày`
        parent._delay = minDelay
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
// ═══════════════════════════════════════════════════════════
function computeRollupActualDates(tasks) {
  const sorted = [...tasks].sort((a,b) => b.outline_level - a.outline_level)

  sorted.forEach(parent => {
    if (!parent.is_summary) return
    const children = tasks.filter(c =>
      c.wbs_code && parent.wbs_code &&
      c.wbs_code.startsWith(parent.wbs_code + '.') &&
      c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )
    if (!children.length) return
    const starts   = children.map(c => c._tt_start || c.tt_start).filter(Boolean).sort()
    const finishes = children.map(c => c._tt_finish || c.tt_finish).filter(Boolean).sort()
    parent._tt_start  = starts[0] || null
    parent._tt_finish = finishes[finishes.length - 1] || null
  })

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
// ═══════════════════════════════════════════════════════════
async function recomputeParentDates(projectId) {
  const tasks = STATE.tasks
  if (!tasks.length) return

  const summaries = tasks
    .filter(t => t.is_summary)
    .sort((a,b) => b.outline_level - a.outline_level)

  const updates = []

  summaries.forEach(parent => {
    const children = tasks.filter(c =>
      c.wbs_code.startsWith(parent.wbs_code + '.') &&
      c.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
    )
    if (!children.length) return

    const starts   = children.map(c => c.kh_start).filter(Boolean).sort()
    const finishes = children.map(c => c.kh_finish).filter(Boolean).sort()
    const newStart  = starts[0] || null
    const newFinish = finishes[finishes.length - 1] || null
    const newDur = newStart && newFinish
      ? Math.round((new Date(newFinish) - new Date(newStart)) / 86400000)
      : parent.kh_duration_days

    if (newStart !== parent.kh_start || newFinish !== parent.kh_finish) {
      updates.push({ id: parent.id, kh_start: newStart, kh_finish: newFinish, kh_duration_days: newDur })
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
