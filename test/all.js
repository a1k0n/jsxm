window = {};

require('../xm.js', window);
require('../xmeffects.js', window);

var XMPlayer = window.XMPlayer;

// set up basic blank single-channel, single-pattern XM
function ResetXMData() {
  var xm = {};
  window.XMPlayer.xm = xm;
  xm.channelinfo = [];
  xm.songname = "test song";
  xm.song_looppos = 0;
  xm.nchan = 1;
  xm.flags = 1;
  xm.tempo = 3;
  xm.bpm = 125;
  xm.channelinfo.push({
    number: 0,
    filterstate: new Float32Array(3),
    vol: 0,
    pan: 128,
    period: 1920 - 48*16,
    vL: 0, vR: 0,
    vLprev: 0, vRprev: 0,
    mute: 0,
    volE: 0, panE: 0,
    retrig: 0,
    vibratodepth: 1,
    vibratospeed: 1,
  });
  xm.songpats = [0];
  // 1 channel, 2 row blank pattern
  xm.patterns = [
    [[[-1, -1, -1, 0, 0]]],
    [[[-1, -1, -1, 0, 0]]]];
  xm.instruments = [];
  xm.instruments.push({
    'name': "test instrument",
    'number': 0,
    'samples': [
      { 'len': 256, 'loop': 0,
        'looplen': 256, 'note': 0, 'fine': 0,
        'pan': 128, 'type': 0, 'vol': 64,
        'sampledata': new Float32Array(256)
      }
    ],
    'samplemap': new Uint8Array(96),
    'env_vol': new XMPlayer.Envelope([0, 64, 1, 0], 2, 0, 0, 0),
    'env_pan': new XMPlayer.Envelope([0, 32], 0, 0, 0, 0)
  });
  // reset song position
  XMPlayer.cur_songpos = -1;
  XMPlayer.cur_pat = -1;
  XMPlayer.cur_tick = xm.tempo;
  return xm;
}

// using assert passed to the test function that just logs failures 
exports['test XM startup'] = function(assert) {
  ResetXMData();
  XMPlayer.nextTick();
  assert.equal(XMPlayer.cur_songpos, 0, 'advance to initial song position');
  assert.equal(XMPlayer.cur_pat, 0, 'advance to pattern 0');
  assert.equal(XMPlayer.cur_tick, 0, 'advance to tick 0');
  assert.equal(XMPlayer.cur_row, 1, 'advance to row 1');
};

exports['test note on'] = function(assert) {
  var xm = ResetXMData();
  // [row][column][channel]
  xm.patterns[0][0][0] = [48, 1, 0x10 + 33, 0, 0];  // C-4  1 40 000
  XMPlayer.nextTick();
  var ch = xm.channelinfo[0];
  assert.equal(ch.note, 48, 'set note');
  assert.equal(ch.period, 1152, 'channel period');
  assert.equal(ch.vol, 33, 'channel volume');
  assert.equal(ch.samp, xm.instruments[0].samples[0], 'set sample');
};

if (module == require.main) require('test').run(exports);
