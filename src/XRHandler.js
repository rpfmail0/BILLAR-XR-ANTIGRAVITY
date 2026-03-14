import * as THREE from 'three';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

export class XRHandler {
    constructor(renderer, scene, xrRig, camera, cue, balls, gameLogic) {
        this.renderer = renderer;
        this.scene = scene;
        this.xrRig = xrRig;
        this.camera = camera;
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

        // Locomotion state
        this.snapTurnReady = true;

        this.init();
    }

    init() {
        // Controllers
        this.controller1 = this.renderer.xr.getController(0);
        this.xrRig.add(this.controller1);

        this.controller2 = this.renderer.xr.getController(1);
        this.xrRig.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.xrRig.add(this.controllerGrip1);

        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add(controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.xrRig.add(this.controllerGrip2);

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
        // Find left and right controllers
        const session = this.renderer.xr.getSession();
        let rightCtrl = null;
        let leftCtrl = null;

        // Handle VR Locomotion (Thumbsticks) and hand mapping
        if (session && this.xrRig && this.camera) {
            for (let i = 0; i < session.inputSources.length; i++) {
                const source = session.inputSources[i];
                if (source.handedness === 'right') {
                    rightCtrl = this.renderer.xr.getController(i);
                } else if (source.handedness === 'left') {
                    leftCtrl = this.renderer.xr.getController(i);
                }

                if (!source.gamepad) continue;
                
                const axes = source.gamepad.axes;
                // Standard VR gamepads axes: [0, 1] touchpad/thumbstick 1, [2, 3] touchpad/thumbstick 2.
                if (axes.length >= 4) {
                    const deadzone = 0.1;
                    const moveX = Math.abs(axes[2]) > deadzone ? axes[2] : 0;
                    const moveY = Math.abs(axes[3]) > deadzone ? axes[3] : 0;

                    // Left controller: Movement
                    if (source.handedness === 'left') {
                        const speed = 2.0 * dt;
                        
                        // Calculate forward and right relative to camera view on XZ plane
                        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                        forward.y = 0;
                        forward.normalize();
                        
                        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                        right.y = 0;
                        right.normalize();

                        this.xrRig.position.add(right.multiplyScalar(moveX * speed));
                        this.xrRig.position.add(forward.multiplyScalar(moveY * speed));
                    }

                    // Right controller: Snap turning
                    if (source.handedness === 'right') {
                        if (Math.abs(moveX) < deadzone) {
                            this.snapTurnReady = true;
                        } else if (this.snapTurnReady) {
                            this.xrRig.rotation.y += moveX > 0 ? -Math.PI / 4 : +Math.PI / 4;
                            this.snapTurnReady = false;
                        }
                    }
                }
            }
        }

        // Attach cue
        let cueUpdated = false;

        // Try two-handed aiming first
        if (rightCtrl && leftCtrl) {
            const rightPos = new THREE.Vector3();
            rightCtrl.getWorldPosition(rightPos);
            
            const leftPos = new THREE.Vector3();
            leftCtrl.getWorldPosition(leftPos);
            
            // Only aim if distance is reasonable to avoid glitchy rotation
            if (rightPos.distanceTo(leftPos) > 0.05) {
                const dummy = new THREE.Object3D();
                dummy.position.copy(rightPos);
                
                // We want the cue tip (-Z axis of the cylinder) to point towards the left hand.
                // It seems the visual geometry is built such that it extends backwards, 
                // so we actually need to look AWAY from the left hand to point the tip towards it.
                // Or simply look at the left hand.
                // Wait, if "el taco apunta al reves, desde la mano izquierda hacia la mano derecha",
                // that means the tip is at the right hand, and the back is at the left hand.
                // So we should position it at the right hand, and look at the left hand. But that's what we did.
                // Let's invert the look direction. We look from rightPos to a point behind rightPos.
                
                const direction = new THREE.Vector3().subVectors(rightPos, leftPos).normalize();
                const targetPos = new THREE.Vector3().copy(rightPos).add(direction);
                dummy.lookAt(targetPos);
                
                this.cue.update(rightPos, dummy.quaternion);
                cueUpdated = true;
            }
        }

        // Fallback to primary controller if two hands are not available or too close
        if (!cueUpdated && this.controller1) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            this.controller1.getWorldPosition(worldPos);
            this.controller1.getWorldQuaternion(worldQuat);
            this.cue.update(worldPos, worldQuat);
            cueUpdated = true;
        }

        if (cueUpdated) {
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
                        if (rightCtrl && rightCtrl.gamepad && rightCtrl.gamepad.hapticActuators) {
                            rightCtrl.gamepad.hapticActuators[0].pulse(1.0, 100);
                        } else if (this.controller1.gamepad && this.controller1.gamepad.hapticActuators) {
                            this.controller1.gamepad.hapticActuators[0].pulse(1.0, 100);
                        }
                    }
                }
            }
        }
    }
}
