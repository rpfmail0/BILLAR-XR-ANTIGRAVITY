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
        // Adjust repeat to be more uniform across different lengths
        woodTexture.repeat.set(1, 1);

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
        const cushionThickness = 0.04; // The felt part
        const railWidth = 0.12;       // The wood part
        const totalHeight = 0.08;
        
        const feltMaterial = new THREE.MeshStandardMaterial({ color: 0x0a550a, roughness: 0.8 });
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
            
            // 1. Wood Rail (The base block)
            const railGeo = new THREE.BoxGeometry(w, totalHeight, l);
            const rail = new THREE.Mesh(railGeo, woodRailMaterial);
            // Re-map UVs for the rail to be more uniform
            rail.geometry.attributes.uv.array.forEach((v, i) => {
                if (i % 2 === 0) rail.geometry.attributes.uv.array[i] *= (l * 2); // Scale horizontally
            });
            group.add(rail);

            // 2. Felt Cushion (Attached to the INNER face)
            const feltGeo = new THREE.BoxGeometry(cushionThickness, totalHeight - 0.015, l);
            const felt = new THREE.Mesh(feltGeo, feltMaterial);
            // Position felt on the inner edge of the rail
            // Since the rail is 'w' wide, its inner edge is at -w/2
            felt.position.x = -w / 2 - cushionThickness / 2 + 0.005; 
            felt.position.y = -0.007; // Slightly lower to keep top purely wood
            group.add(felt);

            group.position.set(x, this.height + totalHeight / 2, z);
            group.rotation.y = rotation;
            this.scene.add(group);
            return group;
        };

        // Long bands (Placed such that the inner edge of the wood starts at the table edge)
        const longZ = this.length + railWidth * 2;
        addBanda(railWidth, longZ, -this.width / 2 - railWidth / 2, 0); // Left
        addBanda(railWidth, longZ, this.width / 2 + railWidth / 2, 0, Math.PI); // Right

        // Short bands
        addBanda(railWidth, this.width, 0, -this.length / 2 - railWidth / 2, -Math.PI / 2); // Top
        addBanda(railWidth, this.width, 0, this.length / 2 + railWidth / 2, Math.PI / 2); // Bottom

        this.createDiamonds(totalHeight);
    }

    createDiamonds(cushionHeight) {
        const diamondGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.005, 16);
        const diamondMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff, 
            roughness: 0.0, 
            metalness: 0.8,
            emissive: 0x222222 
        });
        
        const diamondY = this.height + cushionHeight + 0.001;

        // Long rails
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 1; i <= 7; i++) {
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                const z = -this.length / 2 + (i * this.length / 8);
                // Position on center of the wooden rails
                const x = side * (this.width / 2 + 0.06); 
                diamond.position.set(x, diamondY, z);
                this.scene.add(diamond);
            }
        }

        // Short rails
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 1; i <= 3; i++) {
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                const x = -this.width / 2 + (i * this.width / 4);
                const z = side * (this.length / 2 + 0.06);
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

        // Physics Cushions (Aligned with the inner felt surface)
        // The felt is at -railWidth/2 - cushionThickness/2 + 0.005
        // Table edge is at -width/2. 
        // We want the physics to be exactly at the inner face of the felt.
        const cushionHeight = 0.08;
        const cushionThickness = 0.1; // Total effective thickness for physics

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

        // Standard physics positions (matching the felt encounter)
        addCushionBody(cushionThickness, this.length, -this.width / 2 - cushionThickness / 2, 0);
        addCushionBody(cushionThickness, this.length, this.width / 2 + cushionThickness / 2, 0);
        addCushionBody(this.width, cushionThickness, 0, -this.length / 2 - cushionThickness / 2);
        addCushionBody(this.width, cushionThickness, 0, this.length / 2 + cushionThickness / 2);
    }
}
