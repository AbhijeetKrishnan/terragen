import { vec2, vec3, ReadonlyVec2 } from "gl-matrix";
import { PerlinTex, PerlinTexPreset, Perlin } from "./perlin";
import { Config, transformRange, getNormal } from "./util";
import { TriMat, TriObj } from "./triangle";
import presetsFile from "./static/presets.json";

let texturePresets: PerlinTexPreset[] = loadTexPresets();

function loadTexPresets(): PerlinTexPreset[] {
    texturePresets = presetsFile as PerlinTexPreset[];

    for (let pre = 0; pre < texturePresets.length; pre++) {
        let currTex = texturePresets[pre]!;
        if (currTex.layers != currTex.textures.length) {
            throw (
                "Number of layers do not match defined textures for preset" +
                texturePresets[pre]!.name
            );
        }
        let prevShare = currTex.textures[0]!.share!;
        for (let tex = 1; tex < currTex.layers; tex++) {
            let currShare = currTex.textures[tex]!.share!;
            if (prevShare > currShare) {
                throw (
                    "Texture shares for preset " +
                    currTex.name +
                    " not in non-decreasing order"
                );
            }
            prevShare = currShare;
        }
        if (prevShare != 1.0) {
            throw (
                "Share of textures for preset " +
                currTex.name +
                " does not end at 1.0"
            );
        }
    }
    return texturePresets;
}

export function getTexturePreset(
    texPreset: number,
    texName: string
): PerlinTex {
    let texDesc: PerlinTex;
    if (texturePresets[texPreset]!.objTex.name == texName) {
        texDesc = texturePresets[texPreset]!.objTex;
    } else {
        for (
            let tex = 0;
            tex < texturePresets[texPreset]!.textures.length;
            tex++
        ) {
            if (texturePresets[texPreset]!.textures[tex]!.name == texName) {
                texDesc = texturePresets[texPreset]!.textures[tex]!;
                break;
            }
        }
    }
    return texDesc!;
}

/**
 * Generates a texture by interpolating between baseColour and highlightColour based on noise value
 * @param {Number} perlinWidth width of Perlin grid size
 * @param {Number} perlinHeight height of Perlin grid size
 * @param {Object} texDesc description of texture to be generated
 * @return {HTMLCanvasElement}
 */
export function generateTexture(
    perlinWidth: number,
    perlinHeight: number,
    texWidth: number,
    texHeight: number,
    texDesc: PerlinTex
): Uint8Array {
    let baseColour = vec3.clone(texDesc.base);
    let highlightColour = vec3.clone(texDesc.highlight);
    let w = texWidth;
    let h = texHeight;
    let tex = new Uint8Array(w * h * 4);

    let perlin = new Perlin(perlinWidth, perlinHeight); // TODO: could possible vary this as a ratio of world size
    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            let offset = w * h * i + 4 * j;
            let noise =
                perlin.getNoise(vec2.fromValues(j + 0.5, i + 0.5), w, h) / 2;
            let rgb = vec3.create();
            vec3.lerp(rgb, baseColour, highlightColour, noise);
            tex[offset] = rgb[0];
            tex[offset + 1] = rgb[1];
            tex[offset + 2] = rgb[2];
        }
    }
    return tex;
}

/**
 * Generate triangles for terrain of size w x h
 * @param {Number} w
 * @param {Number} h
 * @param {Number} preset - index of texture preset to use
 * @return {Array} - list of triangles
 */
export function generateTerrain(
    w: number,
    h: number,
    preset: number,
    config: Config
): TriObj[] {
    let terrainTris = [];

    let noise = new Perlin(config.perlin_width, config.perlin_height);
    // let objNoise = new Perlin(config.perlin_width, config.perlin_height);

    function generateTri(p1: vec2, p2: vec2, p3: vec2, preset: number): TriObj {
        function getHeightFactor(p: ReadonlyVec2) {
            let retVal =
                (p[0] + p[1]) / (config.terrain_width + config.terrain_height);
            retVal = retVal * retVal;
            return retVal;
        }
        let v1 = vec3.fromValues(
            p1[0],
            p1[1],
            transformRange(
                noise.getNoise(p1, w, h),
                config.terrain_min_depth,
                config.terrain_max_elevation
            ) * getHeightFactor(p1)
        );
        let v2 = vec3.fromValues(
            p2[0],
            p2[1],
            transformRange(
                noise.getNoise(p2, w, h),
                config.terrain_min_depth,
                config.terrain_max_elevation
            ) * getHeightFactor(p2)
        );
        let v3 = vec3.fromValues(
            p3[0],
            p3[1],
            transformRange(
                noise.getNoise(p3, w, h),
                config.terrain_min_depth,
                config.terrain_max_elevation
            ) * getHeightFactor(p3)
        );
        let n = getNormal(v1, v2, v3);

        let currTriMat = new TriMat();
        let tri = new TriObj(currTriMat);

        let ht = (v1[2] + v2[2] + v3[2]) / 3;
        for (let tex = 0; tex < texturePresets[preset]!.layers; tex++) {
            let lim =
                config.terrain_min_depth +
                texturePresets[preset]!.textures[tex]!.share! *
                    (config.terrain_max_elevation - config.terrain_min_depth);
            if (ht < lim) {
                tri.material.texture =
                    texturePresets[preset]!.textures[tex]!.name;
                break;
            }
        }

        tri.vertices = [v1, v2, v3];
        tri.normals = [n, n, n];
        return tri;
    }

    for (let i = 0; i < h; i += config.tri_step_size) {
        for (let j = 0; j < w; j += config.tri_step_size) {
            // generating four corner vectors
            let tl = vec2.fromValues(j, i);
            let tr = vec2.fromValues(j, i + config.tri_step_size);
            let bl = vec2.fromValues(j + config.tri_step_size, i);
            let br = vec2.fromValues(
                j + config.tri_step_size,
                i + config.tri_step_size
            );

            // generating top-left triangle
            let tlTri = generateTri(tr, tl, bl, preset);
            terrainTris.push(tlTri);

            // generating bottom-right triangle
            let brTri = generateTri(bl, br, tr, preset);
            terrainTris.push(brTri);

            // generating objects
            // for (let k = i; k < i + config.tri_step_size; k += OBJ_STEP_SIZE) {
            //     for (let l = j; l < j + config.tri_step_size; l += OBJ_STEP_SIZE) {
            //         let objProbability = transformRange(objNoise.getNoise(vec2.fromValues(l, k), w, h), 0, 1);
            //         let draw = Math.random();
            //         if (draw < objProbability) {
            //             // place object at (k, l, h);
            //             let x = l;
            //             let y = k;
            //             x += transformRange(Math.random(), config.tri_step_size / 10, config.tri_step_size, 0, 1);
            //             y += transformRange(Math.random(), config.tri_step_size / 10, config.tri_step_size, 0, 1);
            //             let v: vec3, n: vec3, h: number;
            //             if (x + y - (i + j) <= 1.0) {
            //                 v = tlTri.vertices[0]!;
            //                 n = tlTri.normals[0]!;
            //             }
            //             else {
            //                 v = brTri.vertices[0]!;
            //                 n = brTri.normals[0]!;
            //             }
            //             h = v[2] - ((x - v[0]) * n[0] + (y - v[1]) * n[1]) / n[2];
            //             if (h < TERRAIN_MIN_DEPTH + texturePresets[preset]!.objCutoff * (TERRAIN_MAX_ELEVATION - TERRAIN_MIN_DEPTH))
            //                 terrainTris.push(TriObj.generateObject(x, y, h, texturePresets[preset]!));
            //         }
            //     }
            // }
        }
    }
    return terrainTris;
}
