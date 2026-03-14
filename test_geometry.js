const THREE = require('three');

const tipRadius = 0.006;
const buttRadius = 0.015;
const length = 1.45;

const geometry = new THREE.CylinderGeometry(tipRadius, buttRadius, length, 32);
geometry.translate(0, length / 2, 0); // Pivot at the tip
geometry.rotateX(-Math.PI / 2); // Point forward

const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());

const rightPos = new THREE.Vector3(0, 0, 0);   // body
const leftPos = new THREE.Vector3(0, 0, -1);   // pointing to screen

const dummy = new THREE.Object3D();
dummy.position.copy(rightPos);

// Try subVectors(left, right)
let direction = new THREE.Vector3().subVectors(leftPos, rightPos).normalize();
let targetPos = new THREE.Vector3().copy(rightPos).add(direction);
dummy.lookAt(targetPos);
mesh.position.copy(rightPos);
mesh.quaternion.copy(dummy.quaternion);

mesh.updateMatrixWorld();

// Get the position of the tip (which is at -Z in local coords??)
let localTip = new THREE.Vector3(0, 0, -length);
let worldTip = localTip.applyMatrix4(mesh.matrixWorld);

// Get the position of the butt (which is at origin)
let localButt = new THREE.Vector3(0, 0, 0);
let worldButt = localButt.applyMatrix4(mesh.matrixWorld);

console.log('--- subVectors(leftPos, rightPos) ---');
console.log('Right Hand:', rightPos);
console.log('Left Hand:', leftPos);
console.log('Tip location:', worldTip);
console.log('Butt location:', worldButt);

// Try subVectors(right, left)
direction = new THREE.Vector3().subVectors(rightPos, leftPos).normalize();
targetPos = new THREE.Vector3().copy(rightPos).add(direction);
dummy.lookAt(targetPos);
mesh.quaternion.copy(dummy.quaternion);

mesh.updateMatrixWorld();

localTip = new THREE.Vector3(0, 0, -length);
worldTip = localTip.applyMatrix4(mesh.matrixWorld);

localButt = new THREE.Vector3(0, 0, 0);
worldButt = localButt.applyMatrix4(mesh.matrixWorld);

console.log('\n--- subVectors(rightPos, leftPos) ---');
console.log('Right Hand:', rightPos);
console.log('Left Hand:', leftPos);
console.log('Tip location:', worldTip);
console.log('Butt location:', worldButt);
