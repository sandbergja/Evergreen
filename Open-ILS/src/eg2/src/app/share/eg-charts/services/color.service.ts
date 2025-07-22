import { Injectable } from '@angular/core';

/**
 * ColorService - Accessible Color Management and Theming
 *
 * This service provides comprehensive color management for all chart types,
 * ensuring accessibility compliance and consistent theming with Evergreen ILS.
 */
@Injectable({
    providedIn: 'root'
})
export class ColorService {

    /**
   * Get the standard Evergreen ILS color palette
   */
    getEvergreenPalette(): string[] {
        return [
            'var(--evergreen)',      // Primary Evergreen brand color
            'var(--primary)',        // Primary blue
            'var(--info)',           // Info blue
            'var(--success)',        // Success green
            'var(--warning)',        // Warning orange
            'var(--danger)',         // Danger red
            'var(--secondary)',      // Secondary gray
            'var(--dark)',           // Dark gray
        ];
    }

    /**
   * Get an accessible color from the palette by index
   */
    getAccessibleColor(index: number): string {
        try {
            const palette = this.getEvergreenPalette();
            const color = palette[index % palette.length];

            // Validate contrast before returning
            const backgroundColor = this.getThemeColors().background;
            if (this.validateContrast(color, backgroundColor)) {
                return color;
            }

            // Return high contrast alternative if validation fails
            return this.getHighContrastColors()[index % this.getHighContrastColors().length];

        } catch {
            return this.handleColorError({
                type: 'invalid',
                message: 'Failed to get accessible color',
                requestedColor: `index ${index}`
            });
        }
    }

    /**
   * Validate color contrast for accessibility
   */
    validateContrast(color1: string, color2: string): boolean {
        try {
            const rgb1 = this.parseColor(color1);
            const rgb2 = this.parseColor(color2);

            if (!rgb1 || !rgb2) {return false;}

            const luminance1 = this.calculateLuminance(rgb1);
            const luminance2 = this.calculateLuminance(rgb2);

            const contrast = (Math.max(luminance1, luminance2) + 0.05) / (Math.min(luminance1, luminance2) + 0.05);

            // WCAG AA standard requires 4.5:1 contrast ratio
            return contrast >= 4.5;

        } catch (error) {
            console.warn('Contrast validation failed:', error);
            return false;
        }
    }

    /**
   * Get current theme colors
   */
    getThemeColors(): ThemeColors {
        return {
            primary: this.getCSSVariable('--primary') || '#007bff',
            secondary: this.getCSSVariable('--secondary') || '#6c757d',
            accent: this.getCSSVariable('--evergreen') || '#28a745',
            background: this.getCSSVariable('--bs-body-bg') || '#ffffff',
            text: this.getCSSVariable('--bs-body-color') || '#212529',
            error: this.getCSSVariable('--danger') || '#dc3545',
            warning: this.getCSSVariable('--warning') || '#ffc107',
            success: this.getCSSVariable('--success') || '#28a745'
        };
    }

    /**
   * Get color-blind friendly palette
   */
    getColorBlindFriendlyPalette(): string[] {
        return [
            '#1f77b4',  // Blue
            '#ff7f0e',  // Orange
            '#2ca02c',  // Green
            '#d62728',  // Red
            '#9467bd',  // Purple
            '#8c564b',  // Brown
            '#e377c2',  // Pink
            '#7f7f7f',  // Gray
            '#bcbd22',  // Olive
            '#17becf'   // Cyan
        ];
    }

    /**
   * Get high contrast colors for accessibility
   */
    getHighContrastColors(): string[] {
        return [
            '#000000',  // Black
            '#ffffff',  // White
            '#ff0000',  // Red
            '#00ff00',  // Green
            '#0000ff',  // Blue
            '#ffff00',  // Yellow
            '#ff00ff',  // Magenta
            '#00ffff'   // Cyan
        ];
    }

    /**
   * Generate a sequence of accessible colors
   */
    generateColorSequence(count: number): string[] {
        const colors: string[] = [];
        const palette = this.getEvergreenPalette();
        const colorBlindPalette = this.getColorBlindFriendlyPalette();

        for (let i = 0; i < count; i++) {
            let color: string;

            if (i < palette.length) {
                color = palette[i];
            } else if (i < palette.length + colorBlindPalette.length) {
                color = colorBlindPalette[i - palette.length];
            } else {
                // Generate additional colors using HSL
                const hue = (i * 137.5) % 360; // Golden angle for even distribution
                color = `hsl(${hue}, 70%, 50%)`;
            }

            // Validate accessibility
            if (this.validateColorAccessibility([color])) {
                colors.push(color);
            } else {
                // Use high contrast fallback
                colors.push(this.getHighContrastColors()[i % this.getHighContrastColors().length]);
            }
        }

        return colors;
    }

    /**
   * Validate accessibility of color array
   */
    validateColorAccessibility(colors: string[]): boolean {
        const backgroundColor = this.getThemeColors().background;

        return colors.every(color => {
            try {
                return this.validateContrast(color, backgroundColor);
            } catch (error) {
                console.warn('Color accessibility validation failed:', error);
                return false;
            }
        });
    }

    /**
   * Handle color errors and provide fallbacks
   */
    handleColorError(error: ColorError): string {
        console.error('Color error:', error);

        // Log error with context
        const errorContext = {
            type: error.type,
            message: error.message,
            requestedColor: error.requestedColor,
            timestamp: new Date().toISOString()
        };

        console.error('Color error context:', errorContext);

        // Provide fallback based on error type
        switch (error.type) {
            case 'invalid':
                return this.getThemeColors().primary;
            case 'contrast':
                return this.getHighContrastColors()[0];
            case 'accessibility':
                return this.getColorBlindFriendlyPalette()[0];
            default:
                return '#000000'; // Safe fallback
        }
    }

    // Private helper methods

    private getCSSVariable(variable: string): string | null {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(variable);
            return value.trim() || null;
        } catch (error) {
            console.warn(`Failed to get CSS variable ${variable}:`, error);
            return null;
        }
    }

    private parseColor(color: string): RGB | null {
        try {
            // Handle CSS variables
            if (color.startsWith('var(')) {
                const variableName = color.slice(4, -1);
                const variableValue = this.getCSSVariable(variableName);
                if (variableValue) {
                    color = variableValue;
                }
            }

            // Create temporary element to compute color
            const div = document.createElement('div');
            div.style.color = color;
            document.body.appendChild(div);

            const computedColor = window.getComputedStyle(div).color;
            document.body.removeChild(div);

            // Parse RGB values
            const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                return {
                    r: parseInt(match[1]),
                    g: parseInt(match[2]),
                    b: parseInt(match[3])
                };
            }

            return null;

        } catch (error) {
            console.warn('Color parsing failed:', error);
            return null;
        }
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

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  error: string;
  warning: string;
  success: string;
}

export interface ColorError {
  type: 'invalid' | 'contrast' | 'accessibility';
  message: string;
  requestedColor: string;
}
