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
    const leaf = tasks.filter(t => !t.is_summary)
    const today = new Date().toLocaleDateString('vi-VN')
    const week = getISOWeek(new Date())

    // Build data summary for prompt
    const late = leaf.filter(t => t._delay > 0).sort((a,b) => (b._delay||0)-(a._delay||0))
    const ahead = leaf.filter(t => t._delay < 0)
    const done = leaf.filter(t => (t.pct_complete||0) === 100)
    const notStarted = leaf.filter(t => !t.tt_start && t.kh_start && new Date(t.kh_start) < new Date())

    // Summary stats
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalPct = rootTask
      ? (rootTask.display_pct !== undefined ? rootTask.display_pct : (rootTask.pct_complete||0))
      : (leaf.length > 0 ? Math.round(leaf.reduce((s,t)=>s+(t.display_pct||t.pct_complete||0),0)/leaf.length) : 0)

    // ── TIMELINE: dùng root task kh_start/kh_finish (đã cập nhật sau điều chỉnh) ──
    // Không dùng getActualTimeline() vì nó lấy max của tất cả tasks, không phản ánh
    // timeline hiện hành sau khi BCH điều chỉnh tiến độ
    const currentStart  = rootTask?.kh_start  || null
    const currentFinish = rootTask?.kh_finish || null

    const fmtVN = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
    const actualStartDate = fmtVN(currentStart)
    const actualEndDate   = fmtVN(currentFinish)

    // % thời gian đã qua tính từ root task timeline (hiện hành)
    let timeElapsedPct = '—'
    let daysRemaining = '—'
    if (currentStart && currentFinish) {
      const [sy,sm,sd] = currentStart.split('-').map(Number)
      const [ey,em,ed] = currentFinish.split('-').map(Number)
      const startMs = new Date(sy, sm-1, sd).getTime()
      const endMs   = new Date(ey, em-1, ed).getTime()
      const nowMs   = new Date().setHours(0,0,0,0)
      const totalMs = endMs - startMs
      const elapsed = nowMs - startMs
      const pctTime = Math.max(0, Math.min(100, Math.round(elapsed / totalMs * 100)))
      timeElapsedPct = pctTime + '%'
      daysRemaining  = Math.max(0, Math.round((endMs - nowMs) / 86400000)) + ' ngày'
    }

    // ── LỊCH SỬ ĐIỀU CHỈNH TIẾN ĐỘ từ schedule_revisions ──
    // Tổng trượt = kh_finish root task - finish_date gốc của project (không cộng delta_days từng revision)
    let revisionContext = ''
    try {
      const { data: revisions } = await sb.from('schedule_revisions')
        .select('revision_name, reason, effective_date, delta_days, affected_count, created_at')
        .eq('project_id', proj.id)
        .order('created_at', { ascending: true })

      // Tính tổng trượt thực tế: root task kh_finish vs project finish_date (baseline gốc)
      let totalSlipDays = 0
      const baselineFinish = proj.finish_date || proj.baseline_finish || null
      if (baselineFinish && currentFinish) {
        const [by, bm, bd] = baselineFinish.split('-').map(Number)
        const [cy, cm, cd] = currentFinish.split('-').map(Number)
        totalSlipDays = Math.round(
          (new Date(cy, cm-1, cd) - new Date(by, bm-1, bd)) / 86400000
        )
      }

      if (revisions?.length) {
        const slipStr = totalSlipDays > 0
          ? `tổng trượt +${totalSlipDays} ngày so với deadline HĐ gốc (${new Date(baselineFinish).toLocaleDateString('vi-VN')})`
          : totalSlipDays < 0
          ? `hoàn thành sớm hơn HĐ gốc ${Math.abs(totalSlipDays)} ngày`
          : `đúng deadline HĐ gốc`

        revisionContext = `\nLỊCH SỬ ĐIỀU CHỈNH TIẾN ĐỘ (${revisions.length} lần điều chỉnh, ${slipStr}):\n`
        revisions.forEach((r, i) => {
          const d = r.effective_date ? new Date(r.effective_date).toLocaleDateString('vi-VN') : '—'
          revisionContext += `- Lần ${i+1} (${d}): ${r.revision_name} — ${r.reason}\n`
        })
        revisionContext += `→ Deadline hiện hành (${actualEndDate}) đã được CĐT chấp thuận. Khi đánh giá tiến độ hàng tuần, so sánh với DEADLINE HIỆN HÀNH, không phải HĐ gốc.\n`
      } else if (totalSlipDays !== 0 && baselineFinish && currentFinish) {
        // Có trượt nhưng chưa có revision record
        revisionContext = `\nTimeline đã điều chỉnh: trượt +${totalSlipDays} ngày so với HĐ gốc (${new Date(baselineFinish).toLocaleDateString('vi-VN')} → ${actualEndDate}).\n`
      }
    } catch(e) { /* bỏ qua nếu bảng chưa có data */ }

    // ── LỊCH SỬ AI CÁC TUẦN TRƯỚC ──
    let historyContext = ''
    try {
      const { data: recentHistory } = await sb.from('ai_summaries')
        .select('week_number, year, stats, created_at')
        .eq('project_id', proj.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentHistory?.length) {
        historyContext = '\nDỮ LIỆU CÁC TUẦN TRƯỚC (để so sánh xu hướng):\n'
        recentHistory.forEach(h => {
          const s = h.stats ? JSON.parse(h.stats) : {}
          historyContext += `- Tuần ${h.week_number}/${h.year}: ${s.total_pct||0}% HT, ${s.late||0} công tác chậm, trễ TB ${s.avg_delay||0} ngày\n`
        })
        historyContext += '(So sánh với tuần hiện tại để đánh giá xu hướng tốt hơn hay xấu hơn)\n'
      }
    } catch(e) { /* bỏ qua */ }

    // Chỉ lấy task trễ CÓ delay hợp lệ (> 0, không null)
    const validLate = late.filter(t => t._delay > 0 && t._delay < 500)
    const validAvgDelay = validLate.length > 0
      ? Math.round(validLate.reduce((s,t) => s+(t._delay||0), 0) / validLate.length)
      : 0

    // Chưa bắt đầu hợp lệ (kh_start trong vòng 60 ngày qua)
    const now60 = new Date(); now60.setDate(now60.getDate() - 60)
    const validNotStarted = notStarted.filter(t =>
      t.kh_start && new Date(t.kh_start) >= now60
    )

    // Nhóm 1: Task đang thi công
    const inProgress = leaf.filter(t => t.tt_start && (t.pct_complete||0) < 100)
    const inProgressSummary = inProgress.slice(0,10).map(t => {
      const pct = t.pct_complete||0
      const d = t._delay || 0
      const delayStr = d > 0 ? ', trễ ' + d + ' ngày' : d < 0 ? ', sớm ' + Math.abs(d) + ' ngày' : ''
      const noteStr = t.latest_note ? ' [Ghi chú: ' + t.latest_note + ']' : ''
      return '- ' + t.name + ': ' + pct + '%' + delayStr + noteStr
    }).join('\n')

    // Nhóm 2: Task trễ hợp lệ kèm ghi chú
    const lateWithNote = validLate.slice(0,8).map(t => {
      const noteStr = t.latest_note ? ' | Ghi chú: ' + t.latest_note : ''
      return '- ' + t.name + ': trễ ' + t._delay + ' ngày, đạt ' + (t.pct_complete||0) + '%' + noteStr
    }).join('\n')

    // Nhóm 3: Level 3 summary
    const lvl3Clean = tasks.filter(t => t.is_summary && t.outline_level === 3)
    const lvl3SummaryClean = lvl3Clean.map(t => {
      const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const delay = t._delay
      let status = 'Đúng KH'
      if (delay > 0 && delay < 365) status = 'Trễ ' + delay + ' ngày'
      else if (delay < 0) status = 'Sớm ' + Math.abs(delay) + ' ngày'
      const parent = tasks.find(p => p.is_summary && p.outline_level === 2
        && t.wbs_code && p.wbs_code && t.wbs_code.startsWith(p.wbs_code + '.'))
      const parentPrefix = parent ? '[' + parent.name.slice(0,20) + '] ' : ''
      return '- ' + parentPrefix + t.name + ': ' + pct + '% (' + status + ')'
    }).join('\n')

    const prompt = `Bạn là trợ lý phân tích dự án xây dựng. Nhiệm vụ: viết báo cáo tuần cho BAN GIÁM ĐỐC — ngắn gọn, số liệu macro, tập trung vào quyết định và rủi ro. KHÔNG liệt kê chi tiết từng task. KHÔNG dùng ngôn ngữ kỹ thuật chuyên sâu.

DỰ ÁN: ${proj.name} (${proj.code})
NGÀY BÁO CÁO: ${today} - Tuần ${week}
TIMELINE HIỆN HÀNH: ${actualStartDate} → ${actualEndDate} (còn ${daysRemaining})
TIẾN ĐỘ: Đã đi ${timeElapsedPct} thời gian thi công, hoàn thành ${totalPct}% khối lượng
${revisionContext}
TỔNG QUAN:
- Tổng công tác: ${leaf.length} | Hoàn thành: ${done.length} | Đang thi công: ${inProgress.length}
- Chậm tiến độ: ${validLate.length} công tác | Trễ trung bình: ${validAvgDelay} ngày (SỐ CHÍNH XÁC TỪ HỆ THỐNG — dùng con số này, KHÔNG tự tính lại)
- Chưa bắt đầu (quá hạn trong 60 ngày gần đây): ${validNotStarted.length} công tác
- % hoàn thành tổng thể: ${totalPct}%
${historyContext}
CHIẾN TRƯỜNG TUẦN NÀY — ĐANG THI CÔNG (${inProgress.length} công tác):
${inProgressSummary || 'Chưa có công tác nào đang thi công'}

CÔNG TÁC CHẬM CÓ DELAY HỢP LỆ (${validLate.length} công tác):
${lateWithNote || 'Không có'}

TIẾN ĐỘ CHI TIẾT THEO HẠNG MỤC (level 3):
${lvl3SummaryClean || 'Không có dữ liệu'}

${(() => {
      if (!STATE._attendanceData) return ''
      const hist = STATE._attendanceData.history || []
      // Chỉ dùng 7 ngày cuối — hist có thể chứa 25-30 ngày (dùng cho chart)
      const hist7 = hist.slice(-7)
      // Tính TB 7 ngày thực tế từ data, không dùng avgCN7day/avgCN7 vì có thể undefined hoặc TB30
      const avg7 = hist7.length
        ? Math.round(hist7.reduce((s,h) => s+(h.cn_proj||0), 0) / hist7.length)
        : (STATE._attendanceData.avgCN7day || STATE._attendanceData.avgCN7 || 0)
      // Xu hướng tính từ 7 ngày cuối
      const first3 = hist7.slice(0,3).map(h => h.cn_proj||0)
      const last3  = hist7.slice(-3).map(h => h.cn_proj||0)
      const avgFirst = first3.length ? Math.round(first3.reduce((s,v)=>s+v,0)/first3.length) : 0
      const avgLast  = last3.length  ? Math.round(last3.reduce((s,v)=>s+v,0)/last3.length)  : 0
      const trend = avgLast - avgFirst
      const trendStr = trend > 5  ? `(xu hướng TĂNG +${trend} CN/ngày so với đầu tuần)`
                     : trend < -5 ? `(xu hướng GIẢM ${Math.abs(trend)} CN/ngày so với đầu tuần)`
                     : '(ổn định trong tuần)'
      const lastDay = hist[hist.length-1] || {}
      // Chỉ lấy 7 ngày cuối để tính min/max — tránh dùng 30 ngày của chart dashboard
      const last7 = hist.slice(-7)
      const minCN = last7.length ? Math.min(...last7.map(h=>h.cn_proj||0)) : 0
      const maxCN = last7.length ? Math.max(...last7.map(h=>h.cn_proj||0)) : 0
      return `QUÂN SỐ 7 NGÀY GẦN NHẤT:
- TB 7 ngày (tuần báo cáo): ${avg7} CN/ngày ${trendStr} | Min: ${minCN} | Max: ${maxCN}
- Ngày gần nhất: ${lastDay.cn_proj||0} CN · BCH: ${lastDay.total_bch||0}
- Phân loại: KC ${lastDay.total_ketcau||0} · HT ${lastDay.total_hoanthien||0} · MEP ${lastDay.total_mep||0} · CN ${lastDay.total_congnhat||0}
`
    })()}${STATE._aiUserNote ? 'CONTEXT THUC TE TU KTTC (uu tien cao):\n' + STATE._aiUserNote + '\n\nHay tich hop thong tin nay. Neu cong tac tre do nguyen nhan khach quan da neu, ghi nhan ro va danh gia kha nang thu hoi tien do.\n\n' : ''}
LƯU Ý QUAN TRỌNG:
- Timeline hiện hành đã bao gồm tất cả điều chỉnh được CĐT chấp thuận — đây là mốc đúng để đánh giá
- % thời gian đã qua = tính từ timeline hiện hành, KHÔNG phải baseline gốc
- Nếu có lịch sử điều chỉnh, nêu ngắn gọn "dự án đã điều chỉnh X lần, tổng +Y ngày do [lý do chính]"
- Chỉ đánh giá dựa trên dữ liệu được cung cấp ở trên, không suy diễn
- Nếu delay > 100 ngày mà % = 0 và chưa có tt_start → task chưa đến giai đoạn, không phải trễ thực sự

YÊU CẦU OUTPUT — viết đúng 4 mục sau, mỗi mục tối đa 3-4 câu, dùng bullet (•) nếu cần liệt kê:

## 1. TỔNG QUAN TIẾN ĐỘ
Đánh giá tổng thể: % HT vs % thời gian đã qua theo timeline HIỆN HÀNH, còn bao nhiêu ngày. Nếu timeline đã điều chỉnh, nêu rõ "so với kế hoạch hiện hành đã được CĐT chấp thuận". Nêu 1 điểm tích cực nếu có.

## 2. CẢNH BÁO TIMELINE DỰ ÁN
Gói nào đang lệch tiến độ nghiêm trọng so với KH HIỆN HÀNH (>15%)? Nguy cơ trễ deadline hiện hành bao nhiêu tuần? Mức độ: 🔴 Nguy hiểm / 🟡 Cần theo dõi / 🟢 Ổn.

## 3. RỦI RO TUẦN TỚI
Rủi ro nào có thể xảy ra trong 2-3 tuần tới? Tập trung vào rủi ro có thể phòng ngừa NGAY.

## 4. VẤN ĐỀ KỸ THUẬT CẦN LƯU Ý KHI CHUYỂN CÔNG TÁC
Gói nào sắp bàn giao sang giai đoạn tiếp theo? Điều kiện tiên quyết chưa đủ? BCH cần chuẩn bị gì?

QUY TẮC:
- Viết cho BGĐ — không cần chi tiết kỹ thuật
- Số liệu macro: %, ngày, tuần
- Mỗi mục tối đa 80 từ
- Dùng **bold** cho con số và cụm từ quan trọng
- Tông văn: thẳng thắn, quyết đoán, không vòng vo
- QUAN TRỌNG: Chỉ dùng số liệu được cung cấp. KHÔNG tự tính toán lại.`

    // Gọi qua Supabase Edge Function
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Chưa đăng nhập')

    const statsPayload = {
      total: leaf.length, done: done.length,
      late: validLate.length,
      avg_delay: validAvgDelay,
      total_pct: totalPct,
      week
    }

    // Xóa bản cũ cùng tuần/năm trước khi lưu mới
    await sb.from('ai_summaries')
      .delete()
      .eq('project_id', proj.id)
      .eq('week_number', week)
      .eq('year', new Date().getFullYear())

    const res = await fetch(CFG.SUPABASE_URL + '/functions/v1/ai-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        prompt,
        project_id:   proj.id,
        project_name: proj.name,
        stats:        statsPayload,
        max_tokens:   4096
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.error?.includes('CLAUDE_API_KEY')) throw new Error('EDGE_FUNCTION_NO_KEY')
      if (res.status === 404) throw new Error('EDGE_FUNCTION_NOT_DEPLOYED')
      throw new Error(err.error || 'Lỗi server ' + res.status)
    }

    const data = await res.json()
    const summary = data.summary || 'Không có kết quả'

    loading(false)
    showAISummaryModal(summary, today, week, proj.name)

  } catch(e) {
    loading(false)
    if (e.message === 'EDGE_FUNCTION_NOT_DEPLOYED') showEdgeFunctionGuide()
    else if (e.message === 'EDGE_FUNCTION_NO_KEY') showAPIKeyGuide()
    else toast('Lỗi: ' + e.message, 'error')
  }
}

function showAISummaryModal(text, date, week, projName) {
  function mdRender(t) {
    return t
      .split('\n').map(line => {
        if (line.startsWith('## ')) return '<div style="font-size:14px;font-weight:700;color:var(--navy);margin:14px 0 6px">' + line.slice(3) + '</div>'
        if (line.startsWith('# '))  return '<div style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 10px">' + line.slice(2) + '</div>'
        const l = line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--gray8)">$1</strong>')
        return l ? '<div style="margin:3px 0">' + l + '</div>' : '<div style="height:6px"></div>'
      }).join('')
  }

  const iterLabel = STATE._aiUserNote ? ' + ghi chú KTTC' : ''
  openModal(`🤖 AI Tóm tắt tiến độ — Tuần ${week}${iterLabel}`, `
    <div style="padding:10px 14px;background:var(--lblue);border-radius:var(--radius);margin-bottom:14px;font-size:12px;color:var(--gray6);display:flex;justify-content:space-between">
      <strong>${projName}</strong>
      <span>Ngày ${date} · Tuần ${week}</span>
    </div>
    <div style="font-size:13px;line-height:1.7;color:var(--gray7);max-height:45vh;overflow-y:auto;padding-right:4px">
      ${mdRender(text)}
    </div>
    ${STATE.role === 'admin' ? `
    <div style="margin-top:12px;border-top:0.5px solid var(--gray2);padding-top:12px">
      <div style="font-size:12px;font-weight:600;color:var(--gray7);margin-bottom:6px">
        📝 Ghi chú context thực tế (tùy chọn — để phân tích lại chính xác hơn):
      </div>
      <textarea id="ai-user-note" rows="3"
        style="width:100%;padding:8px 10px;border:0.5px solid var(--gray3);border-radius:var(--radius);font-size:12px;resize:vertical;font-family:inherit;line-height:1.6;background:var(--gray0)"
        placeholder="VD: Lô O18 do CĐT chậm phát hành bản vẽ 3 tuần. BCH cam kết xong T3 tuần 23. Lô O16B đã bổ sung 1 tổ thêm..."></textarea>
      <div style="font-size:11px;color:var(--gray4);margin-top:4px">
        AI sẽ tích hợp context này → báo cáo sát thực tế hơn. Bấm "🔄 Phân tích lại" sau khi nhập.
      </div>
    </div>
    ` : ''}
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
    ${STATE.role === 'admin' ? '<button class="btn btn-secondary" onclick="reAnalyzeWithNote()" style="border-color:var(--blue);color:var(--blue)">🔄 Phân tích lại</button>' : ''}
    <button class="btn btn-primary" onclick="closeModal();exportWeeklyReport()">📄 Xuất báo cáo</button>
  `)
}

async function showAISummaryHistory() {
  const proj = STATE.currentProject
  if (!proj) return

  loading(true, 'Đang tải lịch sử...')
  const { data: history, error } = await sb.from('ai_summaries')
    .select('*')
    .eq('project_id', proj.id)
    .order('created_at', { ascending: false })
    .limit(10)
  loading(false)

  if (error) {
    if (error.message.includes('does not exist')) {
      openModal('📋 Lịch sử AI Tóm tắt', `
        <div style="text-align:center;padding:30px;color:var(--gray4)">
          <div style="font-size:32px;margin-bottom:12px">🗄️</div>
          <div style="font-size:14px;font-weight:500;margin-bottom:8px">Chưa có bảng lưu lịch sử</div>
          <div style="font-size:12px">Chạy SQL bên dưới trong Supabase để tạo bảng:</div>
          <div style="background:var(--gray1);border-radius:var(--radius);padding:10px;margin-top:10px;font-family:monospace;font-size:11px;text-align:left">
            CREATE TABLE ai_summaries (<br>
            &nbsp;&nbsp;id uuid DEFAULT gen_random_uuid() PRIMARY KEY,<br>
            &nbsp;&nbsp;project_id uuid REFERENCES projects(id),<br>
            &nbsp;&nbsp;project_name text,<br>
            &nbsp;&nbsp;summary_text text,<br>
            &nbsp;&nbsp;stats jsonb,<br>
            &nbsp;&nbsp;created_by text,<br>
            &nbsp;&nbsp;week_number int,<br>
            &nbsp;&nbsp;year int,<br>
            &nbsp;&nbsp;created_at timestamptz DEFAULT now()<br>
            );<br>
            ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;<br>
            CREATE POLICY "auth all" ON ai_summaries FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
          </div>
        </div>
      `, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
      return
    }
    toast('Lỗi: ' + error.message, 'error')
    return
  }

  if (!history?.length) {
    openModal('📋 Lịch sử AI Tóm tắt', `
      <div style="text-align:center;padding:30px;color:var(--gray4)">
        Chưa có lần tóm tắt nào. Bấm <strong>🤖 AI Tóm tắt tiến độ</strong> để tạo lần đầu.
      </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>`)
    return
  }

  window._aiHistoryData = history

  const rows = history.map(function(h, idx) {
    const stats = h.stats ? JSON.parse(h.stats) : {}
    const date = new Date(h.created_at).toLocaleDateString('vi-VN')
    const preview = (h.summary_text||'').slice(0,120) + '...'
    return '<div data-hist-idx="'+idx+'"'
      + ' style="padding:12px 14px;border-bottom:0.5px solid var(--gray2);cursor:pointer"'
      + ' onmouseover="this.style.background=\'var(--gray0)\'" onmouseout="this.style.background=\'\'">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
      + '<span style="font-size:12px;font-weight:600;color:var(--gray8)">Tuần '+h.week_number+'/'+h.year+'</span>'
      + '<span style="font-size:11px;color:var(--gray4)">'+date+' · '+(h.created_by||'').split('@')[0]+'</span>'
      + '</div>'
      + '<div style="display:flex;gap:10px;margin-bottom:6px;flex-wrap:wrap">'
      + (stats.total ? '<span style="font-size:10px;padding:1px 6px;background:var(--lblue);color:var(--blue);border-radius:8px">'+(stats.done||0)+'/'+stats.total+' xong</span>' : '')
      + (stats.late  ? '<span style="font-size:10px;padding:1px 6px;background:#FEE2E2;color:#991B1B;border-radius:8px">'+stats.late+' chậm</span>' : '')
      + (stats.total_pct ? '<span style="font-size:10px;padding:1px 6px;background:#DCFCE7;color:#166534;border-radius:8px">'+stats.total_pct+'% HT</span>' : '')
      + '</div>'
      + '<div style="font-size:12px;color:var(--gray5);line-height:1.5">'+preview+'</div>'
      + '</div>'
  }).join('')

  openModal('📋 Lịch sử AI Tóm tắt — ' + proj.name,
    '<div style="font-size:12px;color:var(--gray4);margin-bottom:10px">'+history.length+' lần gần nhất · Click để xem đầy đủ</div>'
    + '<div id="hist-list" style="border:0.5px solid var(--gray2);border-radius:var(--radius);overflow:hidden">'+rows+'</div>',
    '<button class="btn btn-secondary" onclick="closeModal()">Đóng</button>')

  setTimeout(function() {
    document.querySelectorAll('[data-hist-idx]').forEach(function(el) {
      el.addEventListener('click', function() {
        const idx = parseInt(el.dataset.histIdx)
        const h = window._aiHistoryData[idx]
        if (!h) return
        const d = new Date(h.created_at).toLocaleDateString('vi-VN')
        showAISummaryModal(h.summary_text||'', d, h.week_number||0, h.project_name||'')
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
      <p style="margin-bottom:10px">Tính năng AI Tóm tắt cần deploy 2 thứ trong Supabase:</p>
      <div style="background:var(--gray1);border-radius:var(--radius);padding:12px;font-size:12px;margin-bottom:10px">
        <strong>Bước 1 — Deploy Edge Function <code>ai-summary</code>:</strong><br>
        1. Vào <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/functions" target="_blank" style="color:var(--blue)">Supabase → Edge Functions</a><br>
        2. New function → tên: <strong>ai-summary</strong><br>
        3. Paste nội dung file <strong>ai-summary.ts</strong> đã được gửi → Deploy
      </div>
      <div style="background:var(--gray1);border-radius:var(--radius);padding:12px;font-size:12px">
        <strong>Bước 2 — Thêm Claude API key vào Secrets:</strong><br>
        1. Vào <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/settings/functions" target="_blank" style="color:var(--blue)">Edge Functions → Secrets</a><br>
        2. Add secret: tên <strong>CLAUDE_API_KEY</strong>, giá trị là key từ <a href="https://console.anthropic.com" target="_blank" style="color:var(--blue)">console.anthropic.com</a>
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
        2. Vào <a href="https://supabase.com/dashboard/project/gqelblpdujdqdddisjei/settings/functions" target="_blank" style="color:var(--blue)">Supabase → Edge Functions → Secrets</a><br>
        3. Add secret: <strong>CLAUDE_API_KEY</strong> = key vừa tạo
      </div>
    </div>
  `, `<button class="btn btn-primary" onclick="closeModal()">Đã hiểu</button>`)
}
