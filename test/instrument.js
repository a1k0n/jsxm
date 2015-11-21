var XMPlayer = window.XMPlayer;

// TODO:
//  - test volume envelope (sustain, release)
//  - test panning envelope

exports['test note on'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48, 1, 0x10 + 0x33, 0, 0];  // C-4  1 33 000
  XMPlayer.nextRow();
  var ch = xm.channelinfo[0];
  assert.equal(ch.note, 48, 'set note');
  assert.equal(ch.period, 1152, 'channel period');
  assert.equal(ch.vol, 0x33, 'channel volume');
  assert.equal(ch.samp, xm.instruments[0].samples[0], 'set sample');
  assert.equal(ch.off, 0, 'trigger offset');
};

exports['test instrument trigger'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48, 1, 0x10 + 0x33, 0, 0];  // C-4  1 33 000
  xm.patterns[0][1][0] = [-1, 1, -1, 0, 0];  // ---  1 -- 000
  var ch = xm.channelinfo[0];
  XMPlayer.nextRow();
  ch.pan = 1;  // forcibly override panning
  ch.off = 100;  // and sample offset
  assert.equal(XMPlayer.cur_row, 0, 'row 0');
  XMPlayer.nextRow();
  assert.equal(XMPlayer.cur_row, 1, 'row 1');
  assert.equal(ch.note, 48, 'note same after inst trigger');
  assert.equal(ch.period, 1152, 'period same after inst trigger');
  assert.equal(ch.vol, 64, 'vol reset after inst trigger');
  assert.equal(ch.pan, 128, 'pan reset after inst trigger');
  assert.equal(ch.samp, xm.instruments[0].samples[0], 'set sample');
  assert.equal(ch.off, 0, 'set offset=0');
};

exports['test note trigger'] = function(assert) {
  var xm = testdata.resetXMData();
  // [pat][row][channel]
  xm.patterns[0][0][0] = [48, 1, 0x10 + 0x33, 0, 0];  // C-4  1 33 000
  xm.patterns[0][1][0] = [49, -1, -1, 0, 0];  // C#4 -- -- 000
  var ch = xm.channelinfo[0];
  XMPlayer.nextRow();
  ch.pan = 1;  // forcibly override panning
  ch.off = 100;  // and sample offset
  ch.vibratopos = 1; // and vibrato position
  XMPlayer.nextRow();
  assert.equal(ch.note, 49, 'note updated after inst trigger');
  assert.equal(ch.period, 1136, 'period updated after note trigger');
  assert.equal(ch.vol, 0x33, 'vol not reset after note trigger');
  assert.equal(ch.pan, 1, 'pan not reset after note trigger');
  assert.equal(ch.off, 0, 'set offset=0');
  assert.equal(ch.vibratopos, 0, 'set vibrato pos=0');
};
