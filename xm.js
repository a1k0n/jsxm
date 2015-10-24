var _note_names = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
function prettify_note(note) {
  if (note < 0) return "---";
  if (note == 96) return "^^^";
  note += 11;
  return _note_names[note%12] + ~~(note/12);
}

function prettify_number(num) {
  if (num == -1) return "--";
  if (num < 10) return "0" + num;
  return num;
}

function prettify_volume(num) {
  if (num < 0x10) return "--";
  return num.toString(16);
}

function prettify_effect(t, p) {
  t = t.toString(16);
  if (p < 16) p = '0' + p.toString(16);
  else p = p.toString(16);
  return t + p
}

function prettify_notedata(note, inst, vol, efftype, effparam) {
  return (prettify_note(note) + " " + prettify_number(inst) + " "
    + prettify_volume(vol) + " "
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

var channelinfo = [];
var instruments = [];
var tempo = 4;

function GetEnvelope(env, ticks) {
  // TODO: optimize, maybe
  var y0;
  for (var i = 0; i < env.length; i += 2) {
    y0 = env[i+1];
    if (ticks < env[i]) {
      var x0 = env[i-2];
      var y0 = env[i-1];
      var dx = env[i] - x0;
      var dy = env[i+1] - y0;
      return y0 + (ticks - x0) * dy / dx;
    }
  }
  return y0;
}

// Return 2-pole Butterworth lowpass filter coefficients for
// center frequncy f_c (relative to sampling frequency)
function FilterCoeffs(f_c) {
//  if (f_c > 0.5) {  // we can't lowpass above the nyquist frequency...
//    return [1, 0, 0];
//  }
  var wct = Math.sqrt(2) * Math.PI * f_c;
  var e = Math.exp(-wct);
  var c = e * Math.cos(wct);
  var s = e * Math.sin(wct);
  var gain = (1 - 2*c + c*c + s*s) / 2;
  return [gain, 2*c, -c*c - s*s];
}

function Filter(x, coef, state) {
  var y = coef[0] * (x + state[0]) + coef[1]*state[1] + coef[2]*state[2];
  state[0] = x;
  state[2] = state[1];
  state[1] = y;
  return y;
}

function UpdateChannelNote(ch, note, f_smp) {
  var freq = 8363 * Math.pow(2, note/12.0 + ch.inst.fine/(12*128.0) - 4);
  ch.doff = freq / f_smp;
  ch.filter = FilterCoeffs(ch.doff / 2);
}

var cur_songpos = -1, cur_pat = -1, cur_row = 64, cur_ticksamp = 0;
var cur_tick = 6;
var patdisplay = [];
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
  pretty_row = [];
  for (var i = 0; i < r.length; i++) {
    var ch = channelinfo[i];
    pretty_row.push(prettify_notedata(r[i][0], r[i][1], r[i][2], r[i][3], r[i][4]));
    // instrument trigger
    if (r[i][1] != -1) {
      var inst = instruments[r[i][1] - 1];
      if (inst !== undefined) {
        ch.inst = inst;
        // retrigger?
        ch.off = 0;
        ch.release = 0;
        ch.envtick = 0;
        // new instrument doesn ot reset volume!
      } else {
        // console.log("invalid inst", r[i][1], instruments.length);
      }
    }
    // note trigger
    if (r[i][0] != -1) {
      if (r[i][0] == 96) {
        // release note, FIXME once envelopes are implemented
        ch.release = 1;
      } else {
        // assume linear frequency table (flags header & 1 == 1)
        // is this true in kamel.xm?
        var inst = ch.inst;
        if (inst === undefined) {
          continue;
        }
        // wtf is this?!
        // var period = 7680 - r[i][0]*64 - inst.fine*0.5;
        // var freq = 8363 * Math.pow(2, (4608 - period) / 768);
        var note = r[i][0] + inst.note;
        ch.note = note;
        ch.off = 0;
        ch.release = 0;
        ch.envtick = 0;
        UpdateChannelNote(ch, note, f_smp);
        // console.log("channel", i, r[i][0], ch);
        // if there's an instrument and a note, set the volume
        if (r[i][0] != -1) {
          var p = (inst.pan - 128) / 128.0;
          ch.volL = Math.sqrt(1 - p) * inst.vol;
          ch.volR = Math.sqrt(1 + p) * inst.vol;
        }
      }
    }
    if (r[i][2] != -1) {  // volume column
      // FIXME: panning
      var v = r[i][2];
      if (v < 0x10) {
        console.log("channel", i, "invalid volume", v.toString(16));
      } else if (v <= 0x50) {
        ch.volL = v - 0x10;
        ch.volR = v - 0x10;
      }
    }

    ch.effect = r[i][3];
    ch.effectdata = r[i][4];
    // TODO: process initial effect tick for effects which need it

  }
  var debug = document.getElementById("debug");
  debug.innerHTML = 'pat ' + cur_pat + ' row ' + (cur_row-1);

  var pat = document.getElementById("pattern");
  patdisplay.push(pretty_row.join("  "));
  if (patdisplay.length > 16) {
    patdisplay.shift();
  }
  pat.innerHTML = patdisplay.join("\n");
}

function next_tick(f_smp) {
  cur_tick++;
  if (cur_tick >= tempo) {
    cur_tick = 0;
    next_row(f_smp);
  }
  for (var j = 0; j < nchan; j++) {
    var ch = channelinfo[j];
    var inst = ch.inst;
    // process effects
    if (ch.effect == 0 && ch.effectdata != 0) {
      var arpeggio = [0, ch.effectdata>>4, ch.effectdata&15];
      var note = ch.note + arpeggio[cur_tick % 3];
      UpdateChannelNote(ch, note, f_smp);
    }
    if (inst === undefined) continue;
    if (inst.env_vol !== undefined) {
      ch.env_vol = GetEnvelope(inst.env_vol, ch.envtick);
      if (inst.env_vol_type & 2) {  // sustain loop?
        // if we're sustaining a note, leave env_vol alone
        if (ch.release == 0) {
          if (ch.envtick >= inst.env_vol[inst.env_vol_sustain*2]) {
            continue;
          }
        }
      }
      ch.envtick++;
    } else {
      ch.env_vol = 64;
    }
  }
}

function audio_cb(e) {
  var f_smp = audioctx.sampleRate;
  var buflen = e.outputBuffer.length;
  var dataL = e.outputBuffer.getChannelData(0);
  var dataR = e.outputBuffer.getChannelData(1);
  dataL.fill(0);
  dataR.fill(0);
  var offset = 0;
  var ticklen = 0|(f_smp * 2.5 / bpm);

  while(buflen > 0) {
    if (cur_ticksamp >= ticklen) {
      next_tick(f_smp);
      cur_ticksamp -= ticklen;
    }
    var tickduration = Math.min(buflen, ticklen - cur_ticksamp);
    for (var j = 0; j < nchan; j++) {
      var ch = channelinfo[j];
      var inst = ch.inst;
      var samp, sample_end;
      var loop = false;
      var looplen = 0;
      if (inst === undefined) {
        continue;
      }
      samp = inst.sampledata;
      sample_end = inst.len;
      if ((inst.type & 3) == 1) { // todo: support pingpong
        loop = true;
        looplen = inst.looplen;
        sample_end = looplen + inst.loop;
      }
      var samplen = inst.len;
      var env_vol = ch.env_vol / 64.0;
      var volL = env_vol * ch.volL / 64.0;
      var volR = env_vol * ch.volR / 64.0;
      if (volL < 0) volL = 0;
      if (volR < 0) volR = 0;
      if (volR == 0 && volL == 0)
        continue;
      var k = ch.off;
      var dk = ch.doff;
      // console.log(j, offset, ch);
      for (var i = offset; i < offset+tickduration; i++) {
        var kk = k|0;
        var si = samp[kk];
        /*
        // bilinear filtering
        var sj = si;
        if (kk < sample_end-1)
          sj = samp[kk+1];
        var t = k - kk;
        si = t * sj + (1 - t) * si;
        */
        vl = Filter(volL, ch.popfilter, ch.popfilterstate[0]);
        vr = Filter(volR, ch.popfilter, ch.popfilterstate[1]);
        dataL[i] += Filter(vl * si, ch.filter, ch.filterstate[0]);
        dataR[i] += Filter(vr * si, ch.filter, ch.filterstate[1]);
        k += dk;
        if (k >= sample_end) {  // TODO: implement pingpong looping
          if (loop) {
            k -= looplen;
          } else {
            // kill sample
            ch.inst = undefined;
            for (i++; i < offset+tickduration; i++) {
              // fill rest of buffer with filtered silence to avoid a pop
              dataL[i] += Filter(0, ch.popfilter, ch.filterstate[0]);
              dataR[i] += Filter(0, ch.popfilter, ch.filterstate[1]);
            }
            break;
          }
        }
      }
      ch.off = k;
      ch.doff = dk;
    }
    offset += tickduration;
    cur_ticksamp += tickduration;
    buflen -= tickduration;
  }
}

function ConvertSample(array, bits) {
  var len = array.length;
  var acc = 0;
  if (bits == 0) {  // 8 bit sample
    var samp = new Float32Array(len);
    for (var k = 0; k < len; k++) {
      acc += array[k];
      var b = acc&255;
      if (b & 128) b = b-256;
      samp[k] = (b - 128) / 128.0;
    }
    return samp;
  } else {
    len /= 2;
    var samp = new Float32Array(len);
    for (var k = 0; k < len; k++) {
      acc += array[k*2] + (array[k*2 + 1] << 8);
      var b = acc&65535;
      if (b & 32768) b = b-65536;
      samp[k] = b / 32768.0;
    }
    return samp;
  }
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
    channelinfo.push({
      filterstate: [new Float32Array(3), new Float32Array(3)],
      popfilter: FilterCoeffs(200.0 / 44100.0),
      popfilterstate: [new Float32Array(3), new Float32Array(3)]
    })
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
        var note = -1, inst = -1, vol = -1, efftype = 0, effparam = 0;
        if (byte0 & 0x80) {
          if (byte0 & 0x01) {
            note = dv.getUint8(idx) - 1; idx++;
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
          // byte0 is note from 1..96 or 0 for nothing or 97 for release
          // so we subtract 1 so that C-0 is stored as 0
          note = byte0 - 1;
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

  // now load instruments
  for (i = 0; i < ninst; i++) {
    var hdrsiz = dv.getUint32(idx, true);
    var instname = getstring(dv, idx+0x4, 22);
    var nsamp = dv.getUint16(idx+0x1b, true);
    var env_nvol = dv.getUint8(idx+225);
    var env_vol_type = dv.getUint8(idx+233);
    var env_vol_sustain = dv.getUint8(idx+227);
    var env_vol_loop_start = dv.getUint8(idx+228);
    var env_vol_loop_end = dv.getUint8(idx+229);
    env_vol = [];
    for (var j = 0; j < env_nvol*2; j++) {
      env_vol.push(dv.getUint16(idx+129+j*2, true));
    }
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
        console.log("           vol env", env_vol, env_vol_sustain,
            env_vol_loop_start, env_vol_loop_end, "type", env_vol_type);
        idx += samplen + samphdrsiz;
      }
      inst = {
        'name': instname,
        'len': samplen, 'loop': samploop,
        'looplen': samplooplen, 'note': sampnote, 'fine': sampfinetune,
        'pan': samppan, 'type': samptype, 'vol': sampvol,
        'fine': sampfinetune,
        'sampledata': ConvertSample(new Uint8Array(arrayBuf, sampleoffset, samplen), samptype & 4),
      };
      if (env_vol_type) {
        inst.env_vol = env_vol;
        inst.env_vol_type = env_vol_type;
        inst.env_vol_sustain = env_vol_sustain;
        inst.env_vol_loop_start = env_vol_loop_start;
        inst.env_vol_loop_end = env_vol_loop_end;
      }
      instruments.push(inst);
    } else {
      instruments.push(null);
    }
  }

  audioctx = new AudioContext();
  gainNode = audioctx.createGain();
  gainNode.gain.value = 0.1;  // master volume
  jsNode = audioctx.createScriptProcessor(4096, 0, 2);
  jsNode.onaudioprocess = audio_cb;
  jsNode.connect(gainNode);

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
