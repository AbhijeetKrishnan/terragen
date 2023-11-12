/**
 * Class to represent a triangle object and material
 */

import { vec2, vec3 } from "gl-matrix";
import { PerlinTexPreset } from "./perlin";
import { getNormal } from "./util";

export class TriMat {
    ambient: number[];
    diffuse: number[];
    specular: number[];
    n: number;
    alpha: number;
    texture: string;

    constructor() {
        this.ambient = [0.1, 0.1, 0.1];
        this.diffuse = [0.8, 0.8, 0.8];
        this.specular = [0.3, 0.3, 0.3];
        this.n = 15;
        this.alpha = 0.5;
        this.texture = "";
    }
}

export class TriObj {
    material: TriMat;
    vertices: vec3[];
    normals: vec3[];
    uvs: vec2[];
    triangles: number[][];

    center: vec3;
    on: boolean;
    translation: vec3;
    xAxis: vec3;
    yAxis: vec3;

    glVertices: number[];
    glNormals: number[];
    glUvs: number[];
    glTriangles: number[];

    constructor(triMat: TriMat) {
        this.material = triMat;
        this.vertices = [];
        this.normals = [];
        this.uvs = [
            [0, 0],
            [0.5, 1],
            [1, 0],
        ];
        this.triangles = [[0, 1, 2]];

        // set up hilighting, modeling translation and rotation
        this.center = vec3.fromValues(0, 0, 0); // center point of tri set
        this.on = false; // not highlighted
        this.translation = vec3.fromValues(0, 0, 0); // no translation
        this.xAxis = vec3.fromValues(1, 0, 0); // model X axis
        this.yAxis = vec3.fromValues(0, 1, 0); // model Y axis

        // set up the vertex, normal and uv arrays, define model center and axes
        this.glVertices = []; // flat coord list for webgl
        this.glNormals = []; // flat normal list for webgl
        this.glUvs = []; // flat texture coord list for webgl
        this.glTriangles = []; // flat index list for webgl
    }

    /**
     * Generate a tree object for placement on the terrain
     * @param x
     * @param y
     * @param z
     * @param preset
     * @returns
     */
    static generateObject(
        x: number,
        y: number,
        z: number,
        tex: PerlinTexPreset
    ): TriObj {
        /* define model */
        let v1 = vec3.fromValues(x - 0.1, y - 0.1, z);
        let v2 = vec3.fromValues(x - 0.1, y + 0.1, z);
        let v3 = vec3.fromValues(x + 0.1, y + 0.1, z);
        let v4 = vec3.fromValues(x + 0.1, y - 0.1, z);
        let v5 = vec3.fromValues(x, y, z + 1);

        let n1 = getNormal(v1, v5, v2);
        let n2 = getNormal(v2, v5, v3);
        let n3 = getNormal(v3, v5, v4);
        let n4 = getNormal(v4, v5, v1);

        let currTriMat = new TriMat();
        let tri = new TriObj(currTriMat);
        tri.material.texture = tex.objTex.name;
        tri.uvs = [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
        ];
        tri.triangles = [
            [0, 4, 1],
            [1, 4, 2],
            [2, 4, 3],
            [3, 4, 0],
        ];
        tri.vertices = [
            [v1[0], v1[1], v1[2]],
            [v2[0], v2[1], v2[2]],
            [v3[0], v3[1], v3[2]],
            [v4[0], v4[1], v4[2]],
            [v5[0], v5[1], v5[2]],
        ];
        tri.normals = [
            [n1[0], n1[1], n1[2]],
            [n2[0], n2[1], n2[2]],
            [n3[0], n3[1], n3[2]],
            [n4[0], n4[1], n4[2]],
            [0, 0, 1], // no idea why lol
        ];
        return tri;
    }
}
