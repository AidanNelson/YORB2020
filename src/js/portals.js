//can ask August or YG if you have questions about this!
//models from YG using Vectary ~ * ~ * ../assets/models/portals

import * as THREE from 'three'
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import debugModule from 'debug'
const log = debugModule('YORB:Portals')

const PortalModels = require('../assets/models/portals/*.glb');
//this reference holds all info about which portal goes to where, used by both yorblet.js and winterShow2020.js
const yorbletReference = [
    {url: "https://yorb.itp.io", model: PortalModels['tacobell'], label: {text:"Return to Lobby", color:0xf4d010, size:0.4, rotateY:Math.PI / 2, xOff:0, yOff:3, zOff:2}}, //lobby
    {url: 'https://yorb.itp.io/?x=38&y=0.5&z=14', model: PortalModels['sphBlue'], label: {text:"   Go to\nYorblet 1", color:0x4b4ff4, size:0.25, rotateY:Math.PI / 2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet2.itp.io', model: PortalModels['cubPink'], label: {text:"   Go to\nYorblet 2", color:0xfc3691, size:0.25, rotateY:Math.PI / 2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet3.itp.io', model: PortalModels['pyrYellow'], label: {text:"   Go to\nYorblet 3", color:0xf4d010, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet4.itp.io', model:PortalModels ['ligGreen'], label: {text:"   Go to\nYorblet 4", color:0x9be210, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet5.itp.io', model: PortalModels['sphPink'], label: {text:"   Go to\nYorblet 5", color:0xfc3691, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorbletsix.itp.io', model: PortalModels['cubYellow'], label: {text:"   Go to\nYorblet 6", color:0xf4d010, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet7.itp.io', model: PortalModels['pyrGreene'], label: {text:"   Go to\nYorblet 7", color:0x9be210, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet8.itp.io', model: PortalModels['ligPink'], label: {text:"   Go to\nYorblet 8", color:0xfc3691, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet9.itp.io', model: PortalModels['sphYellow'], label: {text:"   Go to\nYorblet 9", color:0xf4d010, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet10.itp.io', model: PortalModels['cubBlue'], label: {text:"   Go to\nYorblet 10", color:0x4b4ff4, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet11.itp.io', model: PortalModels['pyrBlue'], label: {text:"   Go to\nYorblet 11", color:0x4b4ff4, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}},
    {url: 'https://yorblet12.itp.io', model: PortalModels['sphGreen'], label: {text:"   Go to\nYorblet 12", color:0x9be210, size:0.25, rotateY:Math.PI/2, xOff:0, yOff:3, zOff:0.6}}
]

//yorblet.js uses yorblet_index, which gets passed here to
//the portal trigger is checked in the update method of yorb.js
export class Portal {
    // constructor(scene, portal, destination, label) {
    constructor(scene, position, destination_index) {
        //using the index of the destination because this portal doesn't need to know anything about where it is (besides position), only where it's going
        this.scene = scene; //da sceneee
        this.model = yorbletReference[destination_index].model; //path to glb
        this.position = position; //vec3
        this.destination = yorbletReference[destination_index].url; //url
        this.radius = 1; //trigger distance
        this.label = yorbletReference[destination_index].label; //a label object that contains the text, color, size, rotation Y, x/y/z position offset of the label (do we need more?)

        this.portalLoader = new GLTFLoader();
        // log(this.model);
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
                log('trying to load portal');
                console.error(e)
            }
        )
    }

    teleportCheck(userPosition) {
        //needed to convert because getPlayerPosition doesn't return a vec3
        let userVec3 = new Vector3(userPosition[0], userPosition[1], userPosition[2]);

        // log(this.position.distanceTo(userVec3));
        

        if (this.position.distanceTo(userVec3) <= this.radius) {
            log('teleporting');
            //if doing modal, would need to do so here, but would have to change the return timing
            // window.open(this.destination);
            location.href = this.destination; //suggestion from shawn/billy so that it doesn't open new window
            return true; //for the trigger that removes the user from this yorblet
        }
        return false;
    }

}
