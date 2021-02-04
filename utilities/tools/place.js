// tool for generating meshes based on an array of files and auto spacing them out in a space
// August Luhrs Jan 2020

// might be a little weird but planning on using like:
// const Place = require('./place')
// Place.onWall();

// eventually could also pass in a series of corners and it could auto make walls and auto assign projects to walls to fit?

import * as THREE from 'three'
import { Vector3 } from 'three'

import debugModule from 'debug';
const log = debugModule('YORB: Place Tool');

const onWall = (startPoint, endPoint, assets, geometry, options) => {
    // takes two Vec3 points, an array of assets to generate the textures from, and a shared canvas geometry
    // returns a THREE.Group with the meshes, and if a label is included, names the object by the label for easy raycast checking
    // right now defaults to placing along a flat wall, assumes square canvases, center aligned, evenly spaced -- eventually can add options parameter with those.
    // doesn't need to be wall along an axis, since uses vector math to determine direction of placement
    // assumes start point is on the left for orientation, though since all faces are same, shouldn't matter unless using labels
    // assumes spacing also on extreme sides, so start/end shouldn't be center of first/last canvas, but the edges of the wall
    // right now, only option is label placement location {labelLocation: 'top' or 'alternating'}, defaults to bottom placement
    
    let wallGroup = new THREE.Group();

    //find the direction of placement by subtracting the startVec3 from the endVec3
    let placePath = endPoint.clone();
    placePath.sub(startPoint); //vec3

    //find the width of the canvases to find the total length of spaces in between them
    let totalCanvasWidth = assets.length * geometry.parameters.width; //scalar
    let totalSpacingWidth =  placePath.length() - totalCanvasWidth; //scalar

    // use the spacing to find the distance between the canvas centers
    let spacing = totalSpacingWidth / (assets.length + 1) //scalar, fencepost problem

    // find the length between the centers of the canvases so we can add to the current placement
    let firstPlacement = (geometry.parameters.width / 2) + spacing; //scalar, only for start
    let centerToCenter = geometry.parameters.width + spacing; //scalar, each subsequent placement

    // find start placement pos by dividing the length of the place Vector by the sum of half the asset width and the spacing, then dividing the place Vector by that value
    // something about this feels wrong/redundant, but i'm too close to see it. it works so w/e...
    // i guess the alternative is to normalize the placepath and multiply by the firstPlacement? not sure if that's much more efficient, maybe one less line of code
    // lol wait that's exactly what i did for the nextPlacement... le sigh
    let startLength = placePath.length() / firstPlacement; //scalar
    let startPlacement = placePath.clone(); //vec3
    startPlacement.divideScalar(startLength); //vec3
    let currentPlacement = startPoint.clone(); //vec3
    currentPlacement.add(startPlacement); //vec3

    // find the vector that will be added to one placement pos to find the next (based on center to center distance)
    let nextPlacement = placePath.clone(); //vec3
    nextPlacement.normalize(); //vec3
    nextPlacement.multiplyScalar(centerToCenter); //add the distance to the center of the next canvas

    //rotate the canvas based on the normalized placement vector, could just use place path, but making new vector for clarity. assuming only placing horizontally...
    let rotationDirection = placePath.clone();
    // rotationDirection.normalize(); //prob don't need this but w/e
    rotationDirection.applyAxisAngle(new Vector3(0, 1, 0), Math.PI/2); //rotate 90 degrees on the Y -- need to do this so will rotate to face right of place path no matter what starting orientation

    let labelVec3Alternating;
    if (options.labelLocation = "alternating") {
        labelVec3Alternating = new Vector3(0, 3 * geometry.parameters.width / 4, 0);
    }

    //for each asset, make a mesh based on the file and geometry.
    //if labeled, create a label
    for (let asset of assets) {
        // log(asset);
        //add rotation vector to current spot to get where to look
        let lookAtThisSpot = rotationDirection.clone();
        lookAtThisSpot.add(currentPlacement);

        //first, see if object with label or just file
        if (typeof asset === 'object') {
            let canvasAndLabel = new THREE.Group();
            let text = Object.keys(asset)[0];
            let label = createLabel(text, geometry.parameters.width);
            let canvas;
            let file = Object.values(asset)[0];
            
            if(file.includes('.png') || file.includes('.jpg')){
                const canvasTexture = new THREE.TextureLoader().load(file);
                const canvasMaterial = new THREE.MeshBasicMaterial({map: canvasTexture});
                canvas = new THREE.Mesh(geometry, canvasMaterial);
                canvas.position.copy(currentPlacement);
                canvas.lookAt(lookAtThisSpot);
                // log('quat: ' + JSON.stringify(canvas.getWorldQuaternion()))
            } else if (file.includes('.mp4')){
                // https://stackoverflow.com/questions/18383470/using-video-as-texture-with-three-js
                let video  = document.createElement('video');
                video.src = file;
                video.playsInline = true;
                video.muted = true;
                video.loop = true;
                video.autoplay = true
                video.style.display = 'none';
				video.play();

                const canvasTexture = new THREE.VideoTexture(video);
                const canvasMaterial = new THREE.MeshBasicMaterial({map: canvasTexture});
                canvas = new THREE.Mesh(geometry, canvasMaterial);
                canvas.position.copy(currentPlacement);
                canvas.lookAt(lookAtThisSpot);
            } else {
                log("unsupported file type: " + file);
            }
            //give the canvas a name for raycast stuff later
            canvas.name = text;
            //now adjust label pos and rotation based on canvas'
            let labelVec3 = canvas.position.clone();
            if (options.labelLocation = "alternating") {
                labelVec3.add(labelVec3Alternating);
                labelVec3Alternating.multiplyScalar(-1);
            } else if (options.labelLocation = "top") { 
                labelVec3.add(new Vector3(0, 3 * geometry.parameters.width / 4, 0)) //might be too big on large canvases? need to check TODO
            } else {// defaults to bottom
                labelVec3.sub(new Vector3(0, 3 * geometry.parameters.width / 4, 0));
            }
            label.position.copy(labelVec3);
            let labelOffset = lookAtThisSpot.clone();
            labelOffset.add(labelVec3.sub(canvas.position)) //annoying, but its because i add diff things above...
            label.lookAt(labelOffset);
            label.rotateY(Math.PI); //backwards for some reason
            canvasAndLabel.add(label, canvas); //pretty redundant, i know
            wallGroup.add(canvasAndLabel);
        } else { //just an array of files
            let canvas;
            
            if(asset.includes('.png') || asset.includes('.jpg')){
                const canvasTexture = new THREE.TextureLoader().load(asset);
                const canvasMaterial = new THREE.MeshBasicMaterial({map: canvasTexture});
                canvas = new THREE.Mesh(geometry, canvasMaterial);
                canvas.position.copy(currentPlacement);
                canvas.lookAt(lookAtThisSpot);
                // log('quat: ' + JSON.stringify(canvas.getWorldQuaternion()))
            } else if (asset.includes('.mp4')){
                // https://stackoverflow.com/questions/18383470/using-video-as-texture-with-three-js
                let video  = document.createElement('video');
                video.src = asset;
                video.playsInline = true;
                video.muted = true;
                video.loop = true;
                video.autoplay = true
                video.style.display = 'none';
				video.play();

                const canvasTexture = new THREE.VideoTexture(video);
                const canvasMaterial = new THREE.MeshBasicMaterial({map: canvasTexture});
                canvas = new THREE.Mesh(geometry, canvasMaterial);
                canvas.position.copy(currentPlacement);
                canvas.lookAt(lookAtThisSpot);
            } else {
                log("unsupported file type: " + asset);
            }
            wallGroup.add(canvas);
        }
        currentPlacement.add(nextPlacement); //for the next mesh's location -- for now will leave gap if unsupported asset, but leaving so easier to debug
    }
    return wallGroup
}

function createLabel(label, canvasWidth) {
    // text code from YG's yorblet.js labels, thanks!
    const fontJson = require('../../src/assets/fonts/helvetiker_regular_copy.typeface.json')
    const font = new THREE.Font(fontJson)
    const text = label;
    let textSize = canvasWidth / 10; //can be bigger now that we're alternating

    const fontGeometry = new THREE.TextBufferGeometry(text, {
        font: font,
        size: textSize, //need to test
        height: textSize / 4,
        curveSegments: 11,
        bevelEnabled: true,
        bevelThickness: textSize / 8,
        bevelSize: textSize / 8,
        bevelSegments: 6,
    })

    //change colors TODO
    const fontMaterial1 = new THREE.MeshBasicMaterial({ color: 0x18DD6C, flatShading: true })
    const fontMaterial2 = new THREE.MeshBasicMaterial({ color: 0x1250CC, flatShading: true })
    const fontMesh = new THREE.Mesh(fontGeometry, [fontMaterial1, fontMaterial2])

     //ugh left align -- https://codepen.io/sanprieto/pen/jzWgmO
    fontGeometry.computeBoundingBox();
    fontGeometry.center();
    //might want to make bounding box manually to make sure doesn't go over canvas width?

    // doing along with canvas, not here
    // fontMesh.position.set(39, 2.7, 8.5)
    // fontMesh.lookAt(0, 2.6, 8.5)
    // this.scene.add(fontMesh)
    return fontMesh;
}

exports.onWall = onWall;