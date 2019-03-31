function main() {
    var canvas = document.getElementById('display');
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    perlin = new Perlin(16, 16); // could possible vary this as a ratio of world size
    for (var i = 0; i < h; i++) {
        for (var j = 0; j < w; j++) {
            var n = perlin.getNoise((j + 0.5) / 1, (i + 0.5) / 1, w, h) * 1;
            var noise = 255 * (perlin.getNoise(j + 0.5, i + 0.5, w, h) / 2 + 0.5);
            //console.log(noise);
            ctx.fillStyle = "rgb(" + 0 + "," + noise + "," + 0 + ")";
            ctx.fillRect(j, i, 1, 1);
        }
    }
}