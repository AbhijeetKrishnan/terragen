function main() {
    var canvas = document.getElementById('display');
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    perlin = new Perlin(w, h);
    for (var i = 0; i < h; i++) {
        for (var j = 0; j < w; j++) {
            var noise = 255 * perlin.perlin2(j + 0.5, i + 0.5);
            //console.log(noise);
            ctx.fillStyle = "rgb(" + noise + "," + noise + "," + noise + ")";
            ctx.fillRect(j, i, 1, 1);
        }
    }
}