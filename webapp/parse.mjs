import { createIndex } from './dataIndex.mjs';

let trollsPromise;
let inventoryPromise;

async function getRawData() {
    const res=await fetch('data/view.data');
    const lines=(await res.text()).split('\n');
    return lines;
}

function memoize(fn, indexer) {
    const cache = new Map();
    return async function(...args) {
        const key = args.join('-');
        console.log(`Getting data for ${key}`);
        if (cache.has(key))
            return cache.get(key);
        console.log(`Loading data for ${key}`);
        const ret = await fn(...args);
        console.log(`Indexing data for ${key}`, ret);
        const indexed = new WeakSet();
        for (const i of Object.values(ret)) {
            for (const o of i) {
                if (indexed.has(o)) continue;
                indexed.add(o);
                indexer(o);
            }
        }
        cache.set(key, ret);
        return ret;
    };
}

export const index=createIndex();

async function getDataInner(type) {
    if (type=='view')
        return await getViewData();
    if (type=='inventory')
        return { inventory: await getInventoryData() };
    else {
        const lieux=await getRefData(type);
        return { lieux: lieux, raccourcis: lieux.filter(x=>x.type==='raccourcis'), tgv: lieux.filter(x=>x.type==='lieux' && x.typeLieu==='Gares TGV') };
    }
}

export const getData=memoize(getDataInner, index.indexer);

export async function getRefData(type) {
    const url=`data/${type}.csv`;
    console.dir(url);
    const res=await fetch(url);
    const lines=(await res.text()).split('\n');
    console.dir(lines);
    const ret=lines.map(x=>x.split(/(?<!\\);/)).map(x=>{return { id: Number.parseInt(x[0]), name: x[1].replaceAll("\\;",";"), x: Number.parseInt(x[2]), y: Number.parseInt(x[3]), z: Number.parseInt(x[4]), type: x[6]=="raccourci"?"raccourcis":"lieux", typeLieu:x[5] };});
    console.dir(ret);
    return ret;
}

export async function getTrollsData(type) {
    const url=`data/trolls.data`;
    const res=await fetch(url);
    const lines=(await res.text()).split('\n');
    const ret=lines.map(x=>x.split(';')).map(x=>{
        return { 
            id: Number.parseInt(x[0]), 
            name: x[1], 
            race: x[2],
            niveau: Number.parseInt(x[3]), 
            guilde: Number.parseInt(x[6])
    };});
    const dico=ret.reduce((acc, x)=>{acc[x.id]=x; return acc;}, {});
    return dico;
}

export async function getInventoryData() {
    if (!inventoryPromise)
        inventoryPromise = fetch('data/inventory.json').then(response => response.json());
    return await inventoryPromise;
}


export async function getViewData() {
    if (!trollsPromise)
        trollsPromise = getTrollsData();
    const trolls = await trollsPromise;
    const lines=await getRawData();
    const parsedData={};
    let currentSection=null;
    for(const i of lines) {
        if (i.startsWith('#DEBUT')) {
            currentSection=i.slice(7).toLowerCase();
        } else if (i.startsWith('#FIN')) {
            currentSection=null;
        } else if (i.length>0) {
            const section=parsedData[currentSection]??[];
            parsedData[currentSection]=section;
            const d=i.split(';');
            if (d.length==5)
                section.push({ id: Number.parseInt(d[0]), name: d[1], x: Number.parseInt(d[2]), y: Number.parseInt(d[3]), z: Number.parseInt(d[4]), type: currentSection });
            else
                if (currentSection=='trolls')
                    section.push({ id: Number.parseInt(d[0]), name: trolls[Number.parseInt(d[0])]?.name, x: Number.parseInt(d[1]), y: Number.parseInt(d[2]), z: Number.parseInt(d[3]), type: 'troll' });
                else
                    section.push({ id: Number.parseInt(d[0]), x: Number.parseInt(d[1]), y: Number.parseInt(d[2]), z: Number.parseInt(d[3]), type: currentSection });
        }
    }
    return parsedData;
}
