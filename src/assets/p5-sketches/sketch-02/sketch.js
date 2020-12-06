// where do you want your sketch to live in the space
window.yorbConfig = {
  active: true,
  name: "Aidan Nelson",
  description: "Example WebGL Sketch",
  shape: "sphere",
  position: {
    x: -8.5,
    y: 2.5,
    z: -36,
  },
  rotation: {
    x: 30,
    y: 10,
    z: 50,
  },
  scale: {
    x: 1,
    y: 1,
    z: 1,
  },
};

let cam;

function setup() {
  createCanvas(100, 100, WEBGL);
  normalMaterial();
  cam = createCamera();
  cam.move(0, 0, -100);
}

function draw() {
  background(255, 100, 250);

  rotateX(millis() / 2000);
  rotateY(millis() / 1000);
  box(50);
}
