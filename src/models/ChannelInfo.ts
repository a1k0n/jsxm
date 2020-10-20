import {Inst} from './Inst'

export class ChannelInfo {
    constructor(data: Partial<ChannelInfo>){
        Object.assign(this, data);
    }

    number: number

    filterstate: Float32Array

    vL: number
    vR: number
    vLprev:number
    vRprev:number

    mute: number
    retrig:number
    
    inst: Inst
    note: any
    samp: any
    vol: any
    pan: any
    fine: any
    release: any
    voleffectfn: any
    voleffectdata: any
    vibratospeed: any
    vibratodepth: any
    portaspeed: any
    effect: any
    effectdata: any
    effectfn: any
    periodtarget: any
    env_vol: any
    env_pan: any
    envtick: any
    off: any
    period: any
    vibratotype: any
    vibratopos: any
  
    periodoffset: any
    doff: any
    filter: any
    volE: any
    panE: any
  }
  