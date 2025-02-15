import { Component, ElementRef, Input, signal, ViewChild } from '@angular/core';

import { Params, RouterModule } from '@angular/router';

const HALF_SECOND = 500;

@Component({
    selector: 'eg-show-more',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './show-more.component.html',
    styles: ':host { display: flex; }'
})
export class ShowMoreComponent {
    @Input() text = '';
    @Input() characterLimit: number;
    // if href provided, use it to create a link when displayLink is true
    @Input() displayLink = true;
    @Input() routerLink: string | any[];
    @Input() queryParams: Params;

    @ViewChild('collapsedText') collapsedText!: ElementRef;
    @ViewChild('expandedText') expandedText!: ElementRef;

    protected collapsed = signal(true);

    protected get truncatedText(): string {
        if (this.shouldTruncate) {
            const truncationPoint = this.text.lastIndexOf(' ', this.characterLimit);
            if (truncationPoint < 1) {
                return this.text;
            }
            return this.text.slice(0, truncationPoint) + '…';
        }
        return this.text;
    }

    protected get shouldTruncate(): boolean {
        if (!this.characterLimit) {
            return false;
        }
        if (this.text.length < this.characterLimit) {
            return false;
        }
        return true;
    }

    protected expand(): void {
        this.collapsed.set(false);
        this.setFocus();
    }

    protected collapse(): void {
        this.collapsed.set(true);
    }

    protected setFocus(): void {
        // A brief pause for the screen reader's virtual buffer
        // to read the new DOM element into memory, then set focus
        // to inform the screen reader user of the newly expanded
        // content.
        setTimeout(() => {
            const elementToFocus = (this.collapsedText || this.expandedText)?.nativeElement;
            elementToFocus?.focus({ preventScroll: true });
        }, HALF_SECOND);
    }
}
