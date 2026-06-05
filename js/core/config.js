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

// ── Tam suất: tính lệch theo velocity ─────────────────────────────────────
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
