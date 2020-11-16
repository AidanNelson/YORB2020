const THREE = require("./libs/three.min.js");
export class Sketches{
    constructor(scene){
        this.scene = scene;
        this.updateableVideoTextures = [];
    }


  addSketches() {
    console.log("Adding p5.js sketches to the scene!");
    try {
      let container = document.getElementById("p5-sketch-container");
      let containerDocument = container.document || container.contentDocument;
      let iframes = containerDocument.getElementsByTagName("iframe");

      for (let i = 0; i < iframes.length; i++) {
        // https://stackoverflow.com/questions/926916/how-to-get-the-bodys-content-of-an-iframe-in-java
        let iframeDocument =
          iframes[i].contentDocument || iframes[i].contentWindow.document;
        let canvasEl = iframeDocument.getElementsByTagName("canvas")[0];

        let config = iframes[i].contentWindow.yorbConfig;

        if (canvasEl && config && config.active) {
          // make texture
          let videoTexture = new THREE.Texture(canvasEl);
          videoTexture.minFilter = THREE.LinearFilter;
          videoTexture.magFilter = THREE.LinearFilter;

          // make material from texture
          var videoMaterial = new THREE.MeshBasicMaterial({
            map: videoTexture,
            overdraw: true,
            side: THREE.DoubleSide,
          });

          let geometry;

          // if the user has defined a config:
          if (config) {
            switch (config.shape) {
              case "box":
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;

              case "sphere":
                geometry = new THREE.SphereGeometry(1, 24, 24);
                break;

              case "ico":
                geometry = new THREE.IcosahedronGeometry(1, 0);
                break;

              case "cylinder":
                geometry = new THREE.CylinderGeometry(1, 1, 2, 8);
                break;

              default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            }
          } else {
            geometry = new THREE.BoxGeometry(1, 1, 1);
          }

          this.updateableVideoTextures.push(videoTexture);
          console.log(this.updateableVideoTextures);
          let sketchMesh = new THREE.Mesh(geometry, videoMaterial);

          if (config) {
            sketchMesh.position.set(
              config.position.x,
              config.position.y,
              config.position.z
            );
            sketchMesh.rotation.set(
              THREE.MathUtils.degToRad(config.rotation.x),
              THREE.MathUtils.degToRad(config.rotation.y),
              THREE.MathUtils.degToRad(config.rotation.z)
            );
            sketchMesh.scale.set(
              config.scale.x,
              config.scale.y,
              config.scale.z
            );
          }
          this.scene.add(sketchMesh);
        }
      }
    } catch (err) {
      console.log(err);
    }

    // let sketchFrame = document.getElementById('sketchFrame');
    // console.log(sketchFrame);
    // let canvas = sketchFrame.contentDocument.getElementById('defaultCanvas0');
    // console.log(canvas);

    // for (let i = 0; i < p5sketches.length; i++){
    // 	const info = p5sketches[i];
    // 	this.addSketchToScene(info.sketch, info.location,info.size,info.rotation);
    // }

    // let el = document.createElement('iframe');
    // el.setAttribute('src', 'https://editor.p5js.org/p5/embed/rBqmyGZlS9');
    // el.setAttribute('id', 'myiframe');
    // document.body.appendChild(el);
  }
  /**
   *
   * This function will add a p5 sketch to the scene:
   * creates a canvas and attaches sketch to that canvas,
   * creates a canvasTexture,
   * creates a THREE.js plane object to hold sketch,
   * applies canvasTexture to material on that plane
   *
   */
  addSketchToScene(sketchDefinition, location, size, rotation) {
    const sketch = new p5(sketchDefinition);
    console.log(sketch);

    // const canvasEl = document.getElementById('defaultCanvas0');
    const canvasEl = sketch.canvas;
    // get canvas drawing context
    let rvideoImageContext = canvasEl.getContext("2d");

    // background color if no video present
    // rvideoImageContext.fillStyle = '#000000';
    // rvideoImageContext.fillRect(0, 0, canvasEl.width, canvasEl.height);

    // make texture
    let videoTexture = new THREE.Texture(canvasEl);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // make material from texture
    var videoMaterial = new THREE.MeshBasicMaterial({
      map: videoTexture,
      overdraw: true,
      side: THREE.DoubleSide,
    });

    this.updateableVideoTextures.push(videoTexture);
    console.log(this.updateableVideoTextures);
    let sketchBox = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      // new THREE.SphereGeometry(1,12,12),
      videoMaterial
    );

    sketchBox.position.set(location.x, location.y, location.z);
    this.scene.add(sketchBox);
  }

  update() {
    this.updateableVideoTextures.forEach((tex) => {
      tex.needsUpdate = true;
    });
  }

}