import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ball {
    constructor(scene, physicsWorld, color, position) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.radius = 0.03075; // 61.5mm diameter
        this.color = color;
        this.startPosition = position;

        this.createVisuals();
        this.createPhysics();
    }

    createVisuals() {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: this.color,
            roughness: 0.1,
            metalness: 0.1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    createPhysics() {
        const shape = new CANNON.Sphere(this.radius);
        this.body = new CANNON.Body({
            mass: 0.21, // Standard ball weight approx 210g
            material: this.physicsWorld.ballMaterial,
            shape: shape
        });
        this.body.position.copy(this.startPosition);
        this.body.linearDamping = 0.5; // Rolling friction approximation
        this.body.angularDamping = 0.5;

        this.physicsWorld.world.addBody(this.body);
    }

    update() {
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
}
