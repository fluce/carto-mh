import * as _ from 'lodash';
import { getData } from './parse.mjs';
import { merge } from './utils.mjs';

export async function loadData(viewException, ...layers) {
    return merge(
        ...[
            viewException ? _.omit(await getData("view"), viewException) : [],
            ...await Promise.all(layers.map(x => getData(x)))
        ]
    );
}
