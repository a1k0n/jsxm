var _note_names = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
function prettify_note(note) {
  if (note <= 0) return "---";
  if (note == 97) return "^^^";
  note += 11;
  return _note_names[note%12] + ~~(note/12);
}

function prettify_number(num) {
  if (num == -1) return "--";
  if (num < 10) return "0" + num;
  return num;
}

function prettify_effect(t, p) {
  if (t == -1) t = "-"; else t = t.toString(16);
  if (p == -1) p = "--";
  else if (p < 16) p = '0' + p.toString(16);
  else p = p.toString(16);
  return "" + t + p
}

function prettify_notedata(note, inst, vol, efftype, effparam) {
  return (prettify_note(note) + " " + prettify_number(inst) + " "
    + prettify_number(vol) + " " 
    + prettify_effect(efftype, effparam));
}

function getstring(dv, offset, len) {
  var str = []
  for (var i = offset; i < offset+len; i++) {
    var c = dv.getUint8(i);
    if (c == 0) break;
    str.push(String.fromCharCode(c));
  }
  return str.join('');
}

channelinfo = []

cur_songpos = -1, cur_pat = -1, cur_row = 64, cur_ticksamp = 0;
function next_row(f_smp) {
  if (cur_row >= 64) {
    cur_row = 0;
    cur_songpos++;
    if (cur_songpos >= songpats.length)
      cur_songpos = song_looppos;
    cur_pat = songpats[cur_songpos];
  }
  var p = patterns[cur_pat];
  var r = p[cur_row];
  cur_row++;
  for (var i = 0; i < cur_row.length; i++) {
    // instrument trigger
    if (r[i][1]) channelinfo[i].inst = r[i][1];
    // note trigger
    if (r[i][0]) {
      if (r[i][0] == 97) {
        // release note, FIXME once envelopes are implemented
      } else {
        // assume linear frequency table (flags header & 1 == 1)
        var inst = channelinfo[i].inst;
        var period = 7680 - r[i][0]*64 - instruments[inst].fine*0.5;
        var freq = 8363 * ((4608 - period) / 768);
        channelinfo[i].doff = freq / f_smp;
        channelinfo[i].off = 0;
      }
    }
  }
}

function next_tick(f_smp) {
  // blah
}

function audio_cb(e) {
  var f_smp = audioctx.sampleRate;
  var buflen = e.outputBuffer.length;
  var dataL = e.outputBuffer.getChannelData(0);
  var dataR = e.outputBuffer.getChannelData(1);
  var offset = 0;
  var ticklen = f_smp * 2.5 / bpm;
    
  while(buflen > 0) {
    if (cur_ticksamp >= ticklen) {
      next_tick(f_smp);
      cur_ticksamp -= ticklen;
    }
    var tickduration = Math.min(buflen, ticklen - cur_ticksamp);
    for (var i = 0; i < tickduration; i++) {
      for (var j = 0; j < nchan; j++) {
      }
    }

    cur_ticksamp += tickduration;
    buflen -= tickduration;
  }
  console.log("buflen %d f_smp %d", buflen, f_smp);
}

function playXM(arrayBuf) {
  var dv = new DataView(arrayBuf);
  window.dv = dv;

  var name = getstring(dv, 17, 20);
  var hlen = dv.getUint32(0x3c, true) + 0x3c;
  var songlen = dv.getUint16(0x40, true);
  song_looppos = dv.getUint16(0x42, true);
  nchan = dv.getUint16(0x44, true);
  var npat = dv.getUint16(0x46, true);
  var ninst = dv.getUint16(0x48, true);
  var flags = dv.getUint16(0x4a, true);
  tempo = dv.getUint16(0x4c, true);
  bpm = dv.getUint16(0x4e, true);
  for (var i = 0; i < nchan; i++) {
    channelinfo.push({})
  }
  console.log("header len " + hlen);

  console.log("songlen %d, %d channels, %d patterns, %d instruments", songlen, nchan, npat, ninst);
  console.log("loop @%d", song_looppos);
  console.log("flags=%d tempo %d bpm %d", flags, tempo, bpm);

  songpats = [];
  for (var i = 0; i < songlen; i++) {
    songpats.push(dv.getUint8(0x50 + i));
  }
  console.log("song patterns: ", songpats);

  var idx = hlen;
  patterns = [];
  for (var i = 0; i < npat; i++) {
    var pattern = []
    var patheaderlen = dv.getUint32(idx, true);
    var patrows = dv.getUint16(idx + 5, true);
    var patsize = dv.getUint16(idx + 7, true);
    console.log("pattern %d: %d bytes, %d rows", i, patsize, patrows);
    idx += 9;
    for (var j = 0; j < patrows; j++) {
      row = [];
      pretty_row = [];
      for (var k = 0; k < nchan; k++) {
        var byte0 = dv.getUint8(idx); idx++;
        var note = -1, inst = -1, vol = -1, efftype = -1, effparam = -1;
        if (byte0 & 0x80) {
          if (byte0 & 0x01) {
            note = dv.getUint8(idx); idx++;
          }
          if (byte0 & 0x02) {
            inst = dv.getUint8(idx); idx++;
          }
          if (byte0 & 0x04) {
            vol = dv.getUint8(idx); idx++;
          }
          if (byte0 & 0x08) {
            efftype = dv.getUint8(idx); idx++;
          }
          if (byte0 & 0x10) {
            effparam = dv.getUint8(idx); idx++;
          }
        } else {
          note = byte0;
          inst = dv.getUint8(idx); idx++;
          vol = dv.getUint8(idx); idx++;
          efftype = dv.getUint8(idx); idx++;
          effparam = dv.getUint8(idx); idx++;
        }
        pretty_row.push(prettify_notedata(note, inst, vol, efftype, effparam));
        row.push([note, inst, vol, efftype, effparam]);
      }
      if (i == 0)
        console.log(pretty_row.join("  "));
      pattern.push(row);
    }
    patterns.push(pattern);
  }
  
  instruments = []
  // now load instruments
  for (i = 0; i < ninst; i++) {
    var hdrsiz = dv.getUint32(idx, true);
    var instname = getstring(dv, idx+0x4, 22);
    var nsamp = dv.getUint16(idx+0x1b, true);
    if (nsamp > 0) {
      // FIXME: ignoring keymaps for now and assuming 1 sample / instrument
      // var keymap = getarray(dv, idx+0x21);
      var samphdrsiz = dv.getUint32(idx+0x1d, true);
      console.log("hdrsiz %d; instrument %d: '%s' %d samples, samphdrsiz %d",
          hdrsiz, i, instname, nsamp, samphdrsiz);
      idx += hdrsiz;
      for (var j = 0; j < nsamp; j++) {
        var samplen = dv.getUint32(idx, true);
        var samploop = dv.getUint32(idx+4, true);
        var samplooplen = dv.getUint32(idx+8, true);
        var sampvol = dv.getUint8(idx+12);
        var sampfinetune = dv.getInt8(idx+13);
        var samptype = dv.getUint8(idx+14);
        var samppan = dv.getUint8(idx+15);
        var sampnote = dv.getUint8(idx+16);
        var sampname = getstring(dv, idx+18, 22);
        var sampleoffset = idx + samphdrsiz;
        console.log("sample %d: len %d name '%s' loop %d/%d vol %d",
            j, samplen, sampname, samploop, samplooplen, sampvol);
        console.log("           type %d note %s finetune %d pan %d",
            samptype, prettify_note(sampnote), sampfinetune, samppan);
        idx += samplen + samphdrsiz;
      }
      instruments.push({
        'name': instname,
        'off': sampleoffset, 'len': samplen, 'loop': samploop,
        'looplen': samplooplen, 'note': sampnote, 'fine': sampfinetune,
        'pan': samppan})
    } else {
      instruments.push(null);
    }
  }

  audioctx = new webkitAudioContext();
  gainNode = audioctx.createGain();
  gainNode.gain.value = 1.0;  // master volume
  jsNode = audioctx.createScriptProcessor(4096, 0, 2);
  jsNode.onaudioprocess = audio_cb;
  // jsNode.connect(gainNode);

  var debug = document.getElementById("debug");
  console.log("loaded \"" + name + "\"");
  debug.innerHTML = name;

  // start playing
  gainNode.connect(audioctx.destination);
}

var xmReq = new XMLHttpRequest();
xmReq.open("GET", "kamel.xm", true);
xmReq.responseType = "arraybuffer";
xmReq.onload = function (xmEvent) {
  var arrayBuffer = xmReq.response;
  if (arrayBuffer) {
    playXM(arrayBuffer);
  }
}
xmReq.send(null);
