import fs from 'node:fs/promises';
import fss from 'node:fs';

import { id, secret, targetDir } from './config.mjs';
import { fetchAndDecode } from './utils.mjs';

export async function loadView() {
    
    const url=`https://sp.mountyhall.com/SP_Vue2.php?Numero=${id}&Motdepasse=${secret}&Tresors=1&Lieux=1&Champignons=1`;

    const data=await fetchAndDecode(url);

    if (!fss.existsSync(targetDir))
        await fs.mkdir(targetDir);

    await fs.writeFile(`${targetDir}/view.data`, data);

}