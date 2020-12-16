import { create3DText, createSimpleText } from './utils'
import * as THREE from "three";

export class Signage {
    constructor(scene) {
        this.scene = scene
        this.createSignage()
    }
    createSignage() {
        let textDepth = 0.1
        let curveSegments = 3
        let bevelEnabled = true
        let bevelSize = 0.05
        let outerColor =  0xFF00E0

        let message, txt
        let fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        let font = new THREE.Font(fontJson)

        message = 'Welcome to'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font, outerColor, innerColor
        // txt = create3DText(message, 0.45, textDepth, curveSegments, 0.01, 0.01, false, false, font)
        txt = create3DText(message, 0.45, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-2, 2.85, 0.0)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'ITP  '
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font, outerColor, innerColor
        txt = create3DText(message, 1.15, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-2.25, 1.5, 0.0)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'The Winter Show 2020'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font, outerColor, innerColor
        txt = create3DText(message, 0.25, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-2, 1.15, 0.0)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'Help Desk'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.6, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-11.15, 1.75, -18.5)
        txt.rotateY(0)
        this.scene.add(txt)

        // message = "Resident's Residence"
        // txt = create3DText(message, 0.6, textDepth, curveSegments, 0.01, 0.01, false, false, font, outerColor, innerColor)
        // txt.position.set(-12.5, 1.75, -0.75)
        // txt.rotateY(-Math.PI / 2)
        // this.scene.add(txt)
    }
}
