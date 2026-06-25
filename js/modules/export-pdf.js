// ═══════════════════════════════════════════════════════════
// XUẤT PDF — html2canvas + jsPDF
// ═══════════════════════════════════════════════════════════
async function exportPDF() {
  const proj = STATE.currentProject
  if (!proj) { toast('Chưa có dự án', 'error'); return }

  let waited = 0
  while ((!window.html2canvas || !window.jspdf) && waited < 50) {
    await new Promise(r => setTimeout(r, 100)); waited++
  }
  if (!window.html2canvas || !window.jspdf) {
    toast('Không tải được thư viện PDF.', 'error'); return
  }
  const { jsPDF } = window.jspdf

  loading(true, 'Chuẩn bị dữ liệu...')
  try {
    const today = new Date().toLocaleDateString('vi-VN')
    const week  = getISOWeek(new Date())
    const tasks = STATE.tasks
    const tl3   = getActualTimeline(tasks)
    const rangeStart = tl3 ? tl3.start : new Date(proj.start_date)
    const rangeEnd   = tl3 ? tl3.end   : new Date(proj.finish_date)
    const rangeDays  = tl3 ? tl3.days  : Math.round((rangeEnd-rangeStart)/86400000)
    const todayD     = new Date(); todayD.setHours(0,0,0,0)
    const nowPct     = Math.max(0,Math.min(100,Math.round((todayD-rangeStart)/86400000/rangeDays*100)))

    // ── Lấy AI Summary tuần này (nếu có) ───────────────────
    let aiSummaryText = ''
    try {
      const { data: aiData } = await sb.from('ai_summaries')
        .select('summary_text, stats, week_number, year')
        .eq('project_id', proj.id)
        .eq('week_number', week)
        .eq('year', new Date().getFullYear())
        .single()
      if (aiData?.summary_text) {
        aiSummaryText = aiData.summary_text
      }
    } catch(e) {}

    // ── EVM data ─────────────────────────────────────────────
    if (typeof computeRollupMoney === 'function' && tasks[0]?._contractValue === undefined) {
      computeRollupMoney(tasks)
    }
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalCV  = rootTask?._contractValue || 0
    const totalEV  = rootTask?._earnedValue   || 0
    const leaf     = tasks.filter(t => !t.is_summary)
    const totalPct = rootTask?.display_pct || 0

    // PV tuyến tính
    let totalPV = 0
    const leafWithPrice = leaf.filter(t => (t.unit_price||0) > 0)
    if (leafWithPrice.length > 0) {
      const now = new Date(); now.setHours(0,0,0,0)
      totalPV = leafWithPrice.reduce((s, t) => {
        const cv  = (t.unit_price||0)*(t.planned_quantity||1)
        const [sy,sm,sd] = (t.kh_start||'').split('-').map(Number)
        const [ey,em,ed] = (t.kh_finish||'').split('-').map(Number)
        if (!sy||!ey) return s
        const start = new Date(sy,sm-1,sd), end = new Date(ey,em-1,ed)
        if (now < start) return s
        if (now >= end)  return s + cv
        return s + cv * (now-start)/(end-start)
      }, 0)
    }
    const spi = totalPV > 0 ? totalEV/totalPV : null

    const fmtM = v => {
      if (!v||v===0) return '—'
      if (Math.abs(v)>=1e9) return (v/1e9).toFixed(1)+'tỷ'
      if (Math.abs(v)>=1e6) return Math.round(v/1e6)+'tr'
      return Math.round(v/1e3)+'k'
    }

    // ── Build quarters ──────────────────────────────────────
    const quarters = []
    let qCur = new Date(rangeStart.getFullYear(),Math.floor(rangeStart.getMonth()/3)*3,1)
    while (qCur <= rangeEnd) {
      const pct = Math.max(0,Math.min(100,Math.round((qCur-rangeStart)/86400000/rangeDays*100)))
      quarters.push({ label:'Q'+(Math.floor(qCur.getMonth()/3)+1)+'/'+qCur.getFullYear(), pct })
      qCur = new Date(qCur.getFullYear(),qCur.getMonth()+3,1)
    }

    // ── Build Gantt rows ────────────────────────────────────
    loading(true, 'Đang tạo Gantt...')
    let allRows = ''
    tasks.forEach(t => {
      const pct    = t.display_pct!==undefined?t.display_pct:(t.pct_complete||0)
      const delay  = t._delay||0
      // Dùng getDelayColor để đồng bộ với app
      const barClr = typeof getDelayColor==='function'
        ? getDelayColor(delay)
        : (delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A')
      const khBarClr = '#9DC3E6'
      const indent = (t.outline_level-1)*12
      const fw     = t.outline_level<=1?'700':t.outline_level<=2?'600':t.is_summary?'500':'400'
      const fs     = t.outline_level<=1?'13px':'12px'
      const rowBg  = t.is_summary?'#F8FAFC':'#FFFFFF'
      const pctBg  = pct===100?'#DCFCE7':delay>14?'#FEE2E2':delay>=7?'#FEF3C7':pct===0?'#F1F5F9':'#DBEAFE'
      const pctFg  = pct===100?'#166534':delay>14?'#991B1B':delay>=7?'#92400E':pct===0?'#94A3B8':'#1E40AF'
      const dlyClr = typeof getDelayColor==='function'
        ? getDelayColor(delay)
        : (delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A')

      const d2p = d => d ? Math.max(0,Math.min(100,Math.round((new Date(d)-rangeStart)/86400000/rangeDays*100))) : null
      const khL = d2p(t.kh_start), khR = d2p(t.kh_finish)
      const khW = (khL!==null&&khR!==null)?Math.max(0.3,khR-khL):0
      const ttL = d2p(t.tt_start)
      const ttR = t.tt_finish?d2p(t.tt_finish):(t.tt_start?Math.min(100,nowPct):null)
      const ttW = (ttL!==null&&ttR!==null)?Math.max(0.3,ttR-ttL):0
      const dlyLabel = t._delayLabel||(pct===100?'Xong':'—')

      allRows += '<div style="display:flex;min-height:'+(t.is_summary?'26px':'22px')+';border-bottom:0.5px solid #E2E8F0;background:'+rowBg+';align-items:center">'
        +'<div style="width:300px;flex-shrink:0;padding:3px 4px 3px '+(6+indent)+'px;font-weight:'+fw+';font-size:'+fs+';border-right:0.5px solid #E2E8F0;white-space:normal;line-height:1.3">'+(t.is_summary?'&#9658; ':'')+t.name+'</div>'
        +'<div style="width:48px;flex-shrink:0;text-align:center;border-right:0.5px solid #E2E8F0;padding:2px">'
        +'<span style="font-size:10px;font-weight:600;padding:1px 4px;border-radius:4px;background:'+pctBg+';color:'+pctFg+'">'+pct+'%</span></div>'
        +'<div style="flex:1;position:relative;height:'+(t.is_summary?'26px':'22px')+';overflow:hidden">'
        +(khL!==null?'<div style="position:absolute;height:7px;top:3px;left:'+khL+'%;width:'+khW+'%;background:'+khBarClr+';border-radius:2px"></div>':'')
        +(ttL!==null&&ttW>0?'<div style="position:absolute;height:7px;top:14px;left:'+ttL+'%;width:'+ttW+'%;background:'+barClr+';border-radius:2px;opacity:0.9"></div>':'')
        +'<div style="position:absolute;top:0;bottom:0;left:'+nowPct+'%;width:1.5px;background:#D85A30"></div>'
        +(delay>0&&nowPct<93?'<span style="position:absolute;top:13px;left:'+Math.min(90,nowPct+0.5)+'%;font-size:8px;padding:1px 3px;border-radius:3px;background:#FEF2F2;color:'+dlyClr+';white-space:nowrap">+'+delay+'d</span>':'')
        +'</div>'
        +'<div style="width:110px;flex-shrink:0;font-size:10px;font-weight:500;color:'+dlyClr+';text-align:center;padding:2px 4px;border-left:0.5px solid #E2E8F0;white-space:normal;line-height:1.3">'+dlyLabel+'</div>'
        +'</div>'
    })

    // ── Gantt header ────────────────────────────────────────
    const qLabels = quarters.map(q =>
      '<div style="position:absolute;left:'+q.pct+'%;font-size:8px;color:rgba(255,255,255,0.7);padding-top:8px;white-space:nowrap">'+q.label+'</div>'
    ).join('')

    const headerHtml = '<div style="display:flex;background:#1A2B4A;color:white;font-size:10px;font-weight:600;min-height:30px;align-items:center">'
      +'<div style="width:300px;flex-shrink:0;padding:6px 10px;border-right:1px solid rgba(255,255,255,0.15)">Hạng mục / Công tác</div>'
      +'<div style="width:48px;flex-shrink:0;text-align:center;border-right:1px solid rgba(255,255,255,0.15)">% HT</div>'
      +'<div style="flex:1;position:relative;height:30px;overflow:hidden">'
      +qLabels
      +'<div style="position:absolute;top:0;bottom:0;left:'+nowPct+'%;width:1.5px;background:#D85A30"></div>'
      +'<div style="position:absolute;top:4px;left:'+Math.min(97,nowPct+0.3)+'%;font-size:7px;color:#D85A30;font-weight:700">NOW</div>'
      +'</div>'
      +'<div style="width:110px;flex-shrink:0;text-align:center;border-left:1px solid rgba(255,255,255,0.15);padding:6px 4px">Lệch tiến độ</div>'
      +'</div>'

    // ── EVM Section HTML ─────────────────────────────────────
    const spiColor = !spi?'#64748B':spi>=1?'#16A34A':spi>=0.8?'#D97706':'#DC2626'
    const svColor  = (totalEV-totalPV)>=0?'#16A34A':'#DC2626'
    const evmHtml = totalCV > 0 ? `
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#1A2B4A;margin-bottom:10px">📊 PHÂN TÍCH SẢN LƯỢNG (EVM) — Tuần ${week}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
          <div style="background:white;border-radius:6px;padding:10px;border:1px solid #E2E8F0;text-align:center">
            <div style="font-size:9px;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px">Giá trị HĐ (BAC)</div>
            <div style="font-size:16px;font-weight:700;color:#1A2B4A">${fmtM(totalCV)}</div>
          </div>
          <div style="background:white;border-radius:6px;padding:10px;border:1px solid #E2E8F0;text-align:center">
            <div style="font-size:9px;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px">KH Sản lượng (PV)</div>
            <div style="font-size:16px;font-weight:700;color:#2563EB">${fmtM(totalPV)}</div>
            <div style="font-size:9px;color:#64748B">${totalCV>0?Math.round(totalPV/totalCV*100):0}% BAC</div>
          </div>
          <div style="background:white;border-radius:6px;padding:10px;border:1px solid #E2E8F0;text-align:center">
            <div style="font-size:9px;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px">TH Sản lượng (EV)</div>
            <div style="font-size:16px;font-weight:700;color:#0D9488">${fmtM(totalEV)}</div>
            <div style="font-size:9px;color:#64748B">${totalCV>0?Math.round(totalEV/totalCV*100):0}% BAC</div>
          </div>
          <div style="background:white;border-radius:6px;padding:10px;border:1px solid #E2E8F0;text-align:center">
            <div style="font-size:9px;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px">SPI</div>
            <div style="font-size:20px;font-weight:800;color:${spiColor}">${spi?spi.toFixed(2):'—'}</div>
            <div style="font-size:9px;color:${spiColor};font-weight:600">${spi?spi>=1?'✅ Đạt KH':spi>=0.8?'⚠️ Chú ý':'🔴 Chậm':''}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="font-size:11px;color:#64748B">
            Schedule Variance: <strong style="color:${svColor}">${(totalEV-totalPV)>=0?'+':''}${fmtM(totalEV-totalPV)}</strong>
            ${(totalEV-totalPV)<0?' (thiếu '+fmtM(totalPV-totalEV)+' so với kế hoạch)':' (vượt kế hoạch)'}
          </div>
          <div style="font-size:11px;color:#64748B">
            Tiến độ tổng thể: <strong style="color:#1A2B4A">${totalPct}%</strong>
          </div>
        </div>
      </div>` : ''

    // ── AI Summary Section HTML ──────────────────────────────
    const aiHtml = aiSummaryText ? `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 16px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#1E40AF;margin-bottom:10px">🤖 AI TÓM TẮT TIẾN ĐỘ — Tuần ${week}</div>
        <div style="font-size:11px;line-height:1.7;color:#374151;white-space:pre-wrap">${aiSummaryText.replace(/## /g,'').replace(/\*\*/g,'')}</div>
      </div>` : ''

    // ── Assemble container ───────────────────────────────────
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;background:#fff;font-family:Arial,sans-serif;z-index:-1'
    container.innerHTML =
      // Header
      '<div style="background:#1A2B4A;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">'
      +'<div><div style="font-size:16px;font-weight:700">VelaE&C — Báo cáo tiến độ thi công</div>'
      +'<div style="font-size:10px;opacity:.7;margin-top:2px">'+proj.name+' | Tuần '+week+' · '+today+'</div></div>'
      +'<div style="font-size:10px;opacity:.8;text-align:right">Hệ thống VELA TIẾN ĐỘ<br>Xuất ngày: '+today+'</div></div>'
      // Body
      +'<div style="padding:14px 16px">'
      + evmHtml
      + aiHtml
      // Gantt
      +'<div style="font-size:12px;font-weight:700;color:#1A2B4A;margin-bottom:8px">📋 TIẾN ĐỘ THI CÔNG — BIỂU ĐỒ GANTT</div>'
      +'<div style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">'
      + headerHtml + allRows
      +'</div></div>'

    document.body.appendChild(container)
    await new Promise(r => setTimeout(r, 400))

    loading(true, 'Đang chụp ảnh...')
    const canvas = await html2canvas(container, {
      scale: 1.8, useCORS: true, backgroundColor: '#ffffff',
      logging: false, width: 1200, height: container.scrollHeight
    })
    document.body.removeChild(container)

    loading(true, 'Đang tạo PDF...')
    const pdf    = new jsPDF({ orientation:'landscape', unit:'mm', format:'a3' })
    const pageW  = pdf.internal.pageSize.getWidth()
    const pageH  = pdf.internal.pageSize.getHeight()
    const margin = 8
    const imgW   = pageW - margin*2
    const scale2 = canvas.width / imgW
    const maxPxH = (pageH - margin*2 - 8) * scale2
    let srcY = 0, pageNum = 1, total = Math.ceil(canvas.height/maxPxH)

    while (srcY < canvas.height) {
      const sliceH = Math.min(maxPxH, canvas.height-srcY)
      const sc = document.createElement('canvas')
      sc.width = canvas.width; sc.height = sliceH
      sc.getContext('2d').drawImage(canvas,0,srcY,canvas.width,sliceH,0,0,canvas.width,sliceH)
      const sliceImgH = sliceH/scale2
      if (pageNum>1) pdf.addPage()
      pdf.addImage(sc.toDataURL('image/jpeg',0.92),'JPEG',margin,margin,imgW,sliceImgH)
      pdf.setFillColor(240,244,248); pdf.rect(0,pageH-7,pageW,7,'F')
      pdf.setTextColor(150,150,150); pdf.setFontSize(7)
      pdf.text('VelaE&C — Hệ thống theo dõi tiến độ thi công',margin,pageH-2)
      pdf.text('Trang '+pageNum+'/'+total,pageW-margin,pageH-2,{align:'right'})
      srcY+=maxPxH; pageNum++
    }

    const fn = 'BaoCao_'+proj.code.replace(/[^a-zA-Z0-9]/g,'_')+'_T'+week+'_'+today.replace(/\//g,'-')+'.pdf'
    pdf.save(fn)
    toast('Đã xuất PDF: '+fn, 'success')
  } catch(e) {
    toast('Lỗi xuất PDF: '+e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
  }
}
