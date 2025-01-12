import fs from 'fs/promises';

var url="https://www.mountyhall.com/ftp/Public_Trolls.txt";

var res=await fetch(url);
const data=await res.bytes();

await fs.writeFile('public/trolls.data', data);



