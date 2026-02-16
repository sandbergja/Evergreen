import { TestBed } from '@angular/core/testing';
import { EgChartsService } from './eg-charts.service';
import { ChartData } from './interfaces/chart-data.interface';

describe('EgChartsService', () => {
    let service: EgChartsService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(EgChartsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('validateChartData', () => {
        it('should return true for valid chart data', () => {
            const validData: ChartData = {
                series: [
                    {
                        name: 'Series 1',
                        data: [
                            { x: 1, y: 10 },
                            { x: 2, y: 20 }
                        ]
                    }
                ],
                accessibility: {
                    description: 'Test chart'
                }
            };

            expect(service.validateChartData(validData)).toBe(true);
        });

        it('should return false for invalid chart data', () => {
            expect(service.validateChartData(null as any)).toBe(false);
            expect(service.validateChartData({} as any)).toBe(false);
            expect(service.validateChartData({ series: [] } as any)).toBe(false);
            expect(service.validateChartData({ series: [{ name: 'Test' }] } as any)).toBe(false);
        });

        it('should return false for series with invalid data points', () => {
            const invalidData: ChartData = {
                series: [
                    {
                        name: 'Series 1',
                        data: [
                            { x: 1, y: 10 },
              { x: undefined, y: 20 } as any
                        ]
                    }
                ],
                accessibility: {
                    description: 'Test chart'
                }
            };

            expect(service.validateChartData(invalidData)).toBe(false);
        });
    });

    describe('generateSampleData', () => {
        it('should generate sample data with default parameters', () => {
            const sampleData = service.generateSampleData();

            expect(sampleData.series.length).toBe(2);
            expect(sampleData.series[0].data.length).toBe(10);
            expect(sampleData.title).toBe('Sample Chart');
            expect(sampleData.accessibility?.description).toContain('2 data series');
        });

        it('should generate sample data with custom parameters', () => {
            const sampleData = service.generateSampleData(3, 5);

            expect(sampleData.series.length).toBe(3);
            expect(sampleData.series[0].data.length).toBe(5);
            expect(sampleData.accessibility?.description).toContain('3 data series');
        });

        it('should generate valid data points', () => {
            const sampleData = service.generateSampleData(1, 3);

            expect(service.validateChartData(sampleData)).toBe(true);

            const series = sampleData.series[0];
            expect(series.data.every(point =>
                typeof point.x === 'number' && typeof point.y === 'number'
            )).toBe(true);
        });
    });

    describe('convertCsvToChartData', () => {
        it('should convert CSV data with headers', () => {
            const csvData = `X,Series1,Series2
1,10,15
2,20,25
3,30,35`;

            const chartData = service.convertCsvToChartData(csvData, true);

            expect(chartData.series.length).toBe(2);
            expect(chartData.series[0].name).toBe('Series1');
            expect(chartData.series[1].name).toBe('Series2');
            expect(chartData.series[0].data.length).toBe(3);
            expect(chartData.series[0].data[0]).toEqual({ x: 1, y: 10 });
        });

        it('should convert CSV data without headers', () => {
            const csvData = `1,10,15
2,20,25
3,30,35`;

            const chartData = service.convertCsvToChartData(csvData, false);

            expect(chartData.series.length).toBe(2);
            expect(chartData.series[0].name).toBe('Series 1');
            expect(chartData.series[1].name).toBe('Series 2');
        });
    });

    describe('calculateStatistics', () => {
        it('should calculate correct statistics', () => {
            const chartData: ChartData = {
                series: [
                    {
                        name: 'Series 1',
                        data: [
                            { x: 1, y: 10 },
                            { x: 2, y: 20 },
                            { x: 3, y: 30 }
                        ]
                    },
                    {
                        name: 'Series 2',
                        data: [
                            { x: 1, y: 5 },
                            { x: 2, y: 15 }
                        ]
                    }
                ],
                accessibility: {
                    description: 'Test chart'
                }
            };

            const stats = service.calculateStatistics(chartData);

            expect(stats.seriesCount).toBe(2);
            expect(stats.totalPoints).toBe(5);
            expect(stats.xRange).toEqual([1, 3]);
            expect(stats.yRange).toEqual([5, 30]);
            expect(stats.averageY).toBe(16); // (10+20+30+5+15)/5 = 16
        });

        it('should throw error for invalid data', () => {
            expect(() => service.calculateStatistics({} as any)).toThrow(new Error('Invalid chart data provided'));
        });
    });

    describe('generateAccessibleDescription', () => {
        it('should generate meaningful description', () => {
            const chartData: ChartData = {
                series: [
                    {
                        name: 'Temperature',
                        data: [
                            { x: 1, y: 20 },
                            { x: 2, y: 25 }
                        ]
                    }
                ],
                accessibility: {
                    description: 'Test chart'
                }
            };

            const description = service.generateAccessibleDescription(chartData);

            expect(description).toContain('Line chart with 1 data series');
            expect(description).toContain('Temperature');
            expect(description).toContain('Total of 2 data points');
            expect(description).toContain('X-axis ranges from 1 to 2');
            expect(description).toContain('Y-axis ranges from 20.00 to 25.00');
        });

        it('should handle invalid data gracefully', () => {
            const description = service.generateAccessibleDescription({} as any);
            expect(description).toBe('Invalid chart data');
        });
    });

    describe('getEvergreenColors', () => {
        it('should return array of Evergreen color variables', () => {
            const colors = service.getEvergreenColors();

            expect(Array.isArray(colors)).toBe(true);
            expect(colors.length).toBeGreaterThan(0);
            expect(colors[0]).toBe('var(--evergreen)');
            expect(colors.every(color => color.startsWith('var(--'))).toBe(true);
        });
    });

    describe('applyEvergreenColors', () => {
        it('should apply theme colors to series without colors', () => {
            const chartData: ChartData = {
                series: [
                    { name: 'Series 1', data: [{ x: 1, y: 10 }] },
                    { name: 'Series 2', data: [{ x: 1, y: 20 }] }
                ],
                accessibility: {
                    description: 'Test chart'
                }
            };

            const coloredData = service.applyEvergreenColors(chartData);

            expect(coloredData.series[0].color).toBe('var(--evergreen)');
            expect(coloredData.series[1].color).toBe('var(--primary)');
        });

        it('should preserve existing colors', () => {
            const chartData: ChartData = {
                series: [
                    { name: 'Series 1', data: [{ x: 1, y: 10 }], color: 'red' },
                    { name: 'Series 2', data: [{ x: 1, y: 20 }] }
                ],
                accessibility: {
                    description: 'Test chart'
                }
            };

            const coloredData = service.applyEvergreenColors(chartData);

            expect(coloredData.series[0].color).toBe('red');
            expect(coloredData.series[1].color).toBe('var(--primary)');
        });
    });
});
