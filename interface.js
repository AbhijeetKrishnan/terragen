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
    TERRAIN_WIDTH = Number(document.getElementById("terrain-width").value);
    TERRAIN_HEIGHT = Number(document.getElementById("terrain-height").value);
    TERRAIN_MIN_DEPTH = Number(document.getElementById("terrain-depth").value);
    TERRAIN_MAX_ELEVATION = Number(document.getElementById("terrain-elevation").value);

    PERLIN_WIDTH = Number(document.getElementById("perlin-width").value);
    PERLIN_HEIGHT = Number(document.getElementById("perlin-height").value);

    TEX_WIDTH = Number(document.getElementById("tex-width").value);
    TEX_HEIGHT = Number(document.getElementById("tex-height").value);

    TRI_STEP_SIZE = Number(document.getElementById("tri-step-size").value);
    OBJ_STEP_SIZE = Number(document.getElementById("obj-step-size").value);
}