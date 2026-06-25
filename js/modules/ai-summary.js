// ═══════════════════════════════════════════════════════════
// AI SUMMARY — Claude API
// ═══════════════════════════════════════════════════════════
async function generateAISummary() {
  if (STATE.role !== 'admin') {
    toast('Chỉ admin mới có thể tạo AI tóm tắt', 'error')
    return
  }
  const proj = STATE.currentProject
  if (!proj) { toast('Chưa có dự án', 'error'); return }

  loading(true, '🤖 AI đang phân tích tiến độ...')

  try {
    const tasks = STATE.tasks
    const leaf  = tasks.filter(t => !t.is_summary)
    const today = new Date().toLocaleDateString('vi-VN')
    const week  = getISOWeek(new Date())

    const late       = leaf.filter(t => t._delay > 0).sort((a,b) => (b._delay||0)-(a._delay||0))
    const ahead      = leaf.filter(t => t._delay < 0)
    const done       = leaf.filter(t => (t.pct_complete||0) === 100)
    const notStarted = leaf.filter(t => !t.tt_start && t.kh_start && new Date(t.kh_start) < new Date())

    const rootTask  = tasks.find(t => t.outline_level === 1)
    const totalPct  = rootTask
      ? (rootTask.display_pct !== undefined ? rootTask.display_pct : (rootTask.pct_complete||0))
      : (leaf.length > 0 ? Math.round(leaf.reduce((s,t)=>s+(t.display_pct||t.pct_complete||0),0)/leaf.length) : 0)

    const currentStart  = rootTask?.kh_start  || null
    const currentFinish = rootTask?.kh_finish || null

    const fmtVN = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
    const actualStartDate = fmtVN(currentStart)
    const actualEndDate   = fmtVN(currentFinish)

    let timeElapsedPct = '—'
    let daysRemaining  = '—'
    if (currentStart && currentFinish) {
      const [sy,sm,sd] = currentStart.split('-').map(Number)
      const [ey,em,ed] = currentFinish.split('-').map(Number)
      const startMs = new Date(sy,sm-1,sd).getTime()
      const endMs   = new Date(ey,em-1,ed).getTime()
      const nowMs   = new Date().setHours(0,0,0,0)
      const totalMs = endMs - startMs
      const elapsed = nowMs - startMs
      timeElapsedPct = Math.max(0,Math.min(100,Math.round(elapsed/totalMs*100))) + '%'
      daysRemaining  = Math.max(0,Math.round((endMs-nowMs)/86400000)) + ' ngày'
    }

    // ── EVM: Tính EV, PV, SPI ──────────────────────────────
    // Rollup tiền nếu chưa có
    if (typeof computeRollupMoney === 'function' && tasks[0]?._contractValue === undefined) {
      computeRollupMoney(tasks)
    }

    const leafWithPrice = leaf.filter(t => (t.unit_price||0) > 0)
    const totalCV = rootTask?._contractValue || 0

    // EV = tổng sản lượng thực tế
    const totalEV = rootTask?._earnedValue || 0

    // PV = tính tuyến tính theo thời gian tại tuần hiện tại
    let totalPV = 0
    if (leafWithPrice.length > 0) {
      const now = new Date(); now.setHours(0,0,0,0)
      totalPV = leafWithPrice.reduce((s, t) => {
        const cv    = (t.unit_price||0) * (t.planned_quantity||1)
        const start = t.kh_start ? new Date(...t.kh_start.split('-').map(Number).map((v,i)=>i===1?v-1:v)) : null
        const end   = t.kh_finish ? new Date(...t.kh_finish.split('-').map(Number).map((v,i)=>i===1?v-1:v)) : null
        if (!start || !end) return s
        if (now < start)  return s
        if (now >= end)   return s + cv
        const ratio = (now - start) / (end - start)
        return s + cv * ratio
      }, 0)
    }

    const spi = totalPV > 0 ? (totalEV/totalPV) : null
    const sv  = totalEV - totalPV  // Schedule Variance

    const fmtMoney = v => {
      if (!v || v === 0) return '0'
      if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(1) + ' tỷ'
      if (Math.abs(v) >= 1e6) return Math.round(v/1e6) + ' tr'
      return Math.round(v/1e3) + ' k'
    }

    const evmContext = totalCV > 0 ? `
PHÂN TÍCH SẢN LƯỢNG (EVM) — TUẦN ${week}:
- Giá trị hợp đồng (BAC): ${fmtMoney(totalCV)}
- Sản lượng kế hoạch (PV): ${fmtMoney(totalPV)} (${totalPV>0?Math.round(totalPV/totalCV*100):0}% BAC)
- Sản lượng thực hiện (EV): ${fmtMoney(totalEV)} (${totalCV>0?Math.round(totalEV/totalCV*100):0}% BAC)
- Schedule Variance (SV): ${sv >= 0 ? '+' : ''}${fmtMoney(sv)} (${sv >= 0 ? 'VƯỢT kế hoạch' : 'THIẾU so với kế hoạch'})
- SPI = ${spi ? spi.toFixed(2) : '—'} → ${spi ? (spi >= 1 ? '✅ Đạt/vượt kế hoạch sản lượng' : spi >= 0.8 ? '⚠️ Chậm nhẹ so với kế hoạch' : '🔴 Chậm nghiêm trọng — chỉ đạt ' + Math.round(spi*100) + '% KH sản lượng') : 'Chưa có dữ liệu đơn giá'}
` : ''

    // ── Lịch sử điều chỉnh ──────────────────────────────────
    let revisionContext = ''
    try {
      const { data: revisions } = await sb.from('schedule_revisions')
        .select('revision_name, reason, effective_date, delta_days, affected_count, created_at')
        .eq('project_id', proj.id)
        .order('created_at', { ascending: true })

      if (revisions?.length) {
        const baselineFinish = proj.finish_date || null
        let totalSlipDays = 0
        if (baselineFinish && currentFinish) {
          const [by,bm,bd] = baselineFinish.split('-').map(Number)
          const [cy,cm,cd] = currentFinish.split('-').map(Number)
          totalSlipDays = Math.round((new Date(cy,cm-1,cd)-new Date(by,bm-1,bd))/86400000)
        }
        const slipStr = totalSlipDays > 0 ? `tổng trượt +${totalSlipDays} ngày so với deadline HĐ gốc`
          : totalSlipDays < 0 ? `hoàn thành sớm hơn HĐ gốc ${Math.abs(totalSlipDays)} ngày`
          : `đúng deadline HĐ gốc`
        revisionContext = `\nLỊCH SỬ ĐIỀU CHỈNH TIẾN ĐỘ (${revisions.length} lần, ${slipStr}):\n`
        revisions.forEach((r,i) => {
          const d = r.effective_date ? new Date(r.effective_date).toLocaleDateString('vi-VN') : '—'
          revisionContext += `- Lần ${i+1} (${d}): ${r.revision_name} — ${r.reason}\n`
        })
        revisionContext += `→ Deadline hiện hành (${actualEndDate}) đã được CĐT chấp thuận.\n`
      }
    } catch(e) {}

    // ── Lịch sử AI tuần trước ───────────────────────────────
    let historyContext = ''
    try {
      const { data: recentHistory } = await sb.from('ai_summaries')
        .select('week_number, year, stats, created_at')
        .eq('project_id', proj.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentHistory?.length) {
        historyContext = '\nDỮ LIỆU CÁC TUẦN TRƯỚC (so sánh xu hướng):\n'
        recentHistory.forEach(h => {
          const s = h.stats ? JSON.parse(h.stats) : {}
          const spiStr = s.spi ? ` · SPI=${s.spi}` : ''
          const evStr  = s.ev  ? ` · EV=${s.ev}`   : ''
          historyContext += `- Tuần ${h.week_number}/${h.year}: ${s.total_pct||0}% HT, ${s.late||0} CT chậm${spiStr}${evStr}\n`
        })
      }
    } catch(e) {}

    const validLate = late.filter(t => t._delay > 0 && t._delay < 500)
    const validAvgDelay = validLate.length > 0
      ? Math.round(validLate.reduce((s,t) => s+(t._delay||0),0)/validLate.length) : 0

    const now60 = new Date(); now60.setDate(now60.getDate()-60)
    const validNotStarted = notStarted.filter(t => t.kh_start && new Date(t.kh_start) >= now60)

    const inProgress = leaf.filter(t => t.tt_start && (t.pct_complete||0) < 100)
    const inProgressTop = [...inProgress].sort((a,b)=>(b._delay||0)-(a._delay||0)).slice(0,5)
    const inProgressSummary = inProgressTop.map(t => {
      const pct = t.pct_complete||0
      const d   = t._delay||0
      const delayStr = d>0?', trễ '+d+' ngày':d<0?', sớm '+Math.abs(d)+' ngày':''
      const noteStr  = t.latest_note?' ['+t.latest_note+']':''
      return '- '+t.name+': '+pct+'%'+delayStr+noteStr
    }).join('\n')

    const lateWithNote = validLate.filter(t=>t._delay>5).slice(0,5).map(t => {
      const noteStr = t.latest_note?' ['+t.latest_note+']':''
      return '- '+t.name+': trễ '+t._delay+' ngày, đạt '+(t.pct_complete||0)+'%'+noteStr
    }).join('\n')

    const lvl2Tasks = tasks.filter(t=>t.is_summary&&t.outline_level===2)
    const lvl2Summary = lvl2Tasks.map(t => {
      const pct   = t.display_pct!==undefined?t.display_pct:(t.pct_complete||0)
      const delay = t._delay||0
      const cv    = t._contractValue||0
      const ev    = t._earnedValue||0
      let status  = 'Đúng KH'
      if (delay>3&&delay<365) status = 'Trễ '+delay+' ngày'
      else if (delay<0) status = 'Sớm '+Math.abs(delay)+' ngày'
      const moneyStr = cv>0 ? ` | SL: ${fmtMoney(ev)}/${fmtMoney(cv)}` : ''
      return '- '+t.name+': '+pct+'% ('+status+')'+moneyStr
    }).join('\n')

    let velocityStr = ''
    try {
      const { data: lastWeekStats } = await sb.from('ai_summaries')
        .select('stats').eq('project_id',proj.id)
        .order('created_at',{ascending:false}).limit(2)
      if (lastWeekStats?.length>=2) {
        const prevStats = JSON.parse(lastWeekStats[1].stats||'{}')
        const prevPct = prevStats.total_pct||0
        const prevEV  = prevStats.ev_raw||0
        const velocity = totalPct - prevPct
        const evDelta  = totalEV - prevEV
        velocityStr = velocity>0
          ? `+${velocity}% tiến độ tuần này (tăng so với tuần trước)${evDelta>0?' · SL tăng thêm '+fmtMoney(evDelta):''}`
          : velocity<0?`${velocity}% tiến độ tuần này (giảm)`
          : 'Không thay đổi so với tuần trước'
      }
    } catch(e) {}

    const prompt = `Bạn là trợ lý phân tích dự án xây dựng. Viết báo cáo tuần cho BAN GIÁM ĐỐC — ngắn gọn, số liệu macro, tập trung vào quyết định và rủi ro. KHÔNG liệt kê chi tiết từng task.

DỰ ÁN: ${proj.name} (${proj.code})
NGÀY BÁO CÁO: ${today} - Tuần ${week}
TIMELINE: ${actualStartDate} → ${actualEndDate} (còn ${daysRemaining})
TIẾN ĐỘ THỜI GIAN: Đã đi ${timeElapsedPct} thời gian thi công, hoàn thành ${totalPct}% khối lượng
${revisionContext}${evmContext}
TỔNG QUAN:
- Tổng công tác: ${leaf.length} | Hoàn thành: ${done.length} | Đang TH: ${inProgress.length}
- Chậm tiến độ: ${validLate.length} CT | Trễ TB: ${validAvgDelay} ngày
- Chưa bắt đầu (quá hạn 60 ngày): ${validNotStarted.length} CT
${historyContext}
VELOCITY: ${velocityStr||'Chưa có dữ liệu tuần trước'}

ĐANG THI CÔNG — TOP 5:
${inProgressSummary||'Chưa có'}

CÔNG TÁC CHẬM NGHIÊM TRỌNG (>5 ngày):
${lateWithNote||'Không có'}

TIẾN ĐỘ & SẢN LƯỢNG THEO HẠNG MỤC (level 2):
${lvl2Summary||'Không có dữ liệu'}

${(() => {
      if (!STATE._attendanceData) return ''
      const hist  = STATE._attendanceData.history||[]
      const hist7 = hist.slice(-7)
      const avg7  = hist7.length ? Math.round(hist7.reduce((s,h)=>s+(h.cn_proj||0),0)/hist7.length) : 0
      const first3 = hist7.slice(0,3).map(h=>h.cn_proj||0)
      const last3  = hist7.slice(-3).map(h=>h.cn_proj||0)
      const avgFirst = first3.length?Math.round(first3.reduce((s,v)=>s+v,0)/first3.length):0
      const avgLast  = last3.length?Math.round(last3.reduce((s,v)=>s+v,0)/last3.length):0
      const trend = avgLast - avgFirst
      const trendStr = trend>5?`TĂNG +${trend} CN/ngày`:trend<-5?`GIẢM ${Math.abs(trend)} CN/ngày`:'ổn định'
      const lastDay = hist[hist.length-1]||{}
      const last7data = hist.slice(-7)
      const minCN = last7data.length?Math.min(...last7data.map(h=>h.cn_proj||0)):0
      const maxCN = last7data.length?Math.max(...last7data.map(h=>h.cn_proj||0)):0
      return `QUÂN SỐ 7 NGÀY GẦN NHẤT:
- TB: ${avg7} CN/ngày (xu hướng ${trendStr}) | Min: ${minCN} | Max: ${maxCN}
- Ngày gần nhất: ${lastDay.cn_proj||0} CN · BCH: ${lastDay.total_bch||0}
`
    })()}${STATE._aiUserNote?'CONTEXT THỰC TẾ TỪ KTTC (ưu tiên cao):\n'+STATE._aiUserNote+'\n\n':''}
LƯU Ý:
- Timeline hiện hành là mốc đúng để đánh giá, không dùng baseline gốc
- SPI < 0.8 = cần báo động về sản lượng, không chỉ ngày
- Chỉ dùng số liệu được cung cấp, không tự tính lại

YÊU CẦU OUTPUT — viết đúng 5 mục, mỗi mục tối đa 3-4 câu, dùng bullet (•) nếu cần:

## 1. TỔNG QUAN TIẾN ĐỘ
% HT vs % thời gian đã qua. Còn bao nhiêu ngày. 1 điểm tích cực nếu có.

## 2. PHÂN TÍCH SẢN LƯỢNG (EVM)
EV vs PV, SPI bao nhiêu, ý nghĩa thực tế. Thiếu bao nhiêu tỷ so với kế hoạch. Xu hướng tốt/xấu hơn tuần trước. (Chỉ viết mục này nếu có dữ liệu đơn giá — nếu SPI = — thì ghi "Chưa có dữ liệu đơn giá để tính EVM")

## 3. CẢNH BÁO TIMELINE
Hạng mục nào lệch nghiêm trọng? Nguy cơ trễ deadline? Mức: 🔴 Nguy hiểm / 🟡 Cần theo dõi / 🟢 Ổn.

## 4. RỦI RO TUẦN TỚI
Rủi ro 2-3 tuần tới có thể phòng ngừa ngay.

## 5. VẤN ĐỀ KỸ THUẬT CHUYỂN GIAO
Gói nào sắp sang giai đoạn tiếp theo? Điều kiện tiên quyết? BCH cần chuẩn bị gì?

QUY TẮC:
- Viết cho BGĐ · Số liệu macro · Mỗi mục ≤80 từ · **Bold** con số quan trọng
- Thẳng thắn, không vòng vo · KHÔNG thêm header, tiêu đề, tên người báo cáo
- KHÔNG tự tính hay ước lượng số liệu ngoài dữ liệu được cung cấp
- Nếu velocity/SPI không có data → ghi "Chưa có dữ liệu", KHÔNG tự suy diễn
- Chỉ viết đúng 5 mục ## theo format yêu cầu, không thêm mục khác`

    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Chưa đăng nhập')

    const statsPayload = {
      total:      leaf.length,
      done:       done.length,
      late:       validLate.length,
      avg_delay:  validAvgDelay,
      total_pct:  totalPct,
      week,
      // EVM stats — mới thêm
      ev:         fmtMoney(totalEV),
      ev_raw:     Math.round(totalEV),
      pv:         fmtMoney(totalPV),
      pv_raw:     Math.round(totalPV),
      spi:        spi ? parseFloat(spi.toFixed(2)) : null,
      cv_total:   fmtMoney(totalCV),
    }

    await sb.from('ai_summaries')
      .delete()
      .eq('project_id', proj.id)
      .eq('week_number', week)
      .eq('year', new Date().getFullYear())

    const res = await fetch(CFG.SUPABASE_URL+'/functions/v1/ai-summary', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
      body: JSON.stringify({
        prompt,
        project_id:   proj.id,
        project_name: proj.name,
        stats:        statsPayload,
        max_tokens:   4096
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(()=>({}))
      if (err.error?.includes('CLAUDE_API_KEY')) throw new Error('EDGE_FUNCTION_NO_KEY')
      if (res.status===404) throw new Error('EDGE_FUNCTION_NOT_DEPLOYED')
      throw new Error(err.error||'Lỗi server '+res.status)
    }

    const data    = await res.json()
    const summary = data.summary||'Không có kết quả'

    loading(false)
    showAISummaryModal(summary, today, week, proj.name)

  } catch(e) {
    loading(false)
    if (e.message==='EDGE_FUNCTION_NOT_DEPLOYED') showEdgeFunctionGuide()
    else if (e.message==='EDGE_FUNCTION_NO_KEY') showAPIKeyGuide()
    else toast('Lỗi: '+e.message, 'error')
  }
}

function showAISummaryModal(text, date, week, projName) {
  function mdRender(t) {
    return t.split('\n').map(line => {
      if (line.startsWith('## ')) return '<div style="font-size:14px;font-weight:700;color:var(--navy);margin:14px 0 6px">'+line.slice(3)+'</div>'
      if (line.startsWith('# '))  return '<div style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 10px">'+line.slice(2)+'</div>'
      const l = line.replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--gray8)">$1</strong>')
      return l?'<div style="margin:3px 0">'+l+'</div>':'<div style="height:6px"></div>'
    }).join('')
  }

  const iterLabel = STATE._aiUserNote?' + ghi chú KTTC':''
  openModal(`🤖 AI Tóm tắt tiến độ — Tuần ${week}${iterLabel}`, `
    <div style="padding:10px 14px;background:var(--lblue);border-radius:var(--radius);margin-bottom:14px;font-size:12px;color:var(--gray6)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="color:var(--navy)">${projName}</strong>
        <span>Tuần ${week} · ${date}</span>
      </div>
      <div style="display:flex;gap:16px;font-size:11px;color:var(--gray5)">
        <span>📋 Người báo cáo: <strong style="color:var(--gray7)">Phòng Kỹ Thuật Thi Công</strong></span>
      </div>
    </div>
    <div style="font-size:13px;line-height:1.7;color:var(--gray7);max-height:45vh;overflow-y:auto;padding-right:4px">
      ${mdRender(text)}
    </div>
    ${STATE.role==='admin'?`
    <div style="margin-top:12px;border-top:0.5px solid var(--gray2);padding-top:12px">
      <div style="font-size:12px;font-weight:600;color:var(--gray7);margin-bottom:6px">📝 Ghi chú context thực tế (tùy chọn):</div>
      <textarea id="ai-user-note" rows="3"
        style="width:100%;padding:8px 10px;border:0.5px solid var(--gray3);border-radius:var(--radius);font-size:12px;resize:vertical;font-family:inherit;line-height:1.6;background:var(--gray0)"
        placeholder="VD: Lô O18 do CĐT chậm phát hành bản vẽ. BCH cam kết xong T3 tuần 23..."></textarea>
      <div style="font-size:11px;color:var(--gray4);margin-top:4px">AI sẽ tích hợp context này → báo cáo sát thực tế hơn.</div>
    </div>
    `:''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
    ${STATE.role==='admin'?'<button class="btn btn-secondary" onclick="reAnalyzeWithNote()" style="border-color:var(--blue);color:var(--blue)">🔄 Phân tích lại</button>':''}
    <button class="btn btn-primary" onclick="closeModal();exportWeeklyReport()">📄 Xuất báo cáo</button>
  `)
}

async function showAISummaryHistory() {
  const proj = STATE.currentProject
  if (!proj) return

  loading(true, 'Đang tải lịch sử...')
  const { data: history, error } = await sb.from('ai_summaries')
    .select('*').eq('project_id',proj.id)
    .order('created_at',{ascending:false}).limit(10)
  loading(false)

  if (error) {
    if (error.message.includes('does not exist')) {
      openModal('📋 Lịch sử AI Tóm tắt', `<div style="text-align:center;padding:30px;color:var(--gray4)">
        <div style="font-size:32px;margin-bottom:12px">🗄️</div>
        <div style="font-size:14px;font-weight:500;margin-bottom:8px">Chưa có bảng lưu lịch sử</div>
      </div>`, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
      return
    }
    toast('Lỗi: '+error.message, 'error'); return
  }

  if (!history?.length) {
    openModal('📋 Lịch sử AI Tóm tắt', `<div style="text-align:center;padding:30px;color:var(--gray4)">
      Chưa có lần tóm tắt nào. Bấm <strong>🤖 AI Tóm tắt tiến độ</strong> để tạo lần đầu.
    </div>`, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
    return
  }

  window._aiHistoryData = history

  const rows = history.map((h,idx) => {
    const stats   = h.stats ? JSON.parse(h.stats) : {}
    const date    = new Date(h.created_at).toLocaleDateString('vi-VN')
    const preview = (h.summary_text||'').slice(0,120)+'...'
    const spiTag  = stats.spi!=null
      ? `<span style="font-size:10px;padding:1px 6px;background:${stats.spi>=1?'#DCFCE7':stats.spi>=0.8?'#FEF3C7':'#FEE2E2'};color:${stats.spi>=1?'#166534':stats.spi>=0.8?'#92400E':'#991B1B'};border-radius:8px">SPI=${stats.spi}</span>` : ''
    return '<div data-hist-idx="'+idx+'" style="padding:12px 14px;border-bottom:0.5px solid var(--gray2);cursor:pointer" onmouseover="this.style.background=\'var(--gray0)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
      +'<span style="font-size:12px;font-weight:600;color:var(--gray8)">Tuần '+h.week_number+'/'+h.year+'</span>'
      +'<span style="font-size:11px;color:var(--gray4)">'+date+' · '+(h.created_by||'').split('@')[0]+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
      +(stats.total?'<span style="font-size:10px;padding:1px 6px;background:var(--lblue);color:var(--blue);border-radius:8px">'+(stats.done||0)+'/'+stats.total+' xong</span>':'')
      +(stats.late?'<span style="font-size:10px;padding:1px 6px;background:#FEE2E2;color:#991B1B;border-radius:8px">'+stats.late+' chậm</span>':'')
      +(stats.total_pct?'<span style="font-size:10px;padding:1px 6px;background:#DCFCE7;color:#166534;border-radius:8px">'+stats.total_pct+'% HT</span>':'')
      +(stats.ev?'<span style="font-size:10px;padding:1px 6px;background:#F0FDF4;color:#0D9488;border-radius:8px">EV: '+stats.ev+'</span>':'')
      +spiTag
      +'</div>'
      +'<div style="font-size:12px;color:var(--gray5);line-height:1.5">'+preview+'</div>'
      +'</div>'
  }).join('')

  openModal('📋 Lịch sử AI Tóm tắt — '+proj.name,
    '<div style="font-size:12px;color:var(--gray4);margin-bottom:10px">'+history.length+' lần gần nhất · Click để xem đầy đủ</div>'
    +'<div id="hist-list" style="border:0.5px solid var(--gray2);border-radius:var(--radius);overflow:hidden">'+rows+'</div>',
    '<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>')

  setTimeout(() => {
    document.querySelectorAll('[data-hist-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const h = window._aiHistoryData[parseInt(el.dataset.histIdx)]
        if (!h) return
        showAISummaryModal(h.summary_text||'', new Date(h.created_at).toLocaleDateString('vi-VN'), h.week_number||0, h.project_name||'')
      })
    })
  }, 150)
}

async function reAnalyzeWithNote() {
  const note = document.getElementById('ai-user-note')?.value?.trim()
  if (!note) { toast('Vui lòng nhập ghi chú thực tế trước', 'error'); return }
  STATE._aiUserNote = note
  closeModal()
  await generateAISummary()
  STATE._aiUserNote = null
}

function showEdgeFunctionGuide() {
  openModal('⚙️ Cần deploy Edge Function', `
    <div style="font-size:13px;line-height:1.8;color:var(--gray6)">
      <p style="margin-bottom:10px">Tính năng AI Tóm tắt cần deploy Edge Function trong Supabase:</p>
      <div style="background:var(--gray1);border-radius:var(--radius);padding:12px;font-size:12px;margin-bottom:10px">
        <strong>Bước 1 — Deploy Edge Function ai-summary:</strong><br>
        1. Vào <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/functions" target="_blank" style="color:var(--blue)">Supabase → Edge Functions</a><br>
        2. New function → tên: <strong>ai-summary</strong> → Deploy
      </div>
      <div style="background:var(--gray1);border-radius:var(--radius);padding:12px;font-size:12px">
        <strong>Bước 2 — Thêm Claude API key:</strong><br>
        Vào Edge Functions → Secrets → Add: <strong>CLAUDE_API_KEY</strong>
      </div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Đã hiểu</button>`)
}

function showAPIKeyGuide() {
  openModal('🔑 Thiếu Claude API Key', `
    <div style="font-size:13px;line-height:1.8;color:var(--gray6)">
      <p>Edge Function đã deploy nhưng chưa có API key.</p>
      <div style="background:var(--gray1);border-radius:var(--radius);padding:12px;font-size:12px">
        1. Vào <a href="https://console.anthropic.com" target="_blank" style="color:var(--blue)">console.anthropic.com</a> → API Keys → Create Key<br>
        2. Vào Supabase → Edge Functions → Secrets → Add: <strong>CLAUDE_API_KEY</strong>
      </div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Đã hiểu</button>`)
}
