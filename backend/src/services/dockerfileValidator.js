const DEPRECATED_INSTRUCTIONS = ['MAINTAINER'];

const SECURITY_PATTERNS = [
  { pattern: /password\s*=\s*['"][^'"]+['"]/i, message: 'Hardcoded password detected' },
  { pattern: /secret\s*=\s*['"][^'"]+['"]/i, message: 'Hardcoded secret detected' },
  { pattern: /api_key\s*=\s*['"][^'"]+['"]/i, message: 'Hardcoded API key detected' },
  { pattern: /token\s*=\s*['"][^'"]+['"]/i, message: 'Hardcoded token detected' },
];

const VALID_INSTRUCTIONS = [
  'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY',
  'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL',
  'HEALTHCHECK', 'SHELL'
];

/**
 * Validate a Dockerfile content and return errors and warnings
 * @param {string} content - Dockerfile content
 * @returns {{valid: boolean, errors: Array, warnings: Array, summary: object}}
 */
export function validateDockerfile(content) {
  const warnings = [];
  const errors = [];
  const lines = content.split('\n');

  let hasFrom = false;
  let hasUser = false;
  let hasHealthcheck = false;
  let lastInstruction = null;
  let firstInstructionLine = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') continue;

    // Handle line continuations
    if (line.endsWith('\\')) continue;

    const parts = line.split(/\s+/);
    const instruction = parts[0].toUpperCase();

    // Track first non-comment instruction
    if (firstInstructionLine === null) {
      firstInstructionLine = lineNum;
    }

    // Check for valid instruction
    if (!VALID_INSTRUCTIONS.includes(instruction)) {
      // Could be a continuation or invalid - only error if it looks like an instruction
      if (/^[A-Z]+$/.test(parts[0])) {
        errors.push({ line: lineNum, message: `Unknown instruction: ${parts[0]}` });
      }
      continue;
    }

    // Check for FROM instruction
    if (instruction === 'FROM') {
      hasFrom = true;

      // Check if FROM is the first instruction
      if (firstInstructionLine !== lineNum && !hasFrom) {
        errors.push({ line: lineNum, message: 'FROM must be the first instruction' });
      }

      // Check for :latest tag
      const imageRef = parts[1] || '';
      if (imageRef.endsWith(':latest') || (!imageRef.includes(':') && !imageRef.includes('@'))) {
        warnings.push({
          line: lineNum,
          message: 'Consider using a specific image tag instead of :latest',
          severity: 'best-practice'
        });
      }
    }

    // Track USER instruction
    if (instruction === 'USER') {
      hasUser = true;
    }

    // Track HEALTHCHECK instruction
    if (instruction === 'HEALTHCHECK') {
      hasHealthcheck = true;
    }

    // Check deprecated instructions
    if (DEPRECATED_INSTRUCTIONS.includes(instruction)) {
      warnings.push({
        line: lineNum,
        message: `${instruction} is deprecated, use LABEL instead`
      });
    }

    // Check security patterns
    for (const { pattern, message } of SECURITY_PATTERNS) {
      if (pattern.test(line)) {
        warnings.push({ line: lineNum, message, severity: 'security' });
      }
    }

    // Check for consecutive RUN instructions (can be combined)
    if (instruction === 'RUN' && lastInstruction === 'RUN') {
      warnings.push({
        line: lineNum,
        message: 'Consider combining consecutive RUN instructions to reduce layers',
        severity: 'optimization'
      });
    }

    // Check for ADD vs COPY for local files
    if (instruction === 'ADD') {
      const source = parts[1] || '';
      // If source doesn't look like a URL, suggest COPY
      if (!source.startsWith('http://') && !source.startsWith('https://') && !source.endsWith('.tar') && !source.endsWith('.tar.gz')) {
        warnings.push({
          line: lineNum,
          message: 'Consider using COPY instead of ADD for local files',
          severity: 'best-practice'
        });
      }
    }

    lastInstruction = instruction;
  }

  // Check for missing FROM instruction
  if (!hasFrom) {
    errors.push({ line: 1, message: 'Dockerfile must contain a FROM instruction' });
  }

  // Check for missing USER instruction (running as root)
  if (!hasUser) {
    warnings.push({
      line: null,
      message: 'No USER instruction found - container will run as root',
      severity: 'security'
    });
  }

  // Check for missing HEALTHCHECK
  if (!hasHealthcheck) {
    warnings.push({
      line: null,
      message: 'Consider adding a HEALTHCHECK instruction',
      severity: 'best-practice'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
      securityWarnings: warnings.filter(w => w.severity === 'security').length,
      optimizationWarnings: warnings.filter(w => w.severity === 'optimization').length
    }
  };
}
