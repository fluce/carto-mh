import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './createScene.mjs';
import { loadData } from './loadData.mjs';
import { index } from './parse.mjs';

const target = document.getElementById("canvas");
const selection = document.getElementById("selection");
const groupsElement = document.getElementById("groups");
console.dir(target);

const renderer = new THREE.WebGLRenderer({antialias: true});
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

const data = await loadData(["lieux","tresors"], "TGV", "all");
const path = [];
//const { path, cost }= findPath(data, index, data.origine[0], { x: 65, y: 0, z: 0 });
//console.log("Cost", cost);
//console.log("Length", path.length);

const { scene, origin, update } = await createScene(data, path);

console.dir(data);

const ul = document.createElement('ul');
const li = document.createElement('li');
li.textContent = "Tout";
li.style.color = "#000000";
li.setAttribute('data-item', 'all');
ul.appendChild(li);
Object.entries(data.groups).forEach(([x,a]) => {
    const li = document.createElement('li');
    li.setAttribute('data-item', x);
    li.textContent = x;
    li.style.color = `#${a.color.getHexString()}`;
    ul.appendChild(li);
});
groupsElement.appendChild(ul);
groupsElement.addEventListener('click', event => {
    const item = event.target.getAttribute('data-item');
    if (item) {
        if (item === 'all') {
            for (const x of Object.values(data.groups)) {
                console.log(x);
                if (x.items) {
                    x.mesh.visible = !x.mesh.visible;
                }
            }
        } else {
            const mesh = data.groups[item].mesh;
            mesh.visible = !mesh.visible;
        }
    }
});
groupsElement.querySelectorAll('li').forEach(x => {
});

controls.target.set(origin.x, origin.z, origin.y);

camera.position.z = 30;
camera.position.y = 30;
camera.position.x = 30;

var currentData = null;

function animate() {
    controls.update();
    update();
    raycaster.setFromCamera(pointer, camera);
    if (pointer.x > -1 && pointer.x < 1 && pointer.y > -1 && pointer.y < 1) {
        var intersects = raycaster.intersectObjects(scene.children, true).filter(x=>x.object.visible && x.instanceId && x.object.data && x.object.data[x.instanceId].data);
        if (intersects.length>0) {
            const intersect = intersects[0];
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
        else
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