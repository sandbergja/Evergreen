/* eslint-disable no-magic-numbers */
import { Injectable } from '@angular/core';
import * as d3 from 'd3';

export interface PatternDefinition {
    id: string;
    name: string;
    description: string;
    generator: (
        defs: d3.Selection<SVGDefsElement, unknown, null, undefined>, color: string,
        patternId: string, service: PatternService
        ) => void;
}

/**
 * PatternService - Clean, Professional Accessibility Patterns
 *
 * Redesigned to create subtle, professional patterns that enhance accessibility
 * without overwhelming the visual design.
 */
@Injectable({
    providedIn: 'root'
})
export class PatternService {

    private patterns: PatternDefinition[] = [
        {
            id: 'solid',
            name: 'Solid',
            description: 'Solid color fill (no pattern)',
            generator: () => {} // No pattern needed for solid
        },
        {
            id: 'subtle-lines',
            name: 'Subtle Lines',
            description: 'Very subtle diagonal lines for minimal visual impact',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 12)
                    .attr('height', 12);

                pattern.append('rect')
                    .attr('width', 12)
                    .attr('height', 12)
                    .attr('fill', color);

                // Very thin, subtle diagonal lines with low opacity
                pattern.append('path')
                    .attr('d', 'M-3,3 l6,-6 M0,12 l12,-12 M9,15 l6,-6')
                    .attr('stroke', service.getSubtleContrastColor(color))
                    .attr('stroke-width', 0.8)
                    .attr('stroke-opacity', 0.25)
                    .attr('stroke-linecap', 'round');
            }
        },
        {
            id: 'fine-dots',
            name: 'Fine Dots',
            description: 'Small, evenly spaced dots for subtle texture',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 10)
                    .attr('height', 10);

                pattern.append('rect')
                    .attr('width', 10)
                    .attr('height', 10)
                    .attr('fill', color);

                // Small, subtle dots
                pattern.append('circle')
                    .attr('cx', 5)
                    .attr('cy', 5)
                    .attr('r', 1)
                    .attr('fill', service.getSubtleContrastColor(color))
                    .attr('fill-opacity', 0.3);
            }
        },
        {
            id: 'cross-hatch',
            name: 'Cross Hatch',
            description: 'Refined crosshatch pattern for higher contrast needs',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 14)
                    .attr('height', 14);

                pattern.append('rect')
                    .attr('width', 14)
                    .attr('height', 14)
                    .attr('fill', color);

                const contrastColor = service.getSubtleContrastColor(color);

                // Diagonal lines (more spaced out, thinner)
                pattern.append('path')
                    .attr('d', 'M-2,2 l4,-4 M0,14 l14,-14 M12,16 l4,-4')
                    .attr('stroke', contrastColor)
                    .attr('stroke-width', 0.6)
                    .attr('stroke-opacity', 0.3)
                    .attr('stroke-linecap', 'round');

                // Counter-diagonal lines
                pattern.append('path')
                    .attr('d', 'M-2,12 l4,4 M0,0 l14,14 M12,-2 l4,4')
                    .attr('stroke', contrastColor)
                    .attr('stroke-width', 0.6)
                    .attr('stroke-opacity', 0.3)
                    .attr('stroke-linecap', 'round');
            }
        },
        {
            id: 'vertical-stripes',
            name: 'Vertical Stripes',
            description: 'Clean vertical stripes with good spacing',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 8)
                    .attr('height', 8);

                pattern.append('rect')
                    .attr('width', 8)
                    .attr('height', 8)
                    .attr('fill', color);

                // Single centered vertical line
                pattern.append('rect')
                    .attr('x', 3.5)
                    .attr('y', 0)
                    .attr('width', 1)
                    .attr('height', 8)
                    .attr('fill', service.getSubtleContrastColor(color))
                    .attr('fill-opacity', 0.35);
            }
        },
        {
            id: 'horizontal-stripes',
            name: 'Horizontal Stripes',
            description: 'Clean horizontal stripes with good spacing',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 8)
                    .attr('height', 8);

                pattern.append('rect')
                    .attr('width', 8)
                    .attr('height', 8)
                    .attr('fill', color);

                // Single centered horizontal line
                pattern.append('rect')
                    .attr('x', 0)
                    .attr('y', 3.5)
                    .attr('width', 8)
                    .attr('height', 1)
                    .attr('fill', service.getSubtleContrastColor(color))
                    .attr('fill-opacity', 0.35);
            }
        },
        {
            id: 'diamond-grid',
            name: 'Diamond Grid',
            description: 'Subtle diamond/grid pattern for unique identification',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 12)
                    .attr('height', 12);

                pattern.append('rect')
                    .attr('width', 12)
                    .attr('height', 12)
                    .attr('fill', color);

                // Small diamond shape in center
                pattern.append('path')
                    .attr('d', 'M6,2 L10,6 L6,10 L2,6 Z')
                    .attr('fill', 'none')
                    .attr('stroke', service.getSubtleContrastColor(color))
                    .attr('stroke-width', 0.8)
                    .attr('stroke-opacity', 0.25);
            }
        },
        {
            id: 'scattered-dots',
            name: 'Scattered Dots',
            description: 'Irregularly placed dots for organic texture',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 16)
                    .attr('height', 16);

                pattern.append('rect')
                    .attr('width', 16)
                    .attr('height', 16)
                    .attr('fill', color);

                const contrastColor = service.getSubtleContrastColor(color);

                // Scattered small dots at different positions
                const dotPositions = [
                    {x: 3, y: 4}, {x: 9, y: 2}, {x: 13, y: 7},
                    {x: 6, y: 10}, {x: 11, y: 13}, {x: 2, y: 12}
                ];

                dotPositions.forEach(pos => {
                    pattern.append('circle')
                        .attr('cx', pos.x)
                        .attr('cy', pos.y)
                        .attr('r', 0.8)
                        .attr('fill', contrastColor)
                        .attr('fill-opacity', 0.25);
                });
            }
        },
        {
            id: 'wave-lines',
            name: 'Wave Lines',
            description: 'Gentle wave pattern for smooth differentiation',
            generator: (defs, color, patternId, service) => {
                const pattern = defs.append('pattern')
                    .attr('id', patternId)
                    .attr('patternUnits', 'userSpaceOnUse')
                    .attr('width', 16)
                    .attr('height', 8);

                pattern.append('rect')
                    .attr('width', 16)
                    .attr('height', 8)
                    .attr('fill', color);

                // Smooth sine wave
                pattern.append('path')
                    .attr('d', 'M0,4 Q4,1 8,4 T16,4')
                    .attr('stroke', service.getSubtleContrastColor(color))
                    .attr('stroke-width', 0.8)
                    .attr('fill', 'none')
                    .attr('stroke-opacity', 0.3)
                    .attr('stroke-linecap', 'round');
            }
        }
    ];

    /**
     * Generate all pattern definitions in the provided SVG defs element
     */
    generatePatternDefinitions(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>, colors: string[], chartId?: string): void {
        const uniqueChartId = chartId || `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        colors.forEach((color, colorIndex) => {
            this.patterns.forEach((patternDef) => {
                if (patternDef.id === 'solid') {return;}

                const patternId = `pattern-${uniqueChartId}-${colorIndex}-${patternDef.id}`;
                patternDef.generator(defs, color, patternId, this);
            });
        });
    }

    /**
     * Get pattern ID for a specific data series/slice
     */
    getPatternId(seriesIndex: number, patternType?: string, chartId?: string): string {
        if (!patternType || patternType === 'solid') {
            return '';
        }

        if (!patternType) {
            const availablePatterns = this.patterns.filter(p => p.id !== 'solid');
            const patternIndex = seriesIndex % availablePatterns.length;
            patternType = availablePatterns[patternIndex].id;
        }

        if (chartId) {
            return `pattern-${chartId}-${seriesIndex}-${patternType}`;
        }
        return `pattern-${seriesIndex}-${patternType}`;
    }

    /**
     * Get consistent pattern for series index - now uses subtle patterns
     */
    getPatternForIndex(index: number): string {
        const patternOrder = [
            'subtle-lines',     // Most common and subtle
            'fine-dots',        // Second most common
            'vertical-stripes', // Clear differentiation
            'horizontal-stripes', // Clear differentiation
            'cross-hatch',      // Higher contrast when needed
            'diamond-grid',     // Unique pattern
            'scattered-dots',   // Organic feel
            'wave-lines'        // Smooth alternative
        ];

        return patternOrder[index % patternOrder.length];
    }

    /**
     * Get all available pattern types
     */
    getAvailablePatterns(): PatternDefinition[] {
        return [...this.patterns];
    }

    /**
     * Get pattern by ID
     */
    getPatternById(id: string): PatternDefinition | undefined {
        return this.patterns.find(p => p.id === id);
    }

    /**
     * Calculate a subtle contrast color that won't overwhelm the base color
     * This is key to making patterns look professional
     */
    getSubtleContrastColor(backgroundColor: string): string {
        const rgb = d3.rgb(backgroundColor);

        // Calculate relative luminance
        const r = this.getLinearRGB(rgb.r / 255);
        const g = this.getLinearRGB(rgb.g / 255);
        const b = this.getLinearRGB(rgb.b / 255);

        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // For light colors, use a darker but not too dark contrast
        // For dark colors, use a lighter but not too light contrast
        if (luminance > 0.5) {
            // Light background - use darker pattern but not black
            const darkerRgb = d3.rgb(backgroundColor).darker(1.5);
            return darkerRgb.formatHex();
        } else {
            // Dark background - use lighter pattern but not white
            const lighterRgb = d3.rgb(backgroundColor).brighter(1.5);
            return lighterRgb.formatHex();
        }
    }

    /**
     * Original contrast color method - kept for high contrast needs
     */
    getContrastColor(backgroundColor: string): string {
        const rgb = d3.rgb(backgroundColor);

        const r = this.getLinearRGB(rgb.r / 255);
        const g = this.getLinearRGB(rgb.g / 255);
        const b = this.getLinearRGB(rgb.b / 255);

        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    /**
     * Convert sRGB to linear RGB for luminance calculation
     */
    private getLinearRGB(value: number): number {
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }

    /**
     * Get pattern fill URL for use in SVG fill attribute
     */
    getPatternFillUrl(seriesIndex: number, patternType?: string, chartId?: string): string {
        const patternId = this.getPatternId(seriesIndex, patternType, chartId);
        return patternId ? `url(#${patternId})` : '';
    }

    /**
     * Create a subtle border color that works with any background
     */
    createSubtleBorder(baseColor: string): string {
        try {
            const rgb = d3.rgb(baseColor);

            // Calculate luminance to determine if color is light or dark
            const r = this.getLinearRGB(rgb.r / 255);
            const g = this.getLinearRGB(rgb.g / 255);
            const b = this.getLinearRGB(rgb.b / 255);
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            // For very light colors, darken slightly
            // For very dark colors, lighten slightly
            // For medium colors, darken just a bit
            if (luminance > 0.8) {
                // Very light - darken moderately
                return d3.rgb(baseColor).darker(0.8).formatHex();
            } else if (luminance < 0.2) {
                // Very dark - lighten moderately
                return d3.rgb(baseColor).brighter(0.8).formatHex();
            } else {
                // Medium brightness - darken just slightly
                return d3.rgb(baseColor).darker(0.4).formatHex();
            }
        } catch (error) {
            console.warn('Failed to create border color for:', baseColor, error);
            // Fallback to a neutral border that works on most backgrounds
            return 'rgba(0, 0, 0, 0.15)';
        }
    }


    /**
     * Enable high contrast mode patterns for users who need stronger differentiation
     */
    enableHighContrastPatterns(): void {
        // Override pattern definitions with high contrast versions
        this.patterns = this.patterns.map(pattern => {
            if (pattern.id === 'solid') {return pattern;}

            return {
                ...pattern,
                generator: (defs, color, patternId, service) => {
                    // Regenerate with higher contrast settings
                    const originalGenerator = pattern.generator;
                    originalGenerator(defs, color, patternId, service);

                    // Modify the generated pattern to increase contrast
                    const patternElement = defs.select(`#${patternId}`);
                    patternElement.selectAll('path, rect, circle')
                        .attr('stroke-opacity', 0.7)
                        .attr('fill-opacity', 0.7)
                        .attr('stroke-width', function() {
                            const current = d3.select(this).attr('stroke-width');
                            return current ? (+current * 1.5).toString() : '1.5';
                        });
                }
            };
        });
    }
}
