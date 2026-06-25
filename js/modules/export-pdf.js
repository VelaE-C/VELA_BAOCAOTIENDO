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

    // ── AI Summary ──────────────────────────────────────────
    let aiSummaryText = ''
    try {
      const { data: aiData } = await sb.from('ai_summaries')
        .select('summary_text, stats, week_number, year')
        .eq('project_id', proj.id)
        .eq('week_number', week)
        .eq('year', new Date().getFullYear())
        .single()
      if (aiData?.summary_text) aiSummaryText = aiData.summary_text
    } catch(e) {}

    // ── EVM ─────────────────────────────────────────────────
    if (typeof computeRollupMoney === 'function' && tasks[0]?._contractValue === undefined) {
      computeRollupMoney(tasks)
    }
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalCV  = rootTask?._contractValue || 0
    const totalEV  = rootTask?._earnedValue   || 0
    const leaf     = tasks.filter(t => !t.is_summary)
    const totalPct = rootTask?.display_pct || 0
    const leafWithPrice = leaf.filter(t => (t.unit_price||0) > 0)

    let totalPV = 0
    if (leafWithPrice.length > 0) {
      const now = new Date(); now.setHours(0,0,0,0)
      totalPV = leafWithPrice.reduce((s, t) => {
        const cv = (t.unit_price||0)*(t.planned_quantity||1)
        const [sy,sm,sd] = (t.kh_start||'').split('-').map(Number)
        const [ey,em,ed] = (t.kh_finish||'').split('-').map(Number)
        if (!sy||!ey) return s
        const start = new Date(sy,sm-1,sd), end = new Date(ey,em-1,ed)
        if (now < start) return s
        if (now >= end)  return s + cv
        return s + cv*(now-start)/(end-start)
      }, 0)
    }
    const spi = totalPV > 0 ? totalEV/totalPV : null

    // EV tuần này
    let evLastWeek = 0
    try {
      const lwn = week>1?week-1:52, lwy = week>1?new Date().getFullYear():new Date().getFullYear()-1
      const { data: lp } = await sb.from('task_progress')
        .select('task_id,pct_complete').eq('project_id',proj.id)
        .eq('week_number',lwn).eq('year',lwy)
      if (lp?.length) {
        const lm = {}; lp.forEach(p => { lm[p.task_id]=p.pct_complete||0 })
        evLastWeek = leafWithPrice.reduce((s,t) => {
          const cv=(t.unit_price||0)*(t.planned_quantity||1)
          return s+cv*(lm[t.id]||0)/100
        }, 0)
      }
    } catch(e) {}
    const evThisWeek = Math.max(0, totalEV - evLastWeek)

    const fmtM = v => {
      if (!v||v===0) return '—'
      if (Math.abs(v)>=1e9) return (v/1e9).toFixed(1)+'tỷ'
      if (Math.abs(v)>=1e6) return Math.round(v/1e6)+'tr'
      return Math.round(v/1e3)+'k'
    }

    // ── S-Curve chart SVG ────────────────────────────────────
    loading(true, 'Đang tạo S-Curve...')
    let scurveHtml = ''
    try {
      const { data: allProg } = await sb.from('task_progress')
        .select('task_id,pct_complete,week_number,year')
        .eq('project_id', proj.id)
        .order('year').order('week_number').order('updated_at',{ascending:false})

      if (allProg?.length) {
        const taskHistory = {}
        allProg.forEach(p => {
          if (!taskHistory[p.task_id]) taskHistory[p.task_id] = []
          taskHistory[p.task_id].push(p)
        })
        const getPctAt = (tid,wk,yr) => {
          let best=0
          ;(taskHistory[tid]||[]).forEach(p => {
            if (p.year<yr||(p.year===yr&&p.week_number<=wk)) best=Math.max(best,p.pct_complete||0)
          })
          return best
        }

        // Tuần duy nhất có progress
        const wkMap = {}
        allProg.forEach(p => {
          const k=`${p.year}-${String(p.week_number).padStart(2,'0')}`
          wkMap[k]={week:p.week_number,year:p.year}
        })
        const wks = Object.keys(wkMap).sort().slice(-12) // 12 tuần gần nhất

        const evArr=[], pvArr=[], lblArr=[]
        let prevEV=0
        wks.forEach(k => {
          const {week:wk,year:yr} = wkMap[k]
          lblArr.push('T'+wk)
          const ev = leafWithPrice.reduce((s,t) => {
            const cv=(t.unit_price||0)*(t.planned_quantity||1)
            return s+cv*getPctAt(t.id,wk,yr)/100
          }, 0)
          const wkEnd = new Date(yr,0,4)
          const dow=wkEnd.getDay()||7; wkEnd.setDate(wkEnd.getDate()-dow+1+(wk-1)*7+6)
          const pv = leafWithPrice.reduce((s,t) => {
            const cv=(t.unit_price||0)*(t.planned_quantity||1)
            const [sy,sm,sd]=(t.kh_start||'').split('-').map(Number)
            const [ey,em,ed]=(t.kh_finish||'').split('-').map(Number)
            if(!sy||!ey) return s
            const st=new Date(sy,sm-1,sd),en=new Date(ey,em-1,ed)
            if(wkEnd<st) return s
            if(wkEnd>=en) return s+cv
            return s+cv*(wkEnd-st)/(en-st)
          }, 0)
          evArr.push(ev); pvArr.push(pv)
          prevEV=ev
        })

        // SVG
        const W=1100,H=200,PL=70,PR=20,PT=20,PB=35
        const cW=W-PL-PR, cH=H-PT-PB, n=lblArr.length
        const maxV=Math.max(...evArr,...pvArr,totalCV,1)
        const xC=i=>PL+i*(cW/n)+cW/(n*2)
        const yC=v=>PT+cH-Math.round(v/maxV*cH)
        const fB=v=>{if(!v)return'0';if(v>=1e9)return(v/1e9).toFixed(1)+'tỷ';if(v>=1e6)return Math.round(v/1e6)+'tr';return Math.round(v/1e3)+'k'}

        const barW=Math.max(10,Math.floor(cW/n)-8)
        const bars=evArr.map((ev,i)=>{
          const delta=Math.max(0,ev-(i>0?evArr[i-1]:0))
          const h=Math.max(2,Math.round(delta/maxV*cH))
          const x=PL+i*(cW/n)+(cW/n-barW)/2
          const y=PT+cH-h
          return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#2563EB" rx="2" opacity="0.75"/>
            ${delta>0?`<text x="${x+barW/2}" y="${PT+cH+14}" text-anchor="middle" font-size="9" fill="#1D4ED8" font-weight="600">${fB(delta)}</text>`:''}`
        }).join('')

        const evPts=evArr.map((v,i)=>`${xC(i)},${yC(v)}`).join(' ')
        const pvPts=pvArr.map((v,i)=>`${xC(i)},${yC(v)}`).join(' ')
        const hdY=totalCV>0?yC(totalCV):-1

        const yTicks=[0,.25,.5,.75,1].map(r=>{
          const y=PT+cH-r*cH
          return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="#E2E8F0" stroke-width="0.5"/>
            <text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#94A3B8">${fB(r*maxV)}</text>`
        }).join('')
        const xLbls=lblArr.map((l,i)=>`<text x="${xC(i)}" y="${H-4}" text-anchor="middle" font-size="9" fill="#64748B">${l}</text>`).join('')

        const lastEV=evArr[n-1]||0, lastPV=pvArr[n-1]||0
        const spiV=lastPV>0?(lastEV/lastPV):null
        const spiClr=!spiV?'#64748B':spiV>=1?'#16A34A':spiV>=0.8?'#D97706':'#DC2626'

        scurveHtml = `
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div style="font-size:12px;font-weight:700;color:#1A2B4A">📈 BIỂU ĐỒ SẢN LƯỢNG 12 TUẦN (S-CURVE)</div>
            <div style="display:flex;gap:14px;font-size:10px;color:#64748B;align-items:center">
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#2563EB;border-radius:2px;display:inline-block;opacity:.75"></span>SL tuần (EV)</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:2px;background:#D97706;display:inline-block"></span>Lũy kế TH (EV): <strong style="color:#D97706">${fB(lastEV)}</strong></span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:2px;background:#16A34A;display:inline-block;border-top:2px dashed #16A34A;margin-top:1px"></span>KH (PV): <strong style="color:#16A34A">${fB(lastPV)}</strong></span>
              ${spiV?`<span style="padding:2px 8px;border-radius:12px;background:${spiClr}18;color:${spiClr};font-weight:700">SPI=${spiV.toFixed(2)}</span>`:''}
            </div>
          </div>
          <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
            ${yTicks}
            <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+cH}" stroke="#CBD5E1" stroke-width="1"/>
            ${hdY>0?`<line x1="${PL}" y1="${hdY}" x2="${W-PR}" y2="${hdY}" stroke="#DC2626" stroke-width="1" stroke-dasharray="6 3" opacity="0.4"/>
              <text x="${W-PR+2}" y="${hdY+3}" font-size="8" fill="#DC2626" opacity="0.7">HĐ</text>`:''}
            ${bars}
            <polyline points="${pvPts}" fill="none" stroke="#16A34A" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.8"/>
            ${pvArr.map((v,i)=>`<circle cx="${xC(i)}" cy="${yC(v)}" r="2.5" fill="#16A34A" opacity="0.8"/>`).join('')}
            <polyline points="${evPts}" fill="none" stroke="#D97706" stroke-width="2" stroke-linejoin="round"/>
            ${evArr.map((v,i)=>{
              const isLast=i===n-1
              return `<circle cx="${xC(i)}" cy="${yC(v)}" r="${isLast?4:2.5}" fill="#D97706"/>
                ${isLast?`<text x="${xC(i)}" y="${yC(v)-8}" text-anchor="middle" font-size="10" fill="#D97706" font-weight="700">${fB(v)}</text>`:''}`
            }).join('')}
            ${xLbls}
          </svg>
        </div>`
      }
    } catch(e) { console.warn('S-curve error:', e) }

    // ── Bảng Tiến độ & Sản lượng (giống Dashboard/WBS) ─────
    loading(true, 'Đang tạo bảng tiến độ...')
    const summaries = tasks.filter(t => t.is_summary && t.outline_level <= 3)
    const fmtShort = v => {
      if (!v||v===0) return '—'
      if (v>=1e9) return (v/1e9).toFixed(1)+'tỷ'
      if (v>=1e6) return Math.round(v/1e6)+'tr'
      return Math.round(v/1e3)+'k'
    }

    let summaryRows = ''
    summaries.forEach(t => {
      const pct    = t.display_pct!==undefined?t.display_pct:(t.pct_complete||0)
      const cv     = t._contractValue||0
      const ev     = t._earnedValue||0
      const delay  = t._delay||0
      const indent = (t.outline_level-1)*14
      const dlClr  = typeof getDelayColor==='function'?getDelayColor(delay):(delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A')
      const barClr = pct===100?'#16A34A':dlClr
      const fw     = t.outline_level<=2?'700':'500'
      const fs     = t.outline_level<=2?'12px':'11px'
      const rowBg  = t.outline_level===1?'#F0F4F8':t.outline_level===2?'#F8FAFC':'#FFFFFF'
      const delayTxt = delay>0?`(trễ ${delay}d)`:delay<0?`(sớm ${Math.abs(delay)}d)`:''
      const delayColor = delay>0?dlClr:'#64748B'
      const fmtDate = d => d?new Date(d).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'—'

      summaryRows += `<tr style="background:${rowBg};border-bottom:0.5px solid #E2E8F0">
        <td style="padding:7px 8px;padding-left:${10+indent}px;font-weight:${fw};font-size:${fs};color:#1E293B;line-height:1.4">${t.name}</td>
        <td style="padding:7px 8px;font-size:10px;color:#64748B;white-space:nowrap;text-align:center">${fmtDate(t.kh_start)} → ${fmtDate(t.kh_finish)}</td>
        <td style="padding:7px 8px;text-align:center">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;min-width:60px">
              <div style="width:${pct}%;height:100%;background:${barClr};border-radius:3px"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${barClr};white-space:nowrap">${pct}%</span>
          </div>
        </td>
        <td style="padding:7px 8px;font-size:10px;color:${delayColor};font-weight:600;text-align:center;white-space:nowrap">${delayTxt||'Đúng KH'}</td>
        <td style="padding:7px 8px;font-size:12px;font-weight:700;color:#0D9488;text-align:right;white-space:nowrap">${cv>0?fmtShort(ev):'—'}</td>
        <td style="padding:7px 8px;font-size:11px;color:#334155;text-align:right;white-space:nowrap">${cv>0?fmtShort(cv):'—'}</td>
      </tr>`
    })

    const summaryTableHtml = `
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:12px">
        <div style="background:#1A2B4A;color:white;padding:8px 12px;font-size:12px;font-weight:700">📊 TIẾN ĐỘ & SẢN LƯỢNG THEO HẠNG MỤC</div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#F1F5F9;font-size:10px;font-weight:600;color:#64748B">
              <th style="padding:7px 8px;text-align:left">Hạng mục</th>
              <th style="padding:7px 8px;text-align:center">KH Bắt đầu → Kết thúc</th>
              <th style="padding:7px 8px;text-align:center;min-width:140px">Tiến độ</th>
              <th style="padding:7px 8px;text-align:center">Lệch</th>
              <th style="padding:7px 8px;text-align:right">SL TH</th>
              <th style="padding:7px 8px;text-align:right">Giá trị HĐ</th>
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
      </div>`

    // ── Gantt rows ────────────────────────────────────────────
    loading(true, 'Đang tạo Gantt...')
    let allRows = ''
    tasks.forEach(t => {
      const pct    = t.display_pct!==undefined?t.display_pct:(t.pct_complete||0)
      const delay  = t._delay||0
      const barClr = typeof getDelayColor==='function'?getDelayColor(delay):(delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A')
      const indent = (t.outline_level-1)*12
      const fw     = t.outline_level<=1?'700':t.outline_level<=2?'600':t.is_summary?'500':'400'
      const fs     = t.outline_level<=1?'13px':'12px'
      const rowBg  = t.is_summary?'#F8FAFC':'#FFFFFF'
      const pctBg  = pct===100?'#DCFCE7':delay>14?'#FEE2E2':delay>=7?'#FEF3C7':pct===0?'#F1F5F9':'#DBEAFE'
      const pctFg  = pct===100?'#166534':delay>14?'#991B1B':delay>=7?'#92400E':pct===0?'#94A3B8':'#1E40AF'
      const dlyClr = typeof getDelayColor==='function'?getDelayColor(delay):(delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A')
      const d2p = d => d?Math.max(0,Math.min(100,Math.round((new Date(d)-rangeStart)/86400000/rangeDays*100))):null
      const khL=d2p(t.kh_start),khR=d2p(t.kh_finish)
      const khW=(khL!==null&&khR!==null)?Math.max(0.3,khR-khL):0
      const ttL=d2p(t.tt_start)
      const ttR=t.tt_finish?d2p(t.tt_finish):(t.tt_start?Math.min(100,nowPct):null)
      const ttW=(ttL!==null&&ttR!==null)?Math.max(0.3,ttR-ttL):0
      const dlyLabel=t._delayLabel||(pct===100?'Xong':'—')

      allRows += '<div style="display:flex;min-height:'+(t.is_summary?'26px':'22px')+';border-bottom:0.5px solid #E2E8F0;background:'+rowBg+';align-items:center">'
        +'<div style="width:300px;flex-shrink:0;padding:3px 4px 3px '+(6+indent)+'px;font-weight:'+fw+';font-size:'+fs+';border-right:0.5px solid #E2E8F0;white-space:normal;line-height:1.3">'+(t.is_summary?'&#9658; ':'')+t.name+'</div>'
        +'<div style="width:48px;flex-shrink:0;text-align:center;border-right:0.5px solid #E2E8F0;padding:2px">'
        +'<span style="font-size:10px;font-weight:600;padding:1px 4px;border-radius:4px;background:'+pctBg+';color:'+pctFg+'">'+pct+'%</span></div>'
        +'<div style="flex:1;position:relative;height:'+(t.is_summary?'26px':'22px')+';overflow:hidden">'
        +(khL!==null?'<div style="position:absolute;height:7px;top:3px;left:'+khL+'%;width:'+khW+'%;background:#9DC3E6;border-radius:2px"></div>':'')
        +(ttL!==null&&ttW>0?'<div style="position:absolute;height:7px;top:14px;left:'+ttL+'%;width:'+ttW+'%;background:'+barClr+';border-radius:2px;opacity:0.9"></div>':'')
        +'<div style="position:absolute;top:0;bottom:0;left:'+nowPct+'%;width:1.5px;background:#D85A30"></div>'
        +(delay>0&&nowPct<93?'<span style="position:absolute;top:13px;left:'+Math.min(90,nowPct+0.5)+'%;font-size:8px;padding:1px 3px;border-radius:3px;background:#FEF2F2;color:'+dlyClr+';white-space:nowrap">+'+delay+'d</span>':'')
        +'</div>'
        +'<div style="width:90px;flex-shrink:0;font-size:10px;font-weight:500;color:'+dlyClr+';text-align:center;padding:2px 4px;border-left:0.5px solid #E2E8F0">'+dlyLabel+'</div>'
        +'</div>'
    })

    // ── Gantt header ──────────────────────────────────────────
    const quarters=[]
    let qCur=new Date(rangeStart.getFullYear(),Math.floor(rangeStart.getMonth()/3)*3,1)
    while(qCur<=rangeEnd){
      const pct=Math.max(0,Math.min(100,Math.round((qCur-rangeStart)/86400000/rangeDays*100)))
      quarters.push({label:'Q'+(Math.floor(qCur.getMonth()/3)+1)+'/'+qCur.getFullYear(),pct})
      qCur=new Date(qCur.getFullYear(),qCur.getMonth()+3,1)
    }
    const qLabels=quarters.map(q=>`<div style="position:absolute;left:${q.pct}%;font-size:8px;color:rgba(255,255,255,0.7);padding-top:8px;white-space:nowrap">${q.label}</div>`).join('')
    const headerHtml='<div style="display:flex;background:#1A2B4A;color:white;font-size:10px;font-weight:600;min-height:30px;align-items:center">'
      +'<div style="width:300px;flex-shrink:0;padding:6px 10px;border-right:1px solid rgba(255,255,255,0.15)">Hạng mục / Công tác</div>'
      +'<div style="width:48px;flex-shrink:0;text-align:center;border-right:1px solid rgba(255,255,255,0.15)">% HT</div>'
      +'<div style="flex:1;position:relative;height:30px;overflow:hidden">'+qLabels
      +'<div style="position:absolute;top:0;bottom:0;left:'+nowPct+'%;width:1.5px;background:#D85A30"></div>'
      +'<div style="position:absolute;top:4px;left:'+Math.min(97,nowPct+0.3)+'%;font-size:7px;color:#D85A30;font-weight:700">NOW</div>'
      +'</div>'
      +'<div style="width:90px;flex-shrink:0;text-align:center;border-left:1px solid rgba(255,255,255,0.15);padding:6px 4px">Lệch TĐ</div>'
      +'</div>'

    // ── EVM cards ─────────────────────────────────────────────
    const spiColor=!spi?'#64748B':spi>=1?'#16A34A':spi>=0.8?'#D97706':'#DC2626'
    const evmHtml=totalCV>0?`
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px">
        <div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center;border:1px solid #BFDBFE">
          <div style="font-size:9px;color:#1D4ED8;font-weight:600;margin-bottom:4px">SL TUẦN NÀY</div>
          <div style="font-size:18px;font-weight:800;color:#1D4ED8">${fmtM(evThisWeek)}</div>
        </div>
        <div style="background:#F0FDF4;border-radius:8px;padding:10px;text-align:center;border:1px solid #BBF7D0">
          <div style="font-size:9px;color:#166534;font-weight:600;margin-bottom:4px">LŨY KẾ TH (EV)</div>
          <div style="font-size:18px;font-weight:800;color:#0D9488">${fmtM(totalEV)}</div>
          <div style="font-size:9px;color:#64748B">${totalCV>0?Math.round(totalEV/totalCV*100):0}% HĐ</div>
        </div>
        <div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center;border:1px solid #BFDBFE">
          <div style="font-size:9px;color:#1D4ED8;font-weight:600;margin-bottom:4px">KH SẢN LƯỢNG (PV)</div>
          <div style="font-size:18px;font-weight:800;color:#2563EB">${fmtM(totalPV)}</div>
          <div style="font-size:9px;color:#64748B">${totalCV>0?Math.round(totalPV/totalCV*100):0}% HĐ</div>
        </div>
        <div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;border:1px solid #E2E8F0">
          <div style="font-size:9px;color:#64748B;font-weight:600;margin-bottom:4px">GIÁ TRỊ HĐ (BAC)</div>
          <div style="font-size:18px;font-weight:800;color:#1A2B4A">${fmtM(totalCV)}</div>
        </div>
        <div style="background:${spiColor}10;border-radius:8px;padding:10px;text-align:center;border:1px solid ${spiColor}30">
          <div style="font-size:9px;color:${spiColor};font-weight:600;margin-bottom:4px">SPI</div>
          <div style="font-size:22px;font-weight:800;color:${spiColor}">${spi?spi.toFixed(2):'—'}</div>
          <div style="font-size:9px;color:${spiColor};font-weight:600">${spi?spi>=1?'✅ Đạt KH':spi>=0.8?'⚠️ Chú ý':'🔴 Chậm':''}</div>
        </div>
      </div>`:'';

    // ── AI Summary ────────────────────────────────────────────
    const aiHtml=aiSummaryText?`
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px 16px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#1E40AF;margin-bottom:8px">🤖 PHÂN TÍCH AI — Tuần ${week}</div>
        <div style="font-size:10px;line-height:1.7;color:#374151;white-space:pre-wrap">${aiSummaryText.replace(/## /g,'\n').replace(/\*\*/g,'')}</div>
      </div>`:''

    // ── Assemble ──────────────────────────────────────────────
    const container=document.createElement('div')
    container.style.cssText='position:fixed;left:-9999px;top:0;width:1200px;background:#fff;font-family:Arial,sans-serif;z-index:-1'
    container.innerHTML=
      '<div style="background:#1A2B4A;color:white;padding:12px 20px;display:flex;justify-content:space-between;align-items:center">'
      +'<div style="display:flex;align-items:center;gap:12px">'
      +'<div style="font-size:24px;font-weight:700;color:#E8410A;letter-spacing:-1px">VELA</div>'
      +'<div style="width:1px;height:32px;background:rgba(255,255,255,.3)"></div>'
      +'<div><div style="font-size:15px;font-weight:700">BÁO CÁO TIẾN ĐỘ THI CÔNG</div>'
      +'<div style="font-size:10px;opacity:.7;margin-top:1px">Phòng KTTC — VelaE&C</div></div>'
      +'</div>'
      +'<div style="text-align:right">'
      +'<div style="font-size:13px;font-weight:600">'+proj.name+'</div>'
      +'<div style="font-size:10px;opacity:.7;margin-top:2px">Tuần '+week+'/'+new Date().getFullYear()+' | Ngày lập: '+today+'</div>'
      +'</div></div>'
      +'<div style="padding:14px 16px">'
      + evmHtml
      + scurveHtml
      + aiHtml
      + summaryTableHtml
      +'<div style="font-size:12px;font-weight:700;color:#1A2B4A;margin-bottom:8px">📋 SƠ ĐỒ GANTT TỔNG QUAN</div>'
      +'<div style="font-size:10px;color:#64748B;margin-bottom:6px;display:flex;gap:16px">'
      +'<span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:5px;background:#9DC3E6;border-radius:2px;display:inline-block"></span>KH</span>'
      +'<span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:5px;background:#16A34A;border-radius:2px;display:inline-block"></span>TT đúng/vượt</span>'
      +'<span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:5px;background:#DC2626;border-radius:2px;display:inline-block"></span>TT trễ</span>'
      +'<span style="display:flex;align-items:center;gap:4px"><span style="width:2px;height:14px;background:#D85A30;display:inline-block"></span>Hôm nay</span>'
      +'</div>'
      +'<div style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">'+headerHtml+allRows+'</div>'
      +'</div>'

    document.body.appendChild(container)
    await new Promise(r => setTimeout(r,400))

    loading(true,'Đang chụp ảnh...')
    const canvas=await html2canvas(container,{scale:1.8,useCORS:true,backgroundColor:'#ffffff',logging:false,width:1200,height:container.scrollHeight})
    document.body.removeChild(container)

    loading(true,'Đang tạo PDF...')
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a3'})
    const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight()
    const margin=8,imgW=pageW-margin*2
    const scale2=canvas.width/imgW,maxPxH=(pageH-margin*2-8)*scale2
    let srcY=0,pageNum=1,total=Math.ceil(canvas.height/maxPxH)

    while(srcY<canvas.height){
      const sliceH=Math.min(maxPxH,canvas.height-srcY)
      const sc=document.createElement('canvas')
      sc.width=canvas.width;sc.height=sliceH
      sc.getContext('2d').drawImage(canvas,0,srcY,canvas.width,sliceH,0,0,canvas.width,sliceH)
      if(pageNum>1)pdf.addPage()
      pdf.addImage(sc.toDataURL('image/jpeg',0.92),'JPEG',margin,margin,imgW,sliceH/scale2)
      pdf.setFillColor(240,244,248);pdf.rect(0,pageH-7,pageW,7,'F')
      pdf.setTextColor(150,150,150);pdf.setFontSize(7)
      pdf.text('VelaE&C — Hệ thống theo dõi tiến độ thi công',margin,pageH-2)
      pdf.text('Trang '+pageNum+'/'+total,pageW-margin,pageH-2,{align:'right'})
      srcY+=maxPxH;pageNum++
    }

    const fn='BaoCao_'+proj.code.replace(/[^a-zA-Z0-9]/g,'_')+'_T'+week+'_'+today.replace(/\//g,'-')+'.pdf'
    pdf.save(fn)
    toast('Đã xuất PDF: '+fn,'success')
  } catch(e){
    toast('Lỗi xuất PDF: '+e.message,'error')
    console.error(e)
  } finally { loading(false) }
}
