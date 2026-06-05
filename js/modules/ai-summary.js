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

    // Top 5 worst delays
    const worstTasks = late.slice(0,5).map(t =>
      `- ${t.name}: trễ ${t._delay} ngày, hiện ${t.pct_complete||0}%${t._delayLabel ? ' ('+t._delayLabel+')' : ''}`
    ).join('\n')


    // Summary stats
    // Dùng % của root task (roll-up có trọng số) thay vì avg leaf — giống Dashboard
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalPct = rootTask
      ? (rootTask.display_pct !== undefined ? rootTask.display_pct : (rootTask.pct_complete||0))
      : (leaf.length > 0 ? Math.round(leaf.reduce((s,t)=>s+(t.display_pct||t.pct_complete||0),0)/leaf.length) : 0)
    const lateCount = late.length
    const avgDelay = late.length > 0 ? Math.round(late.reduce((s,t)=>s+(t._delay||0),0)/late.length) : 0

    // Level 2 summary
    const lvl2 = tasks.filter(t => t.is_summary && t.outline_level === 2)
    const lvl2Summary = lvl2.map(t =>
      `- ${t.name}: ${t.display_pct||t.pct_complete||0}% (${t._delayLabel||'Đúng KH'})`
    ).join('\n')

    // Query lịch sử 3 tuần gần nhất để so sánh xu hướng
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
    } catch(e) {
      // Bảng chưa có dữ liệu lịch sử — bỏ qua
    }

    // Tính timeline thực tế từ task (bỏ qua project.start_date từ XML không chính xác)
    const tlActual = getActualTimeline(tasks)
    const actualStartDate = tlActual ? tlActual.start.toLocaleDateString('vi-VN') : proj.start_date
    const actualEndDate   = tlActual ? tlActual.end.toLocaleDateString('vi-VN')   : proj.finish_date

    // Tính % thời gian đã qua dựa trên task dates thực tế (không phải XML project dates)
    let timeElapsedPct = '—'
    if (tlActual) {
      const totalMs  = tlActual.end - tlActual.start
      const elapsedMs = new Date() - tlActual.start
      const pctTime = Math.max(0, Math.min(100, Math.round(elapsedMs / totalMs * 100)))
      timeElapsedPct = pctTime + '%'
    }

    // Chỉ lấy task trễ CÓ delay hợp lệ (> 0, không null)
    const validLate = late.filter(t => t._delay > 0 && t._delay < 500)
    const validAvgDelay = validLate.length > 0
      ? Math.round(validLate.reduce((s,t) => s+(t._delay||0), 0) / validLate.length)
      : 0
    const validWorstTasks = validLate.slice(0,5).map(t =>
      '- ' + t.name + ': trễ ' + t._delay + ' ngày, đạt ' + (t.pct_complete||0) + '%'
        + (t._delayLabel && t._delayLabel !== '—' ? ' (' + t._delayLabel + ')' : '')
    ).join('\n')

    // Chưa bắt đầu hợp lệ (kh_start trong vòng 60 ngày qua)
    const now60 = new Date(); now60.setDate(now60.getDate() - 60)
    const validNotStarted = notStarted.filter(t =>
      t.kh_start && new Date(t.kh_start) >= now60
    )

    // Level 2 summary — bỏ hạng mục delay bất thường (> 365 ngày)
    // Nhóm 1: Task đang thi công (chiến trường thực sự tuần này)
    const inProgress = leaf.filter(t => t.tt_start && (t.pct_complete||0) < 100)
    const inProgressSummary = inProgress.slice(0,10).map(t => {
      const pct = t.pct_complete||0
      const d = t._delay || 0
      const delayStr = d > 0 ? ', trễ ' + d + ' ngày' : d < 0 ? ', sớm ' + Math.abs(d) + ' ngày' : ''
      const noteStr = t.latest_note ? ' [Ghi chú: ' + t.latest_note + ']' : ''
      return '- ' + t.name + ': ' + pct + '%' + delayStr + noteStr
    }).join('\n')

    // Nhóm 2: Task trễ hợp lệ kèm ghi chú (nếu có)
    const lateWithNote = validLate.slice(0,8).map(t => {
      const noteStr = t.latest_note ? ' | Ghi chú: ' + t.latest_note : ''
      return '- ' + t.name + ': trễ ' + t._delay + ' ngày, đạt ' + (t.pct_complete||0) + '%' + noteStr
    }).join('\n')

    // Nhóm 3: Level 3 summary (chi tiết hơn level 2 cho BGĐ)
    const lvl3Clean = tasks.filter(t => t.is_summary && t.outline_level === 3)
    const lvl3SummaryClean = lvl3Clean.map(t => {
      const pct = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const delay = t._delay
      let status = 'Đúng KH'
      if (delay > 0 && delay < 365) status = 'Trễ ' + delay + ' ngày'
      else if (delay < 0) status = 'Sớm ' + Math.abs(delay) + ' ngày'
      // Tìm parent level 2 để thêm context
      const parent = tasks.find(p => p.is_summary && p.outline_level === 2
        && t.wbs_code && p.wbs_code && t.wbs_code.startsWith(p.wbs_code + '.'))
      const parentPrefix = parent ? '[' + parent.name.slice(0,20) + '] ' : ''
      return '- ' + parentPrefix + t.name + ': ' + pct + '% (' + status + ')'
    }).join('\n')

    // Giữ lvl2SummaryClean cho backward compat
    const lvl2SummaryClean = lvl3SummaryClean

    const prompt = `Bạn là chuyên gia quản lý dự án xây dựng tại Việt Nam. Phân tích tiến độ dự án và viết báo cáo ngắn gọn, chính xác bằng tiếng Việt.

DỰ ÁN: ${proj.name} (${proj.code})
NGÀY BÁO CÁO: ${today} - Tuần ${week}
THỜI GIAN THI CÔNG: ${actualStartDate} → ${actualEndDate}
TIẾN ĐỘ: Đã đi ${timeElapsedPct} thời gian thi công, hoàn thành ${totalPct}% khối lượng

TỔNG QUAN:
- Tổng công tác: ${leaf.length} | Hoàn thành: ${done.length} | Đang thi công: ${leaf.filter(t=>t.tt_start&&(t.pct_complete||0)<100).length}
- Chậm tiến độ: ${validLate.length} công tác | Trễ trung bình: ${validAvgDelay} ngày
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
      const c    = STATE._attendanceData.current
      const hist = STATE._attendanceData.history || []
      const avg7 = STATE._attendanceData.avgCN7 || 0

      // Xu hướng: so sánh 3 ngày đầu vs 3 ngày cuối trong 7 ngày
      const first3 = hist.slice(0,3).map(h => h.cn_proj||0)
      const last3  = hist.slice(-3).map(h => h.cn_proj||0)
      const avgFirst = first3.length ? Math.round(first3.reduce((s,v)=>s+v,0)/first3.length) : 0
      const avgLast  = last3.length  ? Math.round(last3.reduce((s,v)=>s+v,0)/last3.length)  : 0
      const trend = avgLast - avgFirst
      const trendStr = trend > 5  ? `(xu hướng TĂNG +${trend} CN/ngày so với đầu tuần)`
                     : trend < -5 ? `(xu hướng GIẢM ${Math.abs(trend)} CN/ngày so với đầu tuần)`
                     : '(ổn định trong tuần)'

      const histRows = hist.map(h => {
        const dt = new Date(h.report_date)
        const lbl = dt.toLocaleDateString('vi-VN', {weekday:'short', day:'2-digit', month:'2-digit'})
        return `  ${lbl}: ${h.cn_proj||0} CN`
      }).join('\n')

      const lastDay = hist[hist.length-1] || {}
      return `QUÂN SỐ CÔNG NHÂN 7 NGÀY GẦN NHẤT (dự án ${c.project_code||''}):
- Trung bình 7 ngày: ${avg7} CN/ngày ${trendStr}
- Ngày gần nhất: ${lastDay.cn_proj||0} CN · BCH: ${lastDay.total_bch||0}
- Phân loại (ngày gần nhất): Kết cấu ${lastDay.total_ketcau||0} · Hoàn thiện ${lastDay.total_hoanthien||0} · MEP ${lastDay.total_mep||0} · Công nhật ${lastDay.total_congnhat||0}
- Chi tiết 7 ngày:
${histRows}
(Phân tích tương quan: so sánh TB ${avg7} CN/ngày với số lượng task đang chậm — nếu quân số thấp mà tiến độ đang trễ nhiều → cảnh báo rủi ro thiếu nhân lực; nếu quân số cao nhưng tiến độ vẫn chậm → vấn đề năng suất hoặc tổ chức)

`
    })()}${STATE._aiUserNote ? 'CONTEXT THUC TE TU KTTC (uu tien cao):\n' + STATE._aiUserNote + '\n\nHay tich hop thong tin nay. Neu cong tac tre do nguyen nhan khach quan da neu, ghi nhan ro va danh gia kha nang thu hoi tien do.\n\n' : ''}
LƯU Ý QUAN TRỌNG:
- Chỉ đánh giá dựa trên dữ liệu được cung cấp ở trên
- Không suy diễn hoặc phóng đại số liệu
- Nếu delay > 100 ngày mà % hoàn thành = 0 và chưa có tt_start → có thể là task chưa đến giai đoạn thi công, không phải trễ thực sự
- % thời gian đã qua được tính từ ngày bắt đầu thi công thực tế (không phải ngày tạo file kế hoạch)

Hãy viết báo cáo TÓM TẮT gồm 4 phần, mỗi phần 2-4 câu ngắn gọn, súc tích:

## 1. TỔNG QUAN TIẾN ĐỘ
Đánh giá chung: dự án đang ở mức nào so với kế hoạch tổng thể (tính theo % thời gian đã qua vs % hoàn thành). Nêu 1-2 điểm tích cực nếu có.

## 2. ĐIỂM CHÚ Ý
Top 3 rủi ro/vấn đề cụ thể cần xử lý ngay. Nêu tên công tác, số ngày trễ, hậu quả nếu không xử lý.

## 3. XU HƯỚNG TUẦN TỚI
Dự báo dựa trên tốc độ hiện tại. Cảnh báo nếu có nguy cơ vượt deadline tổng.

## 4. KHUYẾN NGHỊ
2-3 hành động CỤ THỂ, có thể thực hiện ngay trong tuần tới. Ưu tiên theo mức độ tác động.

## 5. ĐÁNH GIÁ NHÂN LỰC
Dựa trên dữ liệu quân số: quân số hiện tại có đáp ứng được yêu cầu thi công không? Nếu thiếu nhân lực ở gói nào, đề xuất điều chuyển cụ thể.

Giọng văn chuyên nghiệp, thực tế, dành cho Ban Giám Đốc. Dùng **bold** cho tên công tác và số liệu quan trọng.`

    // Gọi qua Supabase Edge Function (tránh CORS khi gọi trực tiếp từ browser)
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Chưa đăng nhập')

    const statsPayload = {
      total: leaf.length, done: done.length,
      late: validLate.length,
      avg_delay: validAvgDelay,
      total_pct: totalPct,  // % root task (roll-up, giống Dashboard)
      week
    }

    // Xóa bản cũ cùng tuần/năm trước khi lưu mới (tránh trùng lặp)
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
        stats:        statsPayload
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.error?.includes('CLAUDE_API_KEY')) {
        throw new Error('EDGE_FUNCTION_NO_KEY')
      }
      if (res.status === 404) {
        throw new Error('EDGE_FUNCTION_NOT_DEPLOYED')
      }
      throw new Error(err.error || 'Lỗi server ' + res.status)
    }

    const data = await res.json()
    const summary = data.summary || 'Không có kết quả'

    loading(false)
    showAISummaryModal(summary, today, week, proj.name)

  } catch(e) {
    loading(false)
    if (e.message === 'EDGE_FUNCTION_NOT_DEPLOYED') {
      showEdgeFunctionGuide()
    } else if (e.message === 'EDGE_FUNCTION_NO_KEY') {
      showAPIKeyGuide()
    } else {
      toast('Lỗi: ' + e.message, 'error')
    }
  }
}

function showAISummaryModal(text, date, week, projName) {
  // Render markdown: ## heading, **bold**, newlines
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

  // Lưu data vào global để click handler truy cập
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

  // Gắn click sau khi modal render xong
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
