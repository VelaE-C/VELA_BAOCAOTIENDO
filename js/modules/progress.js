async function renderWeeklyPDF() {
  const ta       = document.getElementById('report-ai-content')
  const noteEl   = document.getElementById('report-kttc-note')
  const editedAI = ta?.value || ''
  const kttcNote = noteEl?.value?.trim() || ''
  document.querySelectorAll('#report-photo-grid input[type="text"]').forEach((inp, i) => {
    if (window._reportAttachments[i]) window._reportAttachments[i].caption = inp.value
  })
  if (!STATE._reportData) { toast('Lỗi: không có dữ liệu báo cáo', 'error'); return }
  const { weekPhotos, week, year } = STATE._reportData
  closeModal()
  loading(true, 'Đang tạo PDF báo cáo tuần...')
  try {
    const wk = week, yr = year
    const LOGO_URL = 'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png'
    const proj = STATE.currentProject, tasks = STATE.tasks, leaf = tasks.filter(t => !t.is_summary)
    const today = new Date().toLocaleDateString('vi-VN')
    if (typeof computeRollupMoney === 'function' && tasks[0]?._contractValue === undefined) computeRollupMoney(tasks)
    const rootTask = tasks.find(t => t.outline_level === 1)
    const totalCV = rootTask?._contractValue || 0, totalEV = rootTask?._earnedValue || 0, totalPct = rootTask?.display_pct || 0
    const leafWithPrice = leaf.filter(t => (t.unit_price||0) > 0)
    let totalPV = 0
    if (leafWithPrice.length > 0) {
      const now = new Date(); now.setHours(0,0,0,0)
      totalPV = leafWithPrice.reduce((s, t) => {
        const cv = (t.unit_price||0)*(t.planned_quantity||1)
        const [sy,sm,sd] = (t.kh_start||'').split('-').map(Number), [ey,em,ed] = (t.kh_finish||'').split('-').map(Number)
        if (!sy||!ey) return s
        const start = new Date(sy,sm-1,sd), end = new Date(ey,em-1,ed)
        if (now < start) return s; if (now >= end) return s+cv
        return s+cv*(now-start)/(end-start)
      }, 0)
    }
    const spi = totalPV > 0 ? totalEV/totalPV : null
    let evLastWeek = 0
    try {
      const lwn=wk>1?wk-1:52, lwy=wk>1?yr:yr-1
      const { data: lp } = await sb.from('task_progress').select('task_id,pct_complete').eq('project_id',proj.id).eq('week_number',lwn).eq('year',lwy)
      if (lp?.length) { const lm={}; lp.forEach(p=>{lm[p.task_id]=p.pct_complete||0}); evLastWeek=leafWithPrice.reduce((s,t)=>s+(t.unit_price||0)*(t.planned_quantity||1)*(lm[t.id]||0)/100,0) }
    } catch(e) {}
    const evThisWeek = Math.max(0, totalEV - evLastWeek)
    const fmtM = v => { if(!v||v===0)return'—'; if(Math.abs(v)>=1e9)return(v/1e9).toFixed(1)+'tỷ'; if(Math.abs(v)>=1e6)return Math.round(v/1e6)+'tr'; return Math.round(v/1e3)+'k' }

    // S-Curve
    let scurveSvgHtml = ''
    try {
      const { data: allProg } = await sb.from('task_progress').select('task_id,pct_complete,week_number,year').eq('project_id',proj.id).order('year').order('week_number').order('updated_at',{ascending:false})
      if (allProg?.length && leafWithPrice.length > 0) {
        const taskHist={}; allProg.forEach(p=>{if(!taskHist[p.task_id])taskHist[p.task_id]=[];taskHist[p.task_id].push(p)})
        const getPct=(tid,wkn,yrn)=>{let b=0;(taskHist[tid]||[]).forEach(p=>{if(p.year<yrn||(p.year===yrn&&p.week_number<=wkn))b=Math.max(b,p.pct_complete||0)});return b}
        const wkMap={}; allProg.forEach(p=>{const k=`${p.year}-${String(p.week_number).padStart(2,'0')}`;wkMap[k]={week:p.week_number,year:p.year}})
        const wks=Object.keys(wkMap).sort().slice(-12), evArr=[], pvArr=[], lblArr=[]
        wks.forEach(k=>{
          const {week:wkn,year:yrn}=wkMap[k]; lblArr.push('T'+wkn)
          const ev=leafWithPrice.reduce((s,t)=>s+(t.unit_price||0)*(t.planned_quantity||1)*getPct(t.id,wkn,yrn)/100,0)
          const wkEnd=new Date(yrn,0,4); const dow=wkEnd.getDay()||7; wkEnd.setDate(wkEnd.getDate()-dow+1+(wkn-1)*7+6)
          const pv=leafWithPrice.reduce((s,t)=>{const cv=(t.unit_price||0)*(t.planned_quantity||1);const [sy,sm,sd]=(t.kh_start||'').split('-').map(Number);const [ey,em,ed]=(t.kh_finish||'').split('-').map(Number);if(!sy||!ey)return s;const st=new Date(sy,sm-1,sd),en=new Date(ey,em-1,ed);if(wkEnd<st)return s;if(wkEnd>=en)return s+cv;return s+cv*(wkEnd-st)/(en-st)},0)
          evArr.push(ev);pvArr.push(pv)
        })
        const n=lblArr.length,W=860,H=180,PL=65,PR=16,PT=16,PB=38,cW=W-PL-PR,cH=H-PT-PB
        const maxV=Math.max(...evArr,...pvArr,totalCV,1),xC=i=>PL+i*(cW/n)+cW/(n*2),yC=v=>PT+cH-Math.round(v/maxV*cH)
        const fB=v=>{if(!v)return'0';if(v>=1e9)return(v/1e9).toFixed(1)+'tỷ';if(v>=1e6)return Math.round(v/1e6)+'tr';return Math.round(v/1e3)+'k'}
        const barW=Math.max(10,Math.floor(cW/n)-8)
        const bars=evArr.map((ev,i)=>{const d=Math.max(0,ev-(i>0?evArr[i-1]:0));const h=Math.max(2,Math.round(d/maxV*cH));const x=PL+i*(cW/n)+(cW/n-barW)/2;const y=PT+cH-h;return`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#2563EB" rx="2" opacity="0.75"/>${d>0?`<text x="${x+barW/2}" y="${PT+cH+13}" text-anchor="middle" font-size="9" fill="#1D4ED8" font-weight="600">${fB(d)}</text>`:''}`}).join('')
        const evPts=evArr.map((v,i)=>`${xC(i)},${yC(v)}`).join(' '),pvPts=pvArr.map((v,i)=>`${xC(i)},${yC(v)}`).join(' ')
        const hdY=totalCV>0?yC(totalCV):-1
        const yT=[0,.25,.5,.75,1].map(r=>{const y=PT+cH-r*cH;return`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="#E2E8F0" stroke-width="0.5"/><text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#94A3B8">${fB(r*maxV)}</text>`}).join('')
        const xL=lblArr.map((l,i)=>`<text x="${xC(i)}" y="${H-5}" text-anchor="middle" font-size="9" fill="#64748B">${l}</text>`).join('')
        const spiV=pvArr[n-1]>0?evArr[n-1]/pvArr[n-1]:null,spiC=!spiV?'#64748B':spiV>=1?'#16A34A':spiV>=0.8?'#D97706':'#DC2626'
        scurveSvgHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;align-items:center"><span>📈 BIỂU ĐỒ SẢN LƯỢNG 12 TUẦN (S-CURVE)</span><span style="display:flex;gap:10px;font-size:11px;font-weight:400;opacity:.9;align-items:center"><span>■ SL tuần</span><span>— Lũy kế TH: <strong>${fB(evArr[n-1]||0)}</strong></span><span style="color:#86EFAC">- - KH: <strong>${fB(pvArr[n-1]||0)}</strong></span>${spiV?`<span style="padding:1px 7px;border-radius:10px;background:${spiC};font-weight:700">SPI=${spiV.toFixed(2)}</span>`:''}</span></div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA"><svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">${yT}<line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+cH}" stroke="#CBD5E1" stroke-width="1"/>${hdY>0?`<line x1="${PL}" y1="${hdY}" x2="${W-PR}" y2="${hdY}" stroke="#DC2626" stroke-width="1" stroke-dasharray="5 3" opacity="0.4"/><text x="${W-PR+2}" y="${hdY+3}" font-size="8" fill="#DC2626" opacity="0.7">HĐ</text>`:''} ${bars}<polyline points="${pvPts}" fill="none" stroke="#16A34A" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.8"/>${pvArr.map((v,i)=>`<circle cx="${xC(i)}" cy="${yC(v)}" r="2.5" fill="#16A34A" opacity="0.8"/>`).join('')}<polyline points="${evPts}" fill="none" stroke="#D97706" stroke-width="2" stroke-linejoin="round"/>${evArr.map((v,i)=>{const isL=i===n-1;return`<circle cx="${xC(i)}" cy="${yC(v)}" r="${isL?4:2.5}" fill="#D97706"/>${isL?`<text x="${xC(i)}" y="${yC(v)-8}" text-anchor="middle" font-size="10" fill="#D97706" font-weight="700">${fB(v)}</text>`:''}`}).join('')}${xL}</svg></div></div>`
      }
    } catch(e) { console.warn('S-curve:',e) }

    // EVM 5 cards - bỏ 4 card cũ
    const spiColor=!spi?'#64748B':spi>=1?'#16A34A':spi>=0.8?'#D97706':'#DC2626'
    const evmCardsHtml=totalCV>0?`<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px"><div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center;border:1px solid #BFDBFE"><div style="font-size:9px;color:#1D4ED8;font-weight:600;margin-bottom:3px">SL TUẦN NÀY</div><div style="font-size:20px;font-weight:800;color:#1D4ED8">${fmtM(evThisWeek)}</div></div><div style="background:#F0FDF4;border-radius:8px;padding:10px;text-align:center;border:1px solid #BBF7D0"><div style="font-size:9px;color:#166534;font-weight:600;margin-bottom:3px">LŨY KẾ TH (EV)</div><div style="font-size:20px;font-weight:800;color:#0D9488">${fmtM(totalEV)}</div><div style="font-size:9px;color:#64748B">${totalCV>0?Math.round(totalEV/totalCV*100):0}% HĐ</div></div><div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center;border:1px solid #BFDBFE"><div style="font-size:9px;color:#1D4ED8;font-weight:600;margin-bottom:3px">KH SẢN LƯỢNG (PV)</div><div style="font-size:20px;font-weight:800;color:#2563EB">${fmtM(totalPV)}</div><div style="font-size:9px;color:#64748B">${totalCV>0?Math.round(totalPV/totalCV*100):0}% HĐ</div></div><div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;border:1px solid #E2E8F0"><div style="font-size:9px;color:#64748B;font-weight:600;margin-bottom:3px">GIÁ TRỊ HĐ (BAC)</div><div style="font-size:20px;font-weight:800;color:#1A2B4A">${fmtM(totalCV)}</div></div><div style="background:${spiColor}10;border-radius:8px;padding:10px;text-align:center;border:1px solid ${spiColor}40"><div style="font-size:9px;color:${spiColor};font-weight:600;margin-bottom:3px">SPI</div><div style="font-size:24px;font-weight:800;color:${spiColor}">${spi?spi.toFixed(2):'—'}</div><div style="font-size:9px;color:${spiColor};font-weight:600">${spi?spi>=1?'✅ Đạt KH':spi>=0.8?'⚠️ Chú ý':'🔴 Chậm':''}</div></div></div>`:''

    // Bảng Tiến độ & SL (giống Dashboard/WBS)
    const summaries=tasks.filter(t=>t.is_summary&&t.outline_level<=3)
    const fmtD2=d=>d?d.slice(5).replace('-','/'):'—'
    const tableRows=summaries.map(t=>{
      const pct=t.display_pct!==undefined?t.display_pct:(t.pct_complete||0),delay=t._delay||0,cv=t._contractValue||0,ev=t._earnedValue||0
      const dlClr=typeof getDelayColor==='function'?getDelayColor(delay):delay>14?'#DC2626':delay>=7?'#D97706':'#16A34A'
      const barClr=pct===100?'#16A34A':dlClr,indent=(t.outline_level-1)*14,fw=t.outline_level<=2?'600':'400'
      const rowBg=t.outline_level===1?'#EFF6FF':t.outline_level===2?'#F8FAFC':'#FFFFFF'
      const delayTxt=delay>0?`<span style="color:${dlClr};font-weight:600">trễ ${delay}d</span>`:delay<0?`<span style="color:#16A34A;font-weight:600">sớm ${Math.abs(delay)}d</span>`:'<span style="color:#64748B">Đúng KH</span>'
      return`<tr style="background:${rowBg};border-bottom:0.5px solid #E2E8F0"><td style="padding:5px 6px;padding-left:${indent+6}px;font-weight:${fw};font-size:13px;line-height:1.4">${t.name}</td><td style="padding:5px 6px;font-size:11px;color:#64748B;text-align:center;white-space:nowrap">${fmtD2(t.kh_start)} → ${fmtD2(t.kh_finish)}</td><td style="padding:5px 8px;min-width:120px"><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${barClr};border-radius:3px"></div></div><span style="font-size:12px;font-weight:700;color:${barClr};white-space:nowrap">${pct}%</span></div></td><td style="padding:5px 6px;font-size:11px;text-align:center">${delayTxt}</td><td style="padding:5px 6px;font-size:14px;font-weight:700;color:#0D9488;text-align:right;white-space:nowrap">${cv>0?fmtM(ev):'—'}</td><td style="padding:5px 6px;font-size:12px;color:#334155;text-align:right;white-space:nowrap">${cv>0?fmtM(cv):'—'}</td></tr>`
    }).join('')
    const summaryTableHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📊 TIẾN ĐỘ & SẢN LƯỢNG THEO HẠNG MỤC</div><table style="width:100%;border-collapse:collapse;border:0.5px solid #E2E8F0"><thead><tr style="background:#1E3A5F;color:white;font-size:11px"><th style="padding:5px 6px;text-align:left;font-weight:600">Hạng mục</th><th style="padding:5px 6px;text-align:center;font-weight:600">KH BĐ → KT</th><th style="padding:5px 6px;text-align:center;font-weight:600;min-width:130px">Tiến độ</th><th style="padding:5px 6px;text-align:center;font-weight:600">Lệch</th><th style="padding:5px 6px;text-align:right;font-weight:600">SL TH</th><th style="padding:5px 6px;text-align:right;font-weight:600">Giá trị HĐ</th></tr></thead><tbody>${tableRows}</tbody></table></div>`

    // Gantt (giống app — màu theo getDelayColor)
    const tl=getActualTimeline(tasks); let ganttHtml=''
    if(tl){
      const rangeMs=tl.end-tl.start,todayD=new Date();todayD.setHours(0,0,0,0)
      const nowPct=Math.max(0,Math.min(100,Math.round((todayD-tl.start)/rangeMs*100)))
      const quarters=[];let qc=new Date(tl.start.getFullYear(),Math.floor(tl.start.getMonth()/3)*3,1)
      while(qc<=tl.end){const p2=Math.max(0,Math.min(98,Math.round((qc-tl.start)/rangeMs*100)));quarters.push(`<span style="position:absolute;left:${p2}%;font-size:10px;color:rgba(255,255,255,0.8);white-space:nowrap">Q${Math.floor(qc.getMonth()/3)+1}/${qc.getFullYear()}</span>`);qc=new Date(qc.getFullYear(),qc.getMonth()+3,1)}
      ganttHtml=`<div style="display:flex;align-items:center;background:#1A2B4A;color:white;font-size:11px;padding:5px 8px;border-radius:4px 4px 0 0;position:relative;height:22px"><div style="width:190px;flex-shrink:0;font-weight:600">Hạng mục</div><div style="flex:1;position:relative">${quarters.join('')}<div style="position:absolute;top:-4px;bottom:-4px;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div></div><div style="width:70px;text-align:center;font-weight:600">Lệch</div></div>`
      tasks.filter(t=>t.is_summary&&t.outline_level<=3&&t.kh_start).forEach((t,idx)=>{
        const khL=Math.max(0,Math.min(100,Math.round((new Date(t.kh_start)-tl.start)/rangeMs*100))),khR=Math.max(0,Math.min(100,Math.round((new Date(t.kh_finish||t.kh_start)-tl.start)/rangeMs*100))),khW=Math.max(1,khR-khL)
        let ttBar=''
        if(t.tt_start){const ttL=Math.max(0,Math.min(100,Math.round((new Date(t.tt_start)-tl.start)/rangeMs*100)));const ttEnd=t.tt_finish?new Date(t.tt_finish):todayD;const ttR=Math.max(0,Math.min(100,Math.round((ttEnd-tl.start)/rangeMs*100)));const ttW=Math.max(1,ttR-ttL);const d=t._delay||0;const ttC=typeof getDelayColor==='function'?getDelayColor(d):d>14?'#DC2626':d>=7?'#D97706':'#16A34A';ttBar=`<div style="position:absolute;height:6px;top:13px;left:${ttL}%;width:${ttW}%;background:${ttC};border-radius:2px;opacity:.9"></div>`}
        const d=t._delay||0,dlyC=typeof getDelayColor==='function'?getDelayColor(d):d>14?'#DC2626':d>=7?'#D97706':'#16A34A',dlyT=d>0?`+${d}d`:d<0?`${d}d`:'—'
        const rb=idx%2===0?'#F8FAFC':'#FFFFFF',gi=(t.outline_level-1)*10
        ganttHtml+=`<div style="display:flex;align-items:center;background:${rb};border-bottom:0.5px solid #E2E8F0;height:22px"><div style="width:190px;flex-shrink:0;font-size:${t.outline_level===3?'9':'10'}px;font-weight:${t.outline_level===1?'700':t.outline_level===2?'600':'400'};padding:0 6px;padding-left:${6+gi}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.name}</div><div style="flex:1;position:relative;height:100%"><div style="position:absolute;height:6px;top:3px;left:${khL}%;width:${khW}%;background:#93C5FD;border-radius:2px"></div>${ttBar}<div style="position:absolute;top:0;bottom:0;left:${nowPct}%;width:1.5px;background:#F97316;z-index:2"></div></div><div style="width:70px;font-size:11px;font-weight:600;color:${dlyC};text-align:center">${dlyT}</div></div>`
      })
    }

    // AI parse
    const aiHtml=editedAI.split('\n').map(line=>{if(!line.trim())return'<div style="height:5px"></div>';const c=line.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').trim();if(line.startsWith('## ')||line.startsWith('# '))return`<div style="margin:10px 0 5px;padding:4px 10px;background:#EFF6FF;border-left:3px solid #2563EB;border-radius:0 4px 4px 0;font-weight:700;font-size:13px;color:#1E3A8A">${c.replace(/^#+\s*/,'')}</div>`;return`<div style="font-size:13px;line-height:1.7;color:#1E293B;margin:2px 0">${c}</div>`}).join('')

    // Attach
    let attachHtml='';const attachments=window._reportAttachments||[]
    if(attachments.length){const items=attachments.map(p=>`<div style="border-radius:6px;overflow:hidden;border:0.5px solid #E2E8F0"><div style="width:100%;padding-top:66%;position:relative;background:#F1F5F9"><img src="${p.url}" crossorigin="anonymous" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.background='#FEE2E2'"></div>${p.caption?`<div style="padding:6px;background:#FFFBEB;border-top:2px solid #F59E0B"><div style="font-size:11px;font-weight:500;color:#92400E">⚠️ ${p.caption}</div></div>`:'<div style="padding:4px 6px;background:#F9FAFB"><div style="font-size:10px;color:#9CA3AF;font-style:italic">Chưa có ghi chú</div></div>'}</div>`).join('');attachHtml=`<div style="margin-bottom:14px"><div style="background:#F59E0B;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📋 LƯU Ý / HÌNH ẢNH THAM KHẢO (${attachments.length} ảnh)</div><div style="border:0.5px solid #FDE68A;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FFFBEB"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${items}</div></div></div>`}

    // Photos
    const finalPhotos=(window._selectedPhotos!==null&&window._selectedPhotos!==undefined)?window._selectedPhotos:(weekPhotos||[]);let photosHtml=''
    if(finalPhotos?.length){const items=finalPhotos.map(p=>{const label=!p.task_id?(p.caption||'Ảnh tổng thể'):(p.tasks?.name||p.caption||'');const date=p.taken_at?new Date(p.taken_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}):'';return`<div style="border-radius:6px;overflow:hidden;border:0.5px solid #E2E8F0"><div style="width:100%;padding-top:66%;position:relative;background:#E2E8F0"><img src="${p.photo_url}" crossorigin="anonymous" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML='Lỗi ảnh'"></div><div style="padding:4px 6px"><div style="font-size:10px;font-weight:500;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label.slice(0,35)}</div><div style="font-size:9px;color:#94A3B8">${date}</div></div></div>`}).join('');photosHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📷 ẢNH THI CÔNG TUẦN ${wk}/${yr} (${finalPhotos.length} ảnh)</div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${items}</div></div></div>`}

    // Attendance
    let attendanceHtml=''
    if(STATE._attendanceData?.history?.length){const hist=STATE._attendanceData.history,avgCN=STATE._attendanceData.avgCN||0,maxCN=Math.max(...hist.map(h=>h.cn_proj||0),1);const W2=700,H2=150,P2=36,bA=W2-P2-10,sH=H2-44,bW2=Math.max(8,Math.floor(bA/hist.length)-4);const aY=H2-32-Math.round((avgCN/maxCN)*sH);const b3=hist.map((d,i)=>{const cn=d.cn_proj||0,h2=Math.max(4,Math.round((cn/maxCN)*sH)),x=P2+i*(bA/hist.length),y=H2-32-h2;const dt=new Date(d.report_date),lbl=`${dt.getDate()}/${dt.getMonth()+1}`,dow=['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()];const c=cn>avgCN?'#16A34A':cn<avgCN*0.8?'#DC2626':'#60A5FA';return`<rect x="${x}" y="${y}" width="${bW2}" height="${h2}" fill="${c}" rx="2" opacity=".85"/><text x="${x+bW2/2}" y="${y-3}" text-anchor="middle" font-size="8" fill="#334155">${cn}</text><text x="${x+bW2/2}" y="${H2-16}" text-anchor="middle" font-size="8" fill="#64748B">${lbl}</text><text x="${x+bW2/2}" y="${H2-6}" text-anchor="middle" font-size="7" fill="#94A3B8">${dow}</text>`}).join('');attendanceHtml=`<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">👷 QUÂN SỐ CÔNG NHÂN 30 NGÀY GẦN NHẤT</div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:10px;border-radius:0 0 4px 4px;background:#FAFAFA"><svg width="100%" viewBox="0 0 ${W2} ${H2}" style="overflow:visible"><line x1="${P2}" y1="${H2-32}" x2="${W2-10}" y2="${H2-32}" stroke="#E2E8F0" stroke-width="0.5"/><line x1="${P2}" y1="${aY}" x2="${W2-10}" y2="${aY}" stroke="#D97706" stroke-width="1" stroke-dasharray="4 3" opacity=".7"/><text x="${W2-8}" y="${aY+4}" font-size="8" fill="#D97706" font-weight="600">TB</text>${b3}</svg><div style="font-size:11px;margin-top:4px">TB 30 ngày: <strong style="color:#2563EB">${avgCN}</strong> CN/ngày</div></div></div>`}

    const htmlContent=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI",Arial,sans-serif}body{background:white;width:900px}</style></head><body><div id="pdf-content" style="width:900px;background:white"><div style="background:#1A2B4A;padding:14px 24px;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><img src="${LOGO_URL}" style="height:44px;width:auto" crossorigin="anonymous" onerror="this.style.display='none'"><div><div style="color:#F97316;font-size:11px;letter-spacing:.08em">PHÒNG KTTC — VELAE&C</div></div></div><div style="text-align:right"><div style="color:white;font-size:20px;font-weight:700">BÁO CÁO TIẾN ĐỘ THI CÔNG</div><div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:3px">${proj.name}</div><div style="color:rgba(255,255,255,.65);font-size:11px;margin-top:2px">Tuần ${wk}/${yr} | Ngày lập: ${today}</div></div></div><div style="padding:14px 20px">${evmCardsHtml}${scurveSvgHtml}<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">🤖 PHÂN TÍCH AI — TUẦN ${wk}/${yr}</div><div style="border:0.5px solid #E2E8F0;border-top:none;padding:12px;border-radius:0 0 4px 4px;background:#FAFAFA">${aiHtml}</div></div>${kttcNote?`<div style="margin-bottom:14px;padding:10px 14px;background:#FFFBEB;border-left:4px solid #D97706;border-radius:0 4px 4px 0"><div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:4px">📝 GHI CHÚ PHÒNG KTTC</div><div style="font-size:13px;color:#78350F;white-space:pre-wrap;line-height:1.6">${kttcNote}</div></div>`:''} ${attachHtml}${photosHtml}${summaryTableHtml}<div style="margin-bottom:14px"><div style="background:#1A2B4A;color:white;font-size:13px;font-weight:700;padding:6px 10px;border-radius:4px 4px 0 0">📅 SƠ ĐỒ GANTT TỔNG QUAN</div><div style="border:0.5px solid #E2E8F0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">${ganttHtml}<div style="padding:4px 8px;background:#F8FAFC;font-size:10px;color:#64748B;display:flex;gap:14px"><span><span style="display:inline-block;width:12px;height:5px;background:#93C5FD;border-radius:2px;vertical-align:middle;margin-right:3px"></span>KH</span><span><span style="display:inline-block;width:12px;height:5px;background:#16A34A;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT đúng/vượt</span><span><span style="display:inline-block;width:12px;height:5px;background:#DC2626;border-radius:2px;vertical-align:middle;margin-right:3px"></span>TT trễ</span><span><span style="display:inline-block;width:2px;height:12px;background:#F97316;vertical-align:middle;margin-right:3px"></span>Hôm nay</span></div></div></div>${attendanceHtml}</div><div style="background:#F1F5F9;border-top:1px solid #E2E8F0;padding:8px 24px;display:flex;justify-content:space-between"><span style="font-size:11px;color:#64748B">VelaE&C — Hệ thống theo dõi tiến độ thi công</span><span style="font-size:11px;color:#64748B">Phát hành: Phòng KTTC VelaE&C</span></div></div></body></html>`

    const container=document.createElement('div');container.style.cssText='position:fixed;top:-9999px;left:-9999px;width:900px;z-index:-1';container.innerHTML=htmlContent;document.body.appendChild(container)
    const img=container.querySelector('img');if(img)await new Promise(r=>{if(img.complete)r();else{img.onload=r;img.onerror=r;setTimeout(r,3000)}})
    const canvas=await html2canvas(container.querySelector('#pdf-content'),{scale:3,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',width:900,logging:false})
    document.body.removeChild(container)
    const {jsPDF}=window.jspdf;const pdfW=210,pdfH=Math.round(canvas.height/canvas.width*pdfW)
    const pdf=new jsPDF({unit:'mm',format:[pdfW,pdfH],orientation:'portrait'})
    pdf.addImage(canvas.toDataURL('image/jpeg',0.97),'JPEG',0,0,pdfW,pdfH)
    const fn='BC-TD_'+proj.code.replace(/[^a-zA-Z0-9]/g,'_')+'_Tuan'+wk+'_'+yr+'.pdf'
    pdf.save(fn);toast('Đã xuất PDF: '+fn,'success')
  } catch(e){toast('Lỗi xuất PDF: '+e.message,'error');console.error(e)} finally{loading(false)}
}
