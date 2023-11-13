import { vec2, vec3, ReadonlyVec2 } from "gl-matrix";
import { PerlinTex, PerlinTexPreset, Perlin } from "./perlin";
import { Config, transformRange } from "./util";
import { TriObj } from "./triangle";
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

export function getTexturePreset(texPreset: number): PerlinTexPreset {
    return texturePresets[texPreset]!;
}

export function getTextureFromPresets(
    texPreset: number,
    texName: string
): PerlinTex | null {
    for (const tex of texturePresets[texPreset]!.textures) {
        if (tex.name == texName) {
            return tex;
        }
    }
    return null;
}

function getTexByHeight(
    texPreset: PerlinTexPreset,
    height: number,
    minDepth: number,
    maxElevation: number
): PerlinTex {
    for (let tex = 0; tex < texPreset.layers; tex++) {
        let lim =
            minDepth +
            texPreset.textures[tex]!.share! * (maxElevation - minDepth);
        if (height < lim) {
            return texPreset.textures[tex]!;
        }
    }
    // no matching preset found, using last layer
    return texPreset.textures[-1]!;
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
            let offset = 4 * (i * w + j);
            let noise = perlin.getNoise(vec2.fromValues(j, i), w, h);
            let rgb = vec3.create();
            vec3.lerp(
                rgb,
                baseColour,
                highlightColour,
                transformRange(noise, 0, 1, -1, 1)
            );
            tex[offset] = rgb[0];
            tex[offset + 1] = rgb[1];
            tex[offset + 2] = rgb[2];
        }
    }
    return tex;
}

function getHeightFactor(
    p: ReadonlyVec2,
    terrainWidth: number,
    terrainHeight: number
) {
    let retVal = (p[0] + p[1]) / (terrainWidth + terrainHeight);
    return Math.pow(retVal, 2);
}

function generateGridTri(
    points: [vec2, vec2, vec2],
    heights: number[],
    tex: PerlinTex
): TriObj {
    let v = points.map((p, index) =>
        vec3.fromValues(p[0], p[1], heights[index]!)
    ) as [vec3, vec3, vec3];
    let tri = TriObj.getSingleTri(v[0], v[1], v[2], tex);
    return tri;
}

/**
 * Generate triangles for terrain of size w x h
 * @param {Number} w
 * @param {Number} h
 * @param {Number} preset - index of texture preset to use
 * @return {Array} - list of triangles
 */
export function generateTerrain( // TODO: optimize model storage to unify vertices, normals, uvs and triangles arrays
    w: number,
    h: number,
    preset: PerlinTexPreset,
    config: Config
): TriObj[] {
    let terrainTris = [];

    let noise = new Perlin(config.perlin_width, config.perlin_height);
    // let objNoise = new Perlin(config.perlin_width, config.perlin_height);

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

            function createTriObj(points: [vec2, vec2, vec2]): TriObj {
                let noises: number[] = points.map((p) =>
                    transformRange(
                        noise.getNoise(p, w, h),
                        config.terrain_min_depth,
                        config.terrain_max_elevation
                    )
                );
                let heightFactors = points.map((p) =>
                    getHeightFactor(
                        p,
                        config.terrain_width,
                        config.terrain_height
                    )
                );
                let heights = heightFactors.map(
                    (h, index) => h * noises[index]!
                );
                let avgH =
                    heights.reduce((sum, value) => sum + value, 0) /
                    heights.length;
                let tex = getTexByHeight(
                    preset,
                    avgH,
                    config.terrain_min_depth,
                    config.terrain_max_elevation
                );
                return generateGridTri(points, heights, tex);
            }

            // generating top-left triangle
            {
                let points: [vec2, vec2, vec2] = [tl, bl, tr]; // anticlockwise order
                let tlTri = createTriObj(points);
                terrainTris.push(tlTri);
            }

            // generating bottom-right triangle
            {
                let points: [vec2, vec2, vec2] = [tr, bl, br];
                let brTri = createTriObj(points);
                terrainTris.push(brTri);
            }

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
