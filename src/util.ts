import { vec3, ReadonlyVec3 } from "gl-matrix";

/**
 *
 * @param v1
 * @param v2
 * @param v3
 * @returns
 */
export function getNormal( // assume vertices in anticlockwise order
    v1: ReadonlyVec3,
    v2: ReadonlyVec3,
    v3: ReadonlyVec3
): vec3 {
    let v2_v1 = vec3.create();
    vec3.subtract(v2_v1, v2, v1);
    let v3_v1 = vec3.create();
    vec3.subtract(v3_v1, v3, v1);
    let n = vec3.create();
    vec3.cross(n, v2_v1, v3_v1);
    // vec3.negate(n, n);
    vec3.normalize(n, n);
    return n;
}

/**
 * Transform value in range [oldMax, oldMin] to range [newMax, newMin]
 * @param {Number} origVal
 * @param {Number} newMin
 * @param {Number} newMax
 * @param {Number} oldMin
 * @param {Number} oldMax
 * @return {Number}
 */
export function transformRange(
    origVal: number,
    newMin: number,
    newMax: number,
    oldMin: number = -1,
    oldMax: number = 1
): number {
    return (
        ((origVal - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin
    );
}

/**
 * Terrain generation config
 */
export class Config {
    terrain_width: number = 16;
    terrain_height: number = 16;
    terrain_min_depth: number = 0;
    terrain_max_elevation: number = 16;
    perlin_width: number = 16;
    perlin_height: number = 16;
    tex_width: number = 16;
    tex_height: number = 16;
    tex_preset: number = 0; // index of texture preset
    tri_step_size: number = 1;
    obj_step_size: number = 0.8; // ought to be < 1
}
