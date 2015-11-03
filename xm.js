var audioctx;
var songname = '';
var fontimg = new Image();
var pat_canvas = document.createElement('canvas');
fontimg.onload = function() {
  // FIXME: don't attempt to render until this loads
};

fontimg.src = "ft2font.png";

var _note_names = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
var f_smp = 44100;  // updated by play callback, default value here

audioContext = window.AudioContext || window.webkitAudioContext;

var _fontmap_notes = [8*5, 8*22, 8*28];
var _pattern_cellwidth = 16 + 4 + 8 + 4 + 8 + 16 + 4;
var _scope_width = _pattern_cellwidth - 1;
var _pattern_border = 20;
var pat_canvas_patnum;
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
        ctx.drawImage(fontimg, 312, 0, 8, 8, dx, dy, 8, 8);
      } else {
        ctx.drawImage(fontimg, 8*(vol>>4) + 56*8, 4*8, 8, 8, dx, dy, 8, 8);
        ctx.drawImage(fontimg, 8*(vol&15), 4*8, 4, 8, dx+4, dy, 4, 8);
      }
      dx += 8;

      // render effect
      var eff = data[3];
      var effdata = data[4];
      ctx.drawImage(fontimg, 8*eff + 16*8, 4*8, 8, 8, dx, dy, 8, 8);
      dx += 8;
      ctx.drawImage(fontimg, 8*(effdata>>4), 4*8, 4, 8, dx, dy, 4, 8);
      ctx.drawImage(fontimg, 8*(effdata&15), 4*8, 4, 8, dx+4, dy, 4, 8);
    }
  }
}

function prettify_note(note) {
  if (note < 0) return "---";
  if (note == 96) return "^^^";
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
  if (t >= 10) t = String.fromCharCode(55 + t);
  if (p < 16) p = '0' + p.toString(16);
  else p = p.toString(16);
  return t + p
}

function prettify_notedata(data) {
  return (prettify_note(data[0]) + " " + prettify_number(data[1]) + " "
    + prettify_volume(data[2]) + " "
    + prettify_effect(data[3], data[4]));
}

function getstring(dv, offset, len) {
  var str = [];
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
  if (f_c > 0.5) {  // we can't lowpass above the nyquist frequency...
    f_c = 0.5;
  }
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
  if (isNaN(freq)) {
    console.log("invalid period!", period);
    return;
  }
  ch.doff = freq / f_smp;
  ch.filter = FilterCoeffs(ch.doff / 2);
}

function PeriodForNote(ch, note) {
  return 1920 - (note + ch.samp.note)*16 - ch.samp.fine / 8.0;
}

var audio_events = [];
var shown_row = undefined;
function RedrawScreen() {
  var e;
  var t = audioctx.currentTime;
  do {
    e = audio_events.shift();
  } while(e.t < t && audio_events.length > 0);
  if (e == undefined) return;
  var VU = e.vu;
  var scopes = e.scopes;

  if (e.scopes != undefined) {
    // update VU meters & oscilliscopes
    var canvas = document.getElementById("vu");
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, 64);
    ctx.fillStyle = '#0f0';
    ctx.strokeStyle = '#55acff';
    for (var j = 0; j < nchan; j++) {
      var x = _pattern_border + j * _pattern_cellwidth;
      // render channel number
      if (j >= 10) {
        ctx.drawImage(fontimg, 8*((j/10)|0), 4*8, 4, 8, x, 1, 4, 8);
      }
      ctx.drawImage(fontimg, 8*(j%10), 4*8, 4, 8, x+4, 1, 4, 8);

      // volume in dB as a green bar
      var vu_y = -Math.log(VU[j])*10;
      ctx.fillRect(x, vu_y, 2, 64-vu_y);

      // oscilloscope
      var scope = scopes[j];
      ctx.beginPath();
      for (var k = 0; k < _scope_width; k++) {
        ctx.lineTo(x + 1 + k, 32 - 16 * scope[k]);
      }
      ctx.stroke();
    }
  }

  var debug = document.getElementById("debug");
  debug.innerHTML = songname + '<br>pat ' + e.pat + ' row ' + (e.row);

  if (e.row != shown_row) {
    var gfx = document.getElementById("gfxpattern");
    if (e.pat != pat_canvas_patnum) {
      var p = patterns[e.pat];
      if (p != undefined) {
        RenderPattern(pat_canvas, patterns[e.pat]);
        pat_canvas_patnum = e.pat;
      }
    }
    var ctx = gfx.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, gfx.width, gfx.height);
    ctx.fillStyle = '#2a5684';
    ctx.fillRect(0, gfx.height/2 - 4, gfx.width, 8);
    ctx.globalCompositeOperation = 'lighten';
    ctx.drawImage(pat_canvas, 0, gfx.height / 2 - 4 - 8*(e.row));
    ctx.globalCompositeOperation = 'source-over';
    shown_row = e.row;
  }

  if (audio_events.length > 0) {
    var next_event = audio_events[0].t;
    setTimeout(RedrawScreen, 1000*(next_event - audioctx.currentTime));
  }
}

var cur_songpos = -1, cur_pat = -1, cur_row = 64, cur_ticksamp = 0;
var cur_tick = 6;
function next_row() {
  if (cur_pat == -1 || cur_row >= patterns[cur_pat].length) {
    cur_row = 0;
    cur_songpos++;
    if (cur_songpos >= songpats.length)
      cur_songpos = song_looppos;
    cur_pat = songpats[cur_songpos];
  }
  var p = patterns[cur_pat];
  var r = p[cur_row];
  cur_row++;
  for (var i = 0; i < r.length; i++) {
    var ch = channelinfo[i];
    var inst = ch.inst;
    var triggernote = false;
    // instrument trigger
    if (r[i][1] != -1) {
      inst = instruments[r[i][1] - 1];
      if (inst != undefined) {
        ch.inst = inst;
        // retrigger unless overridden below
        triggernote = true;
        if (ch.note) {
          ch.samp = inst.samples[inst.samplemap[ch.note]];
          ch.vol = ch.samp.vol;
          ch.pan = ch.samp.pan;
        }
      } else {
        // console.log("invalid inst", r[i][1], instruments.length);
      }
    }

    // note trigger
    if (r[i][0] != -1) {
      if (r[i][0] == 96) {
        ch.release = 1;
        triggernote = false;
      } else {
        if (inst != undefined) {
          var note = r[i][0];
          ch.note = note;
          ch.samp = inst.samples[inst.samplemap[ch.note]];
          if (triggernote) {
            // if we were already triggering the note, reset vol/pan using
            // (potentially) new sample
            ch.pan = ch.samp.pan;
            ch.vol = ch.samp.vol;
          }
          triggernote = true;
        }
      }
    }

    ch.voleffectfn = undefined;
    if (r[i][2] != -1) {  // volume column
      var v = r[i][2];
      ch.voleffectdata = v & 0x0f;
      if (v < 0x10) {
        console.log("channel", i, "invalid volume", v.toString(16));
      } else if (v <= 0x50) {
        ch.vol = v - 0x10;
      } else if (v >= 0x60 && v < 0x70) {  // volume slide down
        ch.voleffectfn = function(ch) {
          ch.vol = Math.max(0, ch.vol - ch.voleffectdata);
        }
      } else if (v >= 0x70 && v < 0x80) {  // volume slide up
        ch.voleffectfn = function(ch) {
          ch.vol = Math.min(64, ch.vol + ch.voleffectdata);
        }
      } else if (v >= 0x80 && v < 0x90) {  // fine volume slide down
        ch.vol = Math.max(0, ch.vol - (v & 0x0f));
      } else if (v >= 0x90 && v < 0xa0) {  // fine volume slide up
        ch.vol = Math.min(64, ch.vol + (v & 0x0f));
      } else if (v >= 0xc0 && v < 0xd0) {  // set panning
        ch.pan = (v & 0x0f) * 0x11;
      } else {
        console.log("channel", i, "volume effect", v.toString(16));
      }
    }

    ch.effect = r[i][3];
    ch.effectdata = r[i][4];
    if (ch.effect < 36) {
      ch.effectfn = effects_t1[ch.effect];
      var eff_t0 = effects_t0[ch.effect];
      if (eff_t0 && eff_t0(ch, ch.effectdata)) {
        triggernote = false;
      }
    } else {
      console.log("channel", i, "effect > 36", ch.effect);
    }

    // special handling for portamentos: don't trigger the note
    if (ch.effect == 3 || ch.effect == 5) {
      if (r[i][0] != -1) {
        ch.periodtarget = PeriodForNote(ch, ch.note);
      }
      triggernote = false;
      if (inst != undefined) {
        if (ch.env_vol == undefined) {
          // note wasn't already playing; we basically have to ignore the
          // portamento and just trigger
          triggernote = true;
        } else if (ch.release) {
          // reset envelopes if note was released but leave offset/pitch/etc
          // alone
          ch.envtick = 0;
          ch.release = 0;
          ch.env_vol = new EnvelopeFollower(inst.env_vol);
          ch.env_pan = new EnvelopeFollower(inst.env_pan);
        }
      }
    }

    if (triggernote) {
      ch.off = 0;
      ch.release = 0;
      ch.envtick = 0;
      ch.vibratopos = 0;
      ch.env_vol = new EnvelopeFollower(inst.env_vol);
      ch.env_pan = new EnvelopeFollower(inst.env_pan);
      if (ch.note != undefined) {
        ch.period = PeriodForNote(ch, ch.note);
      }
    }
  }
}

function Envelope(points, type, sustain, loopstart, loopend) {
  this.points = points;
  this.type = type;
  this.sustain = sustain;
  this.loopstart = points[loopstart*2];
  this.loopend = points[loopend*2];
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
  var value = this.env.Get(this.tick);

  // if we're sustaining a note, stop advancing the tick counter
  if (!release && this.tick >= this.env.points[this.env.sustain*2]) {
    return this.env.points[this.env.sustain*2 + 1];
  }

  this.tick++;
  if (this.env.type & 4) {  // envelope loop?
    if (!release &&
        this.tick >= this.env.loopend) {
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
    ch.periodoffset = 0;
    if (cur_tick != 0) {
      if(ch.voleffectfn) ch.voleffectfn(ch);
      if(ch.effectfn) ch.effectfn(ch);
    }
    if (isNaN(ch.period)) {
      console.log(prettify_notedata(patterns[cur_pat][cur_row-1][j]),
          "set channel", j, "period to NaN");
    }
    if (inst == undefined) continue;
    if (ch.env_vol == undefined) {
      console.log(prettify_notedata(patterns[cur_pat][cur_row-1][j]),
          "set channel", j, "env_vol to undefined, but note is playing");
      continue;
    }
    ch.volE = ch.env_vol.Tick(ch.release);
    ch.panE = ch.env_pan.Tick(ch.release);
    UpdateChannelPeriod(ch, ch.period + ch.periodoffset);
  }
}

// This function gradually brings the channel back down to zero if it isn't
// already to avoid clicks and pops when samples end.
function MixSilenceIntoBuf(ch, start, end, dataL, dataR) {
  var s = ch.filterstate[1];
  if (isNaN(s)) {
    console.log("NaN filterstate?", ch.filterstate, ch.filter);
    return;
  }
  for (var i = start; i < end; i++) {
    if (Math.abs(s) < 1.526e-5) {  // == 1/65536.0
      s = 0;
      break;
    }
    dataL[i] += s * ch.vL;
    dataR[i] += s * ch.vR;
    s *= popfilter_alpha;
  }
  ch.filterstate[1] = s;
  ch.filterstate[2] = s;
  if (isNaN(s)) {
    console.log("NaN filterstate after adding silence?", ch.filterstate, ch.filter, i);
    return;
  }
  return 0;
}

function MixChannelIntoBuf(ch, start, end, dataL, dataR) {
  var inst = ch.inst;
  var instsamp = ch.samp;
  var loop = false;
  var looplen = 0, loopstart = 0;

  // nothing on this channel, just filter the last dc offset back down to zero
  if (instsamp == undefined || inst == undefined || ch.mute) {
    return MixSilenceIntoBuf(ch, start, end, dataL, dataR);
  }

  var samp = instsamp.sampledata;
  var sample_end = instsamp.len;
  if ((instsamp.type & 3) == 1) { // todo: support pingpong
    loop = true;
    loopstart = instsamp.loop;
    looplen = instsamp.looplen;
    sample_end = loopstart + looplen;
  }
  var samplen = instsamp.len;
  var volE = ch.volE / 64.0;    // current volume envelope
  var panE = 4*(ch.panE - 32);  // current panning envelope
  var p = panE + ch.pan - 128;  // final pan
  var volL = volE * (128 - p) * ch.vol / 8192.0;
  var volR = volE * (128 + p) * ch.vol / 8192.0;
  if (volL < 0) volL = 0;
  if (volR < 0) volR = 0;
  if (volR == 0 && volL == 0)
    return;
  if (isNaN(volR) || isNaN(volL)) {
    console.log("NaN volume!?", ch.number, volL, volR, volE, panE, ch.vol);
    return;
  }
  var k = ch.off;
  var dk = ch.doff;
  var Vrms = 0;
  var f0 = ch.filter[0], f1 = ch.filter[1], f2 = ch.filter[2];
  var fs0 = ch.filterstate[0], fs1 = ch.filterstate[1], fs2 = ch.filterstate[2];

  // we also low-pass filter volume changes with a simple one-zero,
  // one-pole filter to avoid pops and clicks when volume changes.
  var vL = popfilter_alpha * ch.vL + (1 - popfilter_alpha) * (volL + ch.vLprev) * 0.5;
  var vR = popfilter_alpha * ch.vR + (1 - popfilter_alpha) * (volR + ch.vRprev) * 0.5;
  var pf_8 = Math.pow(popfilter_alpha, 8);
  ch.vLprev = volL;
  ch.vRprev = volR;

  // we can mix up to this many bytes before running into a sample end/loop
  var i = start;
  var failsafe = 100;
  while (i < end) {
    if (failsafe-- == 0) {
      console.log("failsafe in mixing loop!", k, sample_end, loopstart, looplen, dk);
      break;
    }
    if (k >= sample_end) {  // TODO: implement pingpong looping
      if (loop) {
        k = loopstart + (k - loopstart) % looplen;
      } else {
        // kill sample
        ch.inst = undefined;
        // fill rest of buf with filtered dc offset using loop above
        return Vrms + MixSilenceIntoBuf(ch, i, end, dataL, dataR);
      }
    }
    var next_event = Math.max(1, Math.min(end, i + (sample_end - k) / dk));
    // this is the inner loop of the player

    // unrolled 8x
    for (; i + 7 < next_event; i+=8) {
      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i] += vL * y;
      dataR[i] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+1] += vL * y;
      dataR[i+1] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+2] += vL * y;
      dataR[i+2] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+3] += vL * y;
      dataR[i+3] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+4] += vL * y;
      dataR[i+4] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+5] += vL * y;
      dataR[i+5] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+6] += vL * y;
      dataR[i+6] += vR * y;
      Vrms += (vL + vR) * y * y;

      var s = samp[k|0];
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      k += dk;
      dataL[i+7] += vL * y;
      dataR[i+7] += vR * y;
      Vrms += (vL + vR) * y * y;

      vL = pf_8 * vL + (1 - pf_8) * volL;
      vR = pf_8 * vR + (1 - pf_8) * volR;
    }

    for (; i < next_event; i++) {
      var s = samp[k|0];
      // we low-pass filter here since we are resampling some arbitrary
      // frequency to f_smp; this is an anti-aliasing filter and is
      // implemented as an IIR butterworth filter (usually we'd use an FIR
      // brick wall filter, but this is much simpler computationally and
      // sounds fine)
      var y = f0 * (s + fs0) + f1*fs1 + f2*fs2;
      fs2 = fs1; fs1 = y; fs0 = s;
      dataL[i] += vL * y;
      dataR[i] += vR * y;
      Vrms += (vL + vR) * y * y;
      k += dk;
    }
  }
  ch.off = k;
  ch.filterstate[0] = fs0;
  ch.filterstate[1] = fs1;
  ch.filterstate[2] = fs2;
  ch.vL = vL;
  ch.vR = vR;
  return Vrms * 0.5;
}

function audio_cb(e) {
  f_smp = audioctx.sampleRate;
  var time_sound_started = undefined;
  var buflen = e.outputBuffer.length;
  var dataL = e.outputBuffer.getChannelData(0);
  var dataR = e.outputBuffer.getChannelData(1);

  for (var i = 0; i < buflen; i++) {
    dataL[i] = 0;
    dataR[i] = 0;
  }

  var offset = 0;
  var ticklen = 0|(f_smp * 2.5 / bpm);

  while(buflen > 0) {
    if (cur_pat == -1 || cur_ticksamp >= ticklen) {
      next_tick(f_smp);
      cur_ticksamp -= ticklen;
    }
    var tickduration = Math.min(buflen, ticklen - cur_ticksamp);
    var VU = new Float32Array(nchan);
    var scopes = undefined;
    for (var j = 0; j < nchan; j++) {
      var scope;
      if (tickduration >= 4*_scope_width) {
        scope = new Float32Array(_scope_width);
        for (var k = 0; k < _scope_width; k++) {
          scope[k] = -dataL[offset+k*4] - dataR[offset+k*4];
        }
      }

      VU[j] = MixChannelIntoBuf(
          channelinfo[j], offset, offset + tickduration, dataL, dataR) /
        tickduration;

      if (tickduration >= 4*_scope_width) {
        for (var k = 0; k < _scope_width; k++) {
          scope[k] += dataL[offset+k*4] + dataR[offset+k*4];
        }
        if (scopes == undefined) scopes = [];
        scopes.push(scope);
      }
    }
    audio_events.push({
      t: e.playbackTime + (0.0 + offset) / f_smp,
      vu: VU,
      scopes: scopes,
      songpos: cur_songpos,
      pat: cur_pat,
      row: cur_row - 1
    });
    if (audio_events.length == 1) {
      requestAnimationFrame(RedrawScreen);
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
      samp[k] = b / 128.0;
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

// optimization: unroll short sample loops so we can run our inner mixing loop
// uninterrupted for as long as possible; this also handles pingpong loops.
function UnrollSampleLoop(samp) {
  var nloops = ((2048 + samp.looplen - 1) / samp.looplen) | 0;
  console.log(samp.looplen, nloops);
  var pingpong = samp.type & 2;
  if (pingpong) {
    // make sure we have an even number of loops if we are pingponging
    nloops = (nloops + 1) & (~1);
  }
  var samplesiz = samp.loop + nloops * samp.looplen;
  var data = new Float32Array(samplesiz);
  for (var i = 0; i < samp.loop; i++) {
    data[i] = samp.sampledata[i];
  }
  for (var j = 0; j < nloops; j++) {
    if ((j&1) && pingpong) {
      for (var k = samp.looplen - 1; k >= 0; k--) {
        data[i++] = samp.sampledata[samp.loop + k];
      }
    } else {
      for (var k = 0; k < samp.looplen; k++) {
        data[i++] = samp.sampledata[samp.loop + k];
      }
    }
  }
  console.log("unrolled sample loop; looplen", samp.looplen, "x", nloops, " = ", samplesiz);
  samp.sampledata = data;
  samp.looplen = nloops * samp.looplen;
  samp.type = 1;
}

function playXM(arrayBuf) {
  var dv = new DataView(arrayBuf);
  window.dv = dv;

  songname = getstring(dv, 17, 20);
  var hlen = dv.getUint32(0x3c, true) + 0x3c;
  var songlen = dv.getUint16(0x40, true);
  song_looppos = dv.getUint16(0x42, true);
  nchan = dv.getUint16(0x44, true);
  var npat = dv.getUint16(0x46, true);
  var ninst = dv.getUint16(0x48, true);
  var flags = dv.getUint16(0x4a, true);
  tempo = dv.getUint16(0x4c, true);
  bpm = dv.getUint16(0x4e, true);
  document.getElementById('vu').width = _pattern_border + _pattern_cellwidth * nchan;
  for (var i = 0; i < nchan; i++) {
    channelinfo.push({
      number: i,
      filterstate: new Float32Array(3),
      vol: 0,
      pan: 128,
      period: 1920 - 48*16,
      vL: 0, vR: 0,   // left right volume envelope followers (changes per sample)
      vLprev: 0, vRprev: 0,
      mute: 0,
      volE: 0, panE: 0,
      retrig: 0,
      vibratodepth: 1,
      vibratospeed: 1,
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
    var pattern = [];
    var patheaderlen = dv.getUint32(idx, true);
    var patrows = dv.getUint16(idx + 5, true);
    var patsize = dv.getUint16(idx + 7, true);
    console.log("pattern %d: %d bytes, %d rows", i, patsize, patrows);
    idx += 9;
    for (var j = 0; patsize > 0 && j < patrows; j++) {
      row = [];
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
        var notedata = [note, inst, vol, efftype, effparam];
        row.push(notedata);
      }
      pattern.push(row);
    }
    patterns.push(pattern);
  }

  var namelist = [];
  // now load instruments
  for (i = 0; i < ninst; i++) {
    var hdrsiz = dv.getUint32(idx, true);
    var instname = getstring(dv, idx+0x4, 22);
    var nsamp = dv.getUint16(idx+0x1b, true);
    if (nsamp > 0) {
      // return a slice so we have a fresh copy and don't retain pointers to
      // the original xm file arraybuf forever
      var samplemap = new Uint8Array(arrayBuf, idx+33, 96).slice();

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
      var vol_fadeout = dv.getUint16(idx+239, true);
      var env_vol = [];
      for (var j = 0; j < env_nvol*2; j++) {
        env_vol.push(dv.getUint16(idx+129+j*2, true));
      }
      var env_pan = [];
      for (var j = 0; j < env_npan*2; j++) {
        env_pan.push(dv.getUint16(idx+177+j*2, true));
      }
      // FIXME: ignoring keymaps for now and assuming 1 sample / instrument
      // var keymap = getarray(dv, idx+0x21);
      var samphdrsiz = dv.getUint32(idx+0x1d, true);
      console.log("hdrsiz %d; instrument %d: '%s' %d samples, samphdrsiz %d",
          hdrsiz, i, instname, nsamp, samphdrsiz);
      idx += hdrsiz;
      var totalsamples = 0;
      var samps = [];
      for (var j = 0; j < nsamp; j++) {
        var samplen = dv.getUint32(idx, true);
        var samploop = dv.getUint32(idx+4, true);
        var samplooplen = dv.getUint32(idx+8, true);
        var sampvol = dv.getUint8(idx+12);
        var sampfinetune = dv.getInt8(idx+13);
        var samptype = dv.getUint8(idx+14);
        var samppan = dv.getUint8(idx+15);
        var sampnote = dv.getInt8(idx+16);
        var sampname = getstring(dv, idx+18, 22);
        var sampleoffset = idx + samphdrsiz + totalsamples;
        console.log("sample %d: len %d name '%s' loop %d/%d vol %d",
            j, samplen, sampname, samploop, samplooplen, sampvol);
        console.log("           type %d note %s(%d) finetune %d pan %d",
            samptype, prettify_note(sampnote + 12*4), sampnote, sampfinetune, samppan);
        console.log("           vol env", env_vol, env_vol_sustain,
            env_vol_loop_start, env_vol_loop_end, "type", env_vol_type,
            "fadeout", vol_fadeout);
        console.log("           pan env", env_pan, env_pan_sustain,
            env_pan_loop_start, env_pan_loop_end, "type", env_pan_type);
        var samp = {
          'len': samplen, 'loop': samploop,
          'looplen': samplooplen, 'note': sampnote, 'fine': sampfinetune,
          'pan': samppan, 'type': samptype, 'vol': sampvol,
          'fine': sampfinetune,
          'sampledata': ConvertSample(
              new Uint8Array(arrayBuf, sampleoffset, samplen), samptype & 16),
        };
        // length / pointers are all specified in bytes; fixup for 16-bit samples
        if (samptype & 16) {
          samp.len /= 2;
          samp.loop /= 2;
          samp.looplen /= 2;
        }

        // unroll short loops and any pingpong loops
        if ((samp.type & 3) && (samp.looplen < 2048 || (samp.type & 2))) {
          UnrollSampleLoop(samp);
        }
        samps.push(samp);

        idx += samphdrsiz;
        totalsamples += samplen;
      }
      idx += totalsamples;
      inst = {
        'name': instname,
        'number': i,
        'fadeout': vol_fadeout,
        'samplemap': samplemap,
        'samples': samps,
      };
      if (env_vol_type) {
        // insert an automatic fadeout to 0 at the end of the envelope
        var env_end_tick = env_vol[env_vol.length-2];
        if (!(env_vol_type & 2)) {  // if there's no sustain point, create one
          env_vol_sustain = env_vol.length / 2;
        }
        if (inst.fadeout > 0) {
          var fadeout_ticks = 65536.0 / inst.fadeout;
          env_vol.push(env_end_tick + fadeout_ticks);
          env_vol.push(0);
        }
        inst.env_vol = new Envelope(
            env_vol,
            env_vol_type,
            env_vol_sustain,
            env_vol_loop_start,
            env_vol_loop_end);
      } else {
        // no envelope, then just make a default full-volume envelope.
        // i thought this would use fadeout, but apparently it doesn't.
        inst.env_vol = new Envelope([0, 64, 1, 0], 2, 0, 0, 0);
      }
      if (env_pan_type) {
        if (!(env_pan_type & 2)) {  // if there's no sustain point, create one
          env_pan_sustain = env_pan.length / 2;
        }
        inst.env_pan = new Envelope(
            env_pan,
            env_pan_type,
            env_pan_sustain,
            env_pan_loop_start,
            env_pan_loop_end);
      } else {
        // create a default empty envelope
        inst.env_pan = new Envelope([0, 32], 0, 0, 0, 0);
      }
      instruments.push(inst);
    } else {
      idx += hdrsiz;
      console.log("empty instrument", i, hdrsiz, idx);
      instruments.push(null);
    }

    var n = (i+1).toString(16);
    if (i < 15) n = ' ' + n;
    namelist.push(n + " " + instname);
  }

  audioctx = new audioContext();
  gainNode = audioctx.createGain();
  gainNode.gain.value = 0.1;  // master volume
  jsNode = audioctx.createScriptProcessor(16384, 0, 2);
  jsNode.onaudioprocess = audio_cb;
  jsNode.connect(gainNode);

  var debug = document.getElementById("debug");
  console.log("loaded \"" + songname + "\"");
  debug.innerHTML = songname;
  var gfxpattern = document.getElementById("gfxpattern");
  gfxpattern.width = _pattern_cellwidth * nchan + _pattern_border;

  var instrlist = document.getElementById("instruments");
  instrlist.innerHTML = namelist.join("\n");

  // start playing
  gainNode.connect(audioctx.destination);
}

var xmReq = new XMLHttpRequest();
var uri = location.search.substr(1);
if (uri == "") {
  uri = "kamel.xm";
}
xmReq.open("GET", uri, true);
xmReq.responseType = "arraybuffer";
xmReq.onload = function (xmEvent) {
  var arrayBuffer = xmReq.response;
  if (arrayBuffer) {
    playXM(arrayBuffer);
  }
}
xmReq.send(null);
