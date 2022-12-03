import { vec3, ReadonlyVec3 } from "gl-matrix";

/**
 * 
 * @param v1 
 * @param v2 
 * @param v3 
 * @returns 
 */
export function getNormal(v1: ReadonlyVec3, v2: ReadonlyVec3, v3: ReadonlyVec3): vec3 {
    let v2_v1 = vec3.create();
    vec3.subtract(v2_v1, v2, v1);
    let v3_v1 = vec3.create();
    vec3.subtract(v3_v1, v3, v1);
    let n = vec3.create();
    vec3.cross(n, v2_v1, v3_v1);
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
 export function transformRange(origVal: number, newMin: number, newMax: number, oldMin: number = -1, oldMax: number = 1): number {
    return (origVal - oldMin) * (newMax - newMin) / (oldMax - oldMin) + newMin;
}
