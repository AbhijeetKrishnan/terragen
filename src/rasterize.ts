import { vec2, vec3, mat4, ReadonlyVec2 } from 'gl-matrix';
import { PerlinTex, PerlinTexPreset, Perlin } from './perlin';
import { TriMat, TriObj } from './triangle';
import { getNormal, transformRange } from './util';

/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
let defaultEye: vec3 = vec3.fromValues(-1.810965657234192, 36.399932861328125, 40.831521987915039); // default eye position in world space
let defaultCenter = vec3.fromValues(62.18913650512695, 36.399932861328125, -9.168441772460938); // default view direction in world space
let defaultUp = vec3.fromValues(0.30000001192092896, 0, 1); // default view up vector

let lightAmbient = vec3.fromValues(1, 1, 1); // default light ambient emission
let lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
let lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
let lightPosition = vec3.fromValues(-1.810965657234192, 36.399932861328125, 40.831521987915039); // default light position

/* input model data */
let gl: WebGLRenderingContext; // the all powerful gl object. It's all here folks!
let inputTriangles: TriObj[] = []; // the triangle data as loaded from input files
let numTriangleSets = 0; // how many triangle sets in input scene
let triSetSizes: number[] = []; // this contains the size of each triangle set

/* model data prepared for webgl */
let vertexBuffers: WebGLBuffer[] = []; // vertex coordinate lists by set, in triples
let normalBuffers: WebGLBuffer[] = []; // normal component lists by set, in triples
let uvBuffers: WebGLBuffer[] = []; // uv coord lists by set, in duples
let triangleBuffers: WebGLBuffer[] = []; // indices into vertexBuffers by set, in triples
let textures: { [key: string]: WebGLTexture } = {}; // texture imagery by set

let texturePresets: PerlinTexPreset[];

/* shader parameter locations */
let vPosAttribLoc: number; // where to put position for vertex shader
let vNormAttribLoc: number; // where to put normal for vertex shader
let vUVAttribLoc: number; // where to put UV for vertex shader
let mMatrixULoc: WebGLUniformLocation; // where to put model matrix for vertex shader
let pvmMatrixULoc: WebGLUniformLocation; // where to put project model view matrix for vertex shader
let ambientULoc: WebGLUniformLocation; // where to put ambient reflecivity for fragment shader
let diffuseULoc: WebGLUniformLocation; // where to put diffuse reflecivity for fragment shader
let specularULoc: WebGLUniformLocation; // where to put specular reflecivity for fragment shader
let shininessULoc: WebGLUniformLocation; // where to put specular exponent for fragment shader
let usingTextureULoc: WebGLUniformLocation; // where to put using texture boolean for fragment shader
let textureULoc: WebGLUniformLocation; // where to put texture for fragment shader

/* interaction variables */
let Eye = vec3.clone(defaultEye); // eye position in world space
let Center = vec3.clone(defaultCenter); // view direction in world space
let Up = vec3.clone(defaultUp); // view up vector in world space
let viewDelta = 0.1; // how much to displace view with each key press
// @ts-expect-error
let rotateTheta = Math.PI / 10; // how much to rotate models by with each key press

/* Terrain generation globals */
let TERRAIN_WIDTH = 16;
let TERRAIN_HEIGHT = 16;
let TERRAIN_MIN_DEPTH = 0;
let TERRAIN_MAX_ELEVATION = 16;

let PERLIN_WIDTH = 16;
let PERLIN_HEIGHT = 16;

// @ts-expect-error
let TEX_WIDTH = 256;
// @ts-expect-error
let TEX_HEIGHT = 256;
let TEX_PRESET = 0; // index of texture preset

let TRI_STEP_SIZE = 1;
let OBJ_STEP_SIZE = 0.8; // ought to be < 1

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url: string, descr: string) {
    let httpReq = new XMLHttpRequest(); // a new http request
    httpReq.open("GET",url,false); // init the request
    httpReq.send(null); // send the request
    let startTime = Date.now();
    while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now()-startTime) > 3000)
            break;
    } // until its loaded or we time out after three seconds
    if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
        throw "Unable to open " + descr + " file!";
    else
        return JSON.parse(httpReq.response);
}

/**
 * Function to handle keypresses
 * @param {KeyBoardEvent} event 
 */
function handleKeyDown(event: KeyboardEvent) {

    // set up needed view params
    let lookAt = vec3.create(),
        viewRight = vec3.create(),
        temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt, vec3.subtract(temp, Center, Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight, vec3.cross(temp, lookAt, Up)); // get view right vector

    switch (event.code) {

        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, -viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, -viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
                Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, -viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, -viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
                Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, -viewDelta)));
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, viewDelta)));
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, -viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
            } // end if shift not pressed
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye, defaultEye);
            Center = vec3.copy(Center, defaultCenter);
            Up = vec3.copy(Up, defaultUp);
            break;

    } // end switch
} // end handleKeyDown

/**
 * set up the webGL environment
 */
function setupWebGL() {

    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

    // create a webgl canvas and set it up
    let webGLCanvas = <HTMLCanvasElement>document.getElementById("display"); // create a webgl canvas
    let tryGL = webGLCanvas.getContext("webgl"); // get a webgl object from it
    try {
        if (tryGL == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl = tryGL;
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try
    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

/**
 * read models in, load them into webgl buffers
 */
function loadModels() {

    function loadTexPresets(): boolean {
        let INPUT_URL = "https://raw.githubusercontent.com/AbhijeetKrishnan/terragen/master/presets.json";
        texturePresets = getJSONFile(INPUT_URL, "presets");

        // validate
        try {
            for (let pre = 0; pre < texturePresets.length; pre++) {
                let currTex = texturePresets[pre]!;
                if (currTex.layers != currTex.textures.length) {
                    throw "Number of layers do not match defined textures for preset" + texturePresets[pre]!.name;
                }
                let prevShare = currTex.textures[0]!.share!;
                for (let tex = 1; tex < currTex.layers; tex++) {
                    let currShare = currTex.textures[tex]!.share!;
                    if (prevShare > currShare) {
                        throw "Texture shares for preset " + currTex.name + " not in non-decreasing order";
                    }
                    prevShare = currShare;
                }
                if (prevShare != 1.0) {
                    throw "Share of textures for preset " + currTex.name + " does not end at 1.0";
                }
            }
        } catch (e) {
            console.log(e);
        }

        return true;
    }

    /**
     * generates a texture by interpolating between baseColour and highlightColour based on noise value
     * @param {Number} perlinWidth width of Perlin grid size
     * @param {Number} perlinHeight height of Perlin grid size
     * @param {Object} texDesc description of texture to be generated
     * @return {HTMLCanvasElement} 
     */
    function generateTexture(perlinWidth: number, perlinHeight: number, texDesc: PerlinTex): HTMLCanvasElement {
        let canvas = document.createElement('canvas'); // Ref: https://stackoverflow.com/questions/3892010/create-2d-context-without-canvas
        canvas.width = texDesc.width;
        canvas.height = texDesc.height;
        let ctx = canvas.getContext('2d')!;
        let w = canvas.width;
        let h = canvas.height;
        let baseColour = vec3.fromValues(texDesc.base[0], texDesc.base[1], texDesc.base[2]);
        let highlightColour = vec3.fromValues(texDesc.highlight[0], texDesc.highlight[1], texDesc.highlight[2]);
        let perlin = new Perlin(perlinWidth, perlinHeight); // could possible vary this as a ratio of world size
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                let noise = perlin.getNoise(vec2.fromValues(j + 0.5, i + 0.5), w, h) / 2 + 0.5; // experiment without 0.5
                let rgb = vec3.create();
                vec3.lerp(rgb, baseColour, highlightColour, noise);
                ctx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
                ctx.fillRect(j, i, 1, 1);
            }
        }
        return canvas;
    }

    /**
     * load a texture
     * @param {string} textureName 
     */
    function loadTexture(textureName: string) {
        if (textureName && !(textureName in textures)) {
            textures[textureName] = gl.createTexture()!; // new texture struct for model
            let currTexture = textures[textureName]!; // shorthand
            gl.bindTexture(gl.TEXTURE_2D, currTexture); // activate model's texture
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v,
            let texDesc: PerlinTex;
            if (texturePresets[TEX_PRESET]!.objTex.name == textureName) {
                texDesc = texturePresets[TEX_PRESET]!.objTex;
            } else {
                for (let tex = 0; tex < texturePresets[TEX_PRESET]!.textures.length; tex++) {
                    if (texturePresets[TEX_PRESET]!.textures[tex]!.name == textureName) {
                        texDesc = texturePresets[TEX_PRESET]!.textures[tex]!;
                        break;
                    }
                }
            }
            let tex = generateTexture(PERLIN_WIDTH, PERLIN_HEIGHT, texDesc!);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // use linear filter for magnification
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); // use mipmap for minification
            gl.generateMipmap(gl.TEXTURE_2D); // letruct mipmap pyramid
            gl.bindTexture(gl.TEXTURE_2D, null); // deactivate model's texture
        }
    } // end load texture

    /**
     * Generate triangles for terrain of size w x h
     * @param {Number} w 
     * @param {Number} h
     * @param {Number} preset - index of texture preset to use
     * @return {Array} - list of triangles
     */
    function generateTerrain(w: number, h: number, preset: number): TriObj[] {
        if (!loadTexPresets()) {
            console.log("Presets file not found or invalid");
        }

        let terrainTris = [];

        let noise = new Perlin(PERLIN_WIDTH, PERLIN_HEIGHT);
        let objNoise = new Perlin(PERLIN_WIDTH, PERLIN_HEIGHT);

        function generateTri(p1: vec2, p2: vec2, p3: vec2, preset: number): TriObj {
            function getHeightFactor(p: ReadonlyVec2) {
                let retVal = (p[0] + p[1]) / (TERRAIN_WIDTH + TERRAIN_HEIGHT);
                retVal = retVal * retVal;
                return retVal;
            }
            let v1 = vec3.fromValues(p1[0], p1[1], transformRange(noise.getNoise(p1, w, h), TERRAIN_MIN_DEPTH, TERRAIN_MAX_ELEVATION) * getHeightFactor(p1));
            let v2 = vec3.fromValues(p2[0], p2[1], transformRange(noise.getNoise(p2, w, h), TERRAIN_MIN_DEPTH, TERRAIN_MAX_ELEVATION) * getHeightFactor(p2));
            let v3 = vec3.fromValues(p3[0], p3[1], transformRange(noise.getNoise(p3, w, h), TERRAIN_MIN_DEPTH, TERRAIN_MAX_ELEVATION) * getHeightFactor(p3));
            let n = getNormal(v1, v2, v3);

            let currTriMat = new TriMat();
            let tri = new TriObj(currTriMat);

            let ht = (v1[2] + v2[2] + v3[2]) / 3;
            for (let tex = 0; tex < texturePresets[preset]!.layers; tex++) {
                let lim = TERRAIN_MIN_DEPTH + texturePresets[preset]!.textures[tex]!.share! * (TERRAIN_MAX_ELEVATION - TERRAIN_MIN_DEPTH);
                if (ht < lim) {
                    tri.material.texture = texturePresets[preset]!.textures[tex]!.name;
                    break;
                }
            }

            tri.vertices = [
                v1,
                v2,
                v3
            ];
            tri.normals = [
                n,
                n,
                n
            ];
            return tri;
        }

        for (let i = 0; i < h; i += TRI_STEP_SIZE) {
            for (let j = 0; j < w; j+= TRI_STEP_SIZE) {
                // generating four corner vectors
                let tl = vec2.fromValues(j, i);
                let tr = vec2.fromValues(j, i + TRI_STEP_SIZE);
                let bl = vec2.fromValues(j + TRI_STEP_SIZE, i);
                let br = vec2.fromValues(j + TRI_STEP_SIZE, i + TRI_STEP_SIZE);

                // generating top-left triangle
                let tlTri = generateTri(tl, bl, tr, preset);
                terrainTris.push(tlTri);

                // generating bottom-right triangle
                let brTri = generateTri(br, tr, bl, preset);
                terrainTris.push(brTri);

                // generating objects
                for (let k = i; k < i + TRI_STEP_SIZE; k += OBJ_STEP_SIZE) {
                    for (let l = j; l < j + TRI_STEP_SIZE; l += OBJ_STEP_SIZE) {
                        let objProbability = transformRange(objNoise.getNoise(vec2.fromValues(l, k), w, h), 0, 1);
                        let draw = Math.random();
                        if (draw < objProbability) {
                            // place object at (k, l, h);
                            let x = l;
                            let y = k;
                            x += transformRange(Math.random(), TRI_STEP_SIZE / 10, TRI_STEP_SIZE, 0, 1);
                            y += transformRange(Math.random(), TRI_STEP_SIZE / 10, TRI_STEP_SIZE, 0, 1);
                            let v: vec3, n: vec3, h: number;
                            if (x + y - (i + j) <= 1.0) {
                                v = tlTri.vertices[0]!;
                                n = tlTri.normals[0]!;
                            }
                            else {
                                v = brTri.vertices[0]!;
                                n = brTri.normals[0]!;
                            }
                            h = v[2] - ((x - v[0]) * n[0] + (y - v[1]) * n[1]) / n[2];
                            if (h < TERRAIN_MIN_DEPTH + texturePresets[preset]!.objCutoff * (TERRAIN_MAX_ELEVATION - TERRAIN_MIN_DEPTH))
                                terrainTris.push(TriObj.generateObject(x, y, h, texturePresets[preset]!));
                        }
                    }
                }
            }
        }
        return terrainTris;
    }

    inputTriangles = generateTerrain(TERRAIN_WIDTH, TERRAIN_HEIGHT, TEX_PRESET); // read in the triangle data

    let currSet: TriObj; // the current triangle set
    let whichSetVert: number; // index of vertex in current triangle set
    let whichSetTri: number; // index of triangle in current triangle set
    let vtxToAdd: vec3; // vtx coords to add to the vertices array
    let normToAdd: vec3; // vtx normal to add to the normal array
    let uvToAdd: vec2; // uv coords to add to the uv arry
    let triToAdd; // tri indices to add to the index array
    let maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
    let minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

    // process each triangle set to load webgl vertex and triangle buffers
    numTriangleSets = inputTriangles.length; // remember how many tri sets
    for (let whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set
        currSet = inputTriangles[whichSet]!;

        let numVerts = currSet.vertices.length; // num vertices in tri set
        for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
            vtxToAdd = currSet.vertices[whichSetVert]!; // get vertex to add
            normToAdd = currSet.normals[whichSetVert]!; // get normal to add
            uvToAdd = currSet.uvs[whichSetVert]!; // get uv to add
            currSet.glVertices.push(...vtxToAdd); // put coords in set vertex list
            currSet.glNormals.push(...normToAdd); // put normal in set normal list
            currSet.glUvs.push(...uvToAdd); // put uv in set uv list
            vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
            vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
            vec3.add(currSet.center, currSet.center, vtxToAdd); // add to ctr sum
        } // end for vertices in set
        vec3.scale(currSet.center, currSet.center, 1 / numVerts); // avg ctr sum

        // send the vertex coords, normals and uvs to webGL; load texture
        vertexBuffers[whichSet] = gl.createBuffer()!; // init empty webgl set vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]!); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currSet.glVertices), gl.STATIC_DRAW); // data in
        normalBuffers[whichSet] = gl.createBuffer()!; // init empty webgl set normal component buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]!); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currSet.glNormals), gl.STATIC_DRAW); // data in
        uvBuffers[whichSet] = gl.createBuffer()!; // init empty webgl set uv coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[whichSet]!); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currSet.glUvs), gl.STATIC_DRAW); // data in
        loadTexture(currSet.material.texture); // load tri set's texture

        // set up the triangle index array, adjusting indices across sets
        triSetSizes[whichSet] = currSet.triangles.length; // number of tris in this set
        for (whichSetTri = 0; whichSetTri < triSetSizes[whichSet]!; whichSetTri++) {
            triToAdd = currSet.triangles[whichSetTri]; // get tri to add
            currSet.glTriangles.push(...triToAdd!); // put indices in set list
        } // end for triangles in set

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()!); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]!); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(currSet.glTriangles), gl.STATIC_DRAW); // data in

    } // end for each triangle set  
} // end load models

/**
 * setup the webGL shaders
 */
function setupShaders() {

    // define vertex shader in essl using es6 template strings
    let vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aVertexUV; // vertex texture uv
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 vVertexUV; // interpolated uv for frag shader

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
            
            // vertex uv
            vVertexUV = aVertexUV;
        }
    `;

    // define fragment shader in essl using es6 template strings
    let fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        
        // texture properties
        uniform bool uUsingTexture; // if we are using a texture
        uniform sampler2D uTexture; // the texture for the fragment
        varying vec2 vVertexUV; // texture uv of fragment
            
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
        
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to find lit color
            vec3 litColor = ambient + diffuse + specular; 
            
            if (!uUsingTexture) {
                gl_FragColor = vec4(litColor, 1.0);
            } else {
                vec4 texColor = texture2D(uTexture, vec2(vVertexUV.s, vVertexUV.t));
            
                // gl_FragColor = vec4(texColor.rgb * litColor, texColor.a);
                gl_FragColor = vec4(texColor.rgb * litColor, 1.0);
            } // end if using texture
        } // end main
    `;

    try {
        let fShader = gl.createShader(gl.FRAGMENT_SHADER)!; // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        let vShader = gl.createShader(gl.VERTEX_SHADER)!; // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            gl.deleteShader(fShader);
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            gl.deleteShader(vShader);
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
        } else { // no compile errors
            let shaderProgram = gl.createProgram()!; // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                vUVAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexUV"); // ptr to vertex UV attrib
                gl.enableVertexAttribArray(vUVAttribLoc); // connect attrib to array

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix")!; // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix")!; // ptr to pvmmat

                // locate fragment uniforms
                let eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                let lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                let lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                let lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                let lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient")!; // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse")!; // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular")!; // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess")!; // ptr to shininess
                usingTextureULoc = gl.getUniformLocation(shaderProgram, "uUsingTexture")!; // ptr to using texture
                textureULoc = gl.getUniformLocation(shaderProgram, "uTexture")!; // ptr to texture

                // pass global (not per model) constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

/**
 * Setup view parameters
 */
// @ts-expect-error
function setupView() {
    let eye_x = TERRAIN_WIDTH / 2;
    let eye_y = 0;
    let eye_z = 1.5 * TERRAIN_MAX_ELEVATION - 0.5 * TERRAIN_MIN_DEPTH;
    Eye = vec3.fromValues(eye_x, eye_y, eye_z);
    Center = vec3.fromValues(eye_x, TERRAIN_HEIGHT, 0);
    vec3.sub(Up, Center, Eye);
    vec3.cross(Up, Up, vec3.fromValues(-1, 0, 0)); // not sure why -1
    viewDelta = (TERRAIN_MAX_ELEVATION - TERRAIN_MIN_DEPTH) / 100;
    rotateTheta = Math.PI / 10;

    lightPosition = vec3.fromValues(TERRAIN_WIDTH / 2, 0, 30);
}

/**
 * render the loaded model
 */
function renderModels() {

    let hMatrix = mat4.create(); // handedness matrix
    let pMatrix = mat4.create(); // projection matrix
    let vMatrix = mat4.create(); // view matrix
    let mMatrix = mat4.create(); // model matrix
    let hpvMatrix = mat4.create(); // hand * proj * view matrices
    let hpvmMatrix = mat4.create(); // hand * proj * view * model matrices

    window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear( /*gl.COLOR_BUFFER_BIT |*/ gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // set up handedness, projection and view
    mat4.fromScaling(hMatrix, vec3.fromValues(-1, 1, 1)); // create handedness matrix
    mat4.perspective(pMatrix, 0.5 * Math.PI, 1, 0.1, 100); // create projection matrix
    mat4.lookAt(vMatrix, Eye, Center, Up); // create view matrix
    mat4.multiply(hpvMatrix, hMatrix, pMatrix); // handedness * projection
    mat4.multiply(hpvMatrix, hpvMatrix, vMatrix); // handedness * projection * view

    // render each triangle set
    let currSet, setMaterial; // the tri set and its material properties
    for (let whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet]!;

        mat4.multiply(hpvmMatrix, hpvMatrix, mMatrix); // handedness * project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in the hpvm matrix

        setMaterial = currSet.material; // normal material
        gl.uniform3fv(ambientULoc, setMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc, setMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc, setMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc, setMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc, Number(currSet.material.texture != '')); // whether the set uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, textures[currSet.material.texture]!); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0

        // position, normal and uv buffers: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichTriSet]!); // activate position
        gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichTriSet]!); // activate normal
        gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[whichTriSet]!); // activate uv
        gl.vertexAttribPointer(vUVAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]!); // activate
        gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet]!, gl.UNSIGNED_SHORT, 0); // render

    } // end for each triangle set
} // end render model

function setParameters() {
    // Ref: https://stackoverflow.com/questions/3547035/javascript-getting-html-form-values
    TERRAIN_WIDTH = Number((<HTMLInputElement>document.getElementById("terrain-width")).value);
    TERRAIN_HEIGHT = Number((<HTMLInputElement>document.getElementById("terrain-height")).value);
    TERRAIN_MIN_DEPTH = Number((<HTMLInputElement>document.getElementById("terrain-depth")).value);
    TERRAIN_MAX_ELEVATION = Number((<HTMLInputElement>document.getElementById("terrain-elevation")).value);

    PERLIN_WIDTH = Number((<HTMLInputElement>document.getElementById("perlin-width")).value);
    PERLIN_HEIGHT = Number((<HTMLInputElement>document.getElementById("perlin-height")).value);

    TEX_WIDTH = Number((<HTMLInputElement>document.getElementById("tex-width")).value);
    TEX_HEIGHT = Number((<HTMLInputElement>document.getElementById("tex-height")).value);
    TEX_PRESET = Number((<HTMLInputElement>document.getElementById("tex-preset")).value);

    TRI_STEP_SIZE = Number((<HTMLInputElement>document.getElementById("tri-step-size")).value);
    OBJ_STEP_SIZE = Number((<HTMLInputElement>document.getElementById("obj-step-size")).value);
}

export function renderClick() {
    // reset model variables
    inputTriangles = []; 
    numTriangleSets = 0; 
    triSetSizes = [];
    vertexBuffers = []; 
    normalBuffers = []; 
    uvBuffers = []; 
    triangleBuffers = [];
    textures = {};

    setParameters();
    loadModels();
    renderModels();
}

/* MAIN -- HERE is where execution begins after window load */

export function main() {
    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    // setupView(); // setup camera // TODO: can't figure out reason for this bug
    renderModels(); // draw the triangles using webGL
} // end main