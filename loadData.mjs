import * as _ from 'lodash';
import { getData } from './parse.mjs';
import { merge } from './utils.mjs';

export async function loadData(viewException, ...layers) {
    const data=merge(
        ...[
            viewException ? _.omit(await getData("view"), viewException) : [],
            ...await Promise.all(layers.map(x => getData(x)))
        ]
    );

    data.groups=
        Object.fromEntries(
            Object.entries(Object.groupBy(data.lieux ?? [], x => x.typeLieu))
                .map(([k,v]) => [k,{items:v}])
        );
        
    return data;
}
