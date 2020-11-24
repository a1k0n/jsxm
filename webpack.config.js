const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
    entry: "./src/index.ts",
    output: {
      filename: "./bundle.js"
    },

    devServer: {
        // contentBase: path.join(__dirname, 'dist'),
        contentBase:  './dist',
        compress: true,
        port: 9000
      },
  
    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",
  
    resolve: {
      // Add '.ts' and '.tsx' as resolvable extensions.
      extensions: [ ".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
    },
  
    module: {
      rules: [
        // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
        { test: /\.tsx?$/, loader: "ts-loader" },
  
        // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
        { test: /\.js$/, loader: "source-map-loader" }
      ]
    },
  
    plugins: [
        new CopyPlugin({
          patterns: [
            { from: './public', to: '.' },
          ],
        }),
      ],
  };