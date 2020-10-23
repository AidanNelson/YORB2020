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


myCoolSketch = (sketch) => {
  sketch.setup = ()=> {
    sketch.createCanvas(400, 400);
  }

  sketch.draw = () => {
    sketch.background(127, 0, 150);
    sketch.strokeWeight(3);
    var a = 0;
    var p = [];
    var inc = sketch.TWO_PI / 25.0;
    let blueLineLen, blueLineDest;

    for (var i = 0; i < 41; i++) {
      if (i % 2 !== 1) sketch.stroke('yellow')
      else sketch.stroke('red')
      let x = 60;
      let y = 200;
      let x2 = 300 + sketch.sin(sketch.frameCount * 0.05 + i) * 10;
      let y2 = 42 + sketch.cos(a) + i * 8;
      sketch.line(x, y, x2, y2);
      p[i] = {
        "x": x2,
        "y": y2
      }
      sketch.stroke('cyan');
      if (p[i - 1]) {
        sketch.line(x2 - blueLineDest, y2 - blueLineLen, p[i - 1].x, p[i - 1].y)
      }
      a = a + inc;
    }
    sketch.noFill();
    sketch.ellipse(60, 200, 50);
  }
}
// where should the sketch end up in the scene:
// [-8.774632992681308, 0.5, 16.359285500664296]
location = {
    x: -9,
    y: 1,
    z: 16
}
size = {
  x: 1.5,
  y: 1.5,
  z: 1.5
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
// size = {
//   x: 1,
//   y: 1,
//   z: 1
// }
// rotation = {
//   x: 0,
//   y: 0,
//   z: 0
// }
// Add this sketch to the array:
// sketches.push({
//   sketch: myCoolSketch,
//   location: location,
//   size: size,
//   rotation: rotation
// });
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
// size = {
//   x: 1,
//   y: 1,
//   z: 1
// }
// rotation = {
//   x: 0,
//   y: 0,
//   z: 0
// }
// Add this sketch to the array:
// sketches.push({
//   sketch: myCoolSketch,
//   location: location,
//   size: size,
//   rotation: rotation
// });
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
// size = {
//   x: 1,
//   y: 1,
//   z: 1
// }
// rotation = {
//   x: 0,
//   y: 0,
//   z: 0
// }
// Add this sketch to the array:
// sketches.push({
//   sketch: myCoolSketch,
//   location: location,
//   size: size,
//   rotation: rotation
// });
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
// size = {
//   x: 1,
//   y: 1,
//   z: 1
// }
// rotation = {
//   x: 0,
//   y: 0,
//   z: 0
// }
// Add this sketch to the array:
// sketches.push({
//   sketch: myCoolSketch,
//   location: location,
//   size: size,
//   rotation: rotation
// });
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
// size = {
//   x: 1,
//   y: 1,
//   z: 1
// }
// rotation = {
//   x: 0,
//   y: 0,
//   z: 0
// }
// Add this sketch to the array:
// sketches.push({
//   sketch: myCoolSketch,
//   location: location,
//   size: size,
//   rotation: rotation
// });

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
// size = {
//   x: 1,
//   y: 1,
//   z: 1
// }
// rotation = {
//   x: 0,
//   y: 0,
//   z: 0
// }
// Add this sketch to the array:
// sketches.push({
//   sketch: myCoolSketch,
//   location: location,
//   size: size,
//   rotation: rotation
// });

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//




// this makes the sketches available to the scene:
module.exports = sketches;
