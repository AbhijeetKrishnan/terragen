import path from "path";
import { Configuration } from "webpack";
import _ from "webpack-dev-server";
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const config: Configuration = {
  entry: {
    rasterize: "./src/rasterize.ts"
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)?$/,
        exclude: [
          /node_modules/
        ],
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "perlin.bundle.js",
    libraryTarget: "umd",
    library: "Perlin",
    clean: true
  },
  devServer: {
    static: path.join(__dirname, "dist"),
    compress: true,
    port: 4000,
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: false
    }),
    new ESLintPlugin(),
    new HtmlWebpackPlugin({
      title: 'terragen',
      template: 'src/index.html'
    }),
  ],
};

export default config;