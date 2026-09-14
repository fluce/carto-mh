// merge each object in args into ret, concatenating each property value together
export function merge(...args) {
    var ret = {};
    for (var i of args) {
        for (var j of Object.keys(i)) {
            ret[j] = ret[j] ?? [];
            ret[j] = ret[j].concat(i[j]);
        }
    }
    return ret;
}

export const decoder = new TextDecoder("iso-8859-1");
export const utf8decoder = new TextDecoder("utf-8");
export async function fetchAndDecode(url, decoderToUse=decoder) {
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    return decoderToUse.decode(data);
}

