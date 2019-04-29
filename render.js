function generateTexture(texWidth, texHeight, perlinWidth, perlinHeight, baseColour, highlightColour) {
    var canvas = document.createElement('canvas');
    canvas.width = texWidth;
    canvas.height = texHeight;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    perlin = new Perlin(perlinWidth, perlinHeight); // could possible vary this as a ratio of world size
    for (var i = 0; i < h; i++) {
        for (var j = 0; j < w; j++) {
            var noise = perlin.getNoise(vec2.fromValues(j + 0.5, i + 0.5), w, h) / 2 + 0.5; // experiment without 0.5
            var rgb = vec3.create();
            vec3.sub(rgb, baseColour, highlightColour);
            vec3.scale(rgb, rgb, noise);
            vec3.add(rgb, base_col, rgb);
            
            ctx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
            ctx.fillRect(j, i, 1, 1);
        }
    }
}