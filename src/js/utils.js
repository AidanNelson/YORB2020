import * as THREE from "three";


// creates a text mesh and returns it, from:
// https://threejs.org/examples/?q=text#webgl_geometry_text_shapes
export function createSimpleText(message, fontColor, fontSize, font) {
    var xMid, yMid, text

    var mat = new THREE.LineBasicMaterial({
        color: fontColor,
        side: THREE.DoubleSide,
    })

    var shapes = font.generateShapes(message, fontSize)

    var geometry = new THREE.ShapeBufferGeometry(shapes)

    geometry.computeBoundingBox()

    xMid = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x)
    yMid = 0.5 * (geometry.boundingBox.max.y - geometry.boundingBox.min.y)

    geometry.translate(xMid, yMid, 0)

    // make shape ( N.B. edge view not visible )
    text = new THREE.Mesh(geometry, mat)
    return text
}

// this function returns 3D text object
// from https://threejs.org/examples/?q=text#webgl_geometry_text
export function create3DText(text, size, height, curveSegments, bevelThickness, bevelSize, bevelEnabled, mirror, font) {
    let textGeo = new THREE.TextGeometry(text, {
        font: font,

        size: size,
        height: height,
        curveSegments: curveSegments,

        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelEnabled: bevelEnabled,
    })

    textGeo.computeBoundingBox()
    textGeo.computeVertexNormals()

    var triangle = new THREE.Triangle()

    let materials = [
        new THREE.MeshPhongMaterial({ color: 0x57068c, flatShading: true }), // front
        new THREE.MeshPhongMaterial({ color: 0xffffff }), // side
    ]

    // "fix" side normals by removing z-component of normals for side faces
    // (this doesn't work well for beveled geometry as then we lose nice curvature around z-axis)

    if (!bevelEnabled) {
        var triangleAreaHeuristics = 0.1 * (height * size)

        for (var i = 0; i < textGeo.faces.length; i++) {
            var face = textGeo.faces[i]

            if (face.materialIndex == 1) {
                for (var j = 0; j < face.vertexNormals.length; j++) {
                    face.vertexNormals[j].z = 0
                    face.vertexNormals[j].normalize()
                }

                var va = textGeo.vertices[face.a]
                var vb = textGeo.vertices[face.b]
                var vc = textGeo.vertices[face.c]

                var s = triangle.set(va, vb, vc).getArea()

                if (s > triangleAreaHeuristics) {
                    for (var j = 0; j < face.vertexNormals.length; j++) {
                        face.vertexNormals[j].copy(face.normal)
                    }
                }
            }
        }
    }

    var centerOffset = -0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x)

    textGeo = new THREE.BufferGeometry().fromGeometry(textGeo)

    // geometry.computeBoundingBox();

    let xMid = -0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x)
    // let yMid = 0.5 * (geometry.boundingBox.max.y - geometry.boundingBox.min.y);

    textGeo.translate(xMid, 0, 0)

    let textMesh = new THREE.Mesh(textGeo, materials)
    // let hover = 5;

    // textMesh.position.x = centerOffset;
    // textMesh.position.y = hover;
    // textMesh.position.z = 0;

    // textMesh.rotation.x = 0;
    // textMesh.rotation.y = Math.PI * 2;

    if (mirror) {
        let textMesh2 = new THREE.Mesh(textGeo, materials)

        textMesh2.position.x = centerOffset
        textMesh2.position.y = -hover
        textMesh2.position.z = height

        textMesh2.rotation.x = Math.PI
        textMesh2.rotation.y = Math.PI * 2

        return textMesh2
    }

    return textMesh
}

// Adapted from: https://github.com/zacharystenger/three-js-video-chat
export function makeVideoTextureAndMaterial(_id, dims = null) {
    // create a canvas and add it to the body
    let rvideoImageCanvas = document.createElement('canvas')
    document.body.appendChild(rvideoImageCanvas)

    rvideoImageCanvas.id = _id + '_canvas'

    // Dims for projector screens.
    if (dims) {
        rvideoImageCanvas.width = dims.width
        rvideoImageCanvas.height = dims.height
    }

    rvideoImageCanvas.style = 'visibility: hidden;'

    // get canvas drawing context
    let rvideoImageContext = rvideoImageCanvas.getContext('2d')

    // background color if no video present
    rvideoImageContext.fillStyle = '#000000'
    rvideoImageContext.fillRect(0, 0, rvideoImageCanvas.width, rvideoImageCanvas.height)

    // make texture
    let videoTexture = new THREE.Texture(rvideoImageCanvas)
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter

    // make material from texture
    var movieMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture,
        overdraw: true,
        side: THREE.DoubleSide,
    })

    return [videoTexture, movieMaterial]
}

// this function redraws on a 2D <canvas> from a <video> and indicates to three.js
// that the _videoTex should be updated
export function redrawVideoCanvas(_videoEl, _canvasEl, _videoTex) {
    let _canvasDrawingContext = _canvasEl.getContext('2d')

    // check that we have enough data on the video element to redraw the canvas
    if (_videoEl.readyState === _videoEl.HAVE_ENOUGH_DATA) {
        // if so, redraw the canvas from the video element
        _canvasDrawingContext.drawImage(_videoEl, 0, 0, _canvasEl.width, _canvasEl.height)
        // and indicate to three.js that the texture needs to be redrawn from the canvas
        _videoTex.needsUpdate = true
    }
}
