import {Envelope} from './Envelope'
import { Sample } from './Sample'
   
export class Instrument {
  name: string
  number: number

  samplemap: Uint8Array
  samples: Sample[]

  env_vol: Envelope
  env_pan: Envelope

  constructor(name: string, number: number) {
    this.name = name
    this.number = number

    this.samplemap = undefined
    this.samples = undefined

    this.env_vol = undefined
    this.env_pan = undefined
  }
}