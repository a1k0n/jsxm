import Envelope from "./Envelope";

export default class EnvelopeFollower {
    env: Envelope;
    tick: number;
  
    constructor(env: Envelope) {
      this.env = env;
      this.tick = 0;
    }
  
    public Tick(release: number) {
      var value = this.env.Get(this.tick);
  
      // if we're sustaining a note, stop advancing the tick counter
      if (!release && this.tick >= this.env.points[this.env.sustain * 2]) {
        return this.env.points[this.env.sustain * 2 + 1];
      }
  
      this.tick++;
      if (this.env.type & 4) {  // envelope loop?
        if (!release &&
          this.tick >= this.env.loopend) {
          this.tick -= this.env.loopend - this.env.loopstart;
        }
      }
      return value;
    };
  }
  