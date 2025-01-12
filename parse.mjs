import { fetchAndDecode } from './utils.mjs';
import _ from 'lodash';

const trolls=await getTrollsData();

async function getRawData() {
    const res=await fetch('/view.data');
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
        for (var i of Object.values(ret)) 
            for (var o of i) 
                indexer(o);
        cache.set(key, ret);
        return ret;
    };
}

function createIndex() {
    const index = {};
    const geoIndex = {};

    const calcId=(i)=>i.type=='lieux'?i:`${i.type}-${i.id}`;

    const indexer=function(i) {
        const entry=geoIndex[`x${i.x}y${i.y}z${i.z}`] ??= [];
        const id=calcId(i.id);
        const existing=index[id];
        if (existing) {
            i=_.merge(existing, i);            
            entry.splice(entry.indexOf(existing),1);            
        } 
        index[id]=i;
        entry.push(i);            
    }

    const get=function(...args) {
        if (args.length==1) {
            if (typeof args[0]=='object') {
                const [d] = args;
                const idx=`x${d.x}y${d.y}z${d.z}`;
                return geoIndex[idx]??[];
            } else {
                const [id] = args;
                return index[id];
            }
        }
        const [x, y, z] = args;
        const idx=`x${x}y${y}z${z}`;
        return geoIndex[idx]??[];
    }

    return { indexer, get, calcId };
}

export const index=createIndex();

async function getDataInner(type) {
    if (type=='view')
        return await getViewData();
    else {
        const lieux=await getRefData(type);
        return { lieux: lieux, raccourcis: lieux.filter(x=>x.type==='raccourcis') };
    }
}

export const getData=memoize(getDataInner, index.indexer);

export async function getRefData(type) {
    const url=`/${type}.csv`;
    console.dir(url);
    const res=await fetch(url);
    const lines=(await res.text()).split('\n');
    //console.dir(lines);
    const ret=lines.map(x=>x.split(/(?<!\\);/)).map(x=>{return { id: parseInt(x[0]), name: x[1].replaceAll("\\;",";"), x: parseInt(x[2]), y: parseInt(x[3]), z: parseInt(x[4]), type: x[6]=="raccourci"?"raccourcis":"lieux", typeLieu:x[5] };});
    console.dir(ret);
    return ret;
}

export async function getTrollsData(type) {
    const url=`/trolls.data`;
    const res=await fetch(url);
    const lines=(await res.text()).split('\n');
    const ret=lines.map(x=>x.split(';')).map(x=>{
        return { 
            id: parseInt(x[0]), 
            name: x[1], 
            race: x[2],
            niveau: parseInt(x[3]), 
            guilde: parseInt(x[6])
    };});
    const dico=ret.reduce((acc, x)=>{acc[x.id]=x; return acc;}, {});
    return dico;
}


export async function getViewData() {
    const lines=await getRawData();
    var parsedData={};
    var currentSection=null;
    for(var i of lines) {
        if (i.startsWith('#DEBUT')) {
            currentSection=i.slice(7).toLowerCase();
        } else if (i.startsWith('#FIN')) {
            currentSection=null;
        } else if (i.length>0) {
            const section=parsedData[currentSection]??[];
            parsedData[currentSection]=section;
            const d=i.split(';');
            if (d.length==5)
                section.push({ id: parseInt(d[0]), name: d[1], x: parseInt(d[2]), y: parseInt(d[3]), z: parseInt(d[4]), type: currentSection });
            else
                if (currentSection=='trolls')
                    section.push({ id: parseInt(d[0]), name: trolls[parseInt(d[0])]?.name, x: parseInt(d[1]), y: parseInt(d[2]), z: parseInt(d[3]), type: 'troll' });
                else
                    section.push({ id: parseInt(d[0]), x: parseInt(d[1]), y: parseInt(d[2]), z: parseInt(d[3]), type: currentSection });
        }
    }
    return parsedData;
}
