// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// XUẤT PDF — html2canvas + jsPDF
// ═══════════════════════════════════════════════════════════
async function exportPDF() {
  const proj = STATE.currentProject
  if (!proj) { toast('Chưa có dự án', 'error'); return }
  // Wait for libraries to load (max 5s)
  let waited = 0
  while ((!window.html2canvas || !window.jspdf) && waited < 50) {
    await new Promise(r => setTimeout(r, 100))
    waited++
  }
  if (!window.html2canvas || !window.jspdf) {
    toast('Không tải được thư viện PDF. Kiểm tra kết nối mạng.', 'error')
    return
  }
  const { jsPDF } = window.jspdf

  loading(true, 'Chuẩn bị dữ liệu...')
  try {
    const today = new Date().toLocaleDateString('vi-VN')
    const tasks = STATE.tasks
    // Dùng timeline thực tế từ task
    const tl3 = getActualTimeline(tasks)
    const rangeStart = tl3 ? tl3.start : new Date(proj.start_date)
    const rangeEnd   = tl3 ? tl3.end   : new Date(proj.finish_date)
    const rangeDays  = tl3 ? tl3.days  : Math.round((rangeEnd - rangeStart) / 86400000)
    const todayD     = new Date(); todayD.setHours(0,0,0,0)
    const nowPct     = Math.max(0, Math.min(100, Math.round((todayD - rangeStart)/86400000/rangeDays*100)))

    // Build quarter labels
    const quarters = []
    let qCur = new Date(rangeStart.getFullYear(), Math.floor(rangeStart.getMonth()/3)*3, 1)
    while (qCur <= rangeEnd) {
      const pct = Math.max(0, Math.min(100, Math.round((qCur-rangeStart)/86400000/rangeDays*100)))
      quarters.push({ label: 'Q'+(Math.floor(qCur.getMonth()/3)+1)+'/'+qCur.getFullYear(), pct })
      qCur = new Date(qCur.getFullYear(), qCur.getMonth()+3, 1)
    }

    // Build ALL rows HTML (no collapse, full tree)
    loading(true, 'Đang tạo Gantt đầy đủ...')
    let allRows = ''
    tasks.forEach(function(t) {
      const pct      = t.display_pct !== undefined ? t.display_pct : (t.pct_complete||0)
      const isLate   = t._delay > 0
      const isAhead  = t._delay < 0
      const barClr   = isLate ? '#F09595' : isAhead ? '#5DCAA5' : '#A9D18E'
      const indent   = (t.outline_level-1)*12
      const fw       = t.outline_level<=1?'700':t.outline_level<=2?'600':t.is_summary?'500':'400'
      const fs       = t.outline_level<=1?'13px':'12px'
      const rowBg    = t.is_summary ? '#F8FAFC' : '#FFFFFF'
      const pctBg    = pct===100?'#DCFCE7':isLate?'#FEE2E2':pct===0?'#F1F5F9':'#DBEAFE'
      const pctFg    = pct===100?'#166534':isLate?'#991B1B':pct===0?'#94A3B8':'#1E40AF'
      const dlyClr   = isLate?'#A32D2D':isAhead?'#0D6E4E':'#64748B'
      const dlyLabel = t._delayLabel || (pct===100?'Xong':'—')

      const d2p = function(d) {
        if (!d) return null
        return Math.max(0, Math.min(100, Math.round((new Date(d)-rangeStart)/86400000/rangeDays*100)))
      }
      const khL = d2p(t.kh_start), khR = d2p(t.kh_finish)
      const khW = (khL!==null&&khR!==null) ? Math.max(0.3, khR-khL) : 0
      const ttL = d2p(t.tt_start)
      const ttR = t.tt_finish ? d2p(t.tt_finish) : (t.tt_start ? Math.min(100,nowPct) : null)
      const ttW = (ttL!==null&&ttR!==null) ? Math.max(0.3, ttR-ttL) : 0

      allRows += '<div style="display:flex;min-height:'+(t.is_summary?'26px':'22px')+';border-bottom:0.5px solid #E2E8F0;background:'+rowBg+';align-items:center">'
        + '<div style="width:300px;flex-shrink:0;padding:3px 4px 3px '+(6+indent)+'px;font-weight:'+fw+';font-size:'+fs+';border-right:0.5px solid #E2E8F0;white-space:normal;line-height:1.3">'
        + (t.is_summary ? '&#9658; ' : '') + t.name
        + '</div>'
        + '<div style="width:48px;flex-shrink:0;text-align:center;border-right:0.5px solid #E2E8F0;padding:2px">'
        + '<span style="font-size:10px;font-weight:600;padding:1px 4px;border-radius:4px;background:'+pctBg+';color:'+pctFg+'">'+pct+'%</span>'
        + '</div>'
        + '<div style="flex:1;position:relative;height:'+(t.is_summary?'26px':'22px')+';overflow:hidden">'
        + (khL!==null ? '<div style="position:absolute;height:7px;top:3px;left:'+khL+'%;width:'+khW+'%;background:#9DC3E6;border-radius:2px"></div>' : '')
        + (ttL!==null&&ttW>0 ? '<div style="position:absolute;height:7px;top:14px;left:'+ttL+'%;width:'+ttW+'%;background:'+barClr+';border-radius:2px"></div>' : '')
        + '<div style="position:absolute;top:0;bottom:0;left:'+nowPct+'%;width:1.5px;background:#D85A30"></div>'
        + (isLate&&nowPct<93 ? '<span style="position:absolute;top:13px;left:'+Math.min(90,nowPct+0.5)+'%;font-size:8px;padding:1px 3px;border-radius:3px;background:#FCEBEB;color:#A32D2D;white-space:nowrap">+'+t._delay+'d</span>' : '')
        + '</div>'
        + '<div style="width:110px;flex-shrink:0;font-size:10px;font-weight:500;color:'+dlyClr+';text-align:center;padding:2px 4px;border-left:0.5px solid #E2E8F0;white-space:normal;line-height:1.3">'
        + dlyLabel + '</div>'
        + '</div>'
    })

    // Header
    const qLabels = quarters.map(function(q) {
      return '<div style="position:absolute;left:'+q.pct+'%;font-size:8px;color:rgba(255,255,255,0.7);padding-top:8px;white-space:nowrap">'+q.label+'</div>'
    }).join('')

    const headerHtml = '<div style="display:flex;background:#1A2B4A;color:white;font-size:10px;font-weight:600;min-height:30px;align-items:center">'
      + '<div style="width:300px;flex-shrink:0;padding:6px 10px;border-right:1px solid rgba(255,255,255,0.15)">Hang muc / Cong tac</div>'
      + '<div style="width:48px;flex-shrink:0;text-align:center;border-right:1px solid rgba(255,255,255,0.15)">% HT</div>'
      + '<div style="flex:1;position:relative;height:30px;overflow:hidden">'
      + qLabels
      + '<div style="position:absolute;top:0;bottom:0;left:'+nowPct+'%;width:1.5px;background:#D85A30"></div>'
      + '<div style="position:absolute;top:4px;left:'+Math.min(97,nowPct+0.3)+'%;font-size:7px;color:#D85A30;font-weight:700">NOW</div>'
      + '</div>'
      + '<div style="width:110px;flex-shrink:0;text-align:center;border-left:1px solid rgba(255,255,255,0.15);padding:6px 4px">Lech tien do</div>'
      + '</div>'

    // Hidden container
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;background:#fff;font-family:Arial,sans-serif;z-index:-1'
    container.innerHTML = '<div style="background:#1A2B4A;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-size:15px;font-weight:700">VelaE&C — Bao cao tien do thi cong</div>'
      + '<div style="font-size:10px;opacity:.7;margin-top:2px">'+proj.name+' | '+(proj.start_date||'')+' den '+(proj.finish_date||'')+'</div></div>'
      + '<div style="font-size:10px;opacity:.7">Xuat ngay: '+today+'</div></div>'
      + '<div style="border:1px solid #E2E8F0;overflow:hidden">'
      + headerHtml + allRows + '</div>'
    document.body.appendChild(container)

    await new Promise(function(r){ setTimeout(r, 400) })

    loading(true, 'Dang chup anh...')
    const canvas = await html2canvas(container, {
      scale: 1.8, useCORS: true, backgroundColor: '#ffffff',
      logging: false, width: 1200, height: container.scrollHeight
    })
    document.body.removeChild(container)

    // Slice into A3 landscape pages
    loading(true, 'Dang tao PDF...')
    const pdf    = new jsPDF({ orientation:'landscape', unit:'mm', format:'a3' })
    const pageW  = pdf.internal.pageSize.getWidth()
    const pageH  = pdf.internal.pageSize.getHeight()
    const margin = 8
    const imgW   = pageW - margin*2
    const scale2 = canvas.width / imgW
    const maxPxH = (pageH - margin*2 - 8) * scale2
    let srcY = 0, pageNum = 1, total = Math.ceil(canvas.height / maxPxH)

    while (srcY < canvas.height) {
      const sliceH = Math.min(maxPxH, canvas.height - srcY)
      const sc = document.createElement('canvas')
      sc.width = canvas.width; sc.height = sliceH
      sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      const sliceImgH = sliceH / scale2
      if (pageNum > 1) pdf.addPage()
      pdf.addImage(sc.toDataURL('image/jpeg',0.92), 'JPEG', margin, margin, imgW, sliceImgH)
      pdf.setFillColor(240,244,248); pdf.rect(0,pageH-7,pageW,7,'F')
      pdf.setTextColor(150,150,150); pdf.setFontSize(7)
      pdf.text('VelaE&C — He thong theo doi tien do thi cong', margin, pageH-2)
      pdf.text('Trang '+pageNum+'/'+total, pageW-margin, pageH-2, {align:'right'})
      srcY += maxPxH; pageNum++
    }

    const fn = 'BaoCaoTienDo_'+proj.code.replace(/[^a-zA-Z0-9]/g,'_')+'_'+today.replace(/\//g,'-')+'.pdf'
    pdf.save(fn)
    toast('Da xuat PDF: '+fn, 'success')
  } catch(e) {
    toast('Loi xuat PDF: '+e.message, 'error')
    console.error(e)
  } finally {
    loading(false)
  }
}
