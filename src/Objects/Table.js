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
        // Texture Loader
        const textureLoader = new THREE.TextureLoader();
        const woodTexture = textureLoader.load('textures/wood_mahogany.jpg');
        woodTexture.wrapS = THREE.RepeatWrapping;
        woodTexture.wrapT = THREE.RepeatWrapping;

        // Table Bed (Green felt)
        const bedGeometry = new THREE.BoxGeometry(this.width, 0.05, this.length);
        const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.8 });
        this.bed = new THREE.Mesh(bedGeometry, bedMaterial);
        this.bed.position.y = this.height;
        this.bed.receiveShadow = true;
        this.scene.add(this.bed);

        // Legs - Mahogany Wood Texture
        const legGeometry = new THREE.BoxGeometry(0.1, this.height, 0.1);
        const woodMaterial = new THREE.MeshStandardMaterial({ 
            map: woodTexture,
            color: 0x662211, // Multiply with mahogany tint
            roughness: 0.12,  // High gloss
            metalness: 0.1 
        });

        const legPositions = [
            [-this.width / 2 + 0.1, this.height / 2, -this.length / 2 + 0.1],
            [this.width / 2 - 0.1, this.height / 2, -this.length / 2 + 0.1],
            [-this.width / 2 + 0.1, this.height / 2, this.length / 2 - 0.1],
            [this.width / 2 - 0.1, this.height / 2, this.length / 2 - 0.1]
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, woodMaterial);
            leg.position.set(...pos);
            this.scene.add(leg);
        });

        // Cushions: Exterior (Wood) and Interior (Green Face)
        const totalCushionWidth = 0.1;
        const woodRailWidth = 0.075; // Thick wood frame
        const greenFaceWidth = 0.025; // Thin green elastic part
        const cushionHeight = 0.065;
        
        const greenMaterial = new THREE.MeshStandardMaterial({ color: 0x004400, roughness: 0.7 });

        this.cushionMeshes = [];

        const addCushionGeometry = (w, h, l, x, z, isLong) => {
            // 1. WOOD RAIL (Exterior)
            // Long rails already have l + totalCushionWidth * 2. 
            // Short rails need w + totalCushionWidth * 2 to close the corners.
            const railGeo = isLong ? 
                new THREE.BoxGeometry(woodRailWidth, h, l + totalCushionWidth * 2) : 
                new THREE.BoxGeometry(w + totalCushionWidth * 2, h, woodRailWidth);
            const rail = new THREE.Mesh(railGeo, woodMaterial);
            
            // Adjust position for long/short rails
            let railX = x;
            let railZ = z;
            if (isLong) {
                railX = (x < 0) ? x - greenFaceWidth/2 : x + greenFaceWidth/2;
            } else {
                railZ = (z < 0) ? z - greenFaceWidth/2 : z + greenFaceWidth/2;
            }
            rail.position.set(railX, this.height + h / 2, railZ);
            this.scene.add(rail);

            // 2. GREEN FACE (Interior)
            const faceGeo = isLong ?
                new THREE.BoxGeometry(greenFaceWidth, h, l) :
                new THREE.BoxGeometry(w, h, greenFaceWidth);
            const face = new THREE.Mesh(faceGeo, greenMaterial);
            
            let faceX = x;
            let faceZ = z;
            if (isLong) {
                faceX = (x < 0) ? x + woodRailWidth/2 : x - woodRailWidth/2;
            } else {
                faceZ = (z < 0) ? z + woodRailWidth/2 : z - woodRailWidth/2;
            }
            face.position.set(faceX, this.height + h / 2, faceZ);
            this.scene.add(face);
            this.cushionMeshes.push(face);
        };

        // Long rails
        addCushionGeometry(totalCushionWidth, cushionHeight, this.length, -this.width / 2 - totalCushionWidth / 2, 0, true);
        addCushionGeometry(totalCushionWidth, cushionHeight, this.length, this.width / 2 + totalCushionWidth / 2, 0, true);

        // Short rails
        addCushionGeometry(this.width, cushionHeight, totalCushionWidth, 0, -this.length / 2 - totalCushionWidth / 2, false);
        addCushionGeometry(this.width, cushionHeight, totalCushionWidth, 0, this.length / 2 + totalCushionWidth / 2, false);

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
        const cushionHeight = 0.065;

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
