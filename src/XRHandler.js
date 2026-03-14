import * as THREE from 'three';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

export class XRHandler {
    constructor(renderer, scene, xrRig, camera, cue, balls, gameLogic, soundManager) {
        this.renderer = renderer;
        this.scene = scene;
        this.xrRig = xrRig;
        this.camera = camera;
        this.cue = cue;
        this.balls = balls;
        this.gameLogic = gameLogic;
        this.soundManager = soundManager;
        this.controller1 = null;
        this.controller2 = null;
        this.controllerGrip1 = null;
        this.controllerGrip2 = null;

        this.previousTipPosition = new THREE.Vector3();
        this.currentTipPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        
        // Charging state for button-based shooting
        this.isCharging = false;
        this.chargePower = 0;
        this.chargeDirection = 1;
        this.chargeSpeed = 1.0; // 1 second to reach full power

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
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        
        // HUD - Power Bar
        this.powerBarGroup = new THREE.Group();
        this.powerBarGroup.position.set(0, -0.2, -1); // Slightly down, 1m away from camera
        this.camera.add(this.powerBarGroup);

        const bgGeo = new THREE.PlaneGeometry(0.5, 0.02);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x444444, depthTest: false, transparent: true, opacity: 0.5 });
        const bgMesh = new THREE.Mesh(bgGeo, bgMat);
        bgMesh.renderOrder = 999;
        this.powerBarGroup.add(bgMesh);

        const fgGeo = new THREE.PlaneGeometry(0.5, 0.02);
        fgGeo.translate(0.25, 0, 0); // Pivot at left
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
        this.powerBarMesh = new THREE.Mesh(fgGeo, fgMat);
        this.powerBarMesh.position.x = -0.25;
        this.powerBarMesh.scale.x = 0.001;
        this.powerBarMesh.renderOrder = 1000;
        this.powerBarGroup.add(this.powerBarMesh);

        this.powerBarGroup.visible = false;
    }

    onSelectStart(event) {
        const session = this.renderer.xr.getSession();
        if (session) {
            for (let i = 0; i < session.inputSources.length; i++) {
                if (this.renderer.xr.getController(i) === event.target) {
                    if (session.inputSources[i].handedness !== 'right') return;
                    break;
                }
            }
        }

        this.isCharging = true;
        this.chargePower = 0;
        this.chargeDirection = 1;
        this.powerBarGroup.visible = true;
        
        if (event.target.gamepad && event.target.gamepad.hapticActuators) {
            event.target.gamepad.hapticActuators[0].pulse(0.5, 50);
        }
    }

    onSelectEnd(event) {
        if (!this.isCharging) return;
        
        // Ensure it's the right controller that is ending the selection
        const session = this.renderer.xr.getSession();
        if (session) {
            for (let i = 0; i < session.inputSources.length; i++) {
                if (this.renderer.xr.getController(i) === event.target) {
                    if (session.inputSources[i].handedness !== 'right') return;
                    break;
                }
            }
        }

        this.isCharging = false;
        this.powerBarGroup.visible = false;
        
        this.shootBall(this.chargePower);
        this.chargePower = 0;
        
        if (event.target.gamepad && event.target.gamepad.hapticActuators) {
            event.target.gamepad.hapticActuators[0].pulse(1.0, 100);
        }
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
                // Vector FORWARD from right hand TO left hand
                const direction = new THREE.Vector3().subVectors(leftPos, rightPos).normalize();
                
                // We want the right hand to be the pivot (butt of the cue)
                // and point it towards the left hand
                const targetPos = new THREE.Vector3().copy(rightPos).add(direction);
                
                const dummy = new THREE.Object3D();
                dummy.position.copy(rightPos);
                dummy.lookAt(targetPos);
                
                // The visual cue is oriented with its butt at origin and tip extending along -Z.
                // By making dummy look at targetPos, its -Z axis points towards the left hand.
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
            }
        }

        // Update power bar charging
        if (this.isCharging) {
            this.chargePower += this.chargeDirection * this.chargeSpeed * dt;
            if (this.chargePower >= 1.0) {
                this.chargePower = 1.0;
                this.chargeDirection = -1;
            } else if (this.chargePower <= 0.0) {
                this.chargePower = 0.0;
                this.chargeDirection = 1;
            }
            
            this.powerBarMesh.scale.x = Math.max(0.001, this.chargePower);
            // Change color: green to red
            this.powerBarMesh.material.color.setHSL(0.33 * (1 - this.chargePower), 1.0, 0.5);
        }
    }

    shootBall(power) {
        if (!this.cue.tip) return;
        
        // Find direction the cue is pointing
        const cueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cue.mesh.quaternion).normalize();
        this.cue.tip.getWorldPosition(this.currentTipPosition);
        
        let targetBall = null;
        let minDistance = Infinity;
        
        // 1. Check if the cue tip is physically close to any ball
        for (const ball of this.balls) {
            const dist = this.currentTipPosition.distanceTo(ball.mesh.position);
            if (dist < 0.2) { // within 20cm
                targetBall = ball;
                minDistance = dist;
                break;
            }
        }
        
        // 2. If not close, raycast to find the ball we are pointing at
        if (!targetBall) {
            const raycaster = new THREE.Raycaster(this.currentTipPosition, cueForward);
            const ballMeshes = this.balls.map(b => b.mesh);
            const intersects = raycaster.intersectObjects(ballMeshes);
            
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                targetBall = this.balls.find(b => b.mesh === hitMesh);
                minDistance = intersects[0].distance;
            }
        }
        
        // Only shoot if we found a ball and it's reasonably close
        if (targetBall && minDistance < 2.0) {
            // Apply impulse
            // Reduced maxForce by another 5 times (from 1.0 to 0.2) 
            const maxForce = 0.2; 
            const forceMagnitude = Math.max(0.02, power * maxForce);
            const force = cueForward.multiplyScalar(forceMagnitude);
            const impulse = new CANNON.Vec3(force.x, force.y, force.z);
            
            const hitPointOffset = new CANNON.Vec3(0, -0.01, 0); 
            const worldPoint = new CANNON.Vec3(targetBall.body.position.x, targetBall.body.position.y, targetBall.body.position.z).vadd(hitPointOffset);

            targetBall.body.wakeUp();
            targetBall.body.applyImpulse(impulse, worldPoint);

            if (this.gameLogic) {
                this.gameLogic.startShot();
            }
        }
    }
}
