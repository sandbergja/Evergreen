import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '@eg/core/auth.service';
import { IdlObject } from '@eg/core/idl.service';
import { NetService } from '@eg/core/net.service';
import { PcrudService } from '@eg/core/pcrud.service';
import { GridDataSource } from '@eg/share/grid/grid';
import { GridComponent } from '@eg/share/grid/grid.component';
import { GridModule } from '@eg/share/grid/grid.module';
import { Pager } from '@eg/share/util/pager';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'eg-review-spam',
    standalone: true,
    imports: [GridModule],
    templateUrl: './review-spam.component.html'
})
export class ReviewSpamComponent implements OnInit {
    private auth = inject(AuthService);
    private net = inject(NetService);
    private pcrud = inject(PcrudService);

    dataSource: GridDataSource = new GridDataSource();
    @ViewChild('grid') grid: GridComponent;

    notSpam = (rows: IdlObject[]) => {
        const request$ = rows.map(row => {
            return this.net.request(
                'open-ils.actor',
                'open-ils.actor.user.stage.mark_as_not_spam',
                this.auth.token(),
                row.row_id()
            );
        });
        forkJoin(request$).subscribe({
            complete: () => this.grid.reload()
        });
    };

    ngOnInit() {
        this.dataSource.getRows = (pager: Pager, sort: any) => {
            const orderBy: any = {sstgu: 'row_date DESC'};
            if (sort.length) {
                orderBy.sstgu = `${sort[0].name} ${sort[0].dir}`;
            }

            return this.pcrud.search('sstgu', {row_id: {'>': 0}}, {
                offset: pager.offset,
                limit: pager.limit,
                order_by: orderBy
            });
        };
    }
}
