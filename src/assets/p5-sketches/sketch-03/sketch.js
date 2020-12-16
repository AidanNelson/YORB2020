// where do you want your sketch to live in the space
window.yorbConfig = {
  active:true,
  name: "Billy Bennett",
  description: "Cool Sketch",
  shape: "box", 
  position: {
    x: -10,
    y: 1.5,
    z: 16.4
  },
  rotation: {
    x: 0,
    y:45,
    z: 0
  },
  scale: {
    x: 1,
    y: 1,
    z: 1
  }
}





function setup(){
    createCanvas(400, 400);
}

function draw ()  {
    background(127, 0, 150);
    strokeWeight(3);
    var a = 0;
    var p = [];
    var inc = TWO_PI / 25.0;
    let blueLineLen, blueLineDest;

    for (var i = 0; i < 41; i++) {
    if (i % 2 !== 1) stroke('yellow')
    else stroke('red')
    let x = 60;
    let y = 200;
    let x2 = 300 + sin(frameCount * 0.05 + i) * 10;
    let y2 = 42 + cos(a) + i * 8;
    line(x, y, x2, y2);
    p[i] = {
        "x": x2,
        "y": y2
    }
    stroke('cyan');
    if (p[i - 1]) {
        line(x2 - blueLineDest, y2 - blueLineLen, p[i - 1].x, p[i - 1].y)
    }
    a = a + inc;
    }
    noFill();
    ellipse(60, 200, 50);
}


