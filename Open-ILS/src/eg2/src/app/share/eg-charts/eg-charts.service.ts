import { Injectable } from '@angular/core';
import { ChartData, ChartSeries, ChartPoint } from './interfaces/chart-data.interface';

@Injectable({
    providedIn: 'root'
})
export class EgChartsService {

    constructor() { }

    /**
   * Validates chart data structure
   * @param data Chart data to validate
   * @returns True if valid, false otherwise
   */
    validateChartData(data: ChartData): boolean {
        if (!data || !data.series || !Array.isArray(data.series)) {
            return false;
        }

        if (data.series.length === 0) {
            return false;
        }

        // Check each series has required properties
        for (const series of data.series) {
            if (!series.name || !series.data || !Array.isArray(series.data)) {
                return false;
            }

            // Check each data point has x and y values
            for (const point of series.data) {
                if (point.x === undefined || point.y === undefined) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
   * Generates sample chart data for testing
   * @param seriesCount Number of data series to generate
   * @param pointCount Number of data points per series
   * @returns Sample chart data
   */
    generateSampleData(seriesCount = 2, pointCount = 10): ChartData {
        const series: ChartSeries[] = [];

        for (let s = 0; s < seriesCount; s++) {
            const data: ChartPoint[] = [];
            const baseValue = Math.random() * 50 + 25; // Random base between 25-75

            for (let i = 0; i < pointCount; i++) {
                const x = i + 1;
                const y = baseValue + (Math.random() - 0.5) * 20 + (i * 2); // Trending upward with noise
                data.push({ x, y: Math.round(y * 100) / 100 });
            }

            series.push({
                name: `Series ${s + 1}`,
                data
            });
        }

        return {
            title: 'Sample Chart',
            xAxisLabel: 'Time Period',
            yAxisLabel: 'Value',
            series,
            accessibility: {
                description: `Line chart showing ${seriesCount} data series with ${pointCount} points each`,
                longDescription: 'This is a sample line chart demonstrating the eg-charts library functionality with multiple data series showing trending values over time.',
                dataTable: true
            }
        };
    }

    /**
   * Converts CSV data to chart data format
   * @param csvData CSV string data
   * @param hasHeader Whether the first row contains headers
   * @returns Converted chart data
   */
    convertCsvToChartData(csvData: string, hasHeader = true): ChartData {
        const lines = csvData.trim().split('\n');
        const headers = hasHeader ? lines[0].split(',') : [];
        const dataRows = hasHeader ? lines.slice(1) : lines;

        const series: ChartSeries[] = [];

        // Assuming first column is X values, rest are Y values for different series
        if (headers.length > 1 || dataRows.length > 0) {
            const firstRow = dataRows[0]?.split(',') || [];
            const seriesCount = firstRow.length - 1;

            for (let s = 0; s < seriesCount; s++) {
                const data: ChartPoint[] = [];
                const seriesName = headers[s + 1] || `Series ${s + 1}`;

                for (const row of dataRows) {
                    const values = row.split(',');
                    if (values.length > s + 1) {
                        const x = parseFloat(values[0]) || 0;
                        const y = parseFloat(values[s + 1]) || 0;
                        data.push({ x, y });
                    }
                }

                series.push({
                    name: seriesName,
                    data
                });
            }
        }

        return {
            title: 'Imported Data',
            xAxisLabel: headers[0] || 'X Value',
            yAxisLabel: 'Y Value',
            series,
            accessibility: {
                description: `Chart with ${series.length} data series imported from CSV`,
                dataTable: true
            }
        };
    }

    /**
   * Calculates statistics for chart data
   * @param data Chart data
   * @returns Statistics object
   */
    calculateStatistics(data: ChartData): {
    seriesCount: number;
    totalPoints: number;
    xRange: [number, number];
    yRange: [number, number];
    averageY: number;
  } {
        if (!this.validateChartData(data)) {
            throw new Error('Invalid chart data provided');
        }

        const allPoints = data.series.flatMap(s => s.data);
        const xValues = allPoints.map(p => typeof p.x === 'number' ? p.x : 0);
        const yValues = allPoints.map(p => p.y);

        return {
            seriesCount: data.series.length,
            totalPoints: allPoints.length,
            xRange: [Math.min(...xValues), Math.max(...xValues)],
            yRange: [Math.min(...yValues), Math.max(...yValues)],
            averageY: yValues.reduce((sum, val) => sum + val, 0) / yValues.length
        };
    }

    /**
   * Generates accessible description for chart data
   * @param data Chart data
   * @returns Accessible description string
   */
    generateAccessibleDescription(data: ChartData): string {
        if (!this.validateChartData(data)) {
            return 'Invalid chart data';
        }

        const stats = this.calculateStatistics(data);
        const seriesNames = data.series.map(s => s.name).join(', ');

        return `Line chart with ${stats.seriesCount} data series: ${seriesNames}. ` +
           `Total of ${stats.totalPoints} data points. ` +
           `X-axis ranges from ${stats.xRange[0]} to ${stats.xRange[1]}. ` +
           `Y-axis ranges from ${stats.yRange[0].toFixed(2)} to ${stats.yRange[1].toFixed(2)}. ` +
           `Average Y value is ${stats.averageY.toFixed(2)}.`;
    }

    /**
   * Gets Evergreen theme colors for chart series
   * @returns Array of CSS color variable names
   */
    getEvergreenColors(): string[] {
        return [
            'var(--evergreen)',
            'var(--primary)',
            'var(--info)',
            'var(--success)',
            'var(--warning)',
            'var(--danger)',
            'var(--bs-blue-600)',
            'var(--bs-cyan-700)',
            'var(--bs-green-600)',
            'var(--bs-yellow-600)',
            'var(--bs-orange-600)',
            'var(--bs-red-600)'
        ];
    }

    /**
   * Applies Evergreen theme colors to chart data
   * @param data Chart data
   * @returns Chart data with theme colors applied
   */
    applyEvergreenColors(data: ChartData): ChartData {
        const colors = this.getEvergreenColors();

        return {
            ...data,
            series: data.series.map((series, index) => ({
                ...series,
                color: series.color || colors[index % colors.length]
            }))
        };
    }
}
