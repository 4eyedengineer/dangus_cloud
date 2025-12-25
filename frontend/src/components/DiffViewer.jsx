import PropTypes from 'prop-types';

/**
 * DiffViewer - Terminal-style unified diff display
 *
 * Displays file changes with:
 * - Line numbers
 * - Green for additions (+)
 * - Red for deletions (-)
 * - Monospace font
 */
export function DiffViewer({
  original = '',
  modified = '',
  filename = 'file',
  className = '',
}) {
  const diff = computeDiff(original, modified);

  return (
    <div className={`font-mono text-xs ${className}`}>
      <div className="flex items-center gap-2 mb-2 text-terminal-muted">
        <span className="text-terminal-secondary">{filename}</span>
        <span className="text-terminal-muted">
          (<span className="text-terminal-primary">+{diff.additions}</span>
          {' '}
          <span className="text-terminal-red">-{diff.deletions}</span>)
        </span>
      </div>
      <div className="border border-terminal-border p-2 overflow-x-auto max-h-64 overflow-y-auto">
        {diff.lines.map((line, idx) => (
          <div key={idx} className="flex whitespace-pre">
            <span className="w-8 text-right pr-2 text-terminal-ghost select-none">
              {line.lineNumber || ''}
            </span>
            <span className={getLineColor(line.type)}>
              {line.prefix}
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Get line color based on type
 */
function getLineColor(type) {
  switch (type) {
    case 'addition':
      return 'text-terminal-primary';
    case 'deletion':
      return 'text-terminal-red';
    case 'context':
    default:
      return 'text-terminal-muted';
  }
}

/**
 * Simple diff algorithm for two strings
 * Returns additions, deletions, and lines for display
 */
function computeDiff(original, modified) {
  const originalLines = (original || '').split('\n');
  const modifiedLines = (modified || '').split('\n');

  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(originalLines, modifiedLines);
  const lines = [];
  let additions = 0;
  let deletions = 0;
  let lineNumber = 1;

  let origIdx = 0;
  let modIdx = 0;
  let lcsIdx = 0;

  while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
    if (lcsIdx < lcs.length && origIdx < originalLines.length && originalLines[origIdx] === lcs[lcsIdx]) {
      if (modIdx < modifiedLines.length && modifiedLines[modIdx] === lcs[lcsIdx]) {
        // Context line (unchanged)
        lines.push({
          type: 'context',
          prefix: ' ',
          content: lcs[lcsIdx],
          lineNumber: lineNumber++,
        });
        origIdx++;
        modIdx++;
        lcsIdx++;
      } else {
        // Addition
        lines.push({
          type: 'addition',
          prefix: '+',
          content: modifiedLines[modIdx],
          lineNumber: lineNumber++,
        });
        additions++;
        modIdx++;
      }
    } else if (origIdx < originalLines.length && (lcsIdx >= lcs.length || originalLines[origIdx] !== lcs[lcsIdx])) {
      // Deletion
      lines.push({
        type: 'deletion',
        prefix: '-',
        content: originalLines[origIdx],
        lineNumber: null,
      });
      deletions++;
      origIdx++;
    } else if (modIdx < modifiedLines.length) {
      // Addition
      lines.push({
        type: 'addition',
        prefix: '+',
        content: modifiedLines[modIdx],
        lineNumber: lineNumber++,
      });
      additions++;
      modIdx++;
    } else {
      break;
    }
  }

  return { lines, additions, deletions };
}

/**
 * Compute longest common subsequence of two arrays
 */
function longestCommonSubsequence(arr1, arr2) {
  const m = arr1.length;
  const n = arr2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find actual LCS
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      result.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * SimpleDiffViewer - Shows file changes without computing diff
 * Used when we don't have the original content
 */
export function SimpleDiffViewer({
  fileChanges = [],
  className = '',
}) {
  if (!fileChanges || fileChanges.length === 0) {
    return (
      <div className={`font-mono text-xs text-terminal-muted ${className}`}>
        No file changes
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {fileChanges.map((file, idx) => (
        <div key={idx} className="font-mono text-xs">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-terminal-secondary">{file.path}</span>
            <span className="text-terminal-primary">(modified)</span>
          </div>
          <div className="border border-terminal-border p-2 overflow-x-auto max-h-48 overflow-y-auto">
            <pre className="text-terminal-muted whitespace-pre-wrap">
              {file.content}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}

DiffViewer.propTypes = {
  original: PropTypes.string,
  modified: PropTypes.string,
  filename: PropTypes.string,
  className: PropTypes.string,
};

SimpleDiffViewer.propTypes = {
  fileChanges: PropTypes.arrayOf(PropTypes.shape({
    path: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  })),
  className: PropTypes.string,
};

export default DiffViewer;
