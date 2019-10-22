import * as helpers from '@turf/helpers'
import turfDistance from '@turf/distance'
import turfAlong from '@turf/along'

class PathDataset {
  constructor(locations) {
    this.setLocations(locations);
  }

  // @private
  setLocations(locations) {
    if (locations.length === 0) {
      throw new Error("Empty location list provided")
    }
    let locationsParsed = this.parseLocations(locations);

    this.intervals = this.buildIntervals(locationsParsed);

    this.locations = locationsParsed;
    this.startTime = locationsParsed[0].timestamp;
    this.endTime = locationsParsed[locationsParsed.length - 1].timestamp;
    this.duration = this.endTime - this.startTime;
  }

  parseLocations(locations) {
    return locations.map(loc=>Object.assign(loc, {
      timestamp: parseInt(loc.timestampMs)
    }));
  }

  // Builds a list of intervals from a list of locations
  buildIntervals(locations) {
    return locations.reduce((memo,loc,i)=>{
      if (memo.last) {
        memo.intervals.push(buildInterval(memo.last, loc))
      }
      memo.last = loc;
      return memo;
    }
      , {
        last: null,
        intervals: [],
      }).intervals;
  }
}

class PathInterpolator {
  constructor(pathDataset) {
    this.pathDataset = pathDataset;
    this.reset();
  }

  // Rewind to the start time of the path data
  reset() {
    this.currentTime = this.pathDataset.startTime;
    this.currentInterval = 0;
  }

  goToAbsoluteTime(time) {
    let t = clipNumber(this.pathDataset.startTime, this.pathDataset.endTime, time);

    this.currentTime = t;
    let i = this.intervalAtTime(t);

    if (!i) {
      throw new Error(`Cannot find interval for time: (input=${time} clipped=${t}`)
    }

    this.currentInterval = i;
    let phase = getIntervalPhase(i, time);

    this.phase = phase;
    return {
      interval: i,
      phase: phase,
    }

  }

  intervalAtTime(time) {
    // short-circuit if the currentInterval is the one we are looking for
    let ci = this.currentInterval;
    if (ci && isInInterval(ci, time)) {
      return ci;
    }
    return this.pathDataset.intervals.find(i=>isInInterval(i, time));
  }

}

function buildInterval(start, end) {
  let startPoint = helpers.point([start.lon, start.lat]);
  let endPoint = helpers.point([end.lon, end.lat]);
  let length = turfDistance(startPoint, endPoint);
  let duration = end.timestamp - start.timestamp;

  let velocity = length / (duration / (1000 * 60 * 60));
  return {
    start: start,
    end: end,
    startPoint,
    endPoint,
    length,
    duration,
    velocity,
  }
}

function clipNumber(min, max, x) {
  return x < min ? min : (x > max ? max : x);
}

function isInInterval(interval, time) {
  return time >= interval.start.timestamp && time <= interval.end.timestamp;
}

function getIntervalPhase(interval, time) {
  return parseFloat(time - interval.start.timestamp) / parseFloat(interval.duration)
}

function getPositionInInterval(interval, phase) {
  let distance = phase * interval.length;
  let ln = helpers.lineString([interval.startPoint, interval.endPoint]);
  let pt = turfAlong(ln, distance)
  if (!Array.isArray(pt.geometry.coordinates)) {
    return pt.geometry.coordinates;
  }
  return pt;
}

function zoomLevelForSpeed(velocity) {
  if (velocity < 1.0) return 15;
  if (velocity < 5) return 14;
  if (velocity < 10) return 13;
  if (velocity < 15) return 12;
  if (velocity < 20) return 11;
  if (velocity < 25) return 10;
  return 9;
}

module.exports = {
  PathDataset,
  PathInterpolator,
  getPositionInInterval,
  zoomLevelForSpeed,
}
