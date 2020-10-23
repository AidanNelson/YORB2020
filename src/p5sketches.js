let sketches = [];
let myCoolSketch, location;

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
// My cool sketch!
myCoolSketch = (sketch) => {
  sketch.setup = () => {
    sketch.createCanvas(100, 100, sketch.WEBGL);
  };

  sketch.draw = () => {
    sketch.background(205, 105, 94);
    sketch.rotateY(sketch.millis() / 1000);
    sketch.sphere(40, 16, 3);
  };
};

// create a location for this sketch in the scene:
location = {
  x: -8,
  y: 1.5,
  z: -8,
};
size = {
  x: 1,
  y: 1,
  z: 1
}
rotation = {
  x: 0,
  y: 0,
  z: 0
}

// Add this sketch to the array:
sketches.push({
  sketch: myCoolSketch,
  location: location,
  size: size,
  rotation: rotation
});

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
// Bouncing Ball Sketch
myCoolSketch = (sketch) => {
  let ballX = 100;
  let ballY = 100;
  let velocityX = sketch.random(-5, 5);
  let velocityY = sketch.random(-5, 5);
  let buffer = 25;

  sketch.setup = () => {
    sketch.createCanvas(400, 400);
    ballX = sketch.width / 2;
    ballY = sketch.height / 2;
    sketch.pixelDensity(1);
    sketch.frameRate(25);
    sketch.rectMode(sketch.CENTER);
    sketch.ellipseMode(sketch.CENTER);
  };

  sketch.draw = () => {
    sketch.background(10, 10, 200);
    ballX += velocityX;
    ballY += velocityY;
    if (ballX >= sketch.width - buffer || ballX <= buffer) {
      velocityX = -velocityX;
    }
    if (ballY >= sketch.height - buffer || ballY <= buffer) {
      velocityY = -velocityY;
    }
    sketch.fill(240, 120, 0);
    sketch.ellipse(ballX, ballY, 50, 50);
  };
};

location = {
  x: -8,
  y: 2,
  z: -18,
};
size = {
  x: 2,
  y: 2,
  z: 0.05
}
rotation = {
  x: 0,
  y: 0,
  z: 0
}
// Add this sketch to the array:
sketches.push({
  sketch: myCoolSketch,
  location: location,
  size: size,
  rotation: rotation
});

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//


// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

// myCoolSketch = (sketch) => {
//     // add sketch 'definition' here
// }
// // where should the sketch end up in the scene:
// location = {
//     x: 0,
//     y: 0,
//     z: 0
// }
// // Add this sketch to the array:
// sketches.push({
//     sketch: mySketch,
//     location: location,
//   });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//
// this makes the sketches available to the scene:
module.exports = sketches;
