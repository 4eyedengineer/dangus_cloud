import { useState } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider } from '../components/AsciiDivider'
import { WizardStepIndicator, CompactStepIndicator } from '../components/WizardStepIndicator'
import { RepoSelector } from '../components/RepoSelector'
import { ServiceTable } from '../components/ServiceTable'
import TerminalButton from '../components/TerminalButton'
import TerminalInput from '../components/TerminalInput'
import TerminalSpinner from '../components/TerminalSpinner'
import { useToast } from '../components/Toast'
import { createProject } from '../api/projects'
import { createServicesBatch } from '../api/services'
import { analyzeRepo } from '../api/github'

const STEPS = {
  NAME: 0,
  SOURCE: 1,
  REPO: 2,
  REVIEW: 3
}

const STEP_LABELS = [
  { label: 'NAME' },
  { label: 'SOURCE' },
  { label: 'REPO' },
  { label: 'REVIEW' }
]

export function NewProjectWizard({ onComplete, onCancel }) {
  const toast = useToast()

  // Wizard state
  const [currentStep, setCurrentStep] = useState(STEPS.NAME)
  const [projectName, setProjectName] = useState('')
  const [sourceType, setSourceType] = useState(null) // 'import' or 'empty'
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [services, setServices] = useState([])

  // Loading/error states
  const [analyzing, setAnalyzing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [nameError, setNameError] = useState(null)

  // Validation
  const NAME_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/

  const validateProjectName = (name) => {
    if (!name) return 'Project name is required'
    if (name.length < 1 || name.length > 63) return 'Name must be 1-63 characters'
    if (!NAME_REGEX.test(name)) return 'Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens'
    if (name.includes('--')) return 'Name cannot contain consecutive hyphens'
    return null
  }

  // Step handlers
  const handleNameSubmit = (e) => {
    e?.preventDefault()
    const error = validateProjectName(projectName)
    if (error) {
      setNameError(error)
      return
    }
    setNameError(null)
    setCurrentStep(STEPS.SOURCE)
  }

  const handleSourceSelect = async (type) => {
    setSourceType(type)
    if (type === 'empty') {
      // Create empty project and complete
      await handleCreateEmptyProject()
    } else {
      setCurrentStep(STEPS.REPO)
    }
  }

  const handleRepoSelect = async (repo) => {
    setSelectedRepo(repo)
    setAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeRepo(repo.url, repo.defaultBranch)
      setAnalysis(result)

      // Convert analysis to services array with selection state
      const allServices = [
        ...result.composeServices.map(s => ({
          ...s,
          selected: true
        })),
        ...result.standaloneDockerfiles.map(df => ({
          name: df.serviceName,
          type: 'container',
          image: null,
          build: {
            context: df.context,
            dockerfile: df.path.split('/').pop()
          },
          port: 8080,
          envVars: [],
          hasStorage: false,
          selected: true
        }))
      ]

      if (allServices.length === 0) {
        setError('No services found. Repository needs a docker-compose.yml or Dockerfile.')
        setAnalyzing(false)
        return
      }

      setServices(allServices)
      setCurrentStep(STEPS.REVIEW)
    } catch (err) {
      setError(err.message || 'Failed to analyze repository')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCreateEmptyProject = async () => {
    setCreating(true)
    setError(null)

    try {
      const project = await createProject(projectName)
      toast.success(`Project "${project.name}" created successfully`)
      onComplete(project)
    } catch (err) {
      setError(err.message || 'Failed to create project')
      setCreating(false)
    }
  }

  const handleCreateWithServices = async () => {
    const selectedServices = services.filter(s => s.selected)
    if (selectedServices.length === 0) {
      setError('Please select at least one service')
      return
    }

    setCreating(true)
    setError(null)

    try {
      // Create project first
      const project = await createProject(projectName)

      // Transform services for batch creation
      // If service has a build config, it needs repo_url to build from source
      // If service is image-only (no build), use the image directly
      const serviceData = selectedServices.map(s => ({
        name: s.name,
        port: s.port,
        // Only use image if this is NOT a build service
        image: s.build ? null : (s.image || null),
        // Use repo_url if this is a build service
        repo_url: s.build ? selectedRepo.url : null,
        branch: selectedRepo.defaultBranch,
        dockerfile_path: s.build?.dockerfile || 'Dockerfile',
        build_context: s.build?.context !== '.' ? s.build?.context : null,
        health_check_path: s.healthCheckPath || null,
        storage_gb: s.hasStorage ? 5 : null,
        env_vars: s.envVars || []
      }))

      // Create services
      const result = await createServicesBatch(project.id, serviceData)

      toast.success(`Created project with ${result.summary.created} service(s)`)

      if (result.errors?.length > 0) {
        toast.warning(`${result.errors.length} service(s) failed to create`)
      }

      onComplete(project)
    } catch (err) {
      setError(err.message || 'Failed to create project')
      setCreating(false)
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep === STEPS.SOURCE) {
      setCurrentStep(STEPS.NAME)
    } else if (currentStep === STEPS.REPO) {
      setCurrentStep(STEPS.SOURCE)
      setSelectedRepo(null)
    } else if (currentStep === STEPS.REVIEW) {
      setCurrentStep(STEPS.REPO)
      setAnalysis(null)
      setServices([])
    }
  }

  // Render steps
  const renderNameStep = () => (
    <AsciiBox title="PROJECT NAME" variant="green">
      <form onSubmit={handleNameSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
            Enter a name for your project
          </label>
          <TerminalInput
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value.toLowerCase())
              setNameError(null)
            }}
            placeholder="my-project"
            className="w-full"
            autoFocus
          />
          {nameError && (
            <p className="font-mono text-xs text-terminal-red mt-2">! {nameError}</p>
          )}
          <p className="font-mono text-xs text-terminal-muted mt-2">
            Use lowercase letters, numbers, and hyphens only.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <TerminalButton type="button" variant="secondary" onClick={onCancel}>
            [ CANCEL ]
          </TerminalButton>
          <TerminalButton
            type="submit"
            variant="primary"
            disabled={!projectName}
          >
            [ CONTINUE ]
          </TerminalButton>
        </div>
      </form>
    </AsciiBox>
  )

  const renderSourceStep = () => (
    <div className="space-y-4">
      <p className="font-mono text-sm text-terminal-muted text-center">
        How would you like to set up your project?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => handleSourceSelect('import')}
          className="p-6 border-2 border-terminal-border hover:border-terminal-primary bg-terminal-bg-secondary transition-all text-left group"
        >
          <div className="font-mono text-lg text-terminal-primary group-hover:text-glow-green mb-2">
            IMPORT FROM GITHUB
          </div>
          <div className="font-mono text-xs text-terminal-muted">
            Select a repository and automatically detect services from docker-compose.yml or Dockerfiles
          </div>
          <div className="font-mono text-xs text-terminal-secondary mt-4">
            Recommended for existing projects
          </div>
        </button>

        <button
          onClick={() => handleSourceSelect('empty')}
          disabled={creating}
          className="p-6 border-2 border-terminal-border hover:border-terminal-secondary bg-terminal-bg-secondary transition-all text-left group disabled:opacity-50"
        >
          <div className="font-mono text-lg text-terminal-secondary group-hover:text-glow-amber mb-2">
            {creating ? 'CREATING...' : 'START EMPTY'}
          </div>
          <div className="font-mono text-xs text-terminal-muted">
            Create an empty project and add services manually later
          </div>
          <div className="font-mono text-xs text-terminal-muted mt-4">
            For new projects
          </div>
        </button>
      </div>

      <div className="flex justify-start">
        <TerminalButton variant="secondary" onClick={handleBack}>
          [ BACK ]
        </TerminalButton>
      </div>
    </div>
  )

  const renderRepoStep = () => (
    <div className="space-y-4">
      {analyzing ? (
        <div className="text-center py-12">
          <TerminalSpinner className="text-2xl" />
          <p className="font-mono text-terminal-muted mt-4">
            Analyzing {selectedRepo?.fullName}...
          </p>
        </div>
      ) : (
        <>
          <AsciiBox title="SELECT REPOSITORY" variant="cyan">
            <RepoSelector
              onSelect={handleRepoSelect}
              onCancel={handleBack}
            />
          </AsciiBox>
        </>
      )}
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-4">
      {/* Repository Info */}
      <AsciiBox title="REPOSITORY" variant="cyan">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-terminal-primary">{selectedRepo?.fullName}</div>
            <div className="text-xs text-terminal-muted mt-1">
              Branch: {analysis?.branch} |
              {analysis?.hasDockerCompose
                ? ` Compose: ${analysis.composeFile}`
                : ' No compose file'
              }
            </div>
          </div>
          <TerminalButton
            variant="secondary"
            onClick={() => {
              setCurrentStep(STEPS.REPO)
              setAnalysis(null)
              setServices([])
            }}
          >
            [ CHANGE ]
          </TerminalButton>
        </div>
      </AsciiBox>

      {/* Services Table */}
      <AsciiBox title="DETECTED SERVICES" variant="green">
        <ServiceTable
          services={services}
          onChange={setServices}
        />
      </AsciiBox>

      {/* Actions */}
      <div className="flex justify-between">
        <TerminalButton variant="secondary" onClick={handleBack}>
          [ BACK ]
        </TerminalButton>
        <TerminalButton
          variant="primary"
          onClick={handleCreateWithServices}
          disabled={creating || services.filter(s => s.selected).length === 0}
        >
          {creating ? '[ CREATING... ]' : '[ CREATE PROJECT ]'}
        </TerminalButton>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="font-mono text-terminal-secondary hover:text-terminal-primary transition-colors"
        >
          &lt; BACK
        </button>
        <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase tracking-terminal-wide">
          NEW PROJECT
        </h1>
      </div>

      <AsciiDivider variant="double" color="green" />

      {/* Step Indicator */}
      <WizardStepIndicator
        steps={STEP_LABELS}
        currentStep={currentStep}
        className="mb-8"
      />

      {/* Error Display */}
      {error && (
        <AsciiBox variant="red" title="ERROR">
          <p className="font-mono text-terminal-red">{error}</p>
        </AsciiBox>
      )}

      {/* Step Content */}
      {currentStep === STEPS.NAME && renderNameStep()}
      {currentStep === STEPS.SOURCE && renderSourceStep()}
      {currentStep === STEPS.REPO && renderRepoStep()}
      {currentStep === STEPS.REVIEW && renderReviewStep()}
    </div>
  )
}

export default NewProjectWizard
