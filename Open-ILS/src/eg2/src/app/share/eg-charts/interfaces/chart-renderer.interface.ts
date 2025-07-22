import { ChartData, ChartConfiguration } from './chart-data.interface';
import * as d3 from 'd3';

/**
 * ChartRenderer Interface - Strategy Pattern Implementation
 *
 * This interface defines the contract for different chart rendering strategies.
 * Each chart type (line, bar, pie) implements this interface to provide
 * specific rendering logic while maintaining a consistent API.
 */
export interface ChartRenderer<T = ChartData> {
  /**
   * Render the chart with the given data and configuration
   * @param data - Chart data to render
   * @param svg - D3.js SVG selection for rendering
   * @param config - Chart configuration options
   * @returns Promise that resolves when rendering is complete
   */
  render(data: T, svg: d3.Selection<SVGElement, unknown, null, undefined>, config: ChartConfiguration): Promise<void>;

  /**
   * Update the chart with new data
   * @param data - New chart data
   * @param svg - D3.js SVG selection for updating
   * @returns Promise that resolves when update is complete
   */
  update(data: T, svg: d3.Selection<SVGElement, unknown, null, undefined>): Promise<void>;

  /**
   * Clean up and destroy the chart
   * @param svg - D3.js SVG selection to clean up
   */
  destroy(svg: d3.Selection<SVGElement, unknown, null, undefined>): void;

  /**
   * Validate that the data is appropriate for this chart type
   * @param data - Chart data to validate
   * @returns Validation result with success status and any error messages
   */
  validateData(data: T): ValidationResult;

  /**
   * Get performance metrics for the current chart
   * @returns Performance metrics object
   */
  getPerformanceMetrics(): PerformanceMetrics;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  dataPointCount: number;
}

/**
 * Performance monitoring interface
 */
export interface PerformanceMonitor {
  startMeasurement(operation: string): PerformanceToken;
  endMeasurement(token: PerformanceToken): PerformanceResult;
  getMetrics(): PerformanceMetrics;
  logPerformanceWarning(metric: string, value: number, threshold: number): void;
}

/**
 * Performance token for measurement tracking
 */
export interface PerformanceToken {
  id: string;
  operation: string;
  startTime: number;
  startMemory: number;
}

/**
 * Performance measurement result
 */
export interface PerformanceResult {
  operation: string;
  duration: number;
  memoryUsage: number;
  timestamp: Date;
  exceedsThreshold: boolean;
}
