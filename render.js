function main() {
    var canvas = document.getElementById('display');
    var ctx = canvas.getContext('2d');
    perlin = new Perlin(512, 512);
    for (var x = 0; x < 512; x++) {
        for (var y = 0; y < 512; y++) {
            var noise = perlin.getNoise(x, y);
            ctx.fillStyle = "rgb(" + noise + "," + noise + "," + noise + ")";
            ctx.fillRect(x, y, 1, 1);
        }
    }
}