import ChannelInfo from "./ChannelInfo"
import Envelope from "./Envelope"
import XM from "./XM"

export default class XMPlayer {
    xm: XM

    periodForNote:   (ch: ChannelInfo, note: number) => number 
    prettify_effect:   (t: number, p: number) => number  
    init: () => void
    load: (arrayBuff: any) => void
    play:  () => void 
    pause: () => void 
    stop: () => void 
    cur_songpos: number
    cur_pat: number
    cur_row: number
    cur_ticksamp: number
    cur_tick: number

    max_global_volume: number

    // exposed for testing
    nextTick: () => void
    nextRow: () => void

    Envelope: Envelope;

    next_row: number

    effects_t0: Array<(number, any) => any>
    effects_t1: Array<(number, any) => any>

    audioctx: AudioContext 
    playing: boolean = false
}
