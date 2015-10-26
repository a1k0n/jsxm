var _note_names = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
var f_smp = 44100;  // updated by play callback, default value here

audioContext = window.AudioContext || window.webkitAudioContext;

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

popfilter = FilterCoeffs(200.0 / 44100.0);
popfilter_alpha = 0.9837;

function UpdateChannelPeriod(ch, period) {
  var freq = 8363 * Math.pow(2, (1152.0 - period) / 192.0);
  ch.doff = freq / f_smp;
  ch.filter = FilterCoeffs(ch.doff / 2);
}

function PeriodForNote(ch, note) {
  return 1920 - note*16 - ch.inst.fine / 8.0;
}

function UpdateChannelNote(ch, note) {
  ch.period = PeriodForNote(ch, note);
  UpdateChannelPeriod(ch, ch.period);
}

var cur_songpos = -1, cur_pat = -1, cur_row = 64, cur_ticksamp = 0;
var cur_tick = 6;
var patdisplay = [];
function next_row() {
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
    ch.update = false;
    pretty_row.push(prettify_notedata(r[i][0], r[i][1], r[i][2], r[i][3], r[i][4]));
    // instrument trigger
    if (r[i][1] != -1) {
      var inst = instruments[r[i][1] - 1];
      if (inst !== undefined) {
        ch.inst = inst;
        // retrigger unless overridden below
        triggernote = true;
        // new instrument doesn ot reset volume!
      } else {
        // console.log("invalid inst", r[i][1], instruments.length);
      }
    }
    var triggernote = false;
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
        var note = r[i][0] + inst.note;
        ch.note = note;
        triggernote = true;
        // if there's an instrument and a note, set the volume
        ch.pan = inst.pan;
        ch.vol = inst.vol;
      }
    }
    if (r[i][2] != -1) {  // volume column
      // FIXME: panning
      var v = r[i][2];
      if (v < 0x10) {
        console.log("channel", i, "invalid volume", v.toString(16));
      } else if (v <= 0x50) {
        ch.vol = v - 0x10;
      }
    }

    ch.effect = r[i][3];
    ch.effectdata = r[i][4];
    if (ch.effect < 16) {
      ch.effectfn = effects_t1[ch.effect];
      if (effects_t0[ch.effect](ch, ch.effectdata)) {
        triggernote = false;
      }
    } else {
      console.log("channel", i, "effect > 16", ch.effect);
    }

    // special handling for portamentos: don't trigger the note
    if (ch.effect == 3 || ch.effect == 5) {
      if (r[i][0] != -1) {
        ch.periodtarget = PeriodForNote(ch, ch.note);
      }
      triggernote = false;
      if (ch.release) {
        // reset envelopes if note was released but leave offset/pitch/etc
        // alone
        ch.envtick = 0;
        ch.release = 0;
        ch.env_vol = new EnvelopeFollower(inst.env_vol);
        ch.env_pan = new EnvelopeFollower(inst.env_pan);
      }
    }

    if (triggernote) {
      ch.off = 0;
      ch.release = 0;
      ch.envtick = 0;
      ch.vibratopos = 0;
      ch.env_vol = new EnvelopeFollower(inst.env_vol);
      ch.env_pan = new EnvelopeFollower(inst.env_pan);
      UpdateChannelNote(ch, note);
    }
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

function Envelope(points, type, sustain, loopstart, loopend) {
  this.points = points;
  this.type = type;
  this.sustain = sustain;
  this.loopstart = loopstart;
  this.loopend = loopend;
}

Envelope.prototype.Get = function(ticks) {
  // TODO: optimize follower with ptr
  // or even do binary search here
  var y0;
  var env = this.points;
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

function EnvelopeFollower(env) {
  this.env = env;
  this.tick = 0;
}

EnvelopeFollower.prototype.Tick = function(release) {
  if (this.env === undefined) {
    return 64;
  }
  var value = this.env.Get(this.tick);
  if (this.env.type & 1) {  // sustain?
    // if we're sustaining a note, stop advancing the tick counter
    if (!release &&
        this.tick >= this.env.points[this.env.sustain*2]) {
      return this.env.points[this.env.sustain*2 + 1];
    }
  }
  this.tick++;
  if (this.env.type & 2) {  // envelope loop?
    if (!release &&
        this.tick > this.env.loopend) {
      this.tick -= this.env.loopend - this.env.loopstart;
    }
  }
  return value;
}

function next_tick() {
  cur_tick++;
  if (cur_tick >= tempo) {
    cur_tick = 0;
    next_row();
  }
  for (var j = 0; j < nchan; j++) {
    var ch = channelinfo[j];
    var inst = ch.inst;
    if (ch.effectfn) {
      ch.effectfn(ch);
    }
    if (inst === undefined) continue;
    ch.volE = ch.env_vol.Tick(ch.release);
    ch.panE = ch.env_pan.Tick(ch.release);
  }
}

function audio_cb(e) {
  f_smp = audioctx.sampleRate;
  var buflen = e.outputBuffer.length;
  var dataL = e.outputBuffer.getChannelData(0);
  var dataR = e.outputBuffer.getChannelData(1);

  // backward compat w/ no array.fill
  if (dataL.fill === undefined) {
    for (var i = 0; i < buflen; i++) {
      dataL[i] = 0;
      dataR[i] = 0;
    }
  } else {
    dataL.fill(0);
    dataR.fill(0);
  }

  var offset = 0;
  var ticklen = 0|(f_smp * 2.5 / bpm);
  var VU = new Float32Array(nchan);

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
      var volE = ch.volE / 64.0;
      var panE = (ch.panE - 32);
      var p = panE + ch.pan - 128;
      var volL = volE * (128 - p) * ch.vol / 8192.0;
      var volR = volE * (128 + p) * ch.vol / 8192.0;
      if (volL < 0) volL = 0;
      if (volR < 0) volR = 0;
      if (volR == 0 && volL == 0)
        continue;
      var k = ch.off;
      var dk = ch.doff;
      var Vrms = 0;
      // console.log(j, offset, ch);
      for (var i = offset; i < offset+tickduration; i++) {
        if (ch.mute) break;
        var s = samp[k|0];
        // we low-pass filter here since we are resampling some arbitrary
        // frequency to f_smp; this is an anti-aliasing filter and is
        // implemented as an IIR butterworth filter (usually we'd use an FIR
        // brick wall filter, but this is much simpler computationally and
        // sounds fine)
        var si = ch.filter[0] * (s + ch.filterstate[0]) +
          ch.filter[1]*ch.filterstate[1] + ch.filter[2]*ch.filterstate[2];
        ch.filterstate[2] = ch.filterstate[1];
        ch.filterstate[1] = si; ch.filterstate[0] = s;
        // we also low-pass filter volume changes with a simple one-zero,
        // one-pole filter to avoid pops and clicks when volume changes.
        ch.vL = popfilter_alpha * ch.vL + (1 - popfilter_alpha) * (volL + ch.vLprev) * 0.5;
        ch.vR = popfilter_alpha * ch.vR + (1 - popfilter_alpha) * (volR + ch.vRprev) * 0.5;
        ch.vLprev = volL;
        ch.vRprev = volR;
        dataL[i] += ch.vL * si;
        dataR[i] += ch.vR * si;
        Vrms += ch.vL * ch.vR * si * si;
        k += dk;
        if (k >= sample_end) {  // TODO: implement pingpong looping
          if (loop) {
            k -= looplen;
          } else {
            // kill sample
            ch.inst = undefined;
            // ramp down to zero with the pop filter
            // if the sample ends right before the end of the tick (or the end
            // of the buffer), we could still get a pop but *usually* it's
            // hidden behind other changes in the tick... there's only so much
            // we can do here, anyway.  i guess we could hold the dc offset...
            var rampend = Math.min(offset+tickduration, i+200);
            for (i++; i < rampend; i++) {
              // fill rest of buffer with filtered silence to avoid a pop
              var si = popfilter[0] * (ch.filterstate[0]) +
                popfilter[1]*ch.filterstate[1] +
                popfilter[2]*ch.filterstate[2];
              ch.filterstate[2] = ch.filterstate[1];
              ch.filterstate[1] = si; ch.filterstate[0] = 0;
              dataL[i] += ch.vL * si;
              dataR[i] += ch.vR * si;
            }
            break;
          }
        }
      }
      ch.off = k;
      ch.doff = dk;
      VU[j] += Vrms;
    }
    offset += tickduration;
    cur_ticksamp += tickduration;
    buflen -= tickduration;
  }

  // update VU meters
  var canvas = document.getElementById("vu");
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 300, 64);
  ctx.fillStyle = '#0f0';
  for (var j = 0; j < nchan; j++) {
    var rms = VU[j] / e.outputBuffer.length;
    var y = -Math.log(rms)*10;
    ctx.fillRect(j*16, y, 15, 64-y);
  }
}

function eff_t0_0(ch, data) {  // arpeggio
  // nothing to do here, arpeggio will be done on ch.effectdata
}

function eff_t0_1(ch, data) {  // pitch slide up
  if (data != 0) {
    ch.slideupspeed = data;
  }
}

function eff_t0_2(ch, data) {  // pitch slide down
  if (data != 0) {
    ch.slidedownspeed = data;
  }
}

function eff_t0_3(ch, data) {  // portamento
  if (data != 0) {
    ch.portaspeed = data;
  }
}

function eff_t0_4(ch, data) {  // vibrato
  if (data & 0x0f) {
    ch.vibratodepth = data & 0x0f;
  }
  if (data >> 4) {
    ch.vibratospeed = data >> 4;
  }
  eff_t1_4(ch, data);
}

function eff_t0_a(ch, data) {  // volume slide
  if (data) {
    if (data & 0x0f) {
      ch.volumeslide = -(data & 0x0f);
    } else {
      ch.volumeslide = data >> 4;
    }
  }
}

function eff_unimplemented_t0(ch, data) {
  console.log("unimplemented effect", ch.effect.toString(16), data.toString(16));
}

var effects_t0 = [  // effect functions on tick 0
  eff_t0_0,
  eff_t0_1,
  eff_t0_2,
  eff_t0_3,
  eff_t0_4,
  eff_unimplemented_t0,  // 5
  eff_unimplemented_t0,  // 6
  eff_unimplemented_t0,  // 7
  eff_unimplemented_t0,  // 8
  eff_unimplemented_t0,  // 9
  eff_t0_a,
  eff_unimplemented_t0,  // b
  eff_unimplemented_t0,  // c
  eff_unimplemented_t0,  // d
  eff_unimplemented_t0,  // e
  eff_unimplemented_t0,  // f
];

function eff_t1_0(ch) {  // arpeggio
  if (ch.effectdata != 0) {
    var arpeggio = [0, ch.effectdata>>4, ch.effectdata&15];
    var note = ch.note + arpeggio[cur_tick % 3];
    UpdateChannelNote(ch, note);
  }
}

function eff_t1_1(ch) {  // pitch slide up
  if (ch.slideupspeed !== undefined) {
    ch.period -= ch.slideupspeed;
    UpdateChannelPeriod(ch, ch.period);
  }
}

function eff_t1_2(ch) {  // pitch slide down
  if (ch.slidedownspeed !== undefined) {
    ch.period += ch.slidedownspeed;
    UpdateChannelPeriod(ch, ch.period);
  }
}

function eff_t1_3(ch) {  // portamento
  if (ch.periodtarget !== undefined && ch.portaspeed !== undefined) {
    if (ch.period > ch.periodtarget) {
      ch.period = Math.max(ch.periodtarget, ch.period - ch.portaspeed);
    } else {
      ch.period = Math.min(ch.periodtarget, ch.period + ch.portaspeed);
    }
    UpdateChannelPeriod(ch, ch.period);
  }
}

function eff_t1_4(ch) {  // vibrato
  ch.period += Math.sin(ch.vibratopos * Math.PI / 32) * ch.vibratodepth;
  UpdateChannelPeriod(ch, ch.period);
  ch.vibratopos += ch.vibratospeed;
  ch.vibratopos &= 63;
}

function eff_t1_a(ch) {  // volume slide
  if (ch.volumeslide !== undefined) {
    ch.vol = Math.max(0, Math.min(64, ch.vol + ch.volumeslide));
  }
}

function eff_unimplemented() {}
var effects_t1 = [  // effect functions on tick 1+
  eff_t1_0,
  eff_t1_1,
  eff_t1_2,
  eff_t1_3,
  eff_t1_4,
  eff_unimplemented,  // 5
  eff_unimplemented,  // 6
  eff_unimplemented,  // 7
  eff_unimplemented,  // 8
  eff_unimplemented,  // 9
  eff_t1_a,  // a
  eff_unimplemented,  // b
  eff_unimplemented,  // c
  eff_unimplemented,  // d
  eff_unimplemented,  // e
  eff_unimplemented,  // f
];

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
      filterstate: new Float32Array(3),
      popfilter: FilterCoeffs(200.0 / 44100.0),
      popfilterstate: [new Float32Array(3), new Float32Array(3)],
      vol: 0,
      pan: 128,
      vL: 0, vR: 0,   // left right volume envelope followers (changes per sample)
      vLprev: 0, vRprev: 0,
      mute: 0,
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
      if (i == 12)
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
    var env_npan = dv.getUint8(idx+226);
    var env_pan_type = dv.getUint8(idx+234);
    var env_pan_sustain = dv.getUint8(idx+230);
    var env_pan_loop_start = dv.getUint8(idx+231);
    var env_pan_loop_end = dv.getUint8(idx+232);
    env_vol = [];
    for (var j = 0; j < env_nvol*2; j++) {
      env_vol.push(dv.getUint16(idx+129+j*2, true));
    }
    env_pan = [];
    for (var j = 0; j < env_npan*2; j++) {
      env_pan.push(dv.getUint16(idx+177+j*2, true));
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
        inst.env_vol = new Envelope(
            env_vol,
            env_vol_type,
            env_vol_sustain,
            env_vol_loop_start,
            env_vol_loop_end);
      }
      if (env_pan_type) {
        inst.env_pan = new Envelope(
            env_pan,
            env_pan_type,
            env_pan_sustain,
            env_pan_loop_start,
            env_pan_loop_end);
      }
      instruments.push(inst);
    } else {
      instruments.push(null);
    }
  }

  audioctx = new audioContext();
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
