import {Component, OnDestroy} from '@angular/core';
import {Router, ActivatedRoute} from '@angular/router';
import {SckoService} from './scko.service';
import { CommonModule } from '@angular/common';

@Component({
    templateUrl: 'checkout.component.html',
    imports: [CommonModule]
})

export class SckoCheckoutComponent implements OnDestroy {

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        public  scko: SckoService
    ) {}

    ngOnDestroy() {
        // Removew checkout errors when navigating away.
        this.scko.statusDisplayText = '';
    }

    printList() {
        this.scko.printReceipt();
    }
}

