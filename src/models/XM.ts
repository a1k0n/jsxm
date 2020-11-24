import { ChannelInfo } from './ChannelInfo'
import { Instrument } from './Instrument'
import { Pattern } from './Pattern'

export class XM {
    global_volume: number
    songpats: Array<number>
    patterns: Array<Array<Array<Pattern>>>
    song_looppos: number
    channelinfo: Array<ChannelInfo>
    nchan: number
    instruments: Array<Instrument>

    bpm:number
    tempo:number
    songname:string
    flags: number

    global_volumeslide: number

    constructor() {}

}

export interface AudioContext  { 
    currentTime: number; 
    sampleRate: number; 
    createGain: () => any; 
    createScriptProcessor: (arg0: number, arg1: number, arg2: number) => any; 
    createJavaScriptNode: (arg0: number, arg1: number, arg2: number) => any; 
    destination: any;
    createOscillator: () => any
 }