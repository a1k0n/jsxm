import "./shell";
import "./trackview";
import "./xm";
import "./xmeffects";

import XMPlayer from "./models/XMPlayer"

declare global {
    interface Window {
        XMPlayer: XMPlayer;
        XMView: any;
        webkitAudioContext: any;
        AudioContext: any;
     }
}