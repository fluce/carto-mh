import fs from 'fs/promises';
import fse from 'fs';
import { JSDOM } from 'jsdom';
import { fetchAndDecode } from './utils.mjs';

const nameMap = {
    [undefined]: "all",
    [-3]: "TGV"
}

const raccourcis=["Croisée des cavernes","Sanctuaire","Campement","Gouffre","Caverne","Grotte","Tombe","Rocher","Lac souterrain"];

loadLieux(-3);
loadLieux(undefined);

async function loadLieux(typeLieu) {
    const data = await getData(typeLieu);


    var r=[];
    for(var j of Object.keys(data)) {
        for(var d of data[j]) d.type=j;
        console.log(j);
        console.dir(data[j][0]);

        if (j=='Divers' || j=='Lac') {
            for(var i of raccourcis) {
                var dt=data[j].filter(x=>x.name.startsWith(i));
                //console.log(i);
                //console.dir(dt[0]);
                for(var d of dt) d.type=i;
                //console.dir(data[j].filter(x=>x.name.startsWith(i))[0])
                r.push(...dt);
                if (dt.length>0) {
                    fs.writeFile(`public/${i}.json`, JSON.stringify(dt.map(x=>{delete x.lastUpdate; return x;})));
                    fs.writeFile(`public/${i}.csv`, dt.map(x=>`${x.id};${x.name};${x.x};${x.y};${x.z};${x.type}`).join('\n'));
                }
            }
        }
        fs.writeFile(`public/${j}.json`, JSON.stringify(data[j].map(x=>{delete x.lastUpdate; return x;})));
        fs.writeFile(`public/${j}.csv`, data[j].map(x=>`${x.id};${x.name};${x.x};${x.y};${x.z};${x.type}`).join('\n'));
    }

    if (r.length>0) {
        fs.writeFile(`public/Raccourcis.json`, JSON.stringify(r.map(x=>{delete x.lastUpdate; return x;})));
        fs.writeFile(`public/Raccourcis.csv`, r.map(x=>`${x.id};${x.name};${x.x};${x.y};${x.z};${x.type};raccourci`).join('\n'));
    }

    fs.writeFile(`public/${nameMap[typeLieu]}.json`, JSON.stringify(data));
    fs.writeFile(`public/${nameMap[typeLieu]}.csv`, Object.values(data).flatMap(x=>x).map(x=>`${x.id};${x.name};${x.x};${x.y};${x.z};${x.type}`).join('\n'));
}


async function getData(typeLieu) {

    const filename=`public/data-${nameMap[typeLieu]}.json`;
    if (fse.existsSync(filename)) {
        console.log("Loading from cache");
        const data = await fs.readFile(filename, { encoding: 'utf-8' });
        return JSON.parse(data);
    }
    const rawhtml = await getRawData(typeLieu);
    console.log("Loaded !");
    const data = parseData(rawhtml);
    await fs.writeFile(filename, JSON.stringify(data));
    return data;
}

function parseData(html) {
    const doc = new JSDOM(html);
    const table = doc.window.document.querySelectorAll('#lieux');
    console.dir(table[0].getElementsByTagName("tr")[1].getElementsByTagName("td")[1].textContent);
    /*console.log(table.childElementCount);*/
    const data = {};
    var counter = 0;
    for (var i of table[0].getElementsByTagName("tr")) {
        var cells = Array.from(i.getElementsByTagName("td")).map(x => x.textContent);
        if (cells.length > 0) {
            const coords = cells[3].substring(1, cells[3].length - 1).split(',').map(x => parseInt(x));
            const d = { type: cells[0], id: cells[1], name: cells[2], x: coords[0], y: coords[1], z: coords[2], lastUpdate: cells[4] };
            data[d.type] = data[d.type] ?? [];
            data[d.type].push(d);
            //console.dir(d);
            if (++counter % 100 == 0) {
                console.log(counter);
            }
        }
    }
    return data;
}

async function getRawData(typeLieu) {
    var html;
    const filename = `public/lieux-${nameMap[typeLieu]}.html`;
    if (fse.existsSync(filename)) {
        console.log("Loading from cache");
        html = await fs.readFile(filename, { encoding: 'utf-8' });
    } else {
        console.log("Loading from server");
        const url = `http://trolls.ratibus.net/mountyhall/lieux.php?search=position&orderBy=distance&posx=&posy=&posn=&typeLieu=${typeLieu}`;
        html = await fetchAndDecode(url);
        await fs.writeFile(filename, html);
    }
    return html;
}

