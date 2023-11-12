import { vec2, vec3, mat4 } from "gl-matrix";
import { TriObj } from "./triangle";
import { Config } from "./util";
import { generateTexture, getTexturePreset, generateTerrain } from "./generate";

/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
let defaultEye: vec3 = vec3.fromValues(
    -1.810965657234192,
    36.399932861328125,
    40.831521987915039
); // default eye position in world space
let defaultCenter = vec3.fromValues(
    62.18913650512695,
    36.399932861328125,
    -9.168441772460938
); // default view direction in world space
let defaultUp = vec3.fromValues(0.30000001192092896, 0, 1); // default view up vector

let lightAmbient = vec3.fromValues(1, 1, 1); // default light ambient emission
let lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
let lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
let lightPosition = vec3.fromValues(
    -1.810965657234192,
    36.399932861328125,
    40.831521987915039
); // default light position

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
let rotateTheta = (Math.PI / 180) * 0.1; // how much to rotate models by with each key press

// ASSIGNMENT HELPER FUNCTIONS

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
            Center = vec3.add(
                Center,
                Center,
                vec3.scale(temp, viewRight, viewDelta)
            );
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(
                    Eye,
                    Eye,
                    vec3.scale(temp, viewRight, viewDelta)
                );
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(
                Center,
                Center,
                vec3.scale(temp, viewRight, -viewDelta)
            );
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(
                    Eye,
                    Eye,
                    vec3.scale(temp, viewRight, -viewDelta)
                );
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(
                    Center,
                    Center,
                    vec3.scale(temp, Up, viewDelta)
                );
                Up = vec3.cross(
                    Up,
                    viewRight,
                    vec3.subtract(lookAt, Center, Eye)
                ); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, -viewDelta));
                Center = vec3.add(
                    Center,
                    Center,
                    vec3.scale(temp, lookAt, -viewDelta)
                );
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(
                    Center,
                    Center,
                    vec3.scale(temp, Up, -viewDelta)
                );
                Up = vec3.cross(
                    Up,
                    viewRight,
                    vec3.subtract(lookAt, Center, Eye)
                ); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, viewDelta));
                Center = vec3.add(
                    Center,
                    Center,
                    vec3.scale(temp, lookAt, viewDelta)
                );
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(
                    Up,
                    vec3.add(Up, Up, vec3.scale(temp, viewRight, -viewDelta))
                );
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, viewDelta));
                Center = vec3.add(
                    Center,
                    Center,
                    vec3.scale(temp, Up, viewDelta)
                );
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(
                    Up,
                    vec3.add(Up, Up, vec3.scale(temp, viewRight, viewDelta))
                );
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, -viewDelta));
                Center = vec3.add(
                    Center,
                    Center,
                    vec3.scale(temp, Up, -viewDelta)
                );
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
    } catch (e) {
        // end try
        console.log(e);
    } // end catch
} // end setupWebGL

/**
 * read models in, load them into webgl buffers
 */
function loadModels(config: Config) {
    /**
     * load a texture
     * @param {string} textureName
     */
    function loadTexture(texName: string) {
        if (texName && !(texName in textures)) {
            textures[texName] = gl.createTexture()!; // new texture struct for model
            let currTexture = textures[texName]!; // shorthand
            gl.bindTexture(gl.TEXTURE_2D, currTexture); // activate model's texture
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v,

            let texDesc = getTexturePreset(config.tex_preset, texName);
            let tex = generateTexture(
                config.perlin_width,
                config.perlin_height,
                config.tex_width,
                config.tex_height,
                texDesc
            );

            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                config.tex_width,
                config.tex_height,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                tex
            );
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // use linear filter for magnification
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MIN_FILTER,
                gl.LINEAR_MIPMAP_LINEAR
            ); // use mipmap for minification
            gl.generateMipmap(gl.TEXTURE_2D); // construct mipmap pyramid
            gl.bindTexture(gl.TEXTURE_2D, null); // deactivate model's texture
        }
    } // end load texture

    inputTriangles = generateTerrain(
        config.terrain_width,
        config.terrain_height,
        config.tex_preset,
        config
    ); // read in the triangle data

    let currSet: TriObj; // the current triangle set
    let whichSetVert: number; // index of vertex in current triangle set
    let whichSetTri: number; // index of triangle in current triangle set
    let vtxToAdd: vec3; // vtx coords to add to the vertices array
    let normToAdd: vec3; // vtx normal to add to the normal array
    let uvToAdd: vec2; // uv coords to add to the uv arry
    let triToAdd; // tri indices to add to the index array
    let maxCorner = vec3.fromValues(
        Number.MIN_VALUE,
        Number.MIN_VALUE,
        Number.MIN_VALUE
    ); // bbox corner
    let minCorner = vec3.fromValues(
        Number.MAX_VALUE,
        Number.MAX_VALUE,
        Number.MAX_VALUE
    ); // other corner

    // process each triangle set to load webgl vertex and triangle buffers
    numTriangleSets = inputTriangles.length; // remember how many tri sets
    for (let whichSet = 0; whichSet < numTriangleSets; whichSet++) {
        // for each tri set
        currSet = inputTriangles[whichSet]!;

        let numVerts = currSet.vertices.length; // num vertices in tri set
        for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) {
            // verts in set
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
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(currSet.glVertices),
            gl.STATIC_DRAW
        ); // data in
        normalBuffers[whichSet] = gl.createBuffer()!; // init empty webgl set normal component buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]!); // activate that buffer
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(currSet.glNormals),
            gl.STATIC_DRAW
        ); // data in
        uvBuffers[whichSet] = gl.createBuffer()!; // init empty webgl set uv coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[whichSet]!); // activate that buffer
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(currSet.glUvs),
            gl.STATIC_DRAW
        ); // data in
        loadTexture(currSet.material.texture); // load tri set's texture

        // set up the triangle index array, adjusting indices across sets
        triSetSizes[whichSet] = currSet.triangles.length; // number of tris in this set
        for (
            whichSetTri = 0;
            whichSetTri < triSetSizes[whichSet]!;
            whichSetTri++
        ) {
            triToAdd = currSet.triangles[whichSetTri]; // get tri to add
            currSet.glTriangles.push(...triToAdd!); // put indices in set list
        } // end for triangles in set

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()!); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]!); // activate that buffer
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(currSet.glTriangles),
            gl.STATIC_DRAW
        ); // data in
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

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            // bad frag shader compile
            gl.deleteShader(fShader);
            throw (
                "error during fragment shader compile: " +
                gl.getShaderInfoLog(fShader)
            );
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            // bad vertex shader compile
            gl.deleteShader(vShader);
            throw (
                "error during vertex shader compile: " +
                gl.getShaderInfoLog(vShader)
            );
        } else {
            // no compile errors
            let shaderProgram = gl.createProgram()!; // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                // bad program link
                throw (
                    "error during shader program linking: " +
                    gl.getProgramInfoLog(shaderProgram)
                );
            } else {
                // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(
                    shaderProgram,
                    "aVertexPosition"
                ); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(
                    shaderProgram,
                    "aVertexNormal"
                ); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                vUVAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexUV"); // ptr to vertex UV attrib
                gl.enableVertexAttribArray(vUVAttribLoc); // connect attrib to array

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix")!; // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(
                    shaderProgram,
                    "upvmMatrix"
                )!; // ptr to pvmmat

                // locate fragment uniforms
                let eyePositionULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uEyePosition"
                ); // ptr to eye position
                let lightAmbientULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uLightAmbient"
                ); // ptr to light ambient
                let lightDiffuseULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uLightDiffuse"
                ); // ptr to light diffuse
                let lightSpecularULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uLightSpecular"
                ); // ptr to light specular
                let lightPositionULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uLightPosition"
                ); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient")!; // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse")!; // ptr to diffuse
                specularULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uSpecular"
                )!; // ptr to specular
                shininessULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uShininess"
                )!; // ptr to shininess
                usingTextureULoc = gl.getUniformLocation(
                    shaderProgram,
                    "uUsingTexture"
                )!; // ptr to using texture
                textureULoc = gl.getUniformLocation(shaderProgram, "uTexture")!; // ptr to texture

                // pass global (not per model) constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } catch (e) {
        // end try
        console.log(e);
    } // end catch
} // end setup shaders

/**
 * Setup view parameters
 */
function setupView(config: Config) {
    let eye_x = config.terrain_width / 2;
    let eye_y = 0;
    let eye_z =
        1.5 * config.terrain_max_elevation - 0.5 * config.terrain_min_depth;
    Eye = vec3.fromValues(eye_x, eye_y, eye_z);
    Center = vec3.fromValues(eye_x, config.terrain_height, 0);
    vec3.sub(Up, Center, Eye);
    vec3.cross(Up, Up, vec3.fromValues(-1, 0, 0)); // TODO: not sure why -1
    viewDelta = (config.terrain_max_elevation - config.terrain_min_depth) / 100;
    rotateTheta = Math.PI / 10;
    lightPosition = vec3.fromValues(config.terrain_width / 2, 0, 30);
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

    gl.clear(/*gl.COLOR_BUFFER_BIT |*/ gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

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
        gl.uniform1i(usingTextureULoc, Number(currSet.material.texture != "")); // whether the set uses texture
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
        gl.drawElements(
            gl.TRIANGLES,
            3 * triSetSizes[whichTriSet]!,
            gl.UNSIGNED_SHORT,
            0
        ); // render
    } // end for each triangle set
} // end render model

function getParameters(): Config {
    let config = new Config();

    // Ref: https://stackoverflow.com/questions/3547035/javascript-getting-html-form-values
    config.terrain_width = Number(
        (<HTMLInputElement>document.getElementById("terrain-width")).value
    );
    config.terrain_height = Number(
        (<HTMLInputElement>document.getElementById("terrain-height")).value
    );
    config.terrain_min_depth = Number(
        (<HTMLInputElement>document.getElementById("terrain-depth")).value
    );
    config.terrain_max_elevation = Number(
        (<HTMLInputElement>document.getElementById("terrain-elevation")).value
    );
    config.perlin_width = Number(
        (<HTMLInputElement>document.getElementById("perlin-width")).value
    );
    config.perlin_height = Number(
        (<HTMLInputElement>document.getElementById("perlin-height")).value
    );
    config.tex_width = Number(
        (<HTMLInputElement>document.getElementById("tex-width")).value
    );
    config.tex_height = Number(
        (<HTMLInputElement>document.getElementById("tex-height")).value
    );
    config.tex_preset = Number(
        (<HTMLInputElement>document.getElementById("tex-preset")).value
    );
    config.tri_step_size = Number(
        (<HTMLInputElement>document.getElementById("tri-step-size")).value
    );
    config.obj_step_size = Number(
        (<HTMLInputElement>document.getElementById("obj-step-size")).value
    );
    return config;
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

    let config = getParameters();
    console.log(config);
    loadModels(config);
    renderModels();
}

/* MAIN -- HERE is where execution begins after window load */

export function main() {
    setupWebGL(); // set up the webGL environment
    let config = new Config();
    loadModels(config); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    setupView(config); // setup camera
    renderModels(); // draw the triangles using webGL
} // end main
