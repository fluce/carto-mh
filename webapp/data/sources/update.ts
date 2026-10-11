import * as cheerio from 'cheerio';
import { getToken } from '../dataWorker.ts';
import { compressTrous } from './trous.ts';
import type { RawLocation, TgvLocation } from '../../shared/types';

const raccourcis=["Croisée des cavernes","Sanctuaire","Campement","Gouffre","Caverne","Grotte","Tombe","Rocher","Lac souterrain"];

export async function update() {
    // load data
    const data = await fetch('/api/locations/raw', { method: 'GET',
        headers: {
            Authorization: `Bearer ${await getToken()}`
        }
    });

    const tgv = await fetch('/api/locations/tgv', { method: 'GET',
        headers: {
            Authorization: `Bearer ${await getToken()}`
        }
    });

    const parsedData = await parseData(data);
    console.log('Parsed data:', parsedData);

    const tgvData = await tgv.json() as TgvLocation[];
    console.log('TGV data:', tgvData);

    const trous = compressTrous(parsedData['Trou de Météorite'] ?? []);
    console.log('Compressed trous:', trous);

    delete parsedData['Trou de Météorite'];
    console.log('Remaining parsed data:', parsedData);

    for (const raccourci of raccourcis) {
        for (const location of parsedData[raccourci] ?? []) {
            location.transportNetwork = `shortcut:${raccourci}`;
        }
    }
    const locations = Object.values(parsedData).flat();

    const index = new Map<string | number, RawLocation>();
    for (const location of locations) {
        if (location.type === "Divers") {
            const raccourciKind = checkNameMatchesRaccourci(location.name);
            if (raccourciKind) {
                location.transportNetwork = `shortcut:${raccourciKind}`;
            }
        }
        index.set(location.id, location);
    }

    for (const item of tgvData ?? []) {
        const location = index.get(item.ID);
        if (location) {
            location.transportNetwork = `tgv`;
            location.transportCost = { cost: item.Prix, ration: item.FacteurPrix }
        } else {
            console.warn(`TGV location with ID ${item.ID} not found in index`);
            locations.push({
                type: 'Divers',
                id: item.ID,
                name: item.Nom,
                x: item.X,
                y: item.Y,
                z: item.Z,
                transportNetwork: `tgv`,
                transportCost: { cost: item.Prix, ration: item.FacteurPrix }
            })
        }
    }
    const resultData = { locations, compressedHoles: trous };

    await fetch('/api/locations', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getToken()}`
        },
        body: JSON.stringify(resultData)
    });
    return resultData;


}

function checkNameMatchesRaccourci(name: string) {
    for (const raccourci of raccourcis) {
        if (name.startsWith(raccourci)) {
            return raccourci;
        }
    }
    return null;
}

async function parseData(htmlResponse: Response): Promise<Record<string, RawLocation[]>> {
    console.log('Parsing HTML data for locations');
    try {
        const data: Record<string, RawLocation[]> = {};
        const html = await htmlResponse.text();
        console.log('HTML response:', html);
        const $ = cheerio.load(html);

        $('#lieux tr').each((i, row) => {
            const cells = $(row).find('td').map((_, cell) => $(cell).text()).get();

            if (cells.length < 4) {
                return;
            }

            const coords = cells[3].substring(1, cells[3].length - 1).
                split(',').map(x => Number.parseInt(x));
            const location: RawLocation = {
                type: cells[0],
                id: cells[1],
                name: cells[2],
                x: coords[0],
                y: coords[1],
                z: coords[2],
                lastUpdate: cells[4]
            };
            data[location.type] = data[location.type] ?? [];
            data[location.type].push(location);
        });
        console.log("Parsed : ", data);
        return data;
    } catch (error) {
        console.error('Failed to parse HTML data for locations', error);
        throw error;
    }   
}

