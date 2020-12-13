import { create3DText, createSimpleText } from './utils'

export class Signage {
    constructor(scene) {
        this.scene = scene
        this.createSignage()
    }
    createSignage() {
        let textDepth = 0.1
        let curveSegments = 3
        let message, txt

        message = 'Welcome to'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror
        txt = create3DText(message, 0.25, textDepth, curveSegments, 0.01, 0.01, false, false)
        txt.position.set(-2, 2.85, 0.0)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'ITP  '
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror
        txt = create3DText(message, 1.15, textDepth, curveSegments, 0.01, 0.01, false, false)
        txt.position.set(-2.25, 1.5, 0.0)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'Interactive Telecommunications Program'
        // params: text, size, depth, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror
        txt = create3DText(message, 0.25, textDepth, curveSegments, 0.01, 0.01, false, false)
        txt.position.set(-2, 1.15, 0.0)
        txt.rotateY(Math.PI / 2)
        this.scene.add(txt)

        message = 'The E.R.'
        txt = create3DText(message, 0.6, textDepth, curveSegments, 0.01, 0.01, false, false)
        txt.position.set(-11.25, 1.75, -18.5)
        txt.rotateY(0)
        this.scene.add(txt)

        message = "Resident's Residence"
        txt = create3DText(message, 0.6, textDepth, curveSegments, 0.01, 0.01, false, false)
        txt.position.set(-12.5, 1.75, -0.75)
        txt.rotateY(-Math.PI / 2)
        this.scene.add(txt)
    }
}
