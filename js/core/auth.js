// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
async function login() {
  const email = document.getElementById('login-email').value.trim()
  const pw    = document.getElementById('login-pw').value
  const btn   = document.getElementById('btn-login')
  const err   = document.getElementById('login-error')

  if (!email || !pw) { showErr('Vui lòng điền đủ email và mật khẩu'); return }

  btn.innerHTML = '<span class="spinner"></span> Đang đăng nhập...'
  btn.disabled = true
  err.style.display = 'none'

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw })
  if (error) {
    showErr('Email hoặc mật khẩu không đúng')
    btn.innerHTML = 'Đăng nhập'; btn.disabled = false
    return
  }
  await initApp(data.user)

  function showErr(m) { err.textContent = m; err.style.display = 'block' }
}

async function logout() {
  await sb.auth.signOut()
  location.reload()
}

// ═══════════════════════════════════════════════════════════
// INIT APP
// ═══════════════════════════════════════════════════════════
async function initApp(user) {
  STATE.user = user
  document.getElementById('user-email').textContent = user.email

  const { data: roleData, error: roleErr } = await sb.from('user_roles')
    .select('role, project_id').eq('user_id', user.id).maybeSingle()
  if (roleErr) console.warn('user_roles query:', roleErr.message)
  STATE.role = roleData?.role || 'updater'

  const { data: projs } = await sb.from('projects').select('*').order('code')
  STATE.projects = projs || []

  const sel = document.getElementById('proj-select')
  sel.innerHTML = STATE.projects.map(p =>
    `<option value="${p.id}">${p.code} — ${p.name}</option>`
  ).join('')

  if (STATE.projects.length > 0) {
    STATE.currentProject = STATE.projects[0]
    await loadProjectData(STATE.currentProject.id)
  } else {
    document.getElementById('login-screen').style.display = 'none'
    document.getElementById('app').style.display = 'flex'
    navigate('import')
    toast('Chưa có dự án nào. Vui lòng import file MS Project trước.', '')
    return
  }

  sel.addEventListener('change', async () => {
    STATE.currentProject = STATE.projects.find(p => p.id === sel.value)
    await loadProjectData(STATE.currentProject.id)
    navigate(document.querySelector('.sidebar-item.active')?.dataset.page || 'dashboard')
  })

  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'

  if (STATE.role === 'updater') {
    document.querySelector('[data-page="import"]')?.style.setProperty('display','none')
  }
  if (STATE.role === 'updater') {
    document.querySelectorAll('[data-role="planner"]').forEach(el => el.style.display='none')
  }
  if (['admin','planner'].includes(STATE.role)) {
    document.getElementById('btn-delete-proj').style.display = 'inline-flex'
    const spp = document.getElementById('sidebar-payment')
    if (spp) spp.style.display = 'flex'
  }
  if (STATE.role === 'admin') {
    const su = document.getElementById('sidebar-users')
    if (su) su.style.display = 'flex'
    const sp = document.getElementById('sidebar-portfolio')
    if (sp) sp.style.display = 'flex'
  }

  navigate('dashboard')
}

async function loadProjectData(projectId) {
  loading(true, 'Đang tải dữ liệu dự án...')
  try {
    const { data: tasks } = await sb.from('v_tasks_with_progress')
      .select('*').eq('project_id', projectId).order('sort_order')
    STATE.tasks = computeRollupPct(tasks || [])
    computeRollupDelay(STATE.tasks)
    computeRollupActualDates(STATE.tasks)  // rollup tt_start/finish cho Gantt

    STATE.progress = {}
    STATE.tasks.forEach(t => { STATE.progress[t.id] = t })
  } finally {
    loading(false)
  }
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════
function navigate(page) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page)
  })
  const content = document.getElementById('main-content')
  const pages = { dashboard, wbs, photos, compare, gantt, importPage, users: usersPage, portfolio: portfolioPage, payment: paymentPage }
  const fn = pages[page === 'import' ? 'importPage' : page]
  if (fn) content.innerHTML = fn()
  if (page === 'wbs')       initWbs()
  if (page === 'dashboard') loadDashboard()
  if (page === 'compare')   loadCompare()
  if (page === 'photos')    loadPhotos()
  if (page === 'gantt')     initGantt()
  if (page === 'import')    initImport()
  if (page === 'users')     initUsersPage()
  if (page === 'portfolio') initPortfolio()
  if (page === 'payment')   initPayment()
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS + BOOTSTRAP
// ═══════════════════════════════════════════════════════════
document.getElementById('btn-login').addEventListener('click', login)
document.getElementById('login-pw').addEventListener('keydown', e => { if(e.key==='Enter') login() })
document.getElementById('btn-logout').addEventListener('click', logout)
document.getElementById('modal-close').addEventListener('click', closeModal)
document.querySelectorAll('.sidebar-item').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.page))
})

;(async () => {
  const { data: { session } } = await sb.auth.getSession()
  if (session?.user) await initApp(session.user)
})()
