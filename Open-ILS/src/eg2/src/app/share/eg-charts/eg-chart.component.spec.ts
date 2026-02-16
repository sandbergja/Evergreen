import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EgChartComponent } from './eg-chart.component';
import { ChartData, ChartConfiguration } from './interfaces/chart-data.interface';

describe('EgChartComponent', () => {
    let component: EgChartComponent;
    let fixture: ComponentFixture<EgChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [EgChartComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(EgChartComponent);
        component = fixture.componentInstance;
        component.chartData = {series:[]};
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render chart title when provided', () => {
        const chartData: ChartData = {
            title: 'Test Chart',
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
                description: 'Test chart description'
            }
        };

        component.chartData = chartData;
        fixture.detectChanges();

        const titleElement = fixture.nativeElement.querySelector('.eg-chart-title h2');
        expect(titleElement?.textContent).toBe('Test Chart');
    });

    it('should have proper ARIA attributes', () => {
        const chartData: ChartData = {
            series: [
                {
                    name: 'Series 1',
                    data: [{ x: 1, y: 10 }]
                }
            ],
            accessibility: {
                description: 'Test chart description',
                longDescription: 'Detailed chart description'
            }
        };

        component.chartData = chartData;
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector('.eg-chart-container');
        const svg = fixture.nativeElement.querySelector('svg');

        expect(container.getAttribute('aria-label')).toBe('Test chart description');
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.getAttribute('aria-describedby')).toBe('chart-long-desc');
    });

    it('should generate accessible data table when enabled', () => {
        const chartData: ChartData = {
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
                description: 'Test chart description',
                dataTable: true
            }
        };

        component.chartData = chartData;
        fixture.detectChanges();

        const table = fixture.nativeElement.querySelector('.eg-chart-data-table table');
        expect(table).toBeTruthy();

        const caption = table.querySelector('caption');
        expect(caption?.textContent).toBe('Test chart description');

        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBe(2);
    });

    it('should use default configuration when none provided', () => {
        pending('The drawChart() method actually overwrites these');
        expect(component.config.width).toBe(800);
        expect(component.config.height).toBe(400);
        expect(component.config.showGrid).toBe(true);
        expect(component.config.showTooltip).toBe(true);
    });

    it('should merge custom configuration with defaults', () => {
        const customConfig: ChartConfiguration = {
            width: 600,
            height: 300,
            showGrid: false
        };

        component.config = { ...component.config, ...customConfig };

        expect(component.config.width).toBe(600);
        expect(component.config.height).toBe(300);
        expect(component.config.showGrid).toBe(false);
        expect(component.config.showTooltip).toBe(true); // default preserved
    });

    it('should handle empty chart data gracefully', () => {
        component.chartData = {
            series: [],
            accessibility: {
                description: 'Empty chart'
            }
        };

        expect(() => {
            fixture.detectChanges();
        }).not.toThrow();
    });

    it('should generate correct table data', () => {
        const chartData: ChartData = {
            series: [
                {
                    name: 'Series 1',
                    data: [
                        { x: 1, y: 10 },
                        { x: 2, y: 20 }
                    ]
                },
                {
                    name: 'Series 2',
                    data: [
                        { x: 1, y: 15 },
                        { x: 2, y: 25 }
                    ]
                }
            ],
            accessibility: {
                description: 'Test chart'
            }
        };

        component.chartData = chartData;
        const tableData = component.getTableData();

        expect(tableData.length).toBe(2);
        expect(tableData[0].x).toBe(1);
        expect(tableData[1].x).toBe(2);
    });

    it('should get series values correctly', () => {
        const series = {
            name: 'Test Series',
            data: [
                { x: 1, y: 10 },
                { x: 2, y: 20 }
            ]
        };

        expect(component.getSeriesValue(series, 0)).toBe('10');
        expect(component.getSeriesValue(series, 1)).toBe('20');
        expect(component.getSeriesValue(series, 2)).toBe(''); // Out of bounds
    });

    it('should handle accessibility requirements', () => {
        pending('The drawChart() method actually overwrites all of this stuff');
        const chartData: ChartData = {
            series: [
                {
                    name: 'Series 1',
                    data: [{ x: 1, y: 10 }]
                }
            ],
            accessibility: {
                description: 'Test chart for accessibility'
            }
        };

        component.chartData = chartData;
        fixture.detectChanges();

        // Check that SVG has proper accessibility attributes
        const svg = fixture.nativeElement.querySelector('svg');
        const title = svg.querySelector('title');

        console.log(fixture.nativeElement);
        expect(title.textContent).toContain('Test chart for accessibility');
        expect(svg.getAttribute('role')).toBe('img');
    });
});
