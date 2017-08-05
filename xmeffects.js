(function (window) {
if (!window.XMPlayer) {
  window.XMPlayer = {};
}
var player = window.XMPlayer;

function eff_t1_0(ch) {  // arpeggio
  if (ch.effectdata !== 0 && ch.inst !== undefined) {
    var arpeggio = [0, ch.effectdata>>4, ch.effectdata&15];
    var note = ch.note + arpeggio[player.cur_tick % 3];
    ch.period = player.periodForNote(ch, note);
  }
}

function eff_t0_1(ch, data) {  // pitch slide up
  if (data !== 0) {
    ch.slideupspeed = data;
  }
}

function eff_t1_1(ch) {  // pitch slide up
  if (ch.slideupspeed !== undefined) {
    // is this limited? it appears not
    ch.period -= ch.slideupspeed;
  }
}

function eff_t0_2(ch, data) {  // pitch slide down
  if (data !== 0) {
    ch.slidedownspeed = data;
  }
}

function eff_t1_2(ch) {  // pitch slide down
  if (ch.slidedownspeed !== undefined) {
    // 1728 is the period for C-1
    ch.period = Math.min(1728, ch.period + ch.slidedownspeed);
  }
}

function eff_t0_3(ch, data) {  // portamento
  if (data !== 0) {
    ch.portaspeed = data;
  }
}

function eff_t1_3(ch) {  // portamento
  if (ch.periodtarget !== undefined && ch.portaspeed !== undefined) {
    if (ch.period > ch.periodtarget) {
      ch.period = Math.max(ch.periodtarget, ch.period - ch.portaspeed);
    } else {
      ch.period = Math.min(ch.periodtarget, ch.period + ch.portaspeed);
    }
  }
}

function eff_t0_4(ch, data) {  // vibrato
  if (data & 0x0f) {
    ch.vibratodepth = (data & 0x0f) * 2;
  }
  if (data >> 4) {
    ch.vibratospeed = data >> 4;
  }
  eff_t1_4(ch);
}

function eff_t1_4(ch) {  // vibrato
  ch.periodoffset = getVibratoDelta(ch.vibratotype, ch.vibratopos) * ch.vibratodepth;
  if (isNaN(ch.periodoffset)) {
    console.log("vibrato periodoffset NaN?",
        ch.vibratopos, ch.vibratospeed, ch.vibratodepth);
    ch.periodoffset = 0;
  }
  // only updates on non-first ticks
  if (player.cur_tick > 0) {
    ch.vibratopos += ch.vibratospeed;
    ch.vibratopos &= 63;
  }
}

function getVibratoDelta(type, x) {
  var delta = 0;
  switch (type & 0x03) {
    case 1: // sawtooth (ramp-down)
      delta = ((1 + x * 2 / 64) % 2) - 1;
      break;
    case 2: // square
    case 3: // random (in FT2 these two are the same)
      delta = x < 32 ? 1 : -1;
      break;
    case 0:
    default: // sine
      delta = Math.sin(x * Math.PI / 32);
      break;
  }
  return delta;
}

function eff_t1_5(ch) {  // portamento + volume slide
  eff_t1_a(ch);
  eff_t1_3(ch);
}

function eff_t1_6(ch) {  // vibrato + volume slide
  eff_t1_a(ch);
  eff_t1_4(ch);
}

function eff_t0_8(ch, data) {  // set panning
  ch.pan = data;
}

function eff_t0_9(ch, data) {  // sample offset
  ch.off = data * 256;
}

function eff_t0_a(ch, data) {  // volume slide
  if (data) {
    ch.volumeslide = -(data & 0x0f) + (data >> 4);
  }
}

function eff_t1_a(ch) {  // volume slide
  if (ch.volumeslide !== undefined) {
    ch.vol = Math.max(0, Math.min(64, ch.vol + ch.volumeslide));
  }
}

function eff_t0_b(ch, data) {  // song jump
  if (data < player.xm.songpats.length) {
    player.cur_songpos = data - 1;
    player.cur_pat = -1;
    player.cur_row = -1;
  }
}

function eff_t0_c(ch, data) {  // set volume
  ch.vol = Math.min(64, data);
}

function eff_t0_d(ch, data) {  // pattern jump
  player.cur_songpos++;
  if (player.cur_songpos >= player.xm.songpats.length)
    player.cur_songpos = player.xm.song_looppos;
  player.cur_pat = player.xm.songpats[player.cur_songpos];
  player.next_row = (data >> 4) * 10 + (data & 0x0f);
}

function eff_t0_e(ch, data) {  // extended effects!
  var eff = data >> 4;
  data = data & 0x0f;
  switch (eff) {
    case 1:  // fine porta up
      ch.period -= data;
      break;
    case 2:  // fine porta down
      ch.period += data;
      break;
    case 4:  // set vibrato waveform
      ch.vibratotype = data & 0x07;
      break;
    case 5:  // finetune
      ch.fine = (data<<4) + data - 128;
      break;
    case 6:  // pattern loop
      if (data == 0) {
        ch.loopstart = player.cur_row
      } else {
        if (typeof ch.loopend === "undefined") {
          ch.loopend = player.cur_row
          ch.loopremaining = data
        }
        if(ch.loopremaining !== 0) {
          ch.loopremaining--
          player.next_row = ch.loopstart || 0
        } else {
          delete ch.loopend
          delete ch.loopstart
        }
      }
      break;
    case 8:  // panning
      ch.pan = data * 0x11;
      break;
    case 0x0a:  // fine vol slide up (with memory)
      if (data === 0 && ch.finevolup !== undefined)
        data = ch.finevolup;
      ch.vol = Math.min(64, ch.vol + data);
      ch.finevolup = data;
      break;
    case 0x0b:  // fine vol slide down
      if (data === 0 && ch.finevoldown !== undefined)
        data = ch.finevoldown;
      ch.vol = Math.max(0, ch.vol - data);
      ch.finevoldown = data;
      break;
    case 0x0c:  // note cut handled in eff_t1_e
      break;
    default:
      console.log("unimplemented extended effect E", ch.effectdata.toString(16));
      break;
  }
}

function eff_t1_e(ch) {  // note cut
  switch (ch.effectdata >> 4) {
    case 0x0c:
      if (player.cur_tick == (ch.effectdata & 0x0f)) {
        ch.vol = 0;
      }
      break;
  }
}

function eff_t0_f(ch, data) {  // set tempo
  if (data === 0) {
    console.log("tempo 0?");
    return;
  } else if (data < 0x20) {
    player.xm.tempo = data;
  } else {
    player.xm.bpm = data;
  }
}

function eff_t0_g(ch, data) {  // set global volume
  if (data <= 0x40) {
    // volume gets multiplied by 2 to match
    // the initial max global volume of 128
    player.xm.global_volume = Math.max(0, data * 2);
  } else {
    player.xm.global_volume = player.max_global_volume;
  }
}

function eff_t0_h(ch, data) {  // global volume slide
  if (data) {
    // same as Axy but multiplied by 2
    player.xm.global_volumeslide = (-(data & 0x0f) + (data >> 4)) * 2;
  }
}

function eff_t1_h(ch) {  // global volume slide
  if (player.xm.global_volumeslide !== undefined) {
    player.xm.global_volume = Math.max(0, Math.min(player.max_global_volume,
      player.xm.global_volume + player.xm.global_volumeslide));
  }
}

function eff_t0_r(ch, data) {  // retrigger
  if (data & 0x0f) ch.retrig = (ch.retrig & 0xf0) + (data & 0x0f);
  if (data & 0xf0) ch.retrig = (ch.retrig & 0x0f) + (data & 0xf0);

  // retrigger volume table
  switch (ch.retrig >> 4) {
    case 1: ch.vol -= 1; break;
    case 2: ch.vol -= 2; break;
    case 3: ch.vol -= 4; break;
    case 4: ch.vol -= 8; break;
    case 5: ch.vol -= 16; break;
    case 6: ch.vol *= 2; ch.vol /= 3; break;
    case 7: ch.vol /= 2; break;
    case 9: ch.vol += 1; break;
    case 0x0a: ch.vol += 2; break;
    case 0x0b: ch.vol += 4; break;
    case 0x0c: ch.vol += 8; break;
    case 0x0d: ch.vol += 16; break;
    case 0x0e: ch.vol *= 3; ch.vol /= 2; break;
    case 0x0f: ch.vol *= 2; break;
  }
  ch.vol = Math.min(64, Math.max(0, ch.vol));
}

function eff_t1_r(ch) {
  if (player.cur_tick % (ch.retrig & 0x0f) === 0) {
    ch.off = 0;
  }
}

function eff_unimplemented() {}
function eff_unimplemented_t0(ch, data) {
  console.log("unimplemented effect", player.prettify_effect(ch.effect, data));
}

player.effects_t0 = [  // effect functions on tick 0
  eff_t1_0,  // 1, arpeggio is processed on all ticks
  eff_t0_1,
  eff_t0_2,
  eff_t0_3,
  eff_t0_4,  // 4
  eff_t0_a,  // 5, same as A on first tick
  eff_t0_a,  // 6, same as A on first tick
  eff_unimplemented_t0,  // 7
  eff_t0_8,  // 8
  eff_t0_9,  // 9
  eff_t0_a,  // a
  eff_t0_b,  // b
  eff_t0_c,  // c
  eff_t0_d,  // d
  eff_t0_e,  // e
  eff_t0_f,  // f
  eff_t0_g,  // g
  eff_t0_h,  // h
  eff_unimplemented_t0,  // i
  eff_unimplemented_t0,  // j
  eff_unimplemented_t0,  // k
  eff_unimplemented_t0,  // l
  eff_unimplemented_t0,  // m
  eff_unimplemented_t0,  // n
  eff_unimplemented_t0,  // o
  eff_unimplemented_t0,  // p
  eff_unimplemented_t0,  // q
  eff_t0_r,  // r
  eff_unimplemented_t0,  // s
  eff_unimplemented_t0,  // t
  eff_unimplemented_t0,  // u
  eff_unimplemented_t0,  // v
  eff_unimplemented_t0,  // w
  eff_unimplemented_t0,  // x
  eff_unimplemented_t0,  // y
  eff_unimplemented_t0,  // z
];

player.effects_t1 = [  // effect functions on tick 1+
  eff_t1_0,
  eff_t1_1,
  eff_t1_2,
  eff_t1_3,
  eff_t1_4,
  eff_t1_5,  // 5
  eff_t1_6,  // 6
  eff_unimplemented,  // 7
  null,   // 8
  null,   // 9
  eff_t1_a,  // a
  null,   // b
  null,   // c
  null,   // d
  eff_t1_e,  // e
  null,   // f
  null,  // g
  eff_t1_h,  // h
  eff_unimplemented,  // i
  eff_unimplemented,  // j
  eff_unimplemented,  // k
  eff_unimplemented,  // l
  eff_unimplemented,  // m
  eff_unimplemented,  // n
  eff_unimplemented,  // o
  eff_unimplemented,  // p
  eff_unimplemented,  // q
  eff_t1_r,  // r
  eff_unimplemented,  // s
  eff_unimplemented,  // t
  eff_unimplemented,  // u
  eff_unimplemented,  // v
  eff_unimplemented,  // w
  eff_unimplemented,  // x
  eff_unimplemented,  // y
  eff_unimplemented   // z
];

})(window);
