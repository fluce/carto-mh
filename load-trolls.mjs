import fs from 'fs/promises';
import { fetchAndDecode } from './utils.mjs';

var url="https://www.mountyhall.com/ftp/Public_Trolls.txt";

const data=await fetchAndDecode(url);

await fs.writeFile('public/trolls.data', data);



