import fs from 'fs/promises';
import fss from 'fs';
import { fetchAndDecode } from './utils.mjs';

var url="https://www.mountyhall.com/ftp/Public_Trolls.txt";

const data=await fetchAndDecode(url);

if (!fss.existsSync('public'))
    await fs.mkdir('public');

await fs.writeFile('public/trolls.data', data);



