/**
 * Class to generate 2-D Perlin noise 
 */

class Perlin {
    /**
     * Creates Perlin object with grid size (ixmax x iymax)
     * Coordinates in Perlin grid-space are in [0, ixmax - 1] and [0, iymax - 1]
     * @param {Number} ixmax 
     * @param {Number} iymax
     */

    constructor(ixmax, iymax) {
        // size of Perlin grid
        this.IXMAX = ixmax;
        this.IYMAX = iymax;
        this.rng = new Math.seedrandom();
        this.Gradient = []; // Precomputed (or otherwise) gradient vectors at each grid node

        for (var y = 0; y < this.IYMAX; y++) {
            this.Gradient.push([])
        }
        for (var y = 0; y < this.IYMAX; y++) {
            for (var x = 0; x < this.IXMAX; x++) {
                this.Gradient[y].push(vec2.fromValues(0, 0));
            }
        }
        this.computeGradient();
    }

    /**
     * Sets seed for Perlin noise generation and computes corresponding gradient
     * @param {String} seed 
     */
    setSeed(seed) {
        this.rng = new Math.seedrandom(seed);
    }

    /**
     * Populates Gradient with random 2-D vectors
     */
    computeGradient() {
        for (var y = 0; y < this.IYMAX; y++) {
            for (var x = 0; x < this.IXMAX; x++) {
                // random vector in unit square
                this.Gradient[y][x] = vec2.fromValues(2 * this.rng() - 1, 2 * this.rng() - 1);

                // Normalize the vector
                vec2.normalize(this.Gradient[y][x], this.Gradient[y][x]);
            }
        }
    }

    /**
     * Function to linearly interpolate between a0 and a1
     * Weight w should be in the range [0.0, 1.0]
     * @param {Number} a0 
     * @param {Number} a1 
     * @param {Number} w
     * @return {Number}
     */
    static lerp(a0, a1, w) {
        return a0 + w * (a1 - a0);
    }

    /**
     * Fade function as defined by Ken Perlin.  This eases coordinate values
     * so that they will "ease" towards integral values.  This ends up smoothing
     * the final output.
     * Reference: Ken Perlin. 2002. Improving noise. In Proceedings of the 29th annual conference on 
     *      Computer graphics and interactive techniques (SIGGRAPH '02). ACM, New York, NY, USA, 681-682. 
     *      DOI: https://doi.org/10.1145/566570.566636
     * @param {Number} t
     * @return {Number}
     */
    static fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10); // 6t^5 - 15t^4 + 10t^3
    }

    /**
     * Computes the dot product of the distance and gradient vectors.
     * @param {vec2} coord
     * @param {vec2} cellCoord - Coordinates of a cell corner where coord lives in Perlin grid space
     * @return {Number}
     */
    dotGridGradient(coord, cellCoord) {
        try {
            // Compute the distance vector
            var d = vec2.create();
            vec2.subtract(d, coord, cellCoord);

            // Compute the dot-product
            return vec2.dot(d, this.Gradient[cellCoord[1]][cellCoord[0]]);
        } catch (e) {
            console.log(e);
        }
    }

    /**
     * Compute Perlin noise at world 2-D coordinates v
     * Reference: https://en.wikipedia.org/wiki/Perlin_noise#Implementation
     * @param {vec2} vect
     * @param {Number} width - width of world grid
     * @param {Number} height - height of world grid
     * @return {Number} - in range [-1, 1]
     */
    getNoise(vect, width, height) {

        // Transform world coordinates to Perlin grid coordinates
        var oldRatio = vec2.fromValues(width, height);
        var newRatio = vec2.fromValues(this.IXMAX - 1, this.IYMAX - 1);
        var v = vec2.clone(vect);
        vec2.multiply(v, v, newRatio);
        vec2.divide(v, v, oldRatio);

        // Determine grid cell coordinates
        var x0 = Math.floor(v[0]);
        if (x0 + 1 == this.IXMAX) // in case of point on right edge
            x0 -= 1;
        var x1 = x0 + 1;
        var y0 = Math.floor(v[1]);
        if (y0 + 1 == this.IYMAX) // in case of point on bottom edge
            y0 -= 1;
        var y1 = y0 + 1;

        // console.assert(0 <= x0 && x0 < this.IXMAX, "x0 = " + x0);
        // console.assert(0 <= x1 && x1 < this.IXMAX, "x1 = " + x1);

        // console.assert(0 <= y0 && y0 < this.IYMAX, "y0 = " + y0);
        // console.assert(0 <= y1 && y1 < this.IYMAX, "y1 = " + y1);

        // Determine interpolation weights
        var sx = Perlin.fade(v[0] - x0);
        // console.assert(sx >= 0.0 && sx <= 1.0, {
        //     "message": "sx is not in [0, 1]",
        //     "sx": sx
        // });
        var sy = Perlin.fade(v[1] - y0);
        // console.assert(sy >= 0.0 && sy <= 1.0, {
        //     "message": "sy is not in [0, 1]",
        //     "sy": sy
        // });

        // Interpolate between grid point gradients
        var n0, n1, ix0, ix1, value;
        n0 = this.dotGridGradient(v, vec2.fromValues(x0, y0));
        n1 = this.dotGridGradient(v, vec2.fromValues(x1, y0));
        ix0 = Perlin.lerp(n0, n1, sx);
        n0 = this.dotGridGradient(v, vec2.fromValues(x0, y1));
        n1 = this.dotGridGradient(v, vec2.fromValues(x1, y1));
        ix1 = Perlin.lerp(n0, n1, sx);
        value = Perlin.lerp(ix0, ix1, sy);

        // console.assert(value >= -1.0 && value <= 1.0, "Value in incorrect range " + value);
        return value;
    }
}