function renderClick() {
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