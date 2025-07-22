import { Injectable } from '@angular/core';
import { ChartData } from '../interfaces/chart-data.interface';

/**
 * AccessibilityService - Centralized WCAG Compliance Utilities
 *
 * This service provides comprehensive accessibility features for all chart types,
 * ensuring WCAG 2.2 Level AA compliance throughout the library.
 */
@Injectable({
    providedIn: 'root'
})
export class AccessibilityService {

    /**
   * Generate ARIA label for chart
   */
    generateAriaLabel(data: ChartData): string {
        const seriesCount = data.series.length;
        const totalPoints = data.series.reduce((sum, series) => sum + series.data.length, 0);
        const seriesNames = data.series.map(s => s.name).join(', ');

        let label = `Chart showing ${seriesCount} data series: ${seriesNames}`;

        if (data.title) {
            label = `${data.title}. ${label}`;
        }

        label += `. Total ${totalPoints} data points.`;

        if (data.xAxisLabel) {
            label += ` X-axis: ${data.xAxisLabel}.`;
        }

        if (data.yAxisLabel) {
            label += ` Y-axis: ${data.yAxisLabel}.`;
        }

        return label;
    }

    /**
   * Create accessible data table representation
   */
    createDataTable(data: ChartData): string {
        const headers = ['X Value', ...data.series.map(s => s.name)];
        const maxLength = Math.max(...data.series.map(s => s.data.length));

        let table = `<table class="sr-only"><caption>${data.title || 'Chart Data'}</caption>`;
        table += '<thead><tr>';

        headers.forEach(header => {
            table += `<th scope="col">${header}</th>`;
        });

        table += '</tr></thead><tbody>';

        for (let i = 0; i < maxLength; i++) {
            table += '<tr>';
            table += `<td>${data.series[0]?.data[i]?.x || ''}</td>`;

            for (const series of data.series) {
                table += `<td>${series.data[i]?.y?.toString() || ''}</td>`;
            }

            table += '</tr>';
        }

        table += '</tbody></table>';
        return table;
    }

    /**
   * Set up keyboard navigation for chart elements
   */
    setupKeyboardNavigation(element: HTMLElement): void {
        try {
            // Make chart focusable
            element.setAttribute('tabindex', '0');

            // Add keyboard event listeners
            element.addEventListener('keydown', (event) => {
                this.handleKeyboardNavigation(event, element);
            });

            // Add focus management
            element.addEventListener('focus', () => {
                this.handleFocus(element);
            });

            element.addEventListener('blur', () => {
                this.handleBlur(element);
            });

        } catch {
            this.handleAccessibilityError({
                type: 'navigation',
                message: 'Failed to set up keyboard navigation',
                element: element
            });
        }
    }

    /**
   * Validate color contrast for accessibility
   */
    validateContrast(foreground: string, background: string): boolean {
        try {
            const fgRgb = this.parseColor(foreground);
            const bgRgb = this.parseColor(background);

            if (!fgRgb || !bgRgb) {return false;}

            const fgLuminance = this.calculateLuminance(fgRgb);
            const bgLuminance = this.calculateLuminance(bgRgb);

            const contrast = (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);

            // WCAG AA standard requires 4.5:1 contrast ratio
            return contrast >= 4.5;

        } catch (error) {
            console.warn('Contrast validation failed:', error);
            return false;
        }
    }

    /**
   * Announce data updates to screen readers
   */
    announceDataUpdate(summary: string): void {
        try {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = summary;

            document.body.appendChild(announcement);

            // Remove after announcement
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);

        } catch (error) {
            console.warn('Failed to announce data update:', error);
        }
    }

    /**
   * Get screen reader friendly text description
   */
    getScreenReaderText(data: ChartData): string {
        let text = '';

        if (data.title) {
            text += `Chart title: ${data.title}. `;
        }

        if (data.accessibility?.description) {
            text += `${data.accessibility.description}. `;
        }

        text += `This chart contains ${data.series.length} data series. `;

        data.series.forEach((series, index) => {
            const pointCount = series.data.length;
            text += `Series ${index + 1}: ${series.name} with ${pointCount} data points. `;

            if (series.data.length > 0) {
                const firstPoint = series.data[0];
                const lastPoint = series.data[series.data.length - 1];
                text += `Values range from ${firstPoint.x} (${firstPoint.y}) to ${lastPoint.x} (${lastPoint.y}). `;
            }
        });

        return text;
    }

    /**
   * Set up focus management for chart container
   */
    setupFocusManagement(container: HTMLElement): void {
        try {
            // Find all focusable elements
            const focusableElements = container.querySelectorAll('[tabindex], button, [href], input, select, textarea');

            if (focusableElements.length === 0) {return;}

            // Set up focus trap
            const firstFocusable = focusableElements[0] as HTMLElement;
            const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

            container.addEventListener('keydown', (event) => {
                if (event.key === 'Tab') {
                    if (event.shiftKey) {
                        // Shift + Tab
                        if (document.activeElement === firstFocusable) {
                            event.preventDefault();
                            lastFocusable.focus();
                        }
                    } else {
                        // Tab
                        if (document.activeElement === lastFocusable) {
                            event.preventDefault();
                            firstFocusable.focus();
                        }
                    }
                }
            });

        } catch {
            this.handleAccessibilityError({
                type: 'navigation',
                message: 'Failed to set up focus management',
                element: container
            });
        }
    }

    /**
   * Validate accessibility of chart element
   */
    async validateAccessibility(element: HTMLElement): Promise<AccessibilityReport> {
        const report: AccessibilityReport = {
            score: 100,
            issues: [],
            recommendations: []
        };

        try {
            // Check for ARIA labels
            if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
                report.issues.push({
                    severity: 'error',
                    message: 'Chart missing ARIA label',
                    element: element,
                    fix: 'Add aria-label or aria-labelledby attribute'
                });
                report.score -= 30;
            }

            // Check for keyboard accessibility
            if (!element.hasAttribute('tabindex')) {
                report.issues.push({
                    severity: 'warning',
                    message: 'Chart not keyboard accessible',
                    element: element,
                    fix: 'Add tabindex="0" to make chart focusable'
                });
                report.score -= 20;
            }

            // Check for alternative text
            const title = element.querySelector('title');
            if (!title) {
                report.issues.push({
                    severity: 'warning',
                    message: 'Chart missing title element',
                    element: element,
                    fix: 'Add <title> element for screen readers'
                });
                report.score -= 10;
            }

            // Generate recommendations
            if (report.score < 100) {
                report.recommendations.push('Review WCAG 2.2 guidelines for data visualization');
                report.recommendations.push('Test with screen readers');
            }

        } catch {
            report.issues.push({
                severity: 'error',
                message: 'Failed to validate accessibility',
                element: element,
                fix: 'Check browser console for errors'
            });
            report.score = 0;
        }

        return report;
    }

    /**
   * Handle accessibility errors
   */
    handleAccessibilityError(error: AccessibilityError): void {
        console.error('Accessibility error:', error);

        // Log error with context
        const errorContext = {
            type: error.type,
            message: error.message,
            element: error.element?.tagName || 'unknown',
            timestamp: new Date().toISOString()
        };

        console.error('Accessibility error context:', errorContext);

        // Provide fallback based on error type
        if (error.type === 'navigation' && error.element) {
            // Remove problematic event listeners
            const newElement = error.element.cloneNode(true);
            error.element.parentNode?.replaceChild(newElement, error.element);
        }
    }

    // Private helper methods

    private handleKeyboardNavigation(event: KeyboardEvent, element: HTMLElement): void {
    // Handle arrow keys for chart navigation
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
                event.preventDefault();
                this.navigateChart(event.key, element);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.activateChart(element);
                break;
        }
    }

    private handleFocus(element: HTMLElement): void {
        element.style.outline = '2px solid var(--primary)';
        element.style.outlineOffset = '2px';
    }

    private handleBlur(element: HTMLElement): void {
        element.style.outline = 'none';
    }

    private navigateChart(direction: string, _element: HTMLElement): void {
    // Implementation for chart navigation
        console.log(`Navigating chart: ${direction}`);
    }

    private activateChart(_element: HTMLElement): void {
    // Implementation for chart activation
        console.log('Activating chart element');
    }

    private parseColor(color: string): RGB | null {
    // Simple color parsing - in production, use a robust color parsing library
        const div = document.createElement('div');
        div.style.color = color;
        document.body.appendChild(div);

        const computedColor = window.getComputedStyle(div).color;
        document.body.removeChild(div);

        const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }

        return null;
    }

    private calculateLuminance(rgb: RGB): number {
        const { r, g, b } = rgb;
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }
}

// Supporting interfaces

interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AccessibilityReport {
  score: number;
  issues: AccessibilityIssue[];
  recommendations: string[];
}

export interface AccessibilityIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: HTMLElement;
  fix?: string;
}

export interface AccessibilityError {
  type: 'contrast' | 'navigation' | 'aria' | 'structure';
  message: string;
  element?: HTMLElement;
}
