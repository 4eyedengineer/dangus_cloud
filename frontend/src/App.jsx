import { useState } from 'react'
import {
  Layout,
  SidebarMenu,
  ToastProvider,
  useToast
} from './components'
import {
  Login,
  Dashboard,
  ProjectDetail,
  ServiceDetail,
  NewServiceForm
} from './pages'

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentView, setCurrentView] = useState('dashboard')
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const toast = useToast()

  const navItems = [
    { label: 'Dashboard', href: '/', active: activeNav === 'Dashboard' },
    { label: 'Projects', href: '/projects', active: activeNav === 'Projects' },
    { label: 'Settings', href: '/settings', active: activeNav === 'Settings' },
    { label: 'Logout', href: '/logout', active: activeNav === 'Logout' }
  ]

  const handleNavClick = (item) => {
    if (item.label === 'Logout') {
      setIsAuthenticated(false)
      setCurrentView('login')
      toast.info('Logged out successfully')
      return
    }

    setActiveNav(item.label)
    if (item.label === 'Dashboard' || item.label === 'Projects') {
      setCurrentView('dashboard')
      setSelectedProject(null)
      setSelectedService(null)
    } else if (item.label === 'Settings') {
      // Settings page could be added later
      toast.info('Settings page coming soon')
    }
  }

  const handleLogin = () => {
    setIsAuthenticated(true)
    setCurrentView('dashboard')
    toast.success('Authentication successful')
  }

  const handleProjectClick = (project) => {
    setSelectedProject(project)
    setCurrentView('projectDetail')
  }

  const handleServiceClick = (service) => {
    setSelectedService(service)
    setCurrentView('serviceDetail')
  }

  const handleNewProject = () => {
    toast.info('New project creation coming soon')
  }

  const handleNewService = () => {
    setCurrentView('newService')
  }

  const handleServiceSubmit = async (data) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success(`Service "${data.name}" created successfully`)
    setCurrentView('projectDetail')
  }

  const handleBack = () => {
    if (currentView === 'serviceDetail') {
      setCurrentView('projectDetail')
      setSelectedService(null)
    } else if (currentView === 'projectDetail' || currentView === 'newService') {
      setCurrentView('dashboard')
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
    return [
      { label: 'All Projects', active: true },
      { label: 'Active' },
      { label: 'Archived' },
      { label: 'Favorites' }
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

  // Show login page if not authenticated
  if (!isAuthenticated) {
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
            onNewProject={handleNewProject}
            onProjectClick={handleProjectClick}
          />
        )
      case 'projectDetail':
        return (
          <ProjectDetail
            project={selectedProject}
            onServiceClick={handleServiceClick}
            onNewService={handleNewService}
            onBack={handleBack}
          />
        )
      case 'serviceDetail':
        return (
          <ServiceDetail
            service={selectedService}
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
      default:
        return (
          <Dashboard
            onNewProject={handleNewProject}
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
    >
      {renderContent()}
    </Layout>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
