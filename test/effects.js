var XMPlayer = window.XMPlayer;

// tests TODO:
//  - bxx: song jump
//  - rxy: retrigger w/ volume changes
// low priority TODO (trivial or already covered by other tests):
//  - 5xy: porta+vol
//  - 6xy: vibrato+vol
//  - 8xx: panning
//  - 9xx: sample offset

exports['test 0xy arpeggio'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48, 1, -1, 0, 0x4f];  // C-4  1 -- 04f
  XMPlayer.xm.tempo = 4;
  XMPlayer.nextTick();
  var ch = xm.channelinfo[0];
  assert.equal(ch.note, 48, 'note 0');
  assert.equal(ch.period, 1152, 'row 0 tick 0 period 0');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 16*4, 'row 0 tick 1 period 4');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 16*15, 'row 0 tick 2 period f');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 16*0, 'row 0 tick 3 period 0');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 16*0, 'row 1 tick 0 period 0');
};

exports['test 1xx slide up'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48,  1, -1, 1, 0x01];  // C-4  1 -- 101
  xm.patterns[0][1][0] = [-1, -1, -1, 1, 0x00];  // --- -- -- 100
  XMPlayer.xm.tempo = 3;
  XMPlayer.nextTick();
  var ch = xm.channelinfo[0];
  assert.equal(ch.period, 1152, 'row 0 tick 0 period 0');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 1, 'row 0 tick 1 period -1');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 2, 'row 0 tick 2 period -2');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 2, 'row 1 tick 0 period -2');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 3, 'row 1 tick 1 period -3');
};

exports['test 2xx slide down'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48,  1, -1, 2, 0x01];  // C-4  1 -- 201
  xm.patterns[0][1][0] = [-1, -1, -1, 2, 0x00];  // --- -- -- 200
  XMPlayer.xm.tempo = 3;
  XMPlayer.nextTick();
  var ch = xm.channelinfo[0];
  assert.equal(ch.period, 1152, 'row 0 tick 0 period 0');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 1, 'row 0 tick 1 period +1');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 2, 'row 0 tick 2 period +2');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 2, 'row 1 tick 0 period +2');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 3, 'row 1 tick 1 period +3');
};

exports['test 3xx portamento'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48,  1, -1, 0, 0x00];  // C-4  1 -- 000
  xm.patterns[0][1][0] = [49,  1, -1, 3, 0x09];  // C#4  1 -- 309
  XMPlayer.xm.tempo = 3;
  XMPlayer.nextTick();  // row 0 tick 0
  var ch = xm.channelinfo[0];
  assert.equal(ch.period, 1152, 'row 0 tick 0 period 0');
  XMPlayer.nextTick();  // row 0 tick 1
  XMPlayer.nextTick();  // row 0 tick 2
  XMPlayer.nextTick();  // row 1 tick 0
  assert.equal(ch.period, 1152, 'row 1 tick 0 period 0');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 9, 'row 1 tick 1 period -9');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 - 16, 'row 1 tick 2 period -16');
};

exports['test 4xy vibrato - sine'] = function(assert) {
  var xm = testdata.resetXMData();
  // vibrato 4xy: speed x, depth y
  // full cycle is 64/speed
  xm.patterns[0] = [
    [[48,  1, -1, 4, 0x81]],    // C-4  1 -- 481
    [[-1, -1, -1, 4, 0x02]],    // --- -- -- 402
    [[-1, -1, -1, 4, 0x10]],    // --- -- -- 410
    [[-1, -1, -1, 4, 0x00]],    // --- -- -- 400
    [[-1, -1, -1, 0, 0x00]],    // --- -- -- --- - no vibrato
    [[-1, -1, -1, 4, 0x00]],    // --- -- -- 400 - resume vibrato @ pos 0
    [[-1, -1, 0xb2, 0, 0x00]],  // --- -- V2 --- - volume effect vibrato
  ];
  // I should really be testing ch.doff directly
  XMPlayer.xm.tempo = 3;
  var ch = xm.channelinfo[0];
  XMPlayer.nextTick();  // row 0 tick 0
  var p0 = ch.doff;
  assert.equal(ch.periodoffset, 0, 'row 0 tick 0 periodoffset=0');
  XMPlayer.nextTick();  // row 0 tick 1
  // compute logical period p from actual play frequency
  var p = 16*12 * Math.log(p0 / ch.doff) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 0 tick 1 period +0');
  XMPlayer.nextTick();  // row 0 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "1.414", 'row 0 tick 2 period +1.414');
  XMPlayer.nextTick();  // row 1 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "4.000", 'row 1 tick 0 period +4.000');
  XMPlayer.nextTick();  // row 1 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "4.000", 'row 1 tick 1 period +4.000');
  XMPlayer.nextTick();  // row 1 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "2.828", 'row 1 tick 2 period 2.828');
  XMPlayer.nextTick();  // row 2 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 2 tick 0 period +0');
  XMPlayer.nextTick();  // row 2 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 2 tick 1 period +0');
  XMPlayer.nextTick();  // row 2 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-0.392", 'row 2 tick 2 period -0.392');
  XMPlayer.nextTick();  // row 3 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-0.780", 'row 3 tick 0 period -0.780');
  XMPlayer.nextTick();  // row 3 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-0.780", 'row 3 tick 1 period -0.780');
  XMPlayer.nextTick();  // row 3 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.161", 'row 3 tick 2 period -1.161');
  XMPlayer.nextTick();  // row 4 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 4 tick 0 period 0 - no vibrato');
  XMPlayer.nextTick();  // row 4 tick 1
  XMPlayer.nextTick();  // row 4 tick 2
  // I actually don't know whether vibrato is supposed to reset when the effect
  // goes away or whether it should resume. Resuming is simpler to implement so
  // that's what I'm assuming here...
  XMPlayer.nextTick();  // row 5 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.531", 'row 5 tick 0 period -1.531 - vibrato resume');
  XMPlayer.nextTick();  // row 5 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.531", 'row 5 tick 1 period -1.531');
  XMPlayer.nextTick();  // row 5 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.886", 'row 5 tick 2 period -1.886');
  XMPlayer.nextTick();  // row 6 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.111", 'row 6 tick 0 period -1.111');
};

exports['test 4xy vibrato - saw'] = function(assert) {
  var xm = testdata.resetXMData();
  // vibrato 4xy: speed x, depth y
  // full cycle is 64/speed
  xm.patterns[0] = [
    [[48,  1, -1, 14, 0x41]],  // C-4  1 -- E41 - 1 = saw (ramp-down)
    [[-1, -1, -1,  4, 0x81]],  // --- -- -- 481
    [[-1, -1, -1,  4, 0x00]],  // --- -- -- 400
    [[-1, -1, -1,  0, 0x00]],  // --- -- -- --- - no vibrato
    [[-1, -1, -1,  4, 0x00]],  // --- -- -- 400 - resume vibrato @ pos 0
  ];
  XMPlayer.xm.tempo = 4;
  var ch = xm.channelinfo[0];
  assert.equal(ch.vibratotype, 0, 'initial vibratotype 0');
  XMPlayer.nextTick();  // row 0 tick 0
  var p0 = ch.doff;
  assert.equal(ch.vibratotype, 1, 'row 0 tick 0 vibratotype=1');
  XMPlayer.nextTick();  // row 0 tick 1
  XMPlayer.nextTick();  // row 0 tick 2
  XMPlayer.nextTick();  // row 0 tick 3
  XMPlayer.nextTick();  // row 1 tick 0
  assert.equal(ch.periodoffset, 0, 'row 1 tick 0 periodoffset=0');
  XMPlayer.nextTick();  // row 1 tick 1
  // compute logical period p from actual play frequency
  var p = 16*12 * Math.log(p0 / ch.doff) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 1 tick 1 period +0');
  XMPlayer.nextTick();  // row 1 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.500", 'row 1 tick 2 period +0.500');
  XMPlayer.nextTick();  // row 1 tick 3
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "1.000", 'row 1 tick 3 period +1.000');
  XMPlayer.nextTick();  // row 2 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "1.500", 'row 2 tick 0 period +1.500');
  XMPlayer.nextTick();  // row 2 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "1.500", 'row 2 tick 1 period +1.500');
  XMPlayer.nextTick();  // row 2 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-2.000", 'row 2 tick 2 period -2.000');
  XMPlayer.nextTick();  // row 2 tick 3
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.500", 'row 2 tick 3 period -1.500');
  XMPlayer.nextTick();  // row 3 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 3 tick 0 period 0 - no vibrato');
  XMPlayer.nextTick();  // row 3 tick 1
  XMPlayer.nextTick();  // row 3 tick 2
  XMPlayer.nextTick();  // row 3 tick 3
  XMPlayer.nextTick();  // row 4 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.000", 'row 4 tick 0 period -1.000 - vibrato resume');
  XMPlayer.nextTick();  // row 4 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.000", 'row 4 tick 1 period -1.000');
  XMPlayer.nextTick();  // row 4 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-0.500", 'row 4 tick 2 period -0.500');
  XMPlayer.nextTick();  // row 4 tick 3
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 4 tick 3 period +0');
};

exports['test 4xy vibrato - square'] = function(assert) {
  var xm = testdata.resetXMData();
  // vibrato 4xy: speed x, depth y
  // full cycle is 64/speed
  xm.patterns[0] = [
    [[48,  1, -1, 14, 0x42]],  // C-4  1 -- E42 - 2 = square
    [[-1, -1, -1,  4, 0x81]],  // --- -- -- 481
    [[-1, -1, -1,  4, 0x02]],  // --- -- -- 402
    [[-1, -1, -1,  4, 0x10]],  // --- -- -- 410
    [[-1, -1, -1,  4, 0x03]],  // --- -- -- 403
    [[-1, -1, -1,  0, 0x00]],  // --- -- -- --- - no vibrato
    [[-1, -1, -1,  4, 0x00]],  // --- -- -- 400 - resume vibrato @ pos 0
  ];
  XMPlayer.xm.tempo = 3;
  var ch = xm.channelinfo[0];
  assert.equal(ch.vibratotype, 0, 'initial vibratotype 0');
  XMPlayer.nextTick();  // row 0 tick 0
  var p0 = ch.doff;
  assert.equal(ch.vibratotype, 2, 'row 0 tick 0 vibratotype=2');
  XMPlayer.nextTick();  // row 0 tick 1
  XMPlayer.nextTick();  // row 0 tick 2
  XMPlayer.nextTick();  // row 1 tick 0
  assert.equal(ch.periodoffset, 2, 'row 1 tick 0 periodoffset=2');
  XMPlayer.nextTick();  // row 1 tick 1
  // compute logical period p from actual play frequency
  var p = 16*12 * Math.log(p0 / ch.doff) / Math.log(2);
  assert.equal(p.toFixed(3), "2.000", 'row 1 tick 1 period +2.000');
  XMPlayer.nextTick();  // row 1 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "2.000", 'row 1 tick 2 period +2.000');
  XMPlayer.nextTick();  // row 2 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "4.000", 'row 2 tick 0 period +4.000');
  XMPlayer.nextTick();  // row 2 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "4.000", 'row 2 tick 1 period +4.000');
  XMPlayer.nextTick();  // row 2 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "4.000", 'row 2 tick 2 period +4.000');
  XMPlayer.nextTick();  // row 3 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-4.000", 'row 3 tick 0 period -4.000');
  XMPlayer.nextTick();  // row 3 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-4.000", 'row 3 tick 1 period -4.000');
  XMPlayer.nextTick();  // row 3 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-4.000", 'row 3 tick 2 period -4.000');
  XMPlayer.nextTick();  // row 4 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-6.000", 'row 4 tick 0 period -6.000');
  XMPlayer.nextTick();  // row 4 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-6.000", 'row 4 tick 1 period -6.000');
  XMPlayer.nextTick();  // row 4 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-6.000", 'row 4 tick 2 period -6.000');
  XMPlayer.nextTick();  // row 4 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 4 tick 0 period 0 - no vibrato');
  XMPlayer.nextTick();  // row 4 tick 1
  XMPlayer.nextTick();  // row 4 tick 2
  XMPlayer.nextTick();  // row 5 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-6.000", 'row 5 tick 0 period -6.000 - vibrato resume');
  XMPlayer.nextTick();  // row 5 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-6.000", 'row 5 tick 1 period -6.000');
  XMPlayer.nextTick();  // row 5 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-6.000", 'row 5 tick 2 period -6.000');
};

exports['test Axy volume slide'] = function(assert) {
  var xm = testdata.resetXMData();
  XMPlayer.xm.tempo = 6;

  xm.patterns[0] = [
    [[48,  1, -1, 10, 0x0f]],  // C-4  1 -- A0f (slide down)
    [[-1, -1, -1, 10, 0x90]],  // --- -- -- A90 (slide up)
    [[-1, -1, -1, 10, 0x00]],  // --- -- -- A00 (continue same)
    [[-1, -1, 0x30, 10, 0x11]],  // --- -- 20 A11 (invalid, do nothing)
  ];
  var ch = xm.channelinfo[0];
  XMPlayer.nextTick();
  assert.equal(ch.vol, 64, 'row 0 tick 0 vol 64');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 49, 'row 0 tick 1 vol 49');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 34, 'row 0 tick 2 vol 34');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 19, 'row 0 tick 3 vol 19');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 4, 'row 0 tick 4 vol 4');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 0, 'row 0 tick 5 vol 0');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 0, 'row 1 tick 0 vol 0');
  XMPlayer.nextTick();
  assert.equal(ch.vol, 9, 'row 1 tick 1 vol 9');
  XMPlayer.nextTick();  // row 1 tick 2
  XMPlayer.nextTick();  // tick 3
  XMPlayer.nextTick();  // tick 4
  XMPlayer.nextTick();  // tick 5
  assert.equal(ch.vol, 45, 'row 1 tick 5 vol 45');
  XMPlayer.nextTick();  // row 2 tick 0
  assert.equal(ch.vol, 45, 'row 2 tick 0 vol 45');
  XMPlayer.nextTick();  // row 2 tick 1
  assert.equal(ch.vol, 54, 'row 2 tick 1 vol 54');
  XMPlayer.nextTick();  // tick 2
  XMPlayer.nextTick();  // tick 3
  assert.equal(ch.vol, 64, 'row 2 tick 3 vol 64');
  XMPlayer.nextTick();  // tick 4
  XMPlayer.nextTick();  // tick 5
  XMPlayer.nextTick();  // row 3 tick 0
  assert.equal(ch.vol, 32, 'row 3 tick 0 vol 32');
  XMPlayer.nextTick();  // tick 1
  assert.equal(ch.vol, 32, 'row 3 tick 1 vol 32');
  XMPlayer.nextTick();  // tick 2
  assert.equal(ch.vol, 32, 'row 3 tick 2 vol 32');
};

exports['test Dxx pattern jump'] = function(assert) {
  var xm = testdata.resetXMData();
  xm.tempo = 2;
  xm.patterns[0] = [
    [[-1, -1, -1, 0x0, 0x00]],  // 00 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 01 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 02 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 03 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 04 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 05 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 06 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 07 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 08 --- -- -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 09 --- -- -- 000
    [[49,  1, -1, 0x0, 0x00]],  // 0a C#4  1 -- 000
    [[-1, -1, -1, 0x0, 0x00]],  // 0b --- -- -- 000
  ];
  // argument is BCD, so 0x10 actually means 10 (decimal)
  xm.patterns[1] = [
    [[-1, -1, -1, 0x0, 0x00]],  // --- -- -- 000
    [[48,  1, -1, 0xd, 0x10]],  // C-4  1 -- D10
    [[-1, -1, -1, 0x0, 0x00]],  // --- -- -- 000
  ];
  xm.songpats = [1, 0];
  XMPlayer.nextTick();  // play first, empty row (pattern 1)
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, "songpos 0");
  assert.equal(XMPlayer.cur_pat, 1, "pattern 1");
  assert.equal(XMPlayer.cur_row, 0, "row 0");

  XMPlayer.nextTick();  // play C-4  1 -- D01 in pattern 1
  XMPlayer.nextTick();  // we will jump to pattern 0 row 1 after this

  assert.equal(xm.channelinfo[0].period, 1152, "play C-4 on Dxx row");

  XMPlayer.nextTick();  // play row 0x0a C#4  1 -- 000 in pattern 0

  assert.equal(xm.channelinfo[0].period, 1136, "play C#4 on following row");
  assert.equal(XMPlayer.cur_songpos, 1, "songpos 0");
  assert.equal(XMPlayer.cur_pat, 0, "pattern 1");
  assert.equal(XMPlayer.cur_row, 10, "row 10");
};

exports['test Gxx global volume'] = function(assert) {
  var xm = testdata.resetXMData();
  xm.patterns = [
    [
      [[48, 1, -1, 16, 0x40]], // C-4  1 -- G40
      [[48, 1, -1, 16, 0x2B]], // C-4  1 -- G2B
      // test out of bounds volume
      [[48, 1, -1, 16, 0x80]]  // C-4  1 -- G80
    ]
  ];
  XMPlayer.xm.tempo = 1;
  XMPlayer.nextTick();
  // volume gets multiplied by 2 to match
  // the initial max global volume of 128
  assert.equal(XMPlayer.xm.global_volume, 0x40*2, 'global volume set to 0x40');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.xm.global_volume, 0x2B*2, 'global volume set to 0x2B');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.xm.global_volume, 0x40*2, 'global volume set to 0x40');
};

exports['test Hxy global volume slide'] = function(assert) {
  var xm = testdata.resetXMData();
  xm.tempo = 6;
  xm.global_volume = 128;

  xm.patterns[0] = [
    [[48,  1, -1, 17, 0x0f]],  // C-4  1 -- H0f (slide down)
    [[-1, -1, -1, 17, 0x90]],  // --- -- -- H90 (slide up)
    [[-1, -1, -1, 17, 0x00]],  // --- -- -- H00 (continue same)
    [[-1, -1, 0x30, 17, 0x11]],  // --- -- 30 H11 (invalid, do nothing)
  ];
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 128, 'row 0 tick 0 vol 128');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 98, 'row 0 tick 1 vol 98');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 68, 'row 0 tick 2 vol 68');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 38, 'row 0 tick 3 vol 38');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 8, 'row 0 tick 4 vol 8');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 0, 'row 0 tick 5 vol 0');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 0, 'row 1 tick 0 vol 0');
  XMPlayer.nextTick();
  assert.equal(xm.global_volume, 18, 'row 1 tick 1 vol 18');
  XMPlayer.nextTick();  // row 1 tick 2
  XMPlayer.nextTick();  // tick 3
  XMPlayer.nextTick();  // tick 4
  XMPlayer.nextTick();  // tick 5
  assert.equal(xm.global_volume, 90, 'row 1 tick 5 vol 90');
  XMPlayer.nextTick();  // row 2 tick 0
  assert.equal(xm.global_volume, 90, 'row 2 tick 0 vol 90');
  XMPlayer.nextTick();  // row 2 tick 1
  assert.equal(xm.global_volume, 108, 'row 2 tick 1 vol 108');
  XMPlayer.nextTick();  // tick 2
  XMPlayer.nextTick();  // tick 3
  assert.equal(xm.global_volume, 128, 'row 2 tick 3 vol 128');
  XMPlayer.nextTick();  // tick 4
  XMPlayer.nextTick();  // tick 5
  XMPlayer.nextTick();  // row 3 tick 0
  assert.equal(xm.global_volume, 128, 'row 3 tick 0 vol 128');
  XMPlayer.nextTick();  // tick 1
  assert.equal(xm.global_volume, 128, 'row 3 tick 1 vol 128');
  XMPlayer.nextTick();  // tick 2
  assert.equal(xm.global_volume, 128, 'row 3 tick 2 vol 128');
};

exports['test E4x set vibrato waveform'] = function(assert) {
  var xm = testdata.resetXMData();
  xm.patterns = [
    [
      [[48, 1, -1,  0, 0x00]], // C-4  1 -- ---  (default waveform - sine)
      [[48, 1, -1, 14, 0x41]], // C-4  1 -- E41  (saw, ramp-down)
      [[48, 1, -1, 14, 0x42]], // C-4  1 -- E42  (square)
      [[48, 1, -1, 14, 0x43]]  // C-4  1 -- E43  (random)
    ]
  ];
  xm.tempo = 1;
  var ch = xm.channelinfo[0];
  XMPlayer.nextTick();
  assert.equal(ch.vibratotype, 0, 'row 0 tick 0 vibratotype=0');
  XMPlayer.nextTick();
  assert.equal(ch.vibratotype, 1, 'row 1 tick 0 vibratotype=1');
  XMPlayer.nextTick();
  assert.equal(ch.vibratotype, 2, 'row 2 tick 0 vibratotype=2');
  XMPlayer.nextTick();
  assert.equal(ch.vibratotype, 3, 'row 3 tick 0 vibratotype=3');
};

exports['test E5x finetune override'] = function(assert) {
  var xm = testdata.resetXMData();
  // set an initial finetune so we know we're overriding it...
  xm.instruments[0].samples[0].fine = -4;
  xm.patterns = [
    [
      [[48, 1, -1,  0, 0x00]], // C-4  1 -- 000  (sample finetune -4)
      [[48, 1, -1, 14, 0x50]], // C-4  1 -- E50  (finetune -128)
      [[48, 1, -1, 14, 0x5f]]  // C-4  1 -- E5f  (finetune +127)
    ]
  ];
  xm.tempo = 1;
  var ch = xm.channelinfo[0];
  XMPlayer.nextTick();
  var f0 = ch.doff;
  XMPlayer.nextTick();
  // compare frequency relative to original finetune -4 note
  var f1 = 12 * 128 * Math.log(ch.doff / f0) / Math.log(2);
  assert.equal(f1.toFixed(2), "-124.00", "E50 finetune -128");
  XMPlayer.nextTick();
  var f2 = 12 * 128 * Math.log(ch.doff / f0) / Math.log(2);
  assert.equal(f2.toFixed(2), "131.00", "E5f finetune +127");
};

exports['test E60 loop twice with set beginning'] = function(assert) {
  var xm = testdata.resetXMData(2);

  xm.patterns[0] = [
    [[60, 1, -1, 0, 0], [-1, -1, -1, 0x0, 0x00]], // 0  0
    [[62, 1, -1, 0, 0], [-1, -1, -1, 0xE, 0x60]], // 1   1  4  7
    [[64, 1, -1, 0, 0], [-1, -1, -1, 0x0, 0x00]], // 2    2  5  8
    [[65, 1, -1, 0, 0], [-1, -1, -1, 0xE, 0x62]], // 3     3  6  9
    [[66, 1, -1, 0, 0], [-1, -1, -1, 0x0, 0x00]]  // 4            10
  ];                                              // ^r t->

  //  C-5 1  --  ---     --  --  --  --- |
  //  D-5 1  --  ---     --  --  --  E60 | set repeat start
  //  E-5 1  --  ---     --  --  --  --- |
  //  F-5 1  --  ---     --  --  --  E62 | goto repeate start twice
  //  G-5 1  --  ---     --  --  --  --- |

  xm.tempo = 2;
  var rowProgression = []
  for(var i = 0; i < 11; i++) {
    XMPlayer.nextTick();
    XMPlayer.nextTick();
    rowProgression.push(XMPlayer.cur_row)
  }

  assert.deepEqual(rowProgression, [0,1,2,3, 1,2,3, 1,2,3,4], "row 10"
  );
}
