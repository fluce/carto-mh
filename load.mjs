import fs from 'fs/promises';

import { id, secret } from './config.js';

var url=`https://sp.mountyhall.com/SP_Vue2.php?Numero=${id}&Motdepasse=${secret}&Tresors=1&Lieux=1&Champignons=1`;

var res=await fetch(url);
const data=await res.bytes();

await fs.writeFile('public/view.data', data);

