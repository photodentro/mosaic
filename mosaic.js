/*
Copyright (C) 2018 Alkis Georgopoulos <alkisg@gmail.com>.
SPDX-License-Identifier: CC-BY-SA-4.0

 Scaling requirements:
 * We want to be able to support full screen.
 * We don't want to use a specific size like 800x600, because then even the
   fonts are scaled!
 * We want to rely on a 16:9 aspect ratio.
 So, result:
 * We resize the canvas on window.resize to fit the window while keeping 16:9.
 * We resize/reposition everything manually.
*/
// TODO: create a game global object to avoid polluting the namespace?
var stage;
var bg;
var contl, contr, contb;  // containers; left, right, bottom
var boxl, boxr, boxb;  // rounded boxes; left, right, bottom
var tilesl = [];
var tilesr = [];
var tilesb = [];
var menubar = [];  // the menu bar buttons
var statusText, lvlText;
var imgSuccess;
const ratio = 16/9;
var ts;  // Tile Size; of course same for x and y (square pixels)
var gridX, gridY;  // how many bitmaps in each top box
var tilesNum;  // = gridX * gridY
// To use .svg images, they must not have width or height="100%":
// https://bugzilla.mozilla.org/show_bug.cgi?id=874811
// Additionally, preloadjs currently doesn't work with .svg images.
// Put the tiles first so that we can get them by index more easily
var resourceNames = ['aquarela_colors', 'giraffe', 'pencil', 'mouse_on_cheese', 'mushroom_house', 'pencils_paper', 'pencils', 'white_cake', 'die_1', 'die_2', 'die_3', 'die_4', 'die_5', 'die_6', 'die_7', 'die_0',  'digital_die1', 'digital_die2', 'digital_die3', 'digital_die4', 'digital_die5', 'digital_die6', 'digital_die7', 'digital_die0', 'bar_home', 'bar_help', 'bar_about', 'bar_previous', 'bar_next', 'background', 'flower_good', 'lion_good'];
var resources = [];
var resourcesLoaded = 0;
var level;
var endGame = false;

function init() {
  console.clear();
  stage = new createjs.Stage("mainCanvas");
  stage.enableMouseOver();
  stage.snapToPixelEnabled = true;
  createjs.Bitmap.prototype.snapToPixel = true;
  statusText = new createjs.Text("Φόρτωση...", "20px Arial", "white");
  statusText.textAlign = "center";
  statusText.textBaseline = "middle";
  stage.addChild(statusText);
  resize();

  // Resource preloading
  for (var i = 0; i < resourceNames.length; i++) {
    resources[i] = new Image();
    resources[i].src = "resource/" + resourceNames[i] + ".svg";
    resources[i].onload = queueFileLoad;
  }
  // The last queueFileLoad calls queueComplete. Execution continues there.
}

function imgByName(name) {
  return resources[resourceNames.indexOf(name)];
}

function queueFileLoad(event) {
  resourcesLoaded++;
  statusText.text = "Φόρτωση " + parseInt(100*resourcesLoaded/resourceNames.length) + " %";
  stage.update();
  if (resourcesLoaded == resourceNames.length)
    queueComplete(event);
}

function queueComplete(event) {
  console.log("Finished loading resources");
  // We only keep statusText for debugging; not visible in production builds
  statusText.visible = false;
  bg = new createjs.Bitmap(imgByName("background"));
  stage.addChild(bg);

  boxl = new createjs.Shape();
  stage.addChild(boxl);
  contl = new createjs.Container();
  stage.addChild(contl);
  // We always initialize the max number of tiles = 24, and reuse them
  for (i = 0; i < 24; i++) {
    tilesl[i] = new createjs.Bitmap(imgByName("die_0"));
    tilesl[i].visible = false;
    contl.addChild(tilesl[i]);
  }

  boxr = new createjs.Shape();
  stage.addChild(boxr);
  contr = new createjs.Container();
  stage.addChild(contr);
  for (i = 0; i < 24; i++) {
    tilesr[i] = new createjs.Bitmap(imgByName("die_0"));
    tilesr[i].visible = false;
    contr.addChild(tilesr[i]);
  }

  boxb = new createjs.Shape();
  stage.addChild(boxb);
  contb = new createjs.Container();
  stage.addChild(contb);
  for (i = 0; i < 24; i++) {
    tilesb[i] = new createjs.Bitmap(imgByName("die_0"));
    tilesb[i].visible = false;
    tilesb[i].addEventListener("pressmove", function(event) {
  var pt = event.target.parent.globalToLocal(event.stageX, event.stageY);
  event.target.x = pt.x;
  event.target.y = pt.y;
  stage.update();
});
    tilesb[i].addEventListener("pressup", function(event) {
  // Suppose we drop a pencil image somewhere in tilesr. If after that we want
  // to drop another image over it, we don't want to check for "mouseover",
  // because the pencil is thin. We want to test for a "square" mouseover.
  var pt = boxr.globalToLocal(event.stageX, event.stageY);
  for (i = 0; i < tilesNum; i++)
    if ((Math.abs(pt.x - tilesr[i].x) <= ts/2)
      && (Math.abs(pt.y - tilesr[i].y) <= ts/2)) {
    tilesr[i].image = event.target.image;
    tilesr[i].updateCache();
    checkEndGame();
  }
  event.target.x = event.target.savedX;
  event.target.y = event.target.savedY;
  stage.update();
});
    contb.addChild(tilesb[i]);
  }

  var onMenuClick = [onMenuHome, onMenuHelp, onMenuAbout, onMenuPrevious, onMenuNext];
  for (i = 0; i < 5; i++) {
    menubar[i] = new createjs.Bitmap(resources[resourceNames.indexOf("bar_home") + i]);
    menubar[i].addEventListener("click", onMenuClick[i]);
    menubar[i].addEventListener("mouseover", function(event) {
  // Bring the target on top in its container, mostly for the rotation animation
  event.target.parent.setChildIndex(event.target, event.target.parent.numChildren - 1);
  event.target.scaleX = 1.2*event.target.savedscaleX;
  event.target.scaleY = 1.2*event.target.savedscaleY;
  stage.update();
});
    menubar[i].addEventListener("mouseout", function(event) {
  event.target.scaleX = event.target.savedscaleX;
  event.target.scaleY = event.target.savedscaleY;
  stage.update();
});
    stage.addChild(menubar[i]);
  }

  lvlText = new createjs.Text("1", "20px Arial", "white");
  lvlText.textAlign = "center";
  lvlText.textBaseline = "middle";
  stage.addChild(lvlText);

  imgSuccess = new createjs.Bitmap(imgByName("flower_good"));
  imgSuccess.visible = false;
  stage.addChild(imgSuccess);

  // Bring statusText in front of everything
  statusText.textAlign = "right";
  statusText.textBaseline = "alphabetic";
  stage.setChildIndex(statusText, stage.numChildren - 1);

  initLevel(0);
  window.addEventListener('resize', resize, false);
  createjs.Ticker.on("tick", tick);
  // createjs.Ticker.timingMode = createjs.Ticker.RAF;
  // createjs.Ticker.framerate = 10;
}

function onMenuHome(event) {
  window.history.back();
}

function onMenuHelp(event) {
  alert("Τραβήξτε εικόνες από το κάτω κουτί στο δεξί κουτί έτσι ώστε να ταιριάζουν με το αριστερό κουτί.");
}

function onMenuAbout(event) {
  window.open("credits/index_DS_II.html");
}

function onMenuPrevious(event) {
  initLevel((level+15) % 16);
}

function onMenuNext(event) {
  initLevel((level+1) % 16);
}

// tilesArray, tileWidth, boxWidth
function alignTiles(tilesA, tileW, boxW) {
  // We do want at least one pixel spacing between the tiles
  tilesPerRow = Math.floor(boxW/(tileW+1))
  // If all tiles fit, use that number
  tilesPerRow = Math.min(tilesA.length, tilesPerRow)
  margin = (boxW - tileW*tilesPerRow) / (tilesPerRow-1)
  for (i = 0; i < tilesA.length; i++) {
    if (!tilesA[i].image) {
      console.log(i)
      console.log(tilesA)
    }
    tilesA[i].scaleX = tileW / tilesA[i].image.width;
    tilesA[i].scaleY = tileW / tilesA[i].image.height;
    tilesA[i].regX = tilesA[i].image.width / 2;
    tilesA[i].regY = tilesA[i].image.height / 2;
    tilesA[i].x = (margin+tileW) * (i % tilesPerRow) + tilesA[i].scaleX*tilesA[i].regX;
    tilesA[i].y = (margin+tileW) * Math.floor(i / tilesPerRow) + tilesA[i].scaleY*tilesA[i].regY;
    // These copies are used to preserve the initial coordinates on drag 'n' drop
    tilesA[i].savedX = tilesA[i].x
    tilesA[i].savedY = tilesA[i].y
    // These copies are used to preserve the original scale on mouseover
    tilesA[i].savedscaleX = tilesA[i].scaleX;
    tilesA[i].savedscaleY = tilesA[i].scaleY;
    tilesA[i].cache(0, 0, tilesA[i].image.width, tilesA[i].image.height)
  }
}

function resize() {
  // Resize the canvas element
  winratio = window.innerWidth/window.innerHeight;
  if (winratio >= ratio) {
    stage.canvas.height = window.innerHeight;
    stage.canvas.width = stage.canvas.height * ratio;
  } else {
    stage.canvas.width = window.innerWidth;
    stage.canvas.height = stage.canvas.width / ratio;
  }

  // If loadComplete() hasn't been called yet, the rest of the items aren't available
  if (!boxl) {
    statusText.x = stage.canvas.width / 2;
    statusText.y = stage.canvas.height / 2;
    statusText.font = parseInt(stage.canvas.height/10) + "px Arial";
    return;
  }
  // Calculate the new tile size
  // We want to fit 2 boxes of gridX tiles, and 2 for spacing.
  ts = Math.floor(stage.canvas.width / (2*gridX+2));
  space = stage.canvas.width - 2*gridX*ts;

  // This depicts the spacing of the top boxes
  margin = space / (5 + (1 + (gridX - 1) + 1) + 1 + (1 + (gridX - 1) + 1) + 5);
  boxl.x = 5*margin;
  boxl.y = margin;
  boxl.alpha = 0.5;
  boxl.graphics.clear();
  boxl.graphics.beginStroke("#000");
  boxl.graphics.setStrokeStyle(1);
  boxl.graphics.beginFill("DarkTurquoise").drawRoundRect(0, 0, gridX*ts + (gridX+1)*margin, gridY*ts + (gridY+1)*margin, margin);
  contl.x = boxl.x + margin;
  contl.y = boxl.y + margin;
  alignTiles(tilesl, ts, gridX*ts + (gridX-1)*margin);

  boxr.x = gridX*ts + (gridX+7)*margin;
  boxr.y = boxl.y;
  boxr.alpha = 0.5;
  boxr.graphics.clear();
  boxr.graphics.beginStroke("#000");
  boxr.graphics.setStrokeStyle(1);
  boxr.graphics.beginFill("OrangeRed").drawRoundRect(0, 0, gridX*ts + (gridX+1)*margin, gridY*ts + (gridY+1)*margin, margin);
  contr.x = boxr.x + margin;
  contr.y = boxr.y + margin;
  alignTiles(tilesr, ts, gridX*ts + (gridX-1)*margin);

  boxb.x = boxl.x;
  boxb.y = gridY*ts + (gridY+3)*margin;
  boxb.alpha = 0.5;
  boxb.graphics.clear();
  boxb.graphics.beginStroke("#000");
  boxb.graphics.setStrokeStyle(1);
  boxb.graphics.beginFill("DeepSkyBlue").drawRoundRect(0, 0, 2*gridX*ts + (2*gridX+3)*margin, (Math.floor(1+(tilesNum-1)/12))*ts + (Math.floor(2+(tilesNum-1)/12))*margin, margin);
  contb.x = boxb.x + margin;
  contb.y = boxb.y + margin;
  alignTiles(tilesb, ts, 2*gridX*ts + (2*gridX+1)*margin);

  var bbs = stage.canvas.height / 10;  // bar button size
  var bbm = bbs / 5;  // bar button margin
  // TODO: local/global variables, eslint...
  for (i = 0; i < 5; i++) {
    // Leave one space for the level
    if (i < 4)
      j = i;
    else
      j = i + 1;
    menubar[i].scaleX = bbs / menubar[i].image.width;
    menubar[i].scaleY = bbs / menubar[i].image.height;
    menubar[i].regX = menubar[i].image.width / 2;
    menubar[i].regY = menubar[i].image.height / 2;
    menubar[i].x = (j + 1)*bbm + bbs/2 + j*bbs;
    menubar[i].y = stage.canvas.height - bbm - bbs/2;
    // These copies are used to preserve the original scale on mouseover
    menubar[i].savedscaleX = menubar[i].scaleX;
    menubar[i].savedscaleY = menubar[i].scaleY;
  }

  lvlText.text = level + 1;
  lvlText.x = (4 + 1)*bbm + bbs/2 + 4*bbs;
  lvlText.y = stage.canvas.height - bbm/2 - bbs/2;
  lvlText.font = parseInt(2*bbs/2) + "px Arial";

  // If level is single digit, move lvlText and bar_previous a bit left
  if (level + 1 < 10) {
    lvlText.x -= bbs/4;
    menubar[4].x -= bbs/2;
  }

  imgSuccess.scaleY = (2/3) * stage.canvas.height / imgSuccess.image.height;
  imgSuccess.scaleX = imgSuccess.scaleY;
  imgSuccess.regX = imgSuccess.image.width / 2;
  imgSuccess.regY = imgSuccess.image.height / 2;
  imgSuccess.x = stage.canvas.width / 2;
  imgSuccess.y = stage.canvas.height / 2;

  statusText.text = "Επίπεδο: " + (level + 1 ) + ", εικονίδια: " + tilesNum;
  statusText.x = stage.canvas.width - bbm;
  statusText.y = stage.canvas.height - bbm;
  statusText.font = parseInt(bbs/2) + "px Arial";

  // Fill all the canvas with the background
  bg.scaleX = stage.canvas.width / bg.image.width;
  bg.scaleY = stage.canvas.height / bg.image.height;
  bg.cache(0, 0, bg.image.width, bg.image.height);
  
  stage.update();
}

function tick() {
  if (endGame) {
     imgSuccess.scaleX *= 1.01;
     imgSuccess.scaleY *= 1.01;
  }
  statusText.text = "Επίπεδο: " + (level + 1 ) + ", εικονίδια: " + tilesNum + ', fps: ' + Math.round(createjs.Ticker.getMeasuredFPS());
  stage.update();
}

function initLevel(newLevel) {
  // Internal level number is zero-based; but we display it as 1-based.
  // Levels:       0-1 2-3  4-5  6-7  8-9  10-11 12-13 14-15
  // Top layouts:  3x2 4x2  5x2  6x2  5x3   6x3   5x4   6x4
  // Bot layout:   6+0 8+0 10+0 12+0 12+3  12+6  12+8  12+12
  // Tiles number:  6   8   10   12   15    18    20    24
  // Max box sizes: left(6x4) right(6x4) bot(12x2)

  var tilesNumArr = [6, 8, 10, 12, 15, 18, 21, 24];
  var gridXArr = [3, 4, 5, 6, 5, 6, 7, 6];
  var shuffle = [];

  level = newLevel;
  i = Math.floor(level/2)
  tilesNum = tilesNumArr[i];
  gridX = gridXArr[i];
  gridY = tilesNum / gridX;

  for (i = 0; i < 24; i++) {
    tilesl[i].visible = i < tilesNum;
    tilesr[i].visible = i < tilesNum;
    tilesb[i].visible = i < tilesNum;
  }
  start = level % 4;
  if (start + tilesNum > 24)
    start = 0;
  for (i = 0; i < tilesNum; i++) {
     tilesb[i].image = resources[start + i];
     tilesr[i].image = imgByName("die_0");
     shuffle[i] = start + i;
  }
  for (i = 0; i < tilesNum; i++) {
    rand = Math.floor(Math.random() * tilesNum);
    temp = shuffle[i];
    shuffle[i] = shuffle[rand];
    shuffle[rand] = temp;
  }
  for (i = 0; i < tilesNum; i++) {
     tilesl[i].image = resources[shuffle[i]];
  }

  endGame = false;
  imgSuccess.image = resources[resourceNames.indexOf("flower_good") + Math.floor(Math.random() * 2)];
  imgSuccess.visible = false;
  resize();
}

function checkEndGame() {
  endGame = true;
  for (i = 0; i < tilesNum; i++) {
    if (tilesr[i].image.src != tilesl[i].image.src)
      endGame = false;
  }
  if (endGame) {
    imgSuccess.visible = true;
    setTimeout(onMenuNext, 3000);
    stage.update();
  }
}
