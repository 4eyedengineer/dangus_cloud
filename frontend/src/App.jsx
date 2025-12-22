import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  Layout,
  SidebarMenu,
  ToastProvider,
  useToast,
  TerminalSpinner,
  ErrorBoundary
} from './components'
import {
  Login,
  Dashboard,
  ProjectsList,
  ProjectDetail,
  ServiceDetail,
  NewServiceForm,
  NewProjectWizard,
  Settings
} from './pages'
import { WebSocketProvider } from './context/WebSocketContext'
import { getCurrentUser, logout, getLoginUrl } from './api/auth'
import { fetchProject } from './api/projects'
import { createService } from './api/services'
import { ApiError } from './api/utils'

// Wrapper components for pages that need route params
function ProjectDetailPage({ user, onServiceClick }) {
  const { projectId } = useParams()
  const navigate = useNavigate()

  return (
    <ProjectDetail
      projectId={projectId}
      onServiceClick={onServiceClick}
      onNewService={() => navigate(`/projects/${projectId}/services/new`)}
      onBack={() => navigate('/projects')}
    />
  )
}

function ServiceDetailPage() {
  const { serviceId } = useParams()
  const navigate = useNavigate()

  return (
    <ServiceDetail
      serviceId={serviceId}
      onBack={() => navigate(-1)}
    />
  )
}

function NewServicePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const handleSubmit = async (data) => {
    try {
      const serviceData = {
        name: data.name,
        repo_url: data.image,
        port: data.port,
        branch: 'main',
        dockerfile_path: 'Dockerfile',
        replicas: data.replicas || 1,
        storage_gb: data.storage || null,
        health_check_path: data.healthCheckPath || null
      }
      await createService(projectId, serviceData)
      toast.success(`Service "${data.name}" created successfully`)
      navigate(`/projects/${projectId}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create service'
      toast.error(message)
      throw err
    }
  }

  return (
    <NewServiceForm
      projectId={projectId}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/projects/${projectId}`)}
    />
  )
}

function NewProjectPage() {
  const navigate = useNavigate()

  const handleComplete = (project) => {
    navigate(`/projects/${project.id}`)
  }

  return (
    <NewProjectWizard
      onComplete={handleComplete}
      onCancel={() => navigate('/projects')}
    />
  )
}

function SettingsPage({ user, onLogout }) {
  return (
    <Settings
      user={user}
      onLogout={onLogout}
    />
  )
}

function DashboardPage() {
  const navigate = useNavigate()

  return (
    <Dashboard
      onProjectClick={(project) => navigate(`/projects/${project.id}`)}
      onNewProject={() => navigate('/projects/new')}
    />
  )
}

function ProjectsListPage() {
  const navigate = useNavigate()

  return (
    <ProjectsList
      onProjectClick={(project) => navigate(`/projects/${project.id}`)}
      onNewProject={() => navigate('/projects/new')}
    />
  )
}

function AppContent() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const userData = await getCurrentUser()
      setUser(userData)
    } catch (err) {
      // Not authenticated - this is expected for logged out users
      setUser(null)
    } finally {
      setAuthLoading(false)
    }
  }

  // Determine active nav based on current route
  const getActiveNav = () => {
    const path = location.pathname
    if (path.startsWith('/projects')) return 'Projects'
    if (path.startsWith('/settings')) return 'Settings'
    if (path.startsWith('/services')) return 'Projects' // Services are part of projects
    return 'Dashboard'
  }

  const activeNav = getActiveNav()

  const navItems = [
    { label: 'Dashboard', href: '/', active: activeNav === 'Dashboard' },
    { label: 'Projects', href: '/projects', active: activeNav === 'Projects' },
    { label: 'Settings', href: '/settings', active: activeNav === 'Settings' },
    { label: 'Logout', href: '/logout', active: false }
  ]

  const handleNavClick = async (item) => {
    if (item.label === 'Logout') {
      try {
        await logout()
        setUser(null)
        navigate('/')
        toast.info('Logged out successfully')
      } catch (err) {
        toast.error('Failed to logout')
      }
      return
    }

    navigate(item.href)
  }

  const handleLogin = () => {
    window.location.href = getLoginUrl()
  }

  const handleServiceClick = (service) => {
    navigate(`/services/${service.id}`)
  }

  const getSidebarItems = () => {
    const path = location.pathname

    if (path.match(/^\/projects\/[^/]+$/)) {
      return [
        { label: 'Overview', active: true },
        { label: 'Services' },
        { label: 'Deployments' },
        { label: 'Logs' },
        { label: 'Settings' }
      ]
    }
    if (path.startsWith('/services/')) {
      return [
        { label: 'Overview', active: true },
        { label: 'Configuration' },
        { label: 'Environment' },
        { label: 'Webhooks' },
        { label: 'History' }
      ]
    }
    if (path === '/projects') {
      return [
        { label: 'All Projects', active: true },
        { label: 'Active' },
        { label: 'Archived' },
        { label: 'Favorites' }
      ]
    }
    return [
      { label: 'Dashboard', active: true },
      { label: 'Recent Activity' },
      { label: 'Quick Stats' }
    ]
  }

  const getBreadcrumbs = () => {
    const path = location.pathname
    const crumbs = []

    if (path === '/') {
      crumbs.push({ label: 'dashboard' })
    } else if (path === '/projects') {
      crumbs.push({ label: 'projects' })
    } else if (path === '/projects/new') {
      crumbs.push({ label: 'projects', href: '/projects' })
      crumbs.push({ label: 'new-project' })
    } else if (path.match(/^\/projects\/[^/]+\/services\/new$/)) {
      crumbs.push({ label: 'projects', href: '/projects' })
      crumbs.push({ label: 'project', href: path.replace('/services/new', '') })
      crumbs.push({ label: 'new-service' })
    } else if (path.match(/^\/projects\/[^/]+$/)) {
      crumbs.push({ label: 'projects', href: '/projects' })
      crumbs.push({ label: 'project' })
    } else if (path.match(/^\/services\/[^/]+$/)) {
      crumbs.push({ label: 'projects', href: '/projects' })
      crumbs.push({ label: 'service' })
    } else if (path === '/settings') {
      crumbs.push({ label: 'settings' })
    }

    return crumbs
  }

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-primary terminal-grid-bg flex items-center justify-center">
        <div className="text-center">
          <TerminalSpinner className="text-2xl" />
          <p className="font-mono text-terminal-muted mt-4">Initializing...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  const sidebarContent = (
    <SidebarMenu
      items={getSidebarItems()}
      onItemClick={(item) => toast.info(`Navigating to ${item.label}`)}
    />
  )

  return (
    <Layout
      navItems={navItems}
      onNavClick={handleNavClick}
      breadcrumbs={getBreadcrumbs()}
      sidebarContent={sidebarContent}
      userName={user?.github_username}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage user={user} onServiceClick={handleServiceClick} />} />
        <Route path="/projects/:projectId/services/new" element={<NewServicePage />} />
        <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="/settings" element={<SettingsPage user={user} onLogout={() => { setUser(null); navigate('/'); }} />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
