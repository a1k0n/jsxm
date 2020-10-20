export class Sample {
    constructor(data: Partial<Sample>){
        Object.assign(this, data);
    }

    len: number
    loop: number

    looplen: number
    note: number
    fine: number

    pan: number
    type: number
    vol: number

    fileoffset: number
    sampledata: Float32Array
}