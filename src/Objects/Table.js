import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Table {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.width = 1.42;
        this.length = 2.84;
        this.height = 0.8;

        this.createVisuals();
        this.createPhysics();
    }

    createVisuals() {
        // Table Bed (Green felt)
        const bedGeometry = new THREE.BoxGeometry(this.width, 0.05, this.length);
        const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.8 });
        this.bed = new THREE.Mesh(bedGeometry, bedMaterial);
        this.bed.position.y = this.height;
        this.bed.receiveShadow = true;
        this.scene.add(this.bed);

        // Legs
        const legGeometry = new THREE.BoxGeometry(0.1, this.height, 0.1);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x331100 });

        const positions = [
            [-this.width / 2 + 0.1, this.height / 2, -this.length / 2 + 0.1],
            [this.width / 2 - 0.1, this.height / 2, -this.length / 2 + 0.1],
            [-this.width / 2 + 0.1, this.height / 2, this.length / 2 - 0.1],
            [this.width / 2 - 0.1, this.height / 2, this.length / 2 - 0.1]
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...pos);
            this.scene.add(leg);
        });

        // Cushions (One simple block per side)
        const cushionWidth = 0.1;
        const cushionHeight = 0.08;
        const cushionMaterial = new THREE.MeshStandardMaterial({ color: 0x004400 });

        this.cushionMeshes = [];

        // Long cushions
        const longCushionGeo = new THREE.BoxGeometry(cushionWidth, cushionHeight, this.length + cushionWidth * 2);
        const leftCushion = new THREE.Mesh(longCushionGeo, cushionMaterial);
        leftCushion.position.set(-this.width / 2 - cushionWidth / 2, this.height + cushionHeight / 2, 0);
        this.scene.add(leftCushion);
        this.cushionMeshes.push(leftCushion);

        const rightCushion = new THREE.Mesh(longCushionGeo, cushionMaterial);
        rightCushion.position.set(this.width / 2 + cushionWidth / 2, this.height + cushionHeight / 2, 0);
        this.scene.add(rightCushion);
        this.cushionMeshes.push(rightCushion);

        // Short cushions
        const shortCushionGeo = new THREE.BoxGeometry(this.width, cushionHeight, cushionWidth);
        const topCushion = new THREE.Mesh(shortCushionGeo, cushionMaterial);
        topCushion.position.set(0, this.height + cushionHeight / 2, -this.length / 2 - cushionWidth / 2);
        this.scene.add(topCushion);
        this.cushionMeshes.push(topCushion);

        const bottomCushion = new THREE.Mesh(shortCushionGeo, cushionMaterial);
        bottomCushion.position.set(0, this.height + cushionHeight / 2, this.length / 2 + cushionWidth / 2);
        this.scene.add(bottomCushion);
        this.cushionMeshes.push(bottomCushion);

        this.createDiamonds(cushionHeight);
    }

    createDiamonds(cushionHeight) {
        const diamondGeo = new THREE.SphereGeometry(0.008, 8, 8);
        const diamondMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2 });
        
        // Long rails
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 1; i <= 7; i++) {
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                const z = -this.length / 2 + (i * this.length / 8);
                const x = side * (this.width / 2 + 0.05);
                diamond.position.set(x, this.height + cushionHeight, z);
                this.scene.add(diamond);
            }
        }

        // Short rails
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 1; i <= 3; i++) {
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                const x = -this.width / 2 + (i * this.width / 4);
                const z = side * (this.length / 2 + 0.05);
                diamond.position.set(x, this.height + cushionHeight, z);
                this.scene.add(diamond);
            }
        }
    }

    createPhysics() {
        const bedShape = new CANNON.Box(new CANNON.Vec3(this.width / 2, 0.025, this.length / 2));
        this.bedBody = new CANNON.Body({
            mass: 0,
            material: this.physicsWorld.defaultMaterial
        });
        this.bedBody.addShape(bedShape);
        this.bedBody.position.set(0, this.height, 0);
        this.physicsWorld.world.addBody(this.bedBody);

        const cushionThickness = 0.1;
        const cushionHeight = 0.08;

        const addCushion = (width, length, x, z) => {
            const shape = new CANNON.Box(new CANNON.Vec3(width / 2, cushionHeight / 2, length / 2));
            const body = new CANNON.Body({
                mass: 0,
                material: this.physicsWorld.cushionMaterial
            });
            body.userData = { type: 'cushion' };
            body.addShape(shape);
            body.position.set(x, this.height + cushionHeight / 2, z);
            this.physicsWorld.world.addBody(body);
        };

        addCushion(cushionThickness, this.length, -this.width / 2 - cushionThickness / 2, 0);
        addCushion(cushionThickness, this.length, this.width / 2 + cushionThickness / 2, 0);
        addCushion(this.width, cushionThickness, 0, -this.length / 2 - cushionThickness / 2);
        addCushion(this.width, cushionThickness, 0, this.length / 2 + cushionThickness / 2);
    }
}
