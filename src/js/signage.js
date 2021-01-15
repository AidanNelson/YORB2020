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
        txt.position.set(-2, 2.85, -1)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'ITP '
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font, outerColor, innerColor
        txt = create3DText(message, 1.0, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-2.25, 1.5, -1)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'The Winter Show 2020'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font, outerColor, innerColor
        txt = create3DText(message, 0.275, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-2, 1.0, -1)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'Help Desk'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.6, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-11.15, 1.75, -18.5)
        txt.rotateY(0)
        this.scene.add(txt)

        message = '<< This way!'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.4, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-1, 2.2, -16)
        txt.rotateY(0)
        this.scene.add(txt)

        message = 'The Coding Lab'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.4, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-8.2, 1.75, 16.5)
        txt.rotateY(Math.PI)
        this.scene.add(txt)

        message = 'Memories Fall 2020'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.35, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-14, 2.8, -25)
        txt.rotateY(Math.PI*1.5)
        this.scene.add(txt)

        // message = 'Family Photos'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.35, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-7, 2.8, -53)
        txt.rotateY(Math.PI*1.5)
        this.scene.add(txt)


        // message = 'Family Photos'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.35, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-7.3, 2.8, -69)
        txt.rotateY(Math.PI*1.5)
        this.scene.add(txt)

        // message = 'Family Photos'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font outerColor, innerColor
        txt = create3DText(message, 0.35, textDepth, curveSegments, 0.01, bevelSize*0.5, bevelEnabled, false, font, outerColor)
        txt.position.set(-23, 2.8, -88)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        // message = "Resident's Residence"
        // txt = create3DText(message, 0.6, textDepth, curveSegments, 0.01, 0.01, false, false, font, outerColor, innerColor)
        // txt.position.set(-12.5, 1.75, -0.75)
        // txt.rotateY(-Math.PI / 2)
        // this.scene.add(txt)
    }
}
