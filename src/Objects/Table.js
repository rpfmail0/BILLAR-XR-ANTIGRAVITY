import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Table {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.width = 1.42; // Standard match table width (approx)
        this.length = 2.84; // Standard match table length
        this.height = 0.8; // Table height

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

        // Legs (Simple implementation)
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

        // Cushions (Visuals only for now, physics will be separate bodies)
        const cushionWidth = 0.1;
        const cushionHeight = 0.05;
        const cushionMaterial = new THREE.MeshStandardMaterial({ color: 0x004400 });

        // Long cushions
        const longCushionGeo = new THREE.BoxGeometry(cushionWidth, cushionHeight, this.length + cushionWidth * 2);
        const leftCushion = new THREE.Mesh(longCushionGeo, cushionMaterial);
        leftCushion.position.set(-this.width / 2 - cushionWidth / 2, this.height + 0.025, 0);
        this.scene.add(leftCushion);

        const rightCushion = new THREE.Mesh(longCushionGeo, cushionMaterial);
        rightCushion.position.set(this.width / 2 + cushionWidth / 2, this.height + 0.025, 0);
        this.scene.add(rightCushion);

        // Short cushions
        const shortCushionGeo = new THREE.BoxGeometry(this.width, cushionHeight, cushionWidth);
        const topCushion = new THREE.Mesh(shortCushionGeo, cushionMaterial);
        topCushion.position.set(0, this.height + 0.025, -this.length / 2 - cushionWidth / 2);
        this.scene.add(topCushion);

        const bottomCushion = new THREE.Mesh(shortCushionGeo, cushionMaterial);
        bottomCushion.position.set(0, this.height + 0.025, this.length / 2 + cushionWidth / 2);
        this.scene.add(bottomCushion);
    }

    createPhysics() {
        // Table Bed Body
        const bedShape = new CANNON.Box(new CANNON.Vec3(this.width / 2, 0.025, this.length / 2));
        this.bedBody = new CANNON.Body({
            mass: 0, // Static
            material: this.physicsWorld.defaultMaterial
        });
        this.bedBody.addShape(bedShape);
        this.bedBody.position.set(0, this.height, 0);
        this.physicsWorld.world.addBody(this.bedBody);

        // Cushions
        const cushionThickness = 0.1;
        const cushionHeight = 0.05;

        // Helper to add cushion body
        const addCushion = (width, length, x, z) => {
            const shape = new CANNON.Box(new CANNON.Vec3(width / 2, cushionHeight / 2, length / 2));
            const body = new CANNON.Body({
                mass: 0,
                material: this.physicsWorld.cushionMaterial
            });
            body.addShape(shape);
            body.position.set(x, this.height + 0.025, z);
            this.physicsWorld.world.addBody(body);
        };

        // Left
        addCushion(cushionThickness, this.length, -this.width / 2 - cushionThickness / 2, 0);
        // Right
        addCushion(cushionThickness, this.length, this.width / 2 + cushionThickness / 2, 0);
        // Top
        addCushion(this.width, cushionThickness, 0, -this.length / 2 - cushionThickness / 2);
        // Bottom
        addCushion(this.width, cushionThickness, 0, this.length / 2 + cushionThickness / 2);
    }
}
