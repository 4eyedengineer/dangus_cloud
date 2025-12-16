/**
 * WizardStepIndicator - Terminal-styled step progress indicator
 *
 * Visual representation:
 * [1]────[2]────[3]────[4]
 *  ●      ○      ○      ○
 * NAME  SOURCE  REPO  REVIEW
 */
export function WizardStepIndicator({
  steps = [],
  currentStep = 0,
  className = ''
}) {
  return (
    <div
      className={`font-mono ${className}`}
      role="navigation"
      aria-label="Wizard progress"
    >
      {/* Step numbers with connectors */}
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            {/* Step circle */}
            <div
              className={`
                w-8 h-8 flex items-center justify-center border-2
                ${index <= currentStep
                  ? 'border-terminal-primary text-terminal-primary'
                  : 'border-terminal-muted text-terminal-muted'
                }
                ${index === currentStep ? 'text-glow-green' : ''}
              `}
              aria-current={index === currentStep ? 'step' : undefined}
            >
              {index < currentStep ? (
                <span className="text-terminal-primary">&#10003;</span>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  w-12 md:w-20 h-0.5
                  ${index < currentStep
                    ? 'bg-terminal-primary'
                    : 'bg-terminal-muted'
                  }
                `}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center mt-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className="w-8 flex justify-center">
              <span
                className={`
                  ${index === currentStep
                    ? 'text-terminal-primary text-glow-green'
                    : index < currentStep
                      ? 'text-terminal-primary'
                      : 'text-terminal-muted'
                  }
                `}
                aria-hidden="true"
              >
                {index <= currentStep ? '●' : '○'}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="w-12 md:w-20" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {/* Step labels */}
      <div className="flex items-center justify-center mt-1">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`
                w-8 flex justify-center text-xs uppercase tracking-wide
                ${index === currentStep
                  ? 'text-terminal-primary'
                  : index < currentStep
                    ? 'text-terminal-primary'
                    : 'text-terminal-muted'
                }
              `}
            >
              <span className="whitespace-nowrap -ml-6 w-20 text-center">
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="w-12 md:w-20" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Compact step indicator for smaller spaces
 */
export function CompactStepIndicator({
  current = 1,
  total = 4,
  label = '',
  className = ''
}) {
  return (
    <div
      className={`font-mono text-sm ${className}`}
      role="status"
      aria-label={`Step ${current} of ${total}${label ? `: ${label}` : ''}`}
    >
      <span className="text-terminal-muted">STEP </span>
      <span className="text-terminal-primary">{current}</span>
      <span className="text-terminal-muted"> / {total}</span>
      {label && (
        <>
          <span className="text-terminal-muted"> - </span>
          <span className="text-terminal-primary uppercase">{label}</span>
        </>
      )}
    </div>
  )
}

export default WizardStepIndicator
