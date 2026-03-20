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
        // Texture Loading
        const loader = new THREE.TextureLoader();
        const woodTexture = loader.load('textures/wood_rail.png');
        woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(2, 1);

        // Table Bed (Green felt)
        const bedGeometry = new THREE.BoxGeometry(this.width, 0.05, this.length);
        const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x074407, roughness: 0.9 });
        this.bed = new THREE.Mesh(bedGeometry, bedMaterial);
        this.bed.position.y = this.height;
        this.bed.receiveShadow = true;
        this.scene.add(this.bed);

        // Legs (Durable wood)
        const legGeometry = new THREE.BoxGeometry(0.12, this.height, 0.12);
        const legMaterial = new THREE.MeshPhysicalMaterial({ 
            map: woodTexture, 
            roughness: 0.2,
            metalness: 0.1,
            clearcoat: 0.5
        });

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

        // --- CUSHION SYSTEM ---
        const cushionWidth = 0.12; 
        const cushionHeight = 0.08;
        const railHeight = 0.03; // Top wooden part
        
        // Felt Material (Inner cushions)
        const feltMaterial = new THREE.MeshStandardMaterial({ color: 0x0a550a, roughness: 0.8 });
        
        // Wood Material (Outer rails - VERY SHINY)
        const woodRailMaterial = new THREE.MeshPhysicalMaterial({ 
            map: woodTexture,
            roughness: 0.1,
            metalness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            reflectivity: 0.8
        });

        this.cushionMeshes = [];

        const addBanda = (w, l, x, z, rotation = 0) => {
            const group = new THREE.Group();
            
            // 1. Felt Cushion (Angled look simulation)
            const feltGeo = new THREE.BoxGeometry(w * 0.4, cushionHeight, l);
            const felt = new THREE.Mesh(feltGeo, feltMaterial);
            // Offset felt towards the inside of the table
            felt.position.x = -w * 0.3; 
            group.add(felt);

            // 2. Wood Rail (Top & Outer part)
            const railGeo = new THREE.BoxGeometry(w * 0.6, cushionHeight + 0.002, l);
            const rail = new THREE.Mesh(railGeo, woodRailMaterial);
            rail.position.x = w * 0.2; // Offset wood towards outside
            group.add(rail);

            group.position.set(x, this.height + cushionHeight / 2, z);
            group.rotation.y = rotation;
            this.scene.add(group);
            return group;
        };

        // Long bands
        addBanda(cushionWidth, this.length + cushionWidth * 2, -this.width / 2 - cushionWidth / 2, 0);
        addBanda(cushionWidth, this.length + cushionWidth * 2, this.width / 2 + cushionWidth / 2, 0, Math.PI);

        // Short bands
        addBanda(cushionWidth, this.width, 0, -this.length / 2 - cushionWidth / 2, -Math.PI / 2);
        addBanda(cushionWidth, this.width, 0, this.length / 2 + cushionWidth / 2, Math.PI / 2);

        this.createDiamonds(cushionHeight);
    }

    createDiamonds(cushionHeight) {
        // More realistic "Inlaid Pearl" diamonds
        const diamondGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.005, 16);
        const diamondMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff, 
            roughness: 0.0, 
            metalness: 0.8,
            emissive: 0x222222 
        });
        
        const diamondY = this.height + cushionHeight + 0.001;

        // Long rails (7 diamonds each)
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 1; i <= 7; i++) {
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                const z = -this.length / 2 + (i * this.length / 8);
                const x = side * (this.width / 2 + 0.09); // Positioned on the wood part
                diamond.position.set(x, diamondY, z);
                this.scene.add(diamond);
            }
        }

        // Short rails (3 diamonds each)
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 1; i <= 3; i++) {
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                const x = -this.width / 2 + (i * this.width / 4);
                const z = side * (this.length / 2 + 0.09);
                diamond.position.set(x, diamondY, z);
                this.scene.add(diamond);
            }
        }
    }

    createPhysics() {
        // Table Bed Body
        const bedShape = new CANNON.Box(new CANNON.Vec3(this.width / 2, 0.025, this.length / 2));
        this.bedBody = new CANNON.Body({
            mass: 0,
            material: this.physicsWorld.defaultMaterial
        });
        this.bedBody.addShape(bedShape);
        this.bedBody.position.set(0, this.height, 0);
        this.physicsWorld.world.addBody(this.bedBody);

        // Physics Cushions (Slightly inside for accuracy)
        const cushionThickness = 0.1;
        const cushionHeight = 0.08;

        const addCushionBody = (width, length, x, z) => {
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

        // Left
        addCushionBody(cushionThickness, this.length, -this.width / 2 - cushionThickness / 2, 0);
        // Right
        addCushionBody(cushionThickness, this.length, this.width / 2 + cushionThickness / 2, 0);
        // Top
        addCushionBody(this.width, cushionThickness, 0, -this.length / 2 - cushionThickness / 2);
        // Bottom
        addCushionBody(this.width, cushionThickness, 0, this.length / 2 + cushionThickness / 2);
    }
}
