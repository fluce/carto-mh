import fs from 'fs/promises';
import fss from 'fs';

import { id, secret } from './config.mjs';
import { fetchAndDecode } from './utils.mjs';

var url=`https://sp.mountyhall.com/SP_Vue2.php?Numero=${id}&Motdepasse=${secret}&Tresors=1&Lieux=1&Champignons=1`;

const data=await fetchAndDecode(url);

if (!fss.existsSync('public'))
    await fs.mkdir('public');

await fs.writeFile('public/view.data', data);

