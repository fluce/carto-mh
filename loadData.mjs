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

    data.groups= {
        trolls: { items: data.trolls ?? [], color: 0x0000ff },
        monstres: { items: data.monstres ?? [], color: 0xff0000 },
        tresors: { items: data.tresors ?? [], color: 0xffff00 },
        ...Object.fromEntries(
            Object.entries(Object.groupBy(data.lieux ?? [], x => x.typeLieu))
                .map(([k,v]) => [k,{items:v, autocolor: true}])
        )
    };
        
    return data;
}
