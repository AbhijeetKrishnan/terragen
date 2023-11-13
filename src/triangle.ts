/**
 * Class to represent a triangle object and material
 */

import { vec3 } from "gl-matrix";
import { getNormal } from "./util";
import { PerlinTex } from "./perlin";

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
    material: PerlinTex;
    vertices: [number, number, number][];
    normals: [number, number, number][];
    uvs: [number, number][];
    triangles: [number, number, number][];

    center: vec3;
    on: boolean;
    translation: vec3;
    xAxis: vec3;
    yAxis: vec3;

    glVertices: number[];
    glNormals: number[];
    glUvs: number[];
    glTriangles: number[];

    constructor(
        vertices: vec3[],
        normals: vec3[],
        uvs: [number, number][],
        triangles: [number, number, number][],
        triMat: PerlinTex
    ) {
        this.material = triMat;
        this.vertices = vertices.map((v) => [v[0], v[1], v[2]]);
        this.normals = normals.map((n) => [n[0], n[1], n[2]]);
        this.uvs = uvs;
        this.triangles = triangles;

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

    static getSingleTri(v1: vec3, v2: vec3, v3: vec3, tex: PerlinTex): TriObj {
        let vertices = [v1, v2, v3]; // assume vertices in anticlockwise order
        let n = getNormal(v1, v2, v3);
        let normals = [n, n, n];
        let uvs: [number, number][] = [
            // TODO: how is this obtained?
            [0, 0],
            [1, 0],
            [0.5, 1],
        ];
        let triangles: [number, number, number][] = [[0, 1, 2]];
        return new TriObj(vertices, normals, uvs, triangles, tex);
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
        tex: PerlinTex
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

        let uvs: [number, number][] = [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
        ];
        let triangles: [number, number, number][] = [
            [0, 4, 1],
            [1, 4, 2],
            [2, 4, 3],
            [3, 4, 0],
        ];
        let vertices = [v1, v2, v3, v4, v5];
        let normals = [n1, n2, n3, n4, vec3.fromValues(0, 0, -1)];
        return new TriObj(vertices, normals, uvs, triangles, tex);
    }
}
