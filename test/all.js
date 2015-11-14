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
  assert.equal(XMPlayer.cur_row, 1, 'advance to row 1');
};

exports['test instruments'] = require('./instrument.js');
exports['test effects'] = require('./effects.js');

if (module == require.main) require('test').run(exports);
