import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './createScene.mjs';
import { loadData } from './loadData.mjs';
import { index } from './parse.mjs';
import { MinPriorityQueue } from '@datastructures-js/priority-queue';

const target = document.getElementById("canvas");
const selection = document.getElementById("selection");
console.dir(target);

const renderer = new THREE.WebGLRenderer();
//renderer.setSize(window.innerWidth - 5, window.innerHeight - 5);
target.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, renderer.domElement.offsetWidth / renderer.domElement.offsetHeight, 0.1, 1000);

window.addEventListener( 'resize', onWindowResize );
onWindowResize();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -30, 0);
controls.update();
controls.enablePan = true;
controls.enableDamping = true;
controls.enableZoom = true;
controls.keys = {
	LEFT: 'Q', //left arrow
	UP: 'Z', // up arrow
	RIGHT: 'D', // right arrow
	BOTTOM: 'S' // down arrow
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove',
    event => {
        pointer.x = ((event.clientX-renderer.domElement.offsetLeft) / renderer.domElement.offsetWidth) * 2 - 1;
        pointer.y = -((event.clientY-renderer.domElement.offsetTop) / renderer.domElement.offsetHeight) * 2 + 1;
    });

const data = await loadData(["lieux","tresors"], "TGV", "Raccourcis", "Trou de Météorite");
console.dir(data);
const path = [];
//const { path, cost }= findPath(data, index, data.origine[0], { x: 65, y: 0, z: 0 });
//console.log("Cost", cost);
//console.log("Length", path.length);

const { scene, origin, update } = await createScene(data, path);

controls.target.set(origin.x, origin.z, origin.y);

function findPath(data,index, from, to)
{
    const getNeighbors = (node) => {
        const neighbors = [];
        var lieux=index.get(node).filter(x=>x.type==='raccourcis') ?? [];
        if (lieux[0]) {
            neighbors.push(
                ...data.raccourcis
                       .filter(x=>x.typeLieu===lieux[0].typeLieu && x.id!=lieux[0].id)
                       .map(x=>({ node: {x:x.x, y:x.y, z:x.z}, cost: 2 }))
            );           
            console.log(lieux[0].name);
            console.dir({ node, l:lieux[0], neighbors});
        }

        for (var i = -1; i <= 1; i++)
            for (var j = -1; j <= 1; j++)
                for (var k = -1; k <= 1; k++)
                {
                    if (i == 0 && j == 0 && k == 0)
                        continue;
                    const neighbor = { x:node.x + i, y:node.y + j, z:node.z + k };
                    if (neighbor.z>0) continue;
                    if (neighbor.x>=100 || neighbor.x<=-100 
                        || neighbor.y>=100 || neighbor.y<=-100)
                        continue;
                    var d=index.get(neighbor) ?? [];
                    var l=d.filter(x=>x.type==='lieux')[0];
                    if (l?.typeLieu==="Trou de Météorite")
                        continue;                    
                    const cost = k==0 ? 1 : 2;
                    if (neighbor)
                        neighbors.push({ node: neighbor, cost });
                }
        return neighbors;
    };
    const heuristic = (a, b) => isEqual(a,b)?0:1; 
    //const heuristic = (a, b) => Math.abs(a.x - b.x)+Math.abs(a.y - b.y)+Math.abs((a.z - b.z)*2);
    const isEqual = (a, b) => a.x == b.x && a.y == b.y && a.z == b.z;
    const toKey = (x) => `x${x.x}y${x.y}z${x.z}`;
    return calcAStarPath(from, to, getNeighbors, heuristic, isEqual, toKey,70) ?? [];
}

function calcAStarPath(from, to, getNeighbors, heuristic, isEqual, toKey, maxCost)
{
    var rounds=0;
    const queue = new MinPriorityQueue(x => x.cost);
    const visited = new Set();
    const path = [];
    const cost = new Map();
    const previous = new Map();
    queue.enqueue({ node: from, cost: 0 });
    cost.set(toKey(from) ,0);
    while (!queue.isEmpty())
    {
        rounds++;
        if (rounds%10000==0)
            console.log({ rounds, count:visited.size });
        //if (rounds>30000) break;
        var current = queue.dequeue().node;
        if (!current)
            break;
        //console.log("Current", current);
        if (isEqual(current,to))
        {
            const totalCost=cost.get(toKey(current));
            while (!isEqual(current,from))
            {
                path.push(current);
                current = previous.get(toKey(current));
            }
            path.push(from);
            return { path: path.reverse(), cost: totalCost };
        }
        const currentKey=toKey(current);
        if (visited.has(currentKey))
            continue;
        visited.add(currentKey);
        var ns=getNeighbors(current);
        //console.log("Neighbors", ns);
        for (var n of ns)
        {
            const neighbor = n.node;
            const key=toKey(neighbor);
            const nodeCost = n.cost;
            if (visited.has(key))
                continue;
            const newCost = cost.get(currentKey) + nodeCost;
            if (newCost>maxCost) continue;
            var costNeighbor = cost.get(key);
            if (!costNeighbor || newCost < costNeighbor)
            {
                cost.set(key,newCost);
                previous.set(key,current);
                const a={ node: neighbor, cost: newCost + heuristic(neighbor, to) };
                //console.log("Enqueue", a);
                queue.enqueue(a);
            }
        }
    }
}

camera.position.z = 30;
camera.position.y = 30;
camera.position.x = 30;

var currentData = null;

function animate() {
    controls.update();
    update();
    raycaster.setFromCamera(pointer, camera);
    if (pointer.x > -1 && pointer.x < 1 && pointer.y > -1 && pointer.y < 1) {
        var found = false;
        raycaster.intersectObjects(scene.children).forEach(intersect => {
            if (!found && intersect.instanceId && intersect.object.data) {
                found = true;
                if (currentData != intersect.object.data[intersect.instanceId].data) {
                    currentData = intersect.object.data[intersect.instanceId].data;
                    scene.selectionGizmo.position.set(currentData.x, currentData.z, currentData.y);
                    scene.selectionGizmo.visible=true;
                    selection.innerHTML = JSON.stringify(currentData);
                    console.log(currentData);
                    var dataAtPoint = index.get(currentData);
                    console.log(dataAtPoint);
                } 
            }
        });
        if (!found)
        {
            currentData = null;
            selection.innerHTML = "&nbsp;";
        }
    }
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

function onWindowResize() {

    camera.aspect = target.offsetWidth / target.offsetHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( target.offsetWidth, target.offsetHeight );
}