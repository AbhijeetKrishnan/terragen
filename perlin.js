/**
 * Class to generate Perlin noise
 */

class Perlin {
    constructor(ixmax, iymax) {
        this.IXMAX = ixmax + 1;
        this.IYMAX = iymax + 1;
        this.rng = new Math.seedrandom();
        this.Gradient = []; // Precomputed (or otherwise) gradient vectors at each grid node

        for (var y = 0; y < this.IYMAX; y++) {
            this.Gradient.push([])
        }
        for (var y = 0; y < this.IYMAX; y++) {
            for (var x = 0; x < this.IXMAX; x++) {
                this.Gradient[y].push([0, 0]); // TODO: why isn't vec2 working?
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
        this.computeGradient();
    }

    /**
     * Populates Gradient with random 2-D vectors
     */
    computeGradient() {
        for (var y = 0; y < this.IYMAX; y++) {
            for (var x = 0; x < this.IXMAX; x++) {
                this.Gradient[y][x][0] = 2 * this.rng() - 1;
                this.Gradient[y][x][1] = 2 * this.rng() - 1;

                // Normalize the vector
                var norm = Math.sqrt(this.Gradient[y][x][0] * this.Gradient[y][x][0] + this.Gradient[y][x][1] * this.Gradient[y][x][1]);
                this.Gradient[y][x][0] /= norm;
                this.Gradient[y][x][1] /= norm;
            }
        }
    }

    // Function to linearly interpolate between a0 and a1
    // Weight w should be in the range [0.0, 1.0]
    static lerp(a0, a1, w) {
        return a0 + w * (a1 - a0);
    }

    static fade(t) {
        // Fade function as defined by Ken Perlin.  This eases coordinate values
        // so that they will "ease" towards integral values.  This ends up smoothing
        // the final output.
        return t * t * t * (t * (t * 6 - 15) + 10); // 6t^5 - 15t^4 + 10t^3
    }

    // Computes the dot product of the distance and gradient vectors.
    dotGridGradient(ix, iy, x, y) {

        // Compute the distance vector
        var dx = x - ix;
        var dy = y - iy;

        // Compute the dot-product
        //console.log(dx * this.Gradient[iy][ix][0] + dy * this.Gradient[iy][ix][1]);
        return (dx * this.Gradient[iy][ix][0] + dy * this.Gradient[iy][ix][1]);
    }

    // Compute Perlin noise at 2-D coordinates x, y
    // Ref.: https://en.wikipedia.org/wiki/Perlin_noise#Implementation
    perlin2(x, y) {

        // Determine grid cell coordinates
        var x0 = Math.floor(x);
        var x1 = x0 + 1;
        var y0 = Math.floor(y);
        var y1 = y0 + 1;

        // Determine interpolation weights
        // Could also use higher order polynomial/s-curve here
        var sx = Perlin.fade(x - x0);
        console.assert(sx >= 0.0 && sx <= 1.0, {
            "message": "sx is not in [0, 1]",
            "sx": sx
        });
        var sy = Perlin.fade(y - y0);
        console.assert(sy >= 0.0 && sy <= 1.0, {
            "message": "sy is not in [0, 1]",
            "sy": sy
        });

        // Interpolate between grid point gradients
        var n0, n1, ix0, ix1, value;
        n0 = this.dotGridGradient(x0, y0, x, y);
        n1 = this.dotGridGradient(x1, y0, x, y);
        ix0 = Perlin.lerp(n0, n1, sx);
        n0 = this.dotGridGradient(x0, y1, x, y);
        n1 = this.dotGridGradient(x1, y1, x, y);
        ix1 = Perlin.lerp(n0, n1, sx);
        //console.log(ix0 + " " + ix1);
        value = Perlin.lerp(ix0, ix1, sy);

        return value;
    }
}