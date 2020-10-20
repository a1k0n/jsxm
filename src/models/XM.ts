import { ChannelInfo } from './ChannelInfo'

export class XM {
    global_volume: any
    songpats: Array<any>
    patterns: Array<any>
    song_looppos: any
    channelinfo: Array<ChannelInfo>
    nchan: number
    instruments: Array<any>

    bpm:number
    tempo:number
    songname:string
    flags: any

    constructor() {}

}