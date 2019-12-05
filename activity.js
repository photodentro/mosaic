/*
Copyright (C) 2018 Alkis Georgopoulos <alkisg@gmail.com>.
SPDX-License-Identifier: CC-BY-SA-4.0
*/
var act = null;  // activity object, see initActivity()

function onError(message, source, lineno, colno, error) {
  alert(sformat('Σφάλμα προγραμματιστή!\n'
    + 'message: {}\nsource: {}\nlineno: {}\ncolno: {}\nerror: {}',
  message, source, lineno, colno, error));
}

// ES6 string templates don't work in old Android WebView
function sformat(format) {
  var args = arguments;
  var i = 0;
  return format.replace(/{(\d*)}/g, function sformatReplace(match, number) {
    i += 1;
    if (typeof args[number] !== 'undefined') {
      return args[number];
    }
    if (typeof args[i] !== 'undefined') {
      return args[i];
    }
    return match;
  });
}

// Return an integer from 0 to num-1.
function random(num) {
  return Math.floor(Math.random() * num);
}

// Return a shuffled array [0, ..., num-1].
// If differentIndex==true, make sure that array[i] != i.
function shuffledArray(num, differentIndex) {
  var result = [];
  var i;
  var j;
  var temp;

  // Fill the array with [0, ..., num-1]
  for (i = 0; i < num; i += 1) {
    result.push(i);
  }
  // Shuffle the array
  for (i = 0; i < num; i += 1) {
    j = random(num);
    temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  // Make sure that result[i] != i
  if (differentIndex) {
    for (i = 0; i < num; i += 1) {
      if (result[i] === i) {
        j = (i + 1) % num;
        temp = result[i];
        result[i] = result[j];
        result[j] = temp;
      }
    }
  }
  return result;
}

function ge(element) {
  return document.getElementById(element);
}

function setKeyframes(element, rule, duration) {
  var e = element;
  var i;
  var name = sformat('{}_animation', e.id);

  // The webkit* stuff is for old android webview versions
  e.style.animationName = '';
  e.style.webkitAnimationName = '';
  // First, delete the old animation for this element, if it exists
  for (i = 0; i < act.sheet.cssRules.length; i += 1) {
    if (act.sheet.cssRules[i].name === name) {
      act.sheet.deleteRule(i);
    }
  }
  // Now add the rule
  try {
    act.sheet.insertRule(sformat('@keyframes {} { {} }', name, rule), act.sheet.cssRules.length);
  } catch (err) {
    act.sheet.insertRule(sformat('@-webkit-keyframes {} { {} }', name, rule), act.sheet.cssRules.length);
  }
  void e.offsetWidth;  // https://css-tricks.com/restart-css-animation/
  // IE needs animationDuration before animationName
  e.style.animationDuration = duration || '2s';
  e.style.webkitAnimationDuration = e.style.animationDuration;
  e.style.animationName = name;
  e.style.webkitAnimationName = e.style.animationName;
}

function onResize(event) {
  var w = window.innerWidth;
  var h = window.innerHeight;
  if (w / h < 640 / 360) {
    document.body.style.fontSize = sformat('{}px', 10 * w / 640);
  } else {
    document.body.style.fontSize = sformat('{}px', 10 * h / 360);
  }
}

function doPreventDefault(event) {
  event.preventDefault();
}

function onHome(event) {
  window.history.back();
}

function onHelp(event) {
  ge('help').style.display = 'flex';
  ge('helpaudio').play();
}

function onHelpHide(event) {
  ge('help').style.display = '';
}

function onAbout(event) {
  window.open('credits/index_DS_II.html');
}

function onFullScreen(event) {
  var doc = window.document;
  var docEl = doc.documentElement;
  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen
    || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen
    || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.mozFullScreenElement
    && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    requestFullScreen.call(docEl);
  } else {
    cancelFullScreen.call(doc);
  }
}

function onPrevious(event) {
  initLevel(act.level - 1);
}

function onNext(event) {
  initLevel(act.level + 1);
}

// HTML5 drag and drop has various issues (e.g. drag image sizing)
// and not wide browser compatibility. So implement our own way.
// Also, make it work with touch events.
function onDown(obj, x, y) {
  var dragimg = ge('dragimg');

  act.dragobj = obj;
  dragimg.style.display = 'block';
  dragimg.src = act.dragobj.src;
  dragimg.style.width = act.dragobj.style.width;
  dragimg.style.height = act.dragobj.style.height;
  dragimg.style.padding = act.dragobj.style.padding;
  onMove(x, y);
}

function onMove(x, y) {
  var dri;

  if (!act.dragobj) {
    return;
  }
  dri = ge('dragimg');
  dri.style.left = sformat('{}px', x - Math.round(dri.clientWidth / 2));
  dri.style.top = sformat('{}px', y - Math.round(dri.clientHeight / 2));
}

function onUp(x, y) {
  var el;
  var dro;

  if (!act.dragobj) {
    return;
  }
  ge('dragimg').style.display = '';
  dro = act.dragobj;
  act.dragobj = null;
  el = document.elementFromPoint(x, y);
  if (!el || (el.parentElement.id !== 'clone')) {
    return;
  }
  el.$ord = dro.$ord;
  el.src = dro.src;
  checkLevelOver();
}

function onStockMouseDown(event) {
  onDown(this, event.pageX, event.pageY);
}

function onDocumentMouseMove(event) {
  onMove(event.pageX, event.pageY);
}

function onDocumentMouseUp(event) {
  onUp(event.pageX, event.pageY);
}

function onStockTouchStart(event) {
  onDown(this, event.touches[0].clientX, event.touches[0].clientY);
  act.mouseX = event.touches[0].clientX;
  act.mouseY = event.touches[0].clientY;
  if (act.dragobj) {
    event.preventDefault();
  }
}

function onTouchMove(event) {
  onMove(event.touches[0].clientX, event.touches[0].clientY);
  act.mouseX = event.touches[0].clientX;
  act.mouseY = event.touches[0].clientY;
  if (act.dragobj) {
    event.preventDefault();
  }
}

function onTouchEnd(event) {
  if (act.dragobj) {
    event.preventDefault();
  }
  onUp(act.mouseX, act.mouseY);
}

function checkLevelOver() {
  var i;
  var mid;

  for (i = 0; i < act.tilesNum; i += 1) {
    if (act.clone[i].$ord !== act.original[i].$ord) {
      return;
    }
  }
  mid = (act.clone[0].offsetLeft - act.original[0].offsetLeft)
    / parseFloat(document.body.style.fontSize) / 2;
  setKeyframes(ge('original'), [
    '0% { transform: translate(0em); opacity: 1; }',
    sformat('50% { transform: translate({}em); opacity: 1; }', mid),
    sformat('100% { transform: translate({}em, 5em); opacity: 0; }', mid)].join('\n'), '4s');
  setKeyframes(ge('clone'), [
    '0% { transform: translate(0em); opacity: 1; }',
    sformat('50% { transform: translate({}em); opacity: 1; }', -mid),
    sformat('100% { transform: translate({}em, 5em); opacity: 0; }', -mid)].join('\n'), '4s');
  setKeyframes(ge('stock'), [
    '0% { opacity: 1; }',
    '50% { opacity: 0; }',
    '100% { opacity: 0; }'].join('\n'), '4s');
  setTimeout(initLevel, 4000, act.level + 1);
}

function initLevel(newLevel) {
  // Internal level number is zero-based; but we display it as 1-based.
  // We allow/fix newLevel if it's outside its proper range.
  // Levels:       0-1 2-3  4-5  6-7  8-9  10-11 12-13 14-15
  // Top layouts:  3x2 4x2  5x2  6x2  5x3   6x3   5x4   6x4
  // Bot layout:   6+0 8+0 10+0 12+0 12+3  12+6  12+8  12+12
  // Tiles number:  6   8   10   12   15    18    20    24
  // Max box sizes: left(6x4) right(6x4) bot(12x2)
  var numLevels = 16;
  var i;
  var tilesNumArr = [6, 8, 10, 12, 15, 18, 21, 24];
  var gridXArr = [3, 4, 5, 6, 5, 6, 7, 6];
  var gridX;
  var size;
  var padding;
  var start;
  var shufa;

  act.level = (newLevel + numLevels) % numLevels;
  i = Math.floor(act.level / 2);
  act.tilesNum = tilesNumArr[i];
  gridX = gridXArr[i];
  size = 62 / (2 * gridX + 1);
  padding = size / 20;

  for (i = 0; i < 24; i += 1) {
    act.original[i].style.display = (i < act.tilesNum) ? '' : 'none';
    act.original[i].style.width = sformat('{}em', size);
    act.original[i].style.height = act.original[i].style.width;
    act.original[i].style.padding = sformat('{}em', padding);
    act.clone[i].style.display = act.original[i].style.display;
    act.clone[i].style.width = act.original[i].style.width;
    act.clone[i].style.height = act.original[i].style.height;
    act.clone[i].style.padding = act.original[i].style.padding;
    act.stock[i].style.display = act.original[i].style.display;
    act.stock[i].style.width = act.original[i].style.width;
    act.stock[i].style.height = act.original[i].style.height;
    act.stock[i].style.padding = act.original[i].style.padding;
  }
  ge('original').style.width = sformat('{}em', gridX * size + 2 * padding);
  ge('original').style.padding = sformat('{}em 0 0 {}em', padding, padding);
  ge('clone').style.width = ge('original').style.width;
  ge('clone').style.padding = ge('original').style.padding;
  ge('stock').style.width = sformat('{}em', 2 * gridX * size + 3 * padding);
  ge('stock').style.padding = ge('original').style.padding;
  start = act.level % 4;
  if (start + act.tilesNum > 24) {
    start = 0;
  }
  for (i = 0; i < act.tilesNum; i += 1) {
    act.stock[i].src = sformat('resource/p{}.svg', start + i);
    act.stock[i].$ord = start + i;
    act.clone[i].src = 'resource/p.svg';
    act.clone[i].$ord = -1;
  }
  shufa = shuffledArray(act.tilesNum, false);
  for (i = 0; i < act.tilesNum; i += 1) {
    act.original[i].src = sformat('resource/p{}.svg', start + shufa[i]);
    act.original[i].$ord = start + shufa[i];
  }
  ge('level').innerHTML = act.level + 1;
}

function initActivity() {
  var i;

  act = {
    level: 0,
    tilesNum: -1,
    original: [],
    clone: [],
    stock: [],
    sheet: null,
    dragobj: null,
    mouseX: 0,  // The ontouchend event doesn't contain any coords,
    mouseY: 0,  // so we keep the last ontouchmove ones.
  };
  for (i = 0; i < 24; i += 1) {
    act.original.push(ge(sformat('o{}', i)));
    act.clone.push(ge(sformat('c{}', i)));
    act.stock.push(ge(sformat('s{}', i)));
    act.stock[i].onmousedown = onStockMouseDown;
    act.stock[i].ontouchstart = onStockTouchStart;
  }
  onResize();
  // Create a <style> element for animations, to avoid CORS issues on Chrome
  act.sheet = document.styleSheets[0];
  // TODO: dynamically? document.head.appendChild(document.createElement('style'));
  // Install event handlers
  document.body.onresize = onResize;
  document.body.oncontextmenu = doPreventDefault;
  document.body.onmousemove = onDocumentMouseMove;
  document.body.onmouseup = onDocumentMouseUp;
  document.body.onmouseleave = onDocumentMouseUp;
  document.body.ontouchmove = onTouchMove;
  document.body.ontouchend = onTouchEnd;
  ge('bar_home').onclick = onHome;
  ge('bar_help').onclick = onHelp;
  ge('help').onclick = onHelpHide;
  ge('bar_about').onclick = onAbout;
  ge('bar_fullscreen').onclick = onFullScreen;
  ge('bar_previous').onclick = onPrevious;
  ge('bar_next').onclick = onNext;
  for (i = 0; i < document.images.length; i += 1) {
    document.images[i].ondragstart = doPreventDefault;
  }
  initLevel(act.level);
}

window.onerror = onError;
window.onload = initActivity;
// Call onResize even before the images are loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onResize);
} else {  // `DOMContentLoaded` already fired
  onResize();
}
