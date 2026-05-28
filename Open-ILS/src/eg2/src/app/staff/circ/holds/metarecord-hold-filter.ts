import { Pipe, PipeTransform } from '@angular/core';
import { IdlObject } from '@eg/core/idl.service';

export class MetarecordHoldFilter {
    readonly name: string;
    private readonly values: IdlObject[];

    constructor(name: string, values: IdlObject[]) {
        this.name = name;
        this.values = values;
    }

    /**
     * A key-value list suitable for use in an HTML <select>
     */
    options(): Record<string, string> {
        return this.values
            .reduce((acc: Record<string, string>, value: IdlObject) => {
                acc[value.code()] = value.value();
                return acc;
            }, {});
    }
}
@Pipe({name: 'metarecordHoldFilterLabel'})
export class MetarecordHoldFilterLabelPipe implements PipeTransform{
    transform(value: MetarecordHoldFilter): string {
        switch (value.name) {
            case 'langs':
                return $localize`Languages`;
            case 'formats':
                return $localize`Formats`;
        }
    }

}
