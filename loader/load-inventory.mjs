import fs from 'node:fs/promises';
import fss from 'node:fs';

import { id, secret, targetDir } from './config.mjs';
import { fetchAndDecode } from './utils.mjs';

function parseInventory(data) {
    return data
        .split(/\r?\n/)
        .filter(line => line.length > 0)
        .map(line => {
            const [id, equipped, type, identified, name, magic, description, weight, durability] = line.split(';');
            return {
                id: Number.parseInt(id),
                equipped: equipped === 'O',
                type,
                identified: identified === 'O',
                name,
                magic,
                description,
                weight: Number.parseInt(weight),
                durability: Number.parseInt(durability)
            };
        });
}

export async function loadInventory() {
    const url = `https://sp.mountyhall.com/SP_Equipement.php?Numero=${id}&Motdepasse=${secret}`;
    const data = await fetchAndDecode(url);

    if (!fss.existsSync(targetDir))
        await fs.mkdir(targetDir);

    await fs.writeFile(`${targetDir}/inventory.data`, data);
    await fs.writeFile(`${targetDir}/inventory.json`, JSON.stringify(parseInventory(data)));
}
