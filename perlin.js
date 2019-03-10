/**
 * Class to generate Perlin noise
 */

// Hash lookup table as defined by Ken Perlin.  
// This is a randomly arranged array of all numbers from 0-255 inclusive.
const permutation = [151, 160, 137, 91, 90, 15, 
    131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 
    190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
    77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
    102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
    5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
    223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
    251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
    49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
    138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
];

class Perlin {
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
        try {

            // Compute the distance vector
            var dx = x - ix;
            var dy = y - iy;

            // Compute the dot-product
            // console.log(dx * this.Gradient[iy][ix][0] + dy * this.Gradient[iy][ix][1]);
            return (dx * this.Gradient[iy][ix][0] + dy * this.Gradient[iy][ix][1]);
        } catch (e) {
            console.log(ix + " " + iy);
            console.log(e);
        }
    }

    // Compute Perlin noise at world 2-D coordinates x, y
    // Ref.: https://en.wikipedia.org/wiki/Perlin_noise#Implementation
    perlin2(x, y, width, height) {

        // Transform to Perlin grid coordinates
        x *= (this.IXMAX - 1) / width;
        y *= (this.IYMAX - 1) / height; 

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