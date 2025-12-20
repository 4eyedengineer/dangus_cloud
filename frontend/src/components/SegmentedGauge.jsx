import { useMemo } from 'react'

/**
 * SegmentedGauge - SVG-based arc gauge with discrete segments
 *
 * Features:
 * - 24 segments forming a 270° arc
 * - Threshold-based coloring (v2 spec)
 * - Title above, percentage in center
 */

// v2 threshold colors
const THRESHOLD_COLORS = {
  healthy: '#33ff33',   // 0-50%
  warning: '#aaff33',   // 50-70%
  caution: '#ffaa33',   // 70-85%
  critical: '#ff3333',  // 85-100%
}

const UNFILLED_COLOR = '#333333'

// Get color based on percentage threshold - all filled segments use the same color
const getThresholdColor = (percent) => {
  if (percent <= 50) return THRESHOLD_COLORS.healthy
  if (percent <= 70) return THRESHOLD_COLORS.warning
  if (percent <= 85) return THRESHOLD_COLORS.caution
  return THRESHOLD_COLORS.critical
}

// Calculate point on arc
const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  }
}

// Create arc path for a segment
const describeArc = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ')
}

export function SegmentedGauge({
  value = 0,
  max = 100,
  title = '',
  size = 150,
  showValue = true,
  unit = '%',
  className = ''
}) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0

  // Gauge configuration
  const segments = 24
  const arcAngle = 270 // degrees
  const startAngle = 135 // start from bottom-left
  const gapAngle = 2 // gap between segments
  const segmentAngle = (arcAngle - (segments - 1) * gapAngle) / segments

  const cx = size / 2
  const cy = size / 2
  const radius = (size / 2) - 10 // padding for stroke
  const strokeWidth = 12

  // Calculate which segments are filled
  const filledSegments = Math.round((percent / 100) * segments)

  // Get color based on actual value (all filled segments same color)
  const fillColor = getThresholdColor(percent)

  // Generate segments with memoization
  const segmentPaths = useMemo(() => {
    const paths = []
    for (let i = 0; i < segments; i++) {
      const segmentStartAngle = startAngle + i * (segmentAngle + gapAngle)
      const segmentEndAngle = segmentStartAngle + segmentAngle
      const isFilled = i < filledSegments

      paths.push({
        id: i,
        d: describeArc(cx, cy, radius, segmentStartAngle, segmentEndAngle),
        color: isFilled ? fillColor : UNFILLED_COLOR,
        isFilled
      })
    }
    return paths
  }, [segments, startAngle, segmentAngle, gapAngle, filledSegments, fillColor, cx, cy, radius])

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {title && (
        <div className="text-xs text-terminal-muted uppercase mb-2 font-mono tracking-wide">
          {title}
        </div>
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title || 'Gauge'}
      >
        {/* Background circle for glow effect */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(51, 255, 51, 0.05)"
          strokeWidth={strokeWidth + 4}
        />

        {/* Segments */}
        {segmentPaths.map(segment => (
          <path
            key={segment.id}
            d={segment.d}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: segment.isFilled ? `drop-shadow(0 0 4px ${segment.color}40)` : 'none'
            }}
          />
        ))}

        {/* Center text */}
        {showValue && (
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            className="font-mono"
            style={{
              fill: fillColor,
              fontSize: size * 0.22,
              fontWeight: 'bold'
            }}
          >
            {percent}{unit}
          </text>
        )}
      </svg>
    </div>
  )
}

// Compact version for inline use
export function SegmentedGaugeCompact({
  value = 0,
  max = 100,
  label = '',
  className = ''
}) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const color = getThresholdColor(percent)

  return (
    <div
      className={`flex items-center gap-3 font-mono ${className}`}
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Gauge'}
    >
      <SegmentedGauge value={value} max={max} size={80} showValue={false} />
      <div className="flex flex-col">
        {label && (
          <span className="text-xs text-terminal-muted uppercase">{label}</span>
        )}
        <span
          className="text-lg font-bold"
          style={{ color }}
        >
          {percent}%
        </span>
      </div>
    </div>
  )
}

export default SegmentedGauge
