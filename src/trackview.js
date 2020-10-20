(function (window, document) {
if (!window.XMPlayer) {
  window.XMPlayer = {};
}
var player = window.XMPlayer;

if (!window.XMView) {
  window.XMView = {};
}
var view = window.XMView;

var _pattern_cellwidth = 16 + 4 + 8 + 4 + 8 + 16 + 4;
var _scope_width = _pattern_cellwidth - 1;
var _pattern_border = 20;

view.init = init;
view.pushEvent = pushEvent;
view.pause = pause;
view.resume = resume;
view.stop = stop;
view.scope_width = _scope_width;

// Load font (ripped from FastTracker 2)
var fontimg = new window.Image();
fontimg.src = "ft2font.png";

var _fontmap_notes = [8*5, 8*22, 8*28];
var pat_canvas_patnum;

var audio_events;
var paused_events;
var shown_row;

// canvas to render patterns onto
var pat_canvas = document.createElement('canvas');

// pixel widths of each character in the proportional font
var _fontwidths = [
  4, 7, 3, 6, 6, 6, 6, 5, 4, 5, 5, 5, 5, 5, 7, 7,
  5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 6, 7, 7, 7, 7, 7,
  4, 2, 5, 7, 7, 7, 7, 3, 4, 4, 6, 6, 3, 6, 2, 7,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 2, 3, 6, 6, 6, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 2, 7, 7, 7, 8, 8, 7,
  7, 7, 7, 7, 8, 7, 7, 8, 8, 8, 7, 4, 7, 4, 4, 5,
  3, 6, 6, 6, 6, 6, 4, 6, 6, 2, 4, 6, 2, 8, 6, 6,
  6, 6, 4, 6, 4, 6, 7, 8, 7, 6, 6, 4, 2, 4, 4, 4];

var _bigfontwidths = [
   4, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
  15, 15, 15, 15, 15, 15, 15, 15, 13, 13, 13, 15, 15, 15, 15, 15,
   4,  5, 12, 16, 15, 15, 16,  5,  8,  8, 13, 10,  6, 10,  5, 12,
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15,  5,  6, 12, 10, 12, 15,
  14, 15, 15, 15, 15, 15, 15, 15, 15,  5, 13, 15, 14, 15, 15, 15,
  15, 16, 15, 15, 15, 15, 15, 15, 15, 15, 16,  7, 12,  7, 13, 15,
   5, 13, 13, 13, 13, 13, 11, 13, 13,  5,  9, 13,  5, 16, 13, 13,
  13, 13, 12, 13, 11, 13, 13, 16, 15, 13, 15,  9,  2,  9, 15, 15];

// draw FT2 proportional font text to a drawing context
// returns width rendered
function drawText(text, dx, dy, ctx) {
  var dx0 = dx;
  for (var i = 0; i < text.length; i++) {
    var n = text.charCodeAt(i);
    var sx = (n&63)*8;
    var sy = (n>>6)*10 + 56;
    var width = _fontwidths[n];
    ctx.drawImage(fontimg, sx, sy, width, 10, dx, dy, width, 10);
    dx += width + 1;
  }
  return dx - dx0;
}

function getTextSize(text, widthtable) {
  var width = 0;
  for (var i = 0; i < text.length; i++) {
    var n = text.charCodeAt(i);
    width += widthtable[n] + 1;
  }
  return width;
}

function drawBigText(text, dx, dy, ctx) {
  var dx0 = dx;
  for (var i = 0; i < text.length; i++) {
    var n = text.charCodeAt(i);
    var sx = (n&31)*16;
    var sy = (n>>5)*20 + 96;
    var width = _bigfontwidths[n];
    ctx.drawImage(fontimg, sx, sy, width, 20, dx, dy, width, 20);
    dx += width + 1;
  }
  return dx - dx0;
}

function RenderPattern(canv, pattern) {
  // a pattern consists of NxM cells which look like
  // N-O II VV EFF
  var cellwidth = _pattern_cellwidth;
  canv.width = pattern[0].length * cellwidth + _pattern_border;
  canv.height = pattern.length * 8;
  var ctx = canv.getContext('2d');
  ctx.fillcolor='#000';
  ctx.fillRect(0, 0, canv.width, canv.height);
  for (var j = 0; j < pattern.length; j++) {
    var row = pattern[j];
    var dy = j * 8;
    // render row number
    ctx.drawImage(fontimg, 8*(j>>4), 0, 8, 8, 2, dy, 8, 8);
    ctx.drawImage(fontimg, 8*(j&15), 0, 8, 8, 10, dy, 8, 8);

    for (var i = 0; i < row.length; i++) {
      var dx = i*cellwidth + 2 + _pattern_border;
      var data = row[i];

      // render note
      var note = data[0];
      if (note < 0) {
        // no note = ...
        ctx.drawImage(fontimg, 0, 8*5, 16, 8, dx, dy, 16, 8);
      } else {
        var octave = (note/12)|0;
        var note_fontrow = _fontmap_notes[(octave/3)|0];
        note = (note % (12*3))|0;
        ctx.drawImage(fontimg, 16+16*note, note_fontrow, 16, 8, dx, dy, 16, 8);
      }
      dx += 20;

      // render instrument
      var inst = data[1];
      if (inst != -1) {  // no instrument = render nothing
        if (inst > 15) {
          ctx.drawImage(fontimg, 8*(inst>>4), 4*8, 4, 8, dx, dy, 4, 8);
        }
        ctx.drawImage(fontimg, 8*(inst&15), 4*8, 4, 8, dx+4, dy, 4, 8);
      }
      dx += 12;

      // render volume
      var vol = data[2];
      if (vol < 0x10) {
        // no volume = ..
        ctx.drawImage(fontimg, 312, 0, 8, 8, dx, dy, 8, 8);
      } else {
        ctx.drawImage(fontimg, 8*(vol>>4) + 56*8, 4*8, 8, 8, dx, dy, 8, 8);
        ctx.drawImage(fontimg, 8*(vol&15), 4*8, 4, 8, dx+4, dy, 4, 8);
      }
      dx += 8;

      // render effect
      var eff = data[3];
      var effdata = data[4];
      if (eff !== 0 || effdata !== 0) {
        // draw effect with tiny font (4px space + effect type 0..9a..z)
        ctx.drawImage(fontimg, 8*eff + 16*8, 4*8, 8, 8, dx, dy, 8, 8);
        dx += 8;
        // (hexadecimal 4-width font)
        ctx.drawImage(fontimg, 8*(effdata>>4), 4*8, 4, 8, dx, dy, 4, 8);
        ctx.drawImage(fontimg, 8*(effdata&15), 4*8, 4, 8, dx+4, dy, 4, 8);
      } else {
        // no effect = ...
        ctx.drawImage(fontimg, 0, 8*5, 16, 8, dx+2, dy, 16, 8);
      }
    }
  }
}

function redrawScreen() {
  var e;
  var t = player.audioctx.currentTime;
  while (audio_events.length > 0 && audio_events[0].t < t) {
    e = audio_events.shift();
  }
  if (!e) {
    if (player.playing) {
      window.requestAnimationFrame(redrawScreen);
    }
    return;
  }
  var VU = e.vu;
  var scopes = e.scopes;
  var ctx;

  if (e.scopes !== undefined) {
    // update VU meters & oscilliscopes
    var canvas = document.getElementById("vu");
    ctx = canvas.getContext("2d");
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, 64);
    ctx.fillStyle = '#0f0';
    ctx.strokeStyle = '#55acff';
    for (var j = 0; j < player.xm.nchan; j++) {
      var x = _pattern_border + j * _pattern_cellwidth;
      // render channel number
      drawText(''+j, x, 1, ctx);

      // volume in dB as a green bar
      var vu_y = -Math.log(VU[j])*10;
      ctx.fillRect(x, vu_y, 2, 64-vu_y);

      // oscilloscope
      var scope = scopes[j];
      if (scope) {
        ctx.beginPath();
        for (var k = 0; k < _scope_width; k++) {
          ctx.lineTo(x + 1 + k, 32 - 16 * scope[k]);
        }
        ctx.stroke();
      }
    }
  }

  if (e.row != shown_row || e.pat != pat_canvas_patnum) {
    if (e.pat != pat_canvas_patnum) {
      var p = player.xm.patterns[e.pat];
      if (p) {
        RenderPattern(pat_canvas, player.xm.patterns[e.pat]);
        pat_canvas_patnum = e.pat;
      }
    }

    var gfx = document.getElementById("gfxpattern");
    ctx = gfx.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, gfx.width, gfx.height);
    ctx.fillStyle = '#2a5684';
    ctx.fillRect(0, gfx.height/2 - 4, gfx.width, 8);
    ctx.globalCompositeOperation = 'lighten';
    ctx.drawImage(pat_canvas, 0, gfx.height / 2 - 4 - 8*(e.row));
    ctx.globalCompositeOperation = 'source-over';
    shown_row = e.row;
  }

  if (player.playing) {
    window.requestAnimationFrame(redrawScreen);
  }
}

function init() {
  var title = document.getElementById("title");
  // make title element fit text exactly, then render it
  title.width = getTextSize(player.xm.songname, _bigfontwidths);
  var ctx = title.getContext('2d');
  drawBigText(player.xm.songname, 0, 1, ctx);

  var instrlist = document.getElementById("instruments");
  // clear instrument list if not already clear
  while (instrlist.childNodes.length) {
    instrlist.removeChild(instrlist.childNodes[0]);
  }
  var instrcols = ((player.xm.instruments.length + 7) / 8) | 0;
  for (var i = 0; i < instrcols; i++) {
    var canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    var instrcolumnwidth = 8*22;
    canvas.width = instrcolumnwidth;
    canvas.height = 8 * 10;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var hasname = 0, hasdata = 0;
    for (var j = 8*i; j < Math.min(8*i+8, player.xm.instruments.length); j++) {
      var y = 10*(j - 8*i);
      var n = (j+1).toString(16);
      if (j < 15) n = '0' + n;
      var data = player.xm.instruments[j].samples;
      if (data) {
        var len = data[0].len;
        data = data[0].sampledata;
        var scale = Math.ceil(len / instrcolumnwidth);
        ctx.strokeStyle = '#55acff';
        ctx.beginPath();
        for (var k = 0; k < Math.min(len / scale, instrcolumnwidth - 20); k++) {
          ctx.lineTo(k + 20, y + data[k*scale] * 4 + 4);
        }
        ctx.stroke();
        hasdata++;
      }
      var name = player.xm.instruments[j].name;
      ctx.globalCompositeOperation = 'lighten';
      drawText(n, 1, y, ctx);
      if (name !== '') {
        drawText(player.xm.instruments[j].name, 20, y, ctx);
        hasname++;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (hasname || hasdata) {
      instrlist.appendChild(canvas);
    }
  }

  document.getElementById('vu').width = _pattern_border +
    _pattern_cellwidth * player.xm.nchan;
  var gfxpattern = document.getElementById("gfxpattern");
  gfxpattern.width = _pattern_cellwidth * player.xm.nchan + _pattern_border;

  // generate a fake audio event to render the initial paused screen
  var scopes = [];
  for (i = 0; i < player.xm.nchan; i++) {
    scopes.push(new Float32Array(_scope_width));
  }

  // reset display
  shown_row = undefined;
  pat_canvas_patnum = undefined;

  audio_events = [];
  paused_events = [];
  audio_events.push({
    t: 0, row: 0, pat: player.xm.songpats[0],
    vu: new Float32Array(player.xm.nchan),
    scopes: scopes
  });
  redrawScreen();
}

function pushEvent(e) {
  audio_events.push(e);
  if (audio_events.length == 1) {
    requestAnimationFrame(redrawScreen);
  }
}

function pause() {
  // grab all the audio events
  var t = player.audioctx.currentTime;
  while (audio_events.length > 0) {
    var e = audio_events.shift();
    e.t -= t;
    paused_events.push(e);
  }
}

function resume() {
  var t = player.audioctx.currentTime;
  while (paused_events.length > 0) {
    var e = paused_events.shift();
    e.t += t;
    audio_events.push(e);
  }
  requestAnimationFrame(redrawScreen);
}

function stop() {
  audio_events = [];
  paused_events = [];
}

})(window, document);
