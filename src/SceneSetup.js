import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { SoundManager } from './SoundManager.js';
import { Table } from './Objects/Table.js';
import { Ball } from './Objects/Ball.js';
import { Cue } from './Objects/Cue.js';
import { XRHandler } from './XRHandler.js';
import { GameLogic } from './GameLogic.js';
import { MasterPlayManager } from './MasterPlayManager.js';
import * as CANNON from 'cannon-es';

export class SceneSetup {
    constructor() {
        this.init();
    }

    init() {
        // Sound Manager
        this.soundManager = new SoundManager();

        // Physics
        this.physics = new PhysicsWorld(this.soundManager);
        this.clock = new THREE.Clock();

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 0); // Height mostly handled by WebXR, local pos by xrRig

        // XR Rig (Player grouping for locomotion and initial spawning)
        this.xrRig = new THREE.Group();
        this.xrRig.position.set(0, 0, 2.5); // Start slightly away from the table
        this.scene.add(this.xrRig);
        this.xrRig.add(this.camera);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // VR Button
        const vrButton = VRButton.createButton(this.renderer, { 
            requiredFeatures: ['local-floor'],
            optionalFeatures: ['bounded-floor', 'passthrough'] 
        });
        document.body.appendChild(vrButton);
        
        // Initialize audio context on the actual DOM button click (required by browsers)
        vrButton.addEventListener('click', () => {
            if (this.soundManager) {
                this.soundManager.init();
                // Play a tiny silent sound to force the context to unlock
                this.soundManager.playSound(1, 'sine', 0.01, 0.001, false);
            }
        });

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(2, 5, 2);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Game Objects
        this.table = new Table(this.scene, this.physics);

        // Balls
        // Table surface y is 0.8. Ball radius is 0.03075.
        const ballY = 0.8 + 0.03075;

        this.balls = [];
        // White
        this.balls.push(new Ball(this.scene, this.physics, 0xffffff, new CANNON.Vec3(0, ballY, 0.5)));
        // Yellow
        this.balls.push(new Ball(this.scene, this.physics, 0xffff00, new CANNON.Vec3(0, ballY, -0.5)));
        // Red
        this.balls.push(new Ball(this.scene, this.physics, 0xff0000, new CANNON.Vec3(0.3, ballY, 0)));

        // Cue
        this.cue = new Cue(this.scene);

        // Game Logic
        this.gameLogic = new GameLogic(this.scene, this.physics, this.balls);

        // Master Play Manager
        this.masterPlayManager = new MasterPlayManager(this.scene, this.balls, this.gameLogic, null);

        // Env Map generation
        this.setupEnvironment();

        // XR Handler
        this.xrHandler = new XRHandler(this.renderer, this.scene, this.xrRig, this.camera, this.cue, this.balls, this.gameLogic, this.soundManager, this.table, this.masterPlayManager);
        
        // Link manager back to handler
        this.masterPlayManager.xrHandler = this.xrHandler;
    }

    setupEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        // Create a temporary "lights" scene for the environment
        const envScene = new THREE.Scene();
        
        // Add some "overhead lights" for the billiard room reflection
        const roomBox = new THREE.BoxGeometry(10, 10, 10);
        const roomMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
        const room = new THREE.Mesh(roomBox, roomMat);
        envScene.add(room);

        // Add 3 large bright "softboxes" on the ceiling for nice speculars
        const lightGeo = new THREE.PlaneGeometry(2, 4);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const light1 = new THREE.Mesh(lightGeo, lightMat);
        light1.position.set(0, 4.9, 0);
        light1.rotation.x = Math.PI / 2;
        envScene.add(light1);

        const light2 = new THREE.Mesh(lightGeo, lightMat);
        light2.position.set(3, 4.9, 1);
        light2.rotation.x = Math.PI / 2;
        envScene.add(light2);

        const light3 = new THREE.Mesh(lightGeo, lightMat);
        light3.position.set(-3, 4.9, -1);
        light3.rotation.x = Math.PI / 2;
        envScene.add(light3);

        const envRT = pmremGenerator.fromScene(envScene);
        this.scene.environment = envRT.texture;

        pmremGenerator.dispose();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    render() {
        const dt = Math.min(0.1, this.clock.getDelta());
        this.physics.step(dt);

        this.balls.forEach(ball => ball.update());

        if (this.xrHandler) {
            this.xrHandler.update(dt);
        }

        if (this.gameLogic) {
            this.gameLogic.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}
