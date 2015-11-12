var XMPlayer = window.XMPlayer;

// TODO:
//  - portamento 3xx
//  - vibrato 4xy
//  - volume slide Axy
//  - porta+vol 5xy
//  - etc etc

tests['test 0xy arpeggio'] = function(assert) {
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

tests['test 1xx slide up'] = function(assert) {
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

tests['test 2xx slide down'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48,  1, -1, 2, 0x01];  // C-4  1 -- 201
  xm.patterns[0][1][0] = [-1, -1, -1, 2, 0x00];  // --- -- -- 200
  XMPlayer.xm.tempo = 3;
  XMPlayer.nextTick();
  var ch = xm.channelinfo[0];
  assert.equal(ch.period, 1152, 'row 0 tick 0 period 0');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 1, 'row 0 tick 1 period -1');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 2, 'row 0 tick 2 period -2');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 2, 'row 1 tick 0 period -2');
  XMPlayer.nextTick();
  assert.equal(ch.period, 1152 + 3, 'row 1 tick 1 period -3');
};

tests['test 3xx portamento'] = function(assert) {
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

