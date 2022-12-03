/**
 * Class to generate 2-D Perlin noise 
 */

const seedrandom = require('seedrandom');
import { vec2, vec3 } from 'gl-matrix';

export class PerlinTex {
    name: string;
    base: vec3;
    highlight: vec3;
    width: number;
    height: number;
    share: number | undefined;

    constructor(name: string, base: vec3, highlight: vec3, width: number, height: number, share?: number) {
        this.name = name;
        this.base = base;
        this.highlight = highlight;
        this.width = width;
        this.height = height;
        if (typeof(share) != 'undefined') {
            this.share = share;
        }
    }

    static isPerlinTex(obj: object): obj is PerlinTex {
        return 'name' in obj
            && 'base' in obj
            && 'highlight' in obj
            && 'width' in obj
            && 'height' in obj;
    }
}

export class PerlinTexPreset {
    name: string;
    layers: number;
    textures: PerlinTex[];
    objTex: PerlinTex;
    objCutoff: number;

    constructor(name: string, layers: number, textures: PerlinTex[], objTex: PerlinTex, objCutoff: number) {
        this.name = name;
        this.layers = layers;
        this.textures = textures;
        this.objTex = objTex;
        this.objCutoff = objCutoff;
    }

    static isPerlinTexPreset(obj: object): obj is PerlinTexPreset {
       return 'name' in obj
            && 'layers' in obj
            && 'textures' in obj
            && 'objTex' in obj
            && 'objCutoff' in obj;
    }
}

export class Perlin {
    IXMAX: number;
    IYMAX: number;
    rng: any;
    Gradient: vec2[][];

    /**
     * Creates Perlin object with grid size (ixmax x iymax)
     * Coordinates in Perlin grid-space are in [0, ixmax - 1] and [0. iymax - 1]
     * @param {Number} ixmax 
     * @param {Number} iymax 
     */
    constructor(ixmax: number, iymax: number) {
        // size of Perlin grid
        this.IXMAX = ixmax;
        this.IYMAX = iymax;
        this.rng = seedrandom();
        this.Gradient = new Array<Array<vec2>>(); // Precomputed (or otherwise) gradient vectors at each grid node

        for (let y = 0; y < this.IYMAX; y++) {
            let row: vec2[] = new Array<vec2>();
            for (let x = 0; x < this.IXMAX; x++) {
                row.push(vec2.fromValues(0, 0));
            }
            this.Gradient.push(row);
        }
        this.computeGradient();
    }

    /**
     * Sets seed for Perlin noise generation and computes corresponding gradient
     * @param {String} seed 
     */
    setSeed(seed: string) {
        this.rng = seedrandom(seed);
        this.computeGradient();
    }

    /**
     * Populates Gradient with random 2-D vectors
     */
    computeGradient() {
        for (let y = 0; y < this.IYMAX; y++) {
            let row: vec2[] = this.Gradient[y]!;
            for (let x = 0; x < this.IXMAX; x++) {
                // transform to [-1, 1]
                row[x] = vec2.fromValues(2 * this.rng() - 1, 2 * this.rng() - 1);

                // Normalize the vector
                vec2.normalize(row[x]!, row[x]!);
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
    static lerp(a0: number, a1: number, w: number): number {
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
    static fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10); // 6t^5 - 15t^4 + 10t^3
    }

    /**
     * Computes the dot product of the distance and gradient vectors.
     * @param {vec2} coord
     * @param {vec2} cellCoord - Coordinates of a cell corner where coord lives in Perlin grid space
     * @return {Number}
     */
    dotGridGradient(coord: vec2, cellCoord: vec2): number {
        // Compute the distance vector
        let d = vec2.create();
        vec2.subtract(d, coord, cellCoord);

        // Compute the dot-product
        return vec2.dot(d, this.Gradient[cellCoord[1]]![cellCoord[0]]!);
    }

    /**
     * Compute Perlin noise at world 2-D coordinates v
     * Reference: https://en.wikipedia.org/wiki/Perlin_noise#Implementation
     * @param {vec2} vect
     * @param {Number} width - width of world grid
     * @param {Number} height - height of world grid
     * @return {Number} - in range [-1, 1]
     */
    getNoise(vect: vec2, width: number, height: number): number {

        // Transform world coordinates to Perlin grid coordinates
        let oldRatio = vec2.fromValues(width, height);
        let newRatio = vec2.fromValues(this.IXMAX - 1, this.IYMAX - 1);
        let v = vec2.clone(vect);
        vec2.multiply(v, v, newRatio);
        vec2.divide(v, v, oldRatio);

        // Determine grid cell coordinates
        let x0 = Math.floor(v[0]);
        if (x0 + 1 == this.IXMAX) // in case of point on right edge
            x0 -= 1;
        let x1 = x0 + 1;
        let y0 = Math.floor(v[1]);
        if (y0 + 1 == this.IYMAX) // in case of point on bottom edge
            y0 -= 1;
        let y1 = y0 + 1;

        console.assert(0 <= x0 && x0 < this.IXMAX, "x0 = " + x0);
        console.assert(0 <= x1 && x1 < this.IXMAX, "x1 = " + x1);

        console.assert(0 <= y0 && y0 < this.IYMAX, "y0 = " + y0);
        console.assert(0 <= y1 && y1 < this.IYMAX, "y1 = " + y1);

        // Determine interpolation weights
        let sx = Perlin.fade(v[0] - x0);
        console.assert(sx >= 0.0 && sx <= 1.0, {
            "message": "sx is not in [0, 1]",
            "sx": sx
        });
        let sy = Perlin.fade(v[1] - y0);
        console.assert(sy >= 0.0 && sy <= 1.0, {
            "message": "sy is not in [0, 1]",
            "sy": sy
        });

        // Interpolate between grid point gradients
        let n0, n1, ix0, ix1, value;
        n0 = this.dotGridGradient(v, vec2.fromValues(x0, y0));
        n1 = this.dotGridGradient(v, vec2.fromValues(x1, y0));
        ix0 = Perlin.lerp(n0, n1, sx);
        n0 = this.dotGridGradient(v, vec2.fromValues(x0, y1));
        n1 = this.dotGridGradient(v, vec2.fromValues(x1, y1));
        ix1 = Perlin.lerp(n0, n1, sx);
        value = Perlin.lerp(ix0, ix1, sy);

        console.assert(value >= -1.0 && value <= 1.0, "Value in incorrect range " + value);
        return value;
    }
}