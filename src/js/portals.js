//can ask August if you have questions about this!
//models from YG using Vectary ~ * ~ * ../assets/models/portals

import * as THREE from 'three'
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'


//when yorb.js creates a yorblet, it also needs that yorblets url and portal model
//then in the yorblet, it creates a portal from here using those arguments
//the portal trigger is checked in the update method of yorb.js
export class Portal {
    constructor(scene, portal, destination, label) {
        this.scene = scene; //da sceneee
        this.model = portal.model; //path to glb
        this.position = portal.position; //vec3
        this.destination = destination; //url
        this.radius = 1; //will need to test TODO
        this.label = label; //a label object that contains the text, color, size, rotation Y, x/y/z position offset of the label (do we need more?)

        this.portalLoader = new GLTFLoader();
        this.loadPortalModel(this.model);
    }

    loadPortalModel(modelPath) {
        this.portalLoader.load(
            modelPath,
            (gltf) => {
                let portalScene = gltf.scene
                portalScene.position.set(this.position.x, this.position.y, this.position.z)
                portalScene.scale.set(.1, .1, .1)
                portalScene.traverse((child) => {
                    if (child.isMesh) {
                        // child.material = _material
                        child.castShadow = true
                        child.receiveShadow = true
                    }
                })
                this.scene.add(portalScene)

                // --------------- add portal label -------------------------
                const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
                const font = new THREE.Font(fontJson)

                const text = this.label.text

                const fontGeometry = new THREE.TextBufferGeometry(text, {
                    font: font,
                    size: this.label.size,
                    height: 0.01,
                    curveSegments: 11,
                    bevelEnabled: true,
                    bevelThickness: 0.01,
                    bevelSize: 0.01,
                    bevelSegments: 1,
                })

                const fontMaterial = new THREE.MeshPhongMaterial({ color: this.label.color, flatShading: true })
                const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial)
                fontMesh.rotateY(this.label.rotateY)
                fontMesh.position.set(this.position.x + this.label.xOff, this.position.y + this.label.yOff, this.position.z +  + this.label.zOff) // make it floating right above the portal shape
                
                this.scene.add(fontMesh)
            },
            undefined,
            function (e) {
                console.log('trying to load portal');
                console.error(e)
            }
        )
    }

    teleportCheck(userPosition) {
        //need to change because getPlayerPosition doesn't return a vec3
        let userVec3 = new Vector3(userPosition[0], userPosition[1], userPosition[2]);
        if (this.position.distanceTo(userVec3) <= this.radius) {
            console.log('teleporting');
            window.open(this.destination);
            return true; //for the trigger that removes the user from this yorblet
        }
        return false;
    }

}