import {Component} from '@angular/core';
import {Router, ActivatedRoute, ParamMap} from '@angular/router';
import { StaffCommonModule } from '@eg/staff/common.module';
import {NgbNavChangeEvent} from '@ng-bootstrap/ng-bootstrap';

@Component({
    templateUrl: 'display-attrs.component.html',
    imports: [StaffCommonModule]
})
export class DisplayAttrsComponent {

    attrType: string;

    constructor(
        private router: Router,
        private route: ActivatedRoute) {

        this.route.paramMap.subscribe((params: ParamMap) => {
            this.attrType = params.get('atype');
        });
    }

    // Changing a tab in the UI means changing the route.
    // Changing the route ultimately results in changing the tab.
    onNavChange(evt: NgbNavChangeEvent) {
        this.attrType = evt.nextId;

        // prevent tab changing until after route navigation
        evt.preventDefault();

        const url =
          `/staff/cat/vandelay/display_attrs/${this.attrType}`;

        this.router.navigate([url]);
    }
}

