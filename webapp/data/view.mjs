import { getToken } from '../dataWorker.mjs';
import { updateIndex } from './index.mjs';

async function load() {
    const res=await fetch('api/view', { method: 'GET', headers: {
        "Authorization": `Bearer ${getToken()}`
    } });
    const lines=(await res.text()).split('\n');
    return lines;
}

export async function loadViewData() {
    const lines=await load();
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
                    section.push({ id: Number.parseInt(d[0]), /*name: trolls[Number.parseInt(d[0])]?.name,*/ x: Number.parseInt(d[1]), y: Number.parseInt(d[2]), z: Number.parseInt(d[3]), type: 'trolls' });
                else
                    section.push({ id: Number.parseInt(d[0]), x: Number.parseInt(d[1]), y: Number.parseInt(d[2]), z: Number.parseInt(d[3]), type: currentSection });
        }
    }
    await updateIndex('view:origine', parsedData.origine);
    await updateIndex('view:trolls', parsedData.trolls);
    await updateIndex('view:monstres', parsedData.monstres);
    await updateIndex('view:tresors', parsedData.tresors);
}
