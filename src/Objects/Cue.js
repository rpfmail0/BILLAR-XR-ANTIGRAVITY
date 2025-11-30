import * as THREE from 'three';

export class Cue {
    constructor(scene) {
        this.scene = scene;
        this.length = 1.45; // Standard cue length
        this.tipRadius = 0.006;
        this.buttRadius = 0.015;

        this.createVisuals();
    }

    createVisuals() {
        const geometry = new THREE.CylinderGeometry(this.tipRadius, this.buttRadius, this.length, 32);
        geometry.translate(0, this.length / 2, 0); // Pivot at the tip
        geometry.rotateX(-Math.PI / 2); // Point forward

        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;

        // Add a tip
        const tipGeo = new THREE.CylinderGeometry(this.tipRadius, this.tipRadius, 0.01, 32);
        tipGeo.translate(0, 0.005, 0);
        tipGeo.rotateX(-Math.PI / 2);
        const tipMat = new THREE.MeshStandardMaterial({ color: 0x0000ff }); // Blue chalk
        this.tip = new THREE.Mesh(tipGeo, tipMat);
        this.mesh.add(this.tip);

        this.scene.add(this.mesh);
        this.mesh.visible = false; // Hidden by default until active
    }

    update(position, rotation) {
        if (position && rotation) {
            this.mesh.position.copy(position);
            this.mesh.quaternion.copy(rotation);
            this.mesh.visible = true;
        } else {
            this.mesh.visible = false;
        }
    }
}
