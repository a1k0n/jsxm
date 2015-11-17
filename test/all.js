window = {};

require('../xm.js');
require('../xmeffects.js');
var XMPlayer = window.XMPlayer;

testdata = require('./testdata.js');

// test TODO:
//  - audio output sample positions after ticks
//  - unit test for envelopes
//
// using assert passed to the test function that just logs failures 
exports['test XM startup'] = function(assert) {
  testdata.resetXMData();
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'advance to initial song position');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  assert.equal(XMPlayer.cur_tick, 0, 'advance to tick 0');
  assert.equal(XMPlayer.cur_row, 0, 'advance to row 0');
};

exports['test non-existing song position'] = function(assert) {
  testdata.resetXMData();
  // 2 existing patterns, 1 non-existing
  XMPlayer.xm.songpats = [0, 1, 2]
  // 1 channel, 1 row, 2 blank patterns
  XMPlayer.xm.patterns = [
    [[[-1, -1, -1, 0, 0]]],
    [[[-1, -1, -1, 0, 0]]]
  ];
  XMPlayer.xm.tempo = 1;
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'advance to initial song position');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  assert.equal(XMPlayer.cur_row, 0, 'advance to row 0');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 1, 'advance to song position 1');
  assert.equal(XMPlayer.cur_pat, 1, 'advance to pattern 1');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'return to song position 0');
  assert.equal(XMPlayer.cur_pat, 0, 'return to pattern 0');
};

exports['test non-existing first song position'] = function(assert) {
  testdata.resetXMData();
  // 2 existing patterns, 1 non-existing
  XMPlayer.xm.songpats = [2, 0, 1]
  // 1 channel, 1 row, 2 blank patterns
  XMPlayer.xm.patterns = [
    [[[-1, -1, -1, 0, 0]]],
    [[[-1, -1, -1, 0, 0]]]
  ];
  XMPlayer.xm.tempo = 1;
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 1, 'advance to song position 1');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 2, 'advance to song position 2');
  assert.equal(XMPlayer.cur_pat, 1, 'advance to pattern 1');
};

exports['test multiple non-existing song positions'] = function(assert) {
  testdata.resetXMData();
  // 2 existing patterns, 2 non-existing
  XMPlayer.xm.songpats = [2, 0, 3, 1]
  // 1 channel, 1 row, 2 blank patterns
  XMPlayer.xm.patterns = [
    [[[-1, -1, -1, 0, 0]]],
    [[[-1, -1, -1, 0, 0]]]
  ];
  XMPlayer.xm.tempo = 1;
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 1, 'advance to song position 1');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 3, 'advance to song position 3');
  assert.equal(XMPlayer.cur_pat, 1, 'advance to pattern 1');
};

exports['test non-existing song position with loop'] = function(assert) {
  testdata.resetXMData();
  // 2 existing patterns, 1 non-existing
  XMPlayer.xm.songpats = [0, 1, 2]
  // 1 channel, 1 row, 2 blank patterns
  XMPlayer.xm.patterns = [
    [[[-1, -1, -1, 0, 0]]],
    [[[-1, -1, -1, 0, 0]]]
  ];
  XMPlayer.xm.song_looppos = 1;
  XMPlayer.xm.tempo = 1;
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'advance to initial song position');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  assert.equal(XMPlayer.cur_row, 0, 'advance to row 0');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 1, 'advance to song position 1');
  assert.equal(XMPlayer.cur_pat, 1, 'advance to pattern 1');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 1, 'replay song position 1');
  assert.equal(XMPlayer.cur_pat, 1, 'replay pattern 1');
};

exports['test non-existing song position with invalid loop'] = function(assert) {
  testdata.resetXMData();
  // 2 existing patterns, 1 non-existing
  XMPlayer.xm.songpats = [0, 1, 2]
  // 1 channel, 1 row, 2 blank patterns
  XMPlayer.xm.patterns = [
    [[[-1, -1, -1, 0, 0]]],
    [[[-1, -1, -1, 0, 0]]]
  ];
  XMPlayer.xm.song_looppos = 4;
  XMPlayer.xm.tempo = 1;
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'advance to initial song position');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  assert.equal(XMPlayer.cur_row, 0, 'advance to row 0');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 1, 'advance to song position 1');
  assert.equal(XMPlayer.cur_pat, 1, 'advance to pattern 1');
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'return to song position 0');
  assert.equal(XMPlayer.cur_pat, 0, 'return to pattern 0');
};

exports['test instruments'] = require('./instrument.js');
exports['test effects'] = require('./effects.js');

if (module == require.main) require('test').run(exports);
