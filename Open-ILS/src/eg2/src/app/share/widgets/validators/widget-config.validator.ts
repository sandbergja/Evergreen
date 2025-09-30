import { Injectable, inject } from '@angular/core';
import {
    WidgetJsonConfig,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    DashboardJsonConfig
} from '@eg/staff/dashboard/interfaces/widget-json-config.interface';
import { DataSourceRegistryService } from '../services/data-source-registry.service';
import { TransformEngine } from '../engines/transform.engine';

/**
 * WidgetConfigValidator - Validates JSON widget configurations
 *
 * Provides comprehensive validation for widget configurations including:
 * - Structure validation
 * - Data source validation
 * - Transform validation
 * - Visualization validation
 * - Dashboard layout validation
 *
 * Returns detailed error and warning messages to help developers
 * debug configuration issues.
 */
@Injectable({
    providedIn: 'root'
})
export class WidgetConfigValidator {

    private dataSourceRegistry = inject(DataSourceRegistryService);
    private transformEngine = inject(TransformEngine);

    /**
     * Validate a complete widget configuration
     */
    public validateWidget(config: WidgetJsonConfig): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Basic structure validation
        this.validateBasicStructure(config, errors);

        // Only continue if basic structure is valid
        if (errors.length > 0) {
            return { isValid: false, errors, warnings };
        }

        // Data source validation
        this.validateDataSource(config, errors, warnings);

        // Transform validation
        this.validateTransform(config, errors, warnings);

        // Visualization validation
        this.validateVisualization(config, errors, warnings);

        // Type-specific validation
        this.validateWidgetType(config, errors, warnings);

        // Filters validation
        if (config.filters && config.filters.length > 0) {
            this.validateFilters(config, errors, warnings);
        }

        // Auto-refresh validation
        if (config.autoRefresh) {
            this.validateAutoRefresh(config, errors, warnings);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate basic structure
     */
    private validateBasicStructure(config: WidgetJsonConfig, errors: ValidationError[]): void {
        if (!config) {
            errors.push({
                field: 'config',
                message: 'Configuration object is required',
                severity: 'error'
            });
            return;
        }

        if (!config.id) {
            errors.push({
                field: 'id',
                message: 'Widget ID is required',
                severity: 'error'
            });
        }

        if (!config.name) {
            errors.push({
                field: 'name',
                message: 'Widget name is required',
                severity: 'error'
            });
        }

        if (!config.type) {
            errors.push({
                field: 'type',
                message: 'Widget type is required',
                severity: 'error'
            });
        } else if (!['chart', 'metric'].includes(config.type)) {
            errors.push({
                field: 'type',
                message: `Invalid widget type: "${config.type}". Must be "chart" or "metric"`,
                severity: 'error'
            });
        }
    }

    /**
     * Validate data source configuration
     */
    private validateDataSource(
        config: WidgetJsonConfig,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (!config.dataSource) {
            errors.push({
                field: 'dataSource',
                message: 'Data source configuration is required',
                severity: 'error'
            });
            return;
        }

        const ds = config.dataSource;

        if (!ds.service) {
            errors.push({
                field: 'dataSource.service',
                message: 'Data source service is required',
                severity: 'error'
            });
        }

        if (!ds.method) {
            errors.push({
                field: 'dataSource.method',
                message: 'Data source method is required',
                severity: 'error'
            });
        }

        // Validate against registry
        const registryValidation = this.dataSourceRegistry.validateDataSourceConfig(ds);
        if (!registryValidation.valid) {
            registryValidation.errors.forEach(error => {
                errors.push({
                    field: 'dataSource',
                    message: error,
                    severity: 'error'
                });
            });
        }

        // Check cache configuration
        if (ds.cache) {
            if (ds.cache.enabled && (!ds.cache.ttl || ds.cache.ttl <= 0)) {
                warnings.push({
                    field: 'dataSource.cache.ttl',
                    message: 'Cache is enabled but TTL is not set. Using default TTL of 300 seconds',
                    severity: 'warning'
                });
            }
        }
    }

    /**
     * Validate transform configuration
     */
    private validateTransform(
        config: WidgetJsonConfig,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (!config.transform) {
            errors.push({
                field: 'transform',
                message: 'Transform configuration is required',
                severity: 'error'
            });
            return;
        }

        const transform = config.transform;

        if (!transform.type) {
            errors.push({
                field: 'transform.type',
                message: 'Transform type is required',
                severity: 'error'
            });
        }

        if (!transform.yField) {
            errors.push({
                field: 'transform.yField',
                message: 'Transform yField is required',
                severity: 'error'
            });
        }

        // Validate against transform engine
        const transformValidation = this.transformEngine.validateTransformConfig(transform);
        if (!transformValidation.valid) {
            transformValidation.errors.forEach(error => {
                errors.push({
                    field: 'transform',
                    message: error,
                    severity: 'error'
                });
            });
        }

        // Warnings for chart widgets
        if (config.type === 'chart' && !transform.xField) {
            warnings.push({
                field: 'transform.xField',
                message: 'xField is recommended for chart widgets',
                severity: 'warning'
            });
        }
    }

    /**
     * Validate visualization configuration
     */
    private validateVisualization(
        config: WidgetJsonConfig,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (!config.visualization) {
            errors.push({
                field: 'visualization',
                message: 'Visualization configuration is required',
                severity: 'error'
            });
            return;
        }

        const viz = config.visualization;

        if (!viz.chartType) {
            errors.push({
                field: 'visualization.chartType',
                message: 'Chart type is required',
                severity: 'error'
            });
        }

        if (!viz.title) {
            errors.push({
                field: 'visualization.title',
                message: 'Visualization title is required',
                severity: 'error'
            });
        }

        // Chart-specific validation
        if (config.type === 'chart') {
            if (!['bar', 'line', 'pie'].includes(viz.chartType)) {
                errors.push({
                    field: 'visualization.chartType',
                    message: `Invalid chart type for chart widget: "${viz.chartType}". Must be bar, line, or pie`,
                    severity: 'error'
                });
            }

            if (!viz.xAxisLabel) {
                warnings.push({
                    field: 'visualization.xAxisLabel',
                    message: 'xAxisLabel is recommended for accessibility',
                    severity: 'warning'
                });
            }

            if (!viz.yAxisLabel) {
                warnings.push({
                    field: 'visualization.yAxisLabel',
                    message: 'yAxisLabel is recommended for accessibility',
                    severity: 'warning'
                });
            }
        }

        // Metric-specific validation
        if (config.type === 'metric') {
            if (viz.chartType !== 'metric') {
                errors.push({
                    field: 'visualization.chartType',
                    message: 'Metric widget must have chartType="metric"',
                    severity: 'error'
                });
            }

            if (!viz.icon) {
                warnings.push({
                    field: 'visualization.icon',
                    message: 'Icon is recommended for metric widgets',
                    severity: 'warning'
                });
            }
        }
    }

    /**
     * Widget type-specific validation
     */
    private validateWidgetType(
        config: WidgetJsonConfig,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        // Ensure consistency between type and chartType
        if (config.type === 'chart' && config.visualization?.chartType === 'metric') {
            errors.push({
                field: 'type',
                message: 'Mismatch: type is "chart" but chartType is "metric"',
                severity: 'error'
            });
        }

        if (config.type === 'metric' && config.visualization?.chartType !== 'metric') {
            errors.push({
                field: 'type',
                message: 'Mismatch: type is "metric" but chartType is not "metric"',
                severity: 'error'
            });
        }
    }

    /**
     * Validate filters configuration
     */
    private validateFilters(
        config: WidgetJsonConfig,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        config.filters?.forEach((filter, index) => {
            if (!filter.id) {
                errors.push({
                    field: `filters[${index}].id`,
                    message: 'Filter ID is required',
                    severity: 'error'
                });
            }

            if (!filter.type) {
                errors.push({
                    field: `filters[${index}].type`,
                    message: 'Filter type is required',
                    severity: 'error'
                });
            }

            if (!filter.field) {
                errors.push({
                    field: `filters[${index}].field`,
                    message: 'Filter field is required',
                    severity: 'error'
                });
            }

            if (!filter.label) {
                warnings.push({
                    field: `filters[${index}].label`,
                    message: 'Filter label is recommended for better UX',
                    severity: 'warning'
                });
            }
        });
    }

    /**
     * Validate auto-refresh configuration
     */
    private validateAutoRefresh(
        config: WidgetJsonConfig,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (config.autoRefresh?.enabled) {
            if (!config.autoRefresh.interval || config.autoRefresh.interval <= 0) {
                errors.push({
                    field: 'autoRefresh.interval',
                    message: 'Auto-refresh interval must be greater than 0',
                    severity: 'error'
                });
            } else if (config.autoRefresh.interval < 10) {
                warnings.push({
                    field: 'autoRefresh.interval',
                    message: 'Auto-refresh interval less than 10 seconds may cause performance issues',
                    severity: 'warning'
                });
            }
        }
    }

    /**
     * Validate an entire dashboard configuration
     */
    public validateDashboard(config: DashboardJsonConfig): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Basic dashboard validation
        if (!config.id) {
            errors.push({
                field: 'id',
                message: 'Dashboard ID is required',
                severity: 'error'
            });
        }

        if (!config.name) {
            errors.push({
                field: 'name',
                message: 'Dashboard name is required',
                severity: 'error'
            });
        }

        if (!config.widgets || config.widgets.length === 0) {
            warnings.push({
                field: 'widgets',
                message: 'Dashboard has no widgets',
                severity: 'warning'
            });
        }

        // Validate each widget
        config.widgets?.forEach((widget, index) => {
            const widgetValidation = this.validateWidget(widget);
            widgetValidation.errors.forEach(error => {
                errors.push({
                    field: `widgets[${index}].${error.field}`,
                    message: error.message,
                    severity: 'error'
                });
            });
            widgetValidation.warnings?.forEach(warning => {
                warnings.push({
                    field: `widgets[${index}].${warning.field}`,
                    message: warning.message,
                    severity: 'warning'
                });
            });
        });

        // Check for duplicate widget IDs
        const widgetIds = new Set<string>();
        config.widgets?.forEach((widget, index) => {
            if (widgetIds.has(widget.id)) {
                errors.push({
                    field: `widgets[${index}].id`,
                    message: `Duplicate widget ID: "${widget.id}"`,
                    severity: 'error'
                });
            }
            widgetIds.add(widget.id);
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get validation summary as human-readable string
     */
    public getValidationSummary(result: ValidationResult): string {
        const lines: string[] = [];

        if (result.isValid) {
            lines.push('✓ Configuration is valid');
        } else {
            lines.push(`✗ Configuration has ${result.errors.length} error(s)`);
        }

        if (result.warnings && result.warnings.length > 0) {
            lines.push(`⚠ ${result.warnings.length} warning(s)`);
        }

        // Add errors
        result.errors.forEach(error => {
            lines.push(`  ERROR [${error.field}]: ${error.message}`);
        });

        // Add warnings
        result.warnings?.forEach(warning => {
            lines.push(`  WARNING [${warning.field}]: ${warning.message}`);
        });

        return lines.join('\n');
    }
}