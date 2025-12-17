import { useState, useEffect } from 'react'
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
import { fetchProjects, createProject, deleteProject } from './api/projects'
import { fetchProject } from './api/projects'
import { createService, fetchService, deleteService, triggerDeploy, fetchWebhookSecret } from './api/services'
import { ApiError } from './api/utils'

function AppContent() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
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

  const navItems = [
    { label: 'Dashboard', href: '/', active: activeNav === 'Dashboard' },
    { label: 'Projects', href: '/projects', active: activeNav === 'Projects' },
    { label: 'Settings', href: '/settings', active: activeNav === 'Settings' },
    { label: 'Logout', href: '/logout', active: activeNav === 'Logout' }
  ]

  const handleNavClick = async (item) => {
    if (item.label === 'Logout') {
      try {
        await logout()
        setUser(null)
        setCurrentView('login')
        toast.info('Logged out successfully')
      } catch (err) {
        toast.error('Failed to logout')
      }
      return
    }

    setActiveNav(item.label)
    if (item.label === 'Dashboard') {
      setCurrentView('dashboard')
      setSelectedProject(null)
      setSelectedService(null)
    } else if (item.label === 'Projects') {
      setCurrentView('projects')
      setSelectedProject(null)
      setSelectedService(null)
    } else if (item.label === 'Settings') {
      setCurrentView('settings')
      setSelectedProject(null)
      setSelectedService(null)
    }
  }

  const handleLogin = () => {
    window.location.href = getLoginUrl()
  }

  const handleProjectClick = async (project) => {
    setSelectedProject(project)
    setCurrentView('projectDetail')
  }

  const handleServiceClick = async (service) => {
    setSelectedService(service)
    setCurrentView('serviceDetail')
  }

  const handleNewService = () => {
    setCurrentView('newService')
  }

  const handleNewProject = () => {
    setCurrentView('newProject')
  }

  const handleNewProjectComplete = async (project) => {
    setSelectedProject(project)
    setCurrentView('projectDetail')
  }

  const handleServiceSubmit = async (data) => {
    try {
      const serviceData = {
        name: data.name,
        repo_url: data.image, // Using image as repo_url for now
        port: data.port,
        branch: 'main',
        dockerfile_path: 'Dockerfile',
        replicas: data.replicas || 1,
        storage_gb: data.storage || null,
        health_check_path: data.healthCheckPath || null
      }
      await createService(selectedProject.id, serviceData)
      toast.success(`Service "${data.name}" created successfully`)
      // Refresh project data
      const updatedProject = await fetchProject(selectedProject.id)
      setSelectedProject(updatedProject)
      setCurrentView('projectDetail')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create service'
      toast.error(message)
      throw err
    }
  }

  const handleBack = () => {
    if (currentView === 'serviceDetail') {
      setCurrentView('projectDetail')
      setSelectedService(null)
    } else if (currentView === 'projectDetail' || currentView === 'newService') {
      // Go back to projects list if we came from there, otherwise dashboard
      setCurrentView(activeNav === 'Projects' ? 'projects' : 'dashboard')
      setSelectedProject(null)
    }
  }

  const getSidebarItems = () => {
    if (currentView === 'projectDetail' && selectedProject) {
      return [
        { label: 'Overview', active: true },
        { label: 'Services' },
        { label: 'Deployments' },
        { label: 'Logs' },
        { label: 'Settings' }
      ]
    }
    if (currentView === 'serviceDetail') {
      return [
        { label: 'Overview', active: true },
        { label: 'Configuration' },
        { label: 'Environment' },
        { label: 'Webhooks' },
        { label: 'History' }
      ]
    }
    if (currentView === 'projects') {
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
    const crumbs = [{ label: 'projects', href: '#' }]

    if (selectedProject) {
      crumbs.push({ label: selectedProject.name, href: '#' })
    }

    if (selectedService) {
      crumbs.push({ label: selectedService.name })
    }

    if (currentView === 'newService') {
      crumbs.push({ label: 'new-service' })
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

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            onProjectClick={handleProjectClick}
            onNewProject={handleNewProject}
          />
        )
      case 'projects':
        return (
          <ProjectsList
            onProjectClick={handleProjectClick}
          />
        )
      case 'projectDetail':
        return (
          <ProjectDetail
            projectId={selectedProject?.id}
            onServiceClick={handleServiceClick}
            onNewService={handleNewService}
            onBack={handleBack}
          />
        )
      case 'serviceDetail':
        return (
          <ServiceDetail
            serviceId={selectedService?.id}
            onBack={handleBack}
          />
        )
      case 'newService':
        return (
          <NewServiceForm
            projectId={selectedProject?.id}
            onSubmit={handleServiceSubmit}
            onCancel={handleBack}
          />
        )
      case 'newProject':
        return (
          <NewProjectWizard
            onComplete={handleNewProjectComplete}
            onCancel={handleBack}
          />
        )
      case 'settings':
        return (
          <Settings
            user={user}
            onLogout={() => {
              setUser(null)
              setCurrentView('login')
            }}
          />
        )
      default:
        return (
          <Dashboard
            onProjectClick={handleProjectClick}
          />
        )
    }
  }

  return (
    <Layout
      navItems={navItems}
      onNavClick={handleNavClick}
      breadcrumbs={getBreadcrumbs()}
      sidebarContent={sidebarContent}
      systemStatus="online"
      userName={user?.github_username}
    >
      {renderContent()}
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
