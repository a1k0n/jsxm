# xm.js

[![Build Status](https://travis-ci.org/a1k0n/jsxm.svg?branch=master)](https://travis-ci.org/a1k0n/jsxm)

FastTracker 2 .XM player, written for fun.

[Demo](http://www.a1k0n.net/code/jsxm/)

There is an XM player and a visualizer which are separate components. The
player API looks like this:

 - `XMPlayer.init` -> starts up audio context; it's available as
   `XMPlayer.audioctx`
 - `XMPlayer.load(ArrayBuffer)` -> returns `true` if loaded, otherwise
   barfs randomly
 - `XMPlayer.play()` -> starts playing
 - `XMPlayer.pause()` -> obvious
 - `XMPlayer.stop()` -> obvious; call this before loading a new one

Loading trackview.js is optional; without it, the player won't do any
visualizations. Or, you can override the following to get callbacks:

 - `XMView.pushEvent(e)` -> push an audio event onto the queue. Called
   once per tick (about 50Hz, controlled by song). `e` contains fields:
   - `t` - audio timestamp
   - `vu` - Float32Array of RMS power (volume) for each channel
   - `scopes` - [Float32Array] of oscilloscope data, one array per
     channel; `XMView.scope_width` contains # of samples to produce here
   - `songpos` - position in the song (# patterns played)
   - `pat` - pattern number currently playing
   - `row` - row within pattern
 - `XMView.pause()` - pause visualization
 - `XMView.stop()` - stop/reset visualization

The code which defines what the buttons do and downloads songs and so
forth is in `shell.js`.

The player is fairly feature-complete, but is missing a bunch of effects.

MIT license.
