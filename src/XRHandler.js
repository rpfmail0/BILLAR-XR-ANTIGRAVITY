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
        
        this.canHit = true;

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

            const cameraPos = new THREE.Vector3();
            this.camera.getWorldPosition(cameraPos);
            
            // Only aim if distance is reasonable to avoid glitchy rotation
            if (rightPos.distanceTo(leftPos) > 0.05) {
                // Determine which hand is the back hand (closer to the headset)
                // In billiards, the back hand holds the butt, the front hand makes the bridge
                const rightDist = rightPos.distanceTo(cameraPos);
                const leftDist = leftPos.distanceTo(cameraPos);
                
                let backHandPos, frontHandPos;
                if (rightDist < leftDist) {
                    backHandPos = rightPos;
                    frontHandPos = leftPos;
                } else {
                    backHandPos = leftPos;
                    frontHandPos = rightPos;
                }

                const dummy = new THREE.Object3D();
                dummy.position.copy(backHandPos);
                // Look at front hand. Since the visual cue has pivot at the back and points along -Z,
                // this correctly points the cue from the back hand towards (and past) the front hand.
                dummy.lookAt(frontHandPos);
                
                this.cue.update(backHandPos, dummy.quaternion);
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
                
                // Continuous Collision Detection (CCD) to prevent cue passing through the ball if moved fast
                const A = this.previousTipPosition;
                const B = this.currentTipPosition;
                const C = whiteBall.mesh.position;
                
                const AB = new THREE.Vector3().subVectors(B, A);
                const AC = new THREE.Vector3().subVectors(C, A);
                
                let t = 0;
                if (AB.lengthSq() > 0.000001) {
                    t = AC.dot(AB) / AB.lengthSq();
                    t = Math.max(0, Math.min(1, t)); // Clamp to segment
                }
                
                const closestPoint = new THREE.Vector3().copy(A).add(AB.clone().multiplyScalar(t));
                const dist = closestPoint.distanceTo(C);

                // Ball radius 0.03075, Tip radius 0.006. 
                // Distance to center of ball is roughly the radius when touching.
                // Let's increase the collision threshold to make hitting easier.
                if (dist < 0.05) {
                    if (!this.canHit) return;

                    // Check if the cue tip is actually moving fast enough to constitute a "hit"
                    const speed = this.velocity.length();
                    
                    // Relax the directional check. If we are close and moving, it's a hit.
                    // This avoids issues where the cue direction vector and movement vector don't perfectly align.
                    if (speed > 0.1) {
                        this.canHit = false; // Prevent multiple hits instantly
                        setTimeout(() => { this.canHit = true; }, 500);

                        // Apply impulse
                        // Force magnitude proportional to velocity.
                        const forceMagnitude = Math.min(speed * 20, 150); // Increased multiplier and cap
                        
                        // Direction of force: from the tip of the cue extending forward along the stick's rotation
                        // instead of just the instantaneous velocity vector which might be jittery
                        const cueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cue.mesh.quaternion).normalize();
                        const force = cueForward.multiplyScalar(forceMagnitude);

                        // Apply to Cannon body
                        const impulse = new CANNON.Vec3(force.x, force.y, force.z);
                        
                        // Hit point (slightly below center for natural roll, simplified)
                        const hitPointOffset = new CANNON.Vec3(0, -0.01, 0); 
                        const worldPoint = new CANNON.Vec3(whiteBall.body.position.x, whiteBall.body.position.y, whiteBall.body.position.z).vadd(hitPointOffset);

                        whiteBall.body.wakeUp(); // Ensure body is awake
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
