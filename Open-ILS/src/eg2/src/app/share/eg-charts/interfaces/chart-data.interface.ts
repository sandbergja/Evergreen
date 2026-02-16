// Curve type enum for type-safe curve configuration
export enum CurveType {
  LINEAR = 'linear',
  MONOTONE_X = 'monotoneX',
  MONOTONE_Y = 'monotoneY',
  BASIS = 'basis',
  BASIS_OPEN = 'basisOpen',
  BASIS_CLOSED = 'basisClosed',
  BUNDLE = 'bundle',
  CARDINAL = 'cardinal',
  CARDINAL_OPEN = 'cardinalOpen',
  CARDINAL_CLOSED = 'cardinalClosed',
  CATMULL_ROM = 'catmullRom',
  CATMULL_ROM_OPEN = 'catmullRomOpen',
  CATMULL_ROM_CLOSED = 'catmullRomClosed',
  NATURAL = 'natural',
  STEP = 'step',
  STEP_BEFORE = 'stepBefore',
  STEP_AFTER = 'stepAfter'
}

// Unified chart data interface for all chart types
export interface ChartData {
  series: ChartSeries[];
  // string "name"s of which series should be shown.
  // In non multi chart types, only the first series in this list is shown.
  shownSeries?: string[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  accessibility?: AccessibilityConfig;
}


export interface ChartSeries {
  name: string;
  data: ChartPoint[];
  color?: string; // Falls back to Evergreen theme colors
  pattern?: string; // Accessibility pattern type (e.g., 'diagonal-lines', 'dots')
  // Chart type specific styling options
  curveType?: CurveType;
  lineStyle?: LineStyleConfiguration;
  barStyle?: BarStyleConfiguration;
  pieStyle?: PieStyleConfiguration;
}


// Unified chart point interface for all chart types
export interface ChartPoint {
  x: string | number | Date; // Categories (strings), numeric values, or dates
  y: number; // Value for all chart types
  label?: string; // Optional label for all chart types
  color?: string; // Optional point-specific color
  pattern?: string; // Optional point-specific pattern
}


export interface AccessibilityConfig {
  description: string;
  longDescription?: string;
  dataTable?: boolean; // Generate accessible data table
  patterns?: boolean; // Enable accessibility patterns for color-blind users
  patternOverride?: string[]; // Override default pattern assignment per series
}

// Line styling configuration interface for advanced styling
export interface LineStyleConfiguration {
  strokeWidth?: number;
  strokeDashArray?: string;
  strokeLinecap?: 'round' | 'square' | 'butt';
  strokeLinejoin?: 'round' | 'bevel' | 'miter';
  opacity?: number;
  tension?: number; // For cardinal curves (0-1)
  alpha?: number; // For Catmull-Rom curves (0-1)
}

// Bar chart styling configuration interface
export interface BarStyleConfiguration {
  barWidth?: number;
  barSpacing?: number;
  orientation?: 'vertical' | 'horizontal';
  grouping?: 'grouped' | 'stacked';
  cornerRadius?: number;
  opacity?: number;
}

// Pie chart styling configuration interface
export interface PieStyleConfiguration {
  innerRadius?: number; // For donut charts (0 = full pie, >0 = donut)
  outerRadius?: number; // Outer radius of pie slices
  padAngle?: number; // Padding angle between slices (in radians)
  cornerRadius?: number; // Corner radius for rounded slice corners
  opacity?: number; // Slice opacity
  showLabels?: boolean; // Show slice labels
  showLegend?: boolean; // Show legend
  labelPosition?: 'inside' | 'outside'; // Label positioning
}

export interface ChartConfiguration {
  width?: number;
  height?: number;
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  showGrid?: boolean;
  showTooltip?: boolean;
  animated?: boolean;
  // NEW: Curve configuration options
  curveType?: CurveType;
  lineStyle?: LineStyleConfiguration;
  barStyle?: BarStyleConfiguration; // Bar chart configuration options
  pieStyle?: PieStyleConfiguration; // Pie chart configuration options
  accessibility?: AccessibilityConfig; // Accessibility configuration
}
