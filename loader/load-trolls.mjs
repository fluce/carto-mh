import fs from 'node:fs/promises';
import fss from 'node:fs';
import { fetchAndDecode } from './utils.mjs';
import { targetDir } from './config.mjs';

export async function loadTrolls() {

    const url="https://www.mountyhall.com/ftp/Public_Trolls.txt";

    const data=await fetchAndDecode(url);

    if (!fss.existsSync(targetDir))
        await fs.mkdir(targetDir);

    await fs.writeFile(`${targetDir}/trolls.data`, data);

}
