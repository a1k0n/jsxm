var XMPlayer = window.XMPlayer;

// set up basic blank single-channel, single-pattern XM
exports.resetXMData = function(channels) {
  if(typeof channels == 'undefined') { channels =  1 }
  var xm = {};
  window.XMPlayer.xm = xm;
  xm.channelinfo = [];
  xm.songname = "test song";
  xm.song_looppos = 0;
  xm.nchan = 1;
  xm.flags = 1;
  xm.tempo = 3;
  xm.bpm = 125;
  for(var i = 0; i < channels; i++){
    xm.channelinfo.push({
      number: i,
      filterstate: new Float32Array(3),
      vol: 0,
      pan: 128,
      period: 1920 - 48*16,
      vL: 0, vR: 0,
      vLprev: 0, vRprev: 0,
      mute: 0,
      volE: 0, panE: 0,
      retrig: 0,
      vibratopos: 0,
      vibratodepth: 1,
      vibratospeed: 1,
      vibratotype: 0,
    });
  }
  xm.songpats = [0];
  // 1 channel, 2 row blank pattern
  xm.patterns = [
    [
      [[-1, -1, -1, 0, 0]],
      [[-1, -1, -1, 0, 0]]
    ]
  ];
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
  XMPlayer.cur_tick = 64;
  return xm;
};
