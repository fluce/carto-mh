import { getToken } from '../dataWorker.ts';
import { updateIndex } from '../index/index.ts';
import type { SourceItem } from '../../shared/types';

async function load() {
    const res=await fetch('/api/view', { method: 'GET', headers: {
        "Authorization": `Bearer ${await getToken()}`
    } });
    const lines=(await res.text()).split('\n');
    return lines;
}

export async function loadViewData() {
    const lines=await load();
    const parsedData: Record<string, SourceItem[]> = {};
    let currentSection: string | null = null;
    for(const i of lines) {
        if (i.startsWith('#DEBUT')) {
            currentSection=i.slice(7).toLowerCase();
        } else if (i.startsWith('#FIN')) {
            currentSection=null;
        } else if (i.length>0) {
            const sectionName = currentSection ?? 'null';
            const section=parsedData[sectionName]??[];
            parsedData[sectionName]=section;
            const d=i.split(';');
            if (d.length==5)
                section.push({ id: Number.parseInt(d[0]).toString(), name: d[1], x: Number.parseInt(d[2]), y: Number.parseInt(d[3]), z: Number.parseInt(d[4]), type: sectionName });
            else
                if (currentSection=='trolls')
                    section.push({ id: `troll:${Number.parseInt(d[0])}`, /*name: trolls[Number.parseInt(d[0])]?.name,*/ x: Number.parseInt(d[1]), y: Number.parseInt(d[2]), z: Number.parseInt(d[3]), type: 'trolls' });
                else
                    section.push({ id: Number.parseInt(d[0]).toString(), x: Number.parseInt(d[1]), y: Number.parseInt(d[2]), z: Number.parseInt(d[3]), type: sectionName });
        }
    }
    await updateIndex('view:origine', parsedData.origine ?? []);
    await updateIndex('view:trolls', parsedData.trolls ?? []);
    await updateIndex('view:monstres', parsedData.monstres ?? []);
    await updateIndex('view:tresors', parsedData.tresors ?? []);
}
