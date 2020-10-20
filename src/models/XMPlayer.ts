import { XM } from "./XM"

export class XMPlayer {
    xm: XM

    periodForNote: any
    prettify_effect: any
    init: any
    load: any
    play: any
    pause: any
    stop: any
    cur_songpos: any
    cur_pat: any
    cur_row: any
    cur_ticksamp: any
    cur_tick: any

    max_global_volume: any;

    // exposed for testing
    nextTick: any
    nextRow: any

    Envelope: any;

    next_row: number

    effects_t0: Array<(number, any) => any>
    effects_t1: Array<(number, any) => any>

    audioctx: any
    playing: boolean
}