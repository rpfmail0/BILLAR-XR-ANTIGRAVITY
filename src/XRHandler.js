import * as THREE from 'three';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

export class XRHandler {
    constructor(renderer, scene, cue, balls, gameLogic) {
        this.renderer = renderer;
        this.scene = scene;
        this.cue = cue;
        this.balls = balls;
        this.gameLogic = gameLogic;
        this.controller1 = null;
        this.controller2 = null;
        this.controllerGrip1 = null;
        this.controllerGrip2 = null;

        this.previousTipPosition = new THREE.Vector3();
        this.currentTipPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();

        this.init();
    }

    init() {
        // Controllers
        this.controller1 = this.renderer.xr.getController(0);
        this.scene.add(this.controller1);

        this.controller2 = this.renderer.xr.getController(1);
        this.scene.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.scene.add(this.controllerGrip1);

        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add(controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.scene.add(this.controllerGrip2);

        // Event listeners
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
    }

    onSelectStart() {
        // Reset game or place ball?
    }

    onSelectEnd() {

    }

    update(dt) {
        // Attach cue to right controller (controller1 usually)
        if (this.controller1) {
            this.cue.update(this.controller1.position, this.controller1.quaternion);

            // Calculate tip position in world space
            if (this.cue.tip) {
                this.cue.tip.getWorldPosition(this.currentTipPosition);

                // Calculate velocity
                if (dt > 0) {
                    this.velocity.subVectors(this.currentTipPosition, this.previousTipPosition).divideScalar(dt);
                }

                this.previousTipPosition.copy(this.currentTipPosition);

                // Check collision with White Ball (index 0)
                const whiteBall = this.balls[0];
                const dist = this.currentTipPosition.distanceTo(whiteBall.mesh.position);

                // Ball radius 0.03075, Tip radius 0.006. 
                // Collision distance approx 0.037
                if (dist < 0.038) {
                    // Check if moving towards ball
                    const directionToBall = new THREE.Vector3().subVectors(whiteBall.mesh.position, this.currentTipPosition).normalize();
                    const dot = this.velocity.dot(directionToBall);

                    if (dot > 0.1) { // Moving towards ball with some speed
                        // Apply impulse
                        // Force magnitude proportional to velocity
                        const force = this.velocity.clone().multiplyScalar(5); // Adjust multiplier

                        // Apply to Cannon body
                        // Cannon uses Vec3
                        const impulse = new CANNON.Vec3(force.x, force.y, force.z);
                        const worldPoint = new CANNON.Vec3(this.currentTipPosition.x, this.currentTipPosition.y, this.currentTipPosition.z);

                        whiteBall.body.applyImpulse(impulse, worldPoint);

                        // Notify GameLogic
                        if (this.gameLogic) {
                            this.gameLogic.startShot();
                        }

                        // Haptic feedback
                        if (this.controller1.gamepad && this.controller1.gamepad.hapticActuators) {
                            this.controller1.gamepad.hapticActuators[0].pulse(1.0, 100);
                        }
                    }
                }
            }
        }
    }
}
