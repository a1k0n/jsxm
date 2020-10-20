import { Inst } from './Instrument'
import { Sample } from './Sample'
import { EnvelopeFollower } from './EnvelopeFollower'

export class ChannelInfo {
    constructor(data: Partial<ChannelInfo>) {
        Object.assign(this, data);
    }

    number: number

    filterstate: Float32Array

    vL: number
    vR: number
    vLprev: number
    vRprev: number

    mute: number
    retrig: number

    inst: Inst
    note: number
    samp: Sample
    vol: number
    pan: number
    fine: number
    release: number
    voleffectfn: (channel: ChannelInfo, data: any) => any
    voleffectdata: number
    vibratospeed: number
    vibratodepth: number
    portaspeed: number
    effect: number
    effectdata: number
    effectfn: (ch, data) => any 
    periodtarget: number
    env_vol: EnvelopeFollower
    env_pan: EnvelopeFollower
    envtick: number
    off: number
    period: number
    vibratotype: number
    vibratopos: number

    periodoffset: number
    doff: number
    filter: Array<number>
    volE: number
    panE: number
}
