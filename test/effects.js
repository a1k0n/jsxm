var XMPlayer = window.XMPlayer;

// TODO:
//  - portamento 3xx
//  - vibrato 4xy
//  - volume slide Axy
//  - porta+vol 5xy
//  - etc etc

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

exports['test 4xy vibrato'] = function(assert) {
  var xm = testdata.resetXMData();
  // vibrato 4xy: speed x, depth y
  // full cycle is 64/speed
  // [pat][row][channel]
  xm.patterns[0] = [
    [[48,  1, -1, 4, 0x81]],  // C-4  1 -- 481
    [[-1, -1, -1, 4, 0x02]],  // --- -- -- 402
    [[-1, -1, -1, 4, 0x10]],  // --- -- -- 410
    [[-1, -1, -1, 4, 0x00]],  // --- -- -- 400
    [[-1, -1, -1, 0, 0x00]],  // --- -- -- 000 - no vibrato
    [[-1, -1, -1, 4, 0x00]],  // --- -- -- 400 - resume vibrato @ pos 0
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
  assert.equal(p.toFixed(3), "0.707", 'row 0 tick 1 period +0.707');
  XMPlayer.nextTick();  // row 0 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "1.000", 'row 0 tick 2 period +1.000');
  XMPlayer.nextTick();  // row 1 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "1.414", 'row 1 tick 0 period +1.414');
  XMPlayer.nextTick();  // row 1 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "0.000", 'row 1 tick 1 period +0');
  XMPlayer.nextTick();  // row 1 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.414", 'row 1 tick 2 period -1.414');
  XMPlayer.nextTick();  // row 2 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-2.000", 'row 2 tick 0 period -2.000');
  XMPlayer.nextTick();  // row 2 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.990", 'row 2 tick 1 period -1.990');
  XMPlayer.nextTick();  // row 2 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.962", 'row 2 tick 2 period -1.962');
  XMPlayer.nextTick();  // row 3 tick 0
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.914", 'row 3 tick 0 period -1.914');
  XMPlayer.nextTick();  // row 3 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.848", 'row 3 tick 1 period -1.848');
  XMPlayer.nextTick();  // row 3 tick 2
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.764", 'row 3 tick 2 period -1.764');
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
  assert.equal(p.toFixed(3), "-1.663", 'row 5 tick 0 period -1.663 - vibrato resume');
  XMPlayer.nextTick();  // row 5 tick 1
  p = -16*12 * Math.log(ch.doff / p0) / Math.log(2);
  assert.equal(p.toFixed(3), "-1.546", 'row 5 tick 1 period -1.546');
};

exports['test Gxx global volume'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  // 1 channel, 3 row blank pattern
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
