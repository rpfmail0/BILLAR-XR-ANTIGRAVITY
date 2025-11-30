import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Table } from './Objects/Table.js';
import { Ball } from './Objects/Ball.js';
import { Cue } from './Objects/Cue.js';
import { XRHandler } from './XRHandler.js';
import { GameLogic } from './GameLogic.js';
import * as CANNON from 'cannon-es';

export class SceneSetup {
    constructor() {
        this.init();
    }

    init() {
        // Physics
        this.physics = new PhysicsWorld();
        this.clock = new THREE.Clock();

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 2.5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // VR Button
        document.body.appendChild(VRButton.createButton(this.renderer));

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

        // XR Handler
        this.xrHandler = new XRHandler(this.renderer, this.scene, this.cue, this.balls, this.gameLogic);
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
        const dt = this.clock.getDelta();
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
