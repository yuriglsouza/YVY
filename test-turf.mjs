import * as turfHelpers from "@turf/helpers";
import turfConvex from "@turf/convex";

const points = [
  [-55.9, -13.06],
  [-55.91, -13.06],
  [-55.9, -13.07]
];

try {
    const featureCollection = turfHelpers.featureCollection(points.map(p => turfHelpers.point(p)));
    console.log("Feature collection created");
    const hull = turfConvex(featureCollection);
    // console.log("Hull:", hull);
    if (hull) {
      console.log("Success with turfConvex()");
    }
} catch (e) {
    console.error("Error with turfConvex():", e);
}

try {
    const featureCollection = turfHelpers.featureCollection(points.map(p => turfHelpers.point(p)));
    const hull = turfConvex.default(featureCollection);
    if (hull) {
      console.log("Success with turfConvex.default()");
    }
} catch (e) {
    console.error("Error with turfConvex.default():", e);
}
