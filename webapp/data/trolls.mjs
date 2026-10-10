
import { getToken } from '../dataWorker.mjs';
import { updateIndex } from './index.mjs';

async function load() {
    const response = await fetch('/api/trolls', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
        }
    });
    return await response.text();
}

export async function loadTrolls() {
    const data = await load();
    const trolls = parse(data);
    updateIndex("troll",trolls)
    console.log("Loaded trolls data:", trolls);
}

function parse(data)
{
    return data.split("\n").map(parseLine);
}

function parseLine(line)
{
    const items=line.split(";");
    return {
        id: items[0],
        name: items[1],
        race: items[2],
        level: items[3]
    };
}
