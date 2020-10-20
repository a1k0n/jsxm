import { ChannelInfo } from './ChannelInfo'
import { Pattern } from './Pattern'

export class XM {
    global_volume: any
    songpats: Array<any>
    patterns: Array<Array<Array<Pattern>>>
    song_looppos: any
    channelinfo: Array<ChannelInfo>
    nchan: number
    instruments: Array<any>

    bpm:number
    tempo:number
    songname:string
    flags: any

    global_volumeslide: number

    constructor() {}

}