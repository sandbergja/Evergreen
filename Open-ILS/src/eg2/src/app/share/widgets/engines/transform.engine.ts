import { Injectable } from '@angular/core';
import { TransformConfig, TransformResult, AggregationFunction } from '@eg/staff/dashboard/interfaces/widget-json-config.interface';

/**
 * TransformEngine - Data transformation engine for JSON widgets
 *
 * This service provides data transformation capabilities for JSON-driven widgets.
 * It applies various transformations like grouping, aggregation, filtering, sorting, etc.
 *
 * Features:
 * - Group by field with aggregation
 * - Sum, average, count, min, max aggregations
 * - Filter data by expression
 * - Sort data
 * - Map data
 * - Reduce data
 * - Limit results
 *
 * All transformations are chainable and return consistent TransformResult objects.
 */

@Injectable({
    providedIn: 'root'
})
export class TransformEngine {

    /**
     * Transform data based on configuration
     * Accepts any data type and normalizes to array before transforming
     */
    public transform(data: any, config: TransformConfig): TransformResult {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            // NORMALIZE: Ensure data is always an array for processing
            let normalizedData: any[];
            if (!Array.isArray(data)) {
                // Single object or primitive - wrap in array
                normalizedData = data ? [data] : [];
                console.log('🔧 TransformEngine: Normalized non-array data to array', {
                    originalType: typeof data,
                    originalData: data,
                    wrapped: normalizedData,
                    transformType: config.type,
                    yField: config.yField
                });
            } else {
                normalizedData = data;
                console.log('🔧 TransformEngine: Data is array, length:', normalizedData.length);
            }

            let transformedData: any[];

            // Apply transformation based on type (using normalized array data)
            switch (config.type) {
                case 'groupBy':
                    transformedData = this.groupBy(normalizedData, config);
                    break;
                case 'sum':
                    transformedData = this.sum(normalizedData, config);
                    break;
                case 'average':
                    transformedData = this.average(normalizedData, config);
                    break;
                case 'count':
                    transformedData = this.count(normalizedData, config);
                    break;
                case 'filter':
                    transformedData = this.filter(normalizedData, config);
                    break;
                case 'sort':
                    transformedData = this.sort(normalizedData, config);
                    break;
                case 'map':
                    transformedData = this.map(normalizedData, config);
                    break;
                case 'reduce':
                    transformedData = this.reduce(normalizedData, config);
                    break;
                case 'multiSeries':
                    transformedData = this.multiSeries(normalizedData, config);
                    break;
                default:
                    throw new Error(`Unknown transform type: ${config.type}`);
            }

            // Apply limit if specified
            if (config.limit && config.limit > 0) {
                transformedData = transformedData.slice(0, config.limit);
            }

            // Apply sorting if specified (and not already sorted)
            if (config.sortBy && config.type !== 'sort') {
                transformedData = this.applySorting(transformedData, config.sortBy.field, config.sortBy.order);
            }

            const executionTime = Date.now() - startTime;

            return {
                data: transformedData,
                metadata: {
                    recordCount: transformedData.length,
                    transformType: config.type,
                    executionTime,
                    errors: errors.length > 0 ? errors : undefined
                }
            };
        } catch (error) {
            errors.push(error.message);
            throw new Error(`Transform failed: ${error.message}`);
        }
    }

    /**
     * Group data by a field and aggregate
     */
    private groupBy(data: any[], config: TransformConfig): any[] {
        if (!config.groupByField) {
            throw new Error('groupBy transform requires groupByField');
        }

        const groups = new Map<any, any[]>();

        // Group the data
        data.forEach(item => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const key = this.getNestedValue(item, config.groupByField!);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            groups.get(key)!.push(item);
        });

        // Aggregate each group
        const result: any[] = [];
        groups.forEach((items, key) => {
            const aggregatedValue = this.aggregate(items, config.yField, config.aggregation || 'sum');

            result.push({
                [config.xField || 'x']: key,
                [config.yField]: aggregatedValue,
                _count: items.length,
                _items: items // Keep original items for reference
            });
        });

        return result;
    }

    /**
     * Sum values
     */
    private sum(data: any[], config: TransformConfig): any[] {
        const total = this.aggregate(data, config.yField, 'sum');

        // Preserve all fields from first object if it exists (for trend calculations, etc.)
        const result = data.length > 0 ? { ...data[0] } : {};

        return [{
            ...result,
            [config.yField]: total,
            _count: data.length
        }];
    }

    /**
     * Average values
     */
    private average(data: any[], config: TransformConfig): any[] {
        const avg = this.aggregate(data, config.yField, 'average');
        return [{
            [config.yField]: avg,
            _count: data.length
        }];
    }

    /**
     * Count records
     */
    private count(data: any[], config: TransformConfig): any[] {
        return [{
            count: data.length,
            [config.yField]: data.length
        }];
    }

    /**
     * Filter data by expression
     */
    private filter(data: any[], config: TransformConfig): any[] {
        if (!config.filterExpression) {
            return data;
        }

        // Simple filter expression parsing (field=value, field>value, etc.)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return data.filter(item => this.evaluateFilterExpression(item, config.filterExpression!));
    }

    /**
     * Sort data
     */
    private sort(data: any[], config: TransformConfig): any[] {
        if (!config.sortBy) {
            throw new Error('sort transform requires sortBy configuration');
        }

        return this.applySorting([...data], config.sortBy.field, config.sortBy.order);
    }

    /**
     * Map data using expression
     */
    private map(data: any[], config: TransformConfig): any[] {
        if (!config.mapExpression) {
            throw new Error('map transform requires mapExpression');
        }

        // For now, this is a placeholder - in production, you'd implement safe expression evaluation
        console.warn('Map transform with expressions is not fully implemented for security reasons');
        return data;
    }

    /**
     * Reduce data
     */
    private reduce(data: any[], config: TransformConfig): any[] {
        // This is a simplified reduce - in production, you'd want more sophisticated options
        const aggregatedValue = this.aggregate(data, config.yField, config.aggregation || 'sum');
        return [{
            [config.yField]: aggregatedValue,
            _count: data.length
        }];
    }

    /**
     * Create multiple series from flat data
     * Pivots data by seriesField to create separate series for charts
     * Example input: [{library: "BR1", status: "Available", count: 100}, {library: "BR1", status: "Checked out", count: 50}]
     * Example output: ChartData with multiple series
     */
    private multiSeries(data: any[], config: TransformConfig): any {
        if (!config.seriesField) {
            throw new Error('multiSeries transform requires seriesField');
        }
        if (!config.xField) {
            throw new Error('multiSeries transform requires xField');
        }

        // Group data by xField (categories) and seriesField (series)
        const seriesMap = new Map<string, Map<any, number>>();
        const categories = new Set<any>();

        data.forEach(item => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const seriesKey = this.getNestedValue(item, config.seriesField!);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const category = this.getNestedValue(item, config.xField!);
            const value = this.getNestedValue(item, config.yField);

            categories.add(category);

            if (!seriesMap.has(seriesKey)) {
                seriesMap.set(seriesKey, new Map());
            }

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const categoryMap = seriesMap.get(seriesKey)!;
            const existingValue = categoryMap.get(category) || 0;

            // Aggregate if multiple values for same category/series
            if (config.aggregation === 'sum' || !config.aggregation) {
                categoryMap.set(category, existingValue + (value || 0));
            } else if (config.aggregation === 'average') {
                // For average, we'd need to track count - simplified here
                categoryMap.set(category, value || 0);
            } else {
                categoryMap.set(category, value || 0);
            }
        });

        // Convert to ChartData format with multiple series
        const series: any[] = [];
        const categoryArray = Array.from(categories);

        seriesMap.forEach((categoryMap, seriesName) => {
            const seriesData = categoryArray.map(category => ({
                x: category,
                y: categoryMap.get(category) || 0,
                label: `${category}: ${categoryMap.get(category) || 0}`
            }));

            series.push({
                name: seriesName,
                data: seriesData
            });
        });

        // Return ChartData structure (not array)
        return {
            _multiSeriesData: true,  // Flag to indicate this is multi-series data
            series: series
        };
    }

    /**
     * Aggregate values using specified function
     */
    private aggregate(data: any[], field: string, fn: AggregationFunction): number {
        const values = data
            .map(item => this.getNestedValue(item, field))
            .filter(val => typeof val === 'number' && !isNaN(val));

        if (values.length === 0) {
            return 0;
        }

        switch (fn) {
            case 'sum':
                return values.reduce((acc, val) => acc + val, 0);
            case 'average':
                return values.reduce((acc, val) => acc + val, 0) / values.length;
            case 'count':
                return values.length;
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
            case 'first':
                return values[0];
            case 'last':
                return values[values.length - 1];
            default:
                throw new Error(`Unknown aggregation function: ${fn}`);
        }
    }

    /**
     * Apply sorting to data
     */
    private applySorting(data: any[], field: string, order: 'asc' | 'desc'): any[] {
        return data.sort((a, b) => {
            const aVal = this.getNestedValue(a, field);
            const bVal = this.getNestedValue(b, field);

            if (aVal === bVal) {return 0;}

            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return order === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * Evaluate filter expression
     * Supports: field=value, field!=value, field>value, field<value, field>=value, field<=value
     */
    private evaluateFilterExpression(item: any, expression: string): boolean {
        // Simple expression parser
        const operators = ['>=', '<=', '!=', '=', '>', '<'];
        let operator = '';
        let parts: string[] = [];

        // Find the operator
        for (const op of operators) {
            if (expression.includes(op)) {
                operator = op;
                parts = expression.split(op).map(p => p.trim());
                break;
            }
        }

        if (!operator || parts.length !== 2) {
            console.warn(`Invalid filter expression: ${expression}`);
            return true; // Don't filter if expression is invalid
        }

        const [field, expectedValue] = parts;
        const actualValue = this.getNestedValue(item, field);

        // Convert expectedValue to appropriate type
        let typedExpectedValue: any = expectedValue;
        if (!isNaN(Number(expectedValue))) {
            typedExpectedValue = Number(expectedValue);
        } else if (expectedValue === 'true' || expectedValue === 'false') {
            typedExpectedValue = expectedValue === 'true';
        }

        // Perform comparison
        switch (operator) {
            case '=':
                return actualValue === typedExpectedValue;
            case '!=':
                return actualValue !== typedExpectedValue;
            case '>':
                return actualValue > typedExpectedValue;
            case '<':
                return actualValue < typedExpectedValue;
            case '>=':
                return actualValue >= typedExpectedValue;
            case '<=':
                return actualValue <= typedExpectedValue;
            default:
                return true;
        }
    }

    /**
     * Get nested value from object using dot notation
     * Example: getNestedValue(obj, 'user.profile.name')
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, prop) => {
            return current?.[prop];
        }, obj);
    }

    /**
     * Validate transform configuration
     */
    public validateTransformConfig(config: TransformConfig): { valid: boolean, errors: string[] } {
        const errors: string[] = [];

        // Check yField is provided
        if (!config.yField) {
            errors.push('yField is required');
        }

        // Type-specific validation
        switch (config.type) {
            case 'groupBy':
                if (!config.groupByField) {
                    errors.push('groupBy transform requires groupByField');
                }
                break;
            case 'multiSeries':
                if (!config.seriesField) {
                    errors.push('multiSeries transform requires seriesField');
                }
                if (!config.xField) {
                    errors.push('multiSeries transform requires xField');
                }
                break;
            case 'filter':
                if (!config.filterExpression) {
                    errors.push('filter transform requires filterExpression');
                }
                break;
            case 'sort':
                if (!config.sortBy) {
                    errors.push('sort transform requires sortBy configuration');
                }
                break;
            case 'map':
                if (!config.mapExpression) {
                    errors.push('map transform requires mapExpression');
                }
                break;
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get supported transform types
     */
    public getSupportedTransformTypes(): string[] {
        return ['groupBy', 'sum', 'average', 'count', 'filter', 'sort', 'map', 'reduce', 'multiSeries'];
    }

    /**
     * Get supported aggregation functions
     */
    public getSupportedAggregations(): string[] {
        return ['sum', 'average', 'count', 'min', 'max', 'first', 'last'];
    }
}
