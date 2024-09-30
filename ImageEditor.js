// ImageEditor.js
import React, { Component } from 'react';
import { View, ActivityIndicator, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

export default class ImageEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resizedImageUri: null,
      isLoading: true,
      base64Image: null,
      selectedColor: 'rgba(0, 0, 0, 1)', // Default color for the select button
    };

    // Bind methods
    this.loadImage = this.loadImage.bind(this);
    this.onMessage = this.onMessage.bind(this);
    this.handleSelectColor = this.handleSelectColor.bind(this);
    this.getWebViewContent = this.getWebViewContent.bind(this);
  }

  componentDidMount() {
    this.loadImage();
  }

  async loadImage() {
    const { imageUri } = this.props;
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
      const base64Image = `data:image/jpeg;base64,${base64}`;
      this.setState({ base64Image, isLoading: false });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to process the image.');
      this.props.onCancel();
    }
  }

  onMessage(event) {
    const data = JSON.parse(event.nativeEvent.data);
    if (data && data.type === 'COLOR_SELECTED') {
      const { r, g, b, a } = data;
      const rgba = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      this.setState({ selectedColor: rgba }, () => {
        // Update the select button color in the WebView without reloading
        const injectedJS = `window.setSelectButtonColor("${rgba}"); true;`;
        this.webview.injectJavaScript(injectedJS);
      });
    } else if (data && data.type === 'SELECT_BUTTON_PRESSED') {
      this.handleSelectColor();
    }
  }

  handleSelectColor = () => {
    const { selectedColor } = this.state;
    if (selectedColor) {
      this.props.onColourSelected(selectedColor); // Pass the selected color up to App.js
    } else {
      Alert.alert('No color selected', 'Please click on a pixel to select a color.');
    }
  };

  getWebViewContent() {
    const { base64Image } = this.state; // Remove selectedColor from here

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body, html {
                margin: 0;
                padding: 0;
                overflow: hidden;
                touch-action: none;
                display: flex;
                flex-direction: column;
                height: 100vh;
            }
            
            #canvasContainer {
                flex: 1;
                position: relative;
            }
            
            #canvas {
                width: 100%;
                height: 100%;
            }
            
            #square {
                position: absolute;
                border: 2px solid red;
                width: 50px;
                height: 50px;
                display: none;
            }
            
            /* New Instructional Text Styles */
            #instructionText {
                font-size: 12px;           /* Small font size */
                text-align: center;        /* Centered text */
                margin-top: 4px;           /* Small space above the text */
                color: #000;               /* Text color (black) */
                font-family: Arial, sans-serif; /* Optional: Define a readable font */
            }
            
            #bottomContainer {
                display: flex;
                flex-direction: row;
                height: 28%;               /* Adjusted from 30% to 28% to accommodate text */
                margin-top: 2px;           /* 2px spacing from the image */
            }
            
            #zoomCanvasContainer {
                flex: 1;
                margin-left: 2px;          /* 2px from left */
                margin-bottom: 2px;        /* 2px from bottom */
            }
            
            #zoomCanvas {
                width: 100%;
                height: 100%;
                border: 1px solid black;
            }
            
            #selectButtonContainer {
                width: 60px;
                margin-right: 2px;         /* 2px from right */
                margin-bottom: 2px;        /* 2px from bottom */
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            #selectButton {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: rgba(0, 0, 0, 1); /* Set default color */
                border-radius: 8px;
            }
            
            #selectButtonText {
                color: #fff;
                font-weight: bold;
            }
          
          </style>
        </head>
        <body>
          <div id="canvasContainer">
              <canvas id="canvas"></canvas>
              <div id="square"></div>
          </div>
        
          <!-- New Instructional Text -->
          <div id="instructionText">Select a colour from a pixel in the zoomed-in area.</div>
        
          <div id="bottomContainer">
              <div id="zoomCanvasContainer">
                  <canvas id="zoomCanvas"></canvas>
              </div>
              <div id="selectButtonContainer">
                  <div id="selectButton">
                      <span id="selectButtonText">Select</span>
                  </div>
              </div>
          </div>
        
          <script>
            var canvas = document.getElementById('canvas');
            var ctx = canvas.getContext('2d');
            var img = new Image();
            img.src = '${base64Image}';
            
            var imgWidth, imgHeight, imgX, imgY;
            var lastRectX = 0;
            var lastRectY = 0;
            var isTouchingCanvas = false;
            var isTouchingZoom = false;
            
            // Throttle function to limit the rate of function execution
            function throttle(func, limit) {
                let lastFunc;
                let lastRan;
                return function() {
                    const context = this;
                    const args = arguments;
                    if (!lastRan) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    } else {
                        clearTimeout(lastFunc);
                        lastFunc = setTimeout(function() {
                            if ((Date.now() - lastRan) >= limit) {
                                func.apply(context, args);
                                lastRan = Date.now();
                            }
                        }, limit - (Date.now() - lastRan));
                    }
                }
            }
            
            function resizeCanvas() {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
                drawImage();
              
                // Reposition the red box after resizing
                var square = document.getElementById('square');
                var squareLeft = imgX + lastRectX;
                var squareTop = imgY + lastRectY;
                square.style.left = squareLeft + 'px';
                square.style.top = squareTop + 'px';
                square.style.display = 'block';
              
                // Update the zoomed-in area based on the last position
                updateZoomedArea(lastRectX + 25, lastRectY + 25);
              }
              

            window.addEventListener('resize', resizeCanvas);
            
            img.onload = function () {
                resizeCanvas();
              
                // Initial position (center of the image)
                var rectSize = 50;
                lastRectX = (imgWidth - rectSize) / 2;
                lastRectY = (imgHeight - rectSize) / 2;
              
                // Position the red box
                var square = document.getElementById('square');
                square.style.left = imgX + lastRectX + 'px';
                square.style.top = imgY + lastRectY + 'px';
                square.style.display = 'block';
              
                // Update the zoomed-in area
                updateZoomedArea(lastRectX + rectSize / 2, lastRectY + rectSize / 2);
              };
              
            
            function drawImage() {
              var aspectRatio = img.width / img.height;
              var canvasWidth = canvas.width;
              var canvasHeight = canvas.height;
  
              if (canvasWidth / canvasHeight > aspectRatio) {
                imgHeight = canvasHeight;
                imgWidth = imgHeight * aspectRatio;
              } else {
                imgWidth = canvasWidth;
                imgHeight = imgWidth / aspectRatio;
              }
  
              imgX = (canvasWidth - imgWidth) / 2;
              imgY = (canvasHeight - imgHeight) / 2;
  
              ctx.clearRect(0, 0, canvasWidth, canvasHeight);
              ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
            }
  
            function updateZoomedArea(x, y) {
                var rectSize = 50;
                var rectX = Math.min(Math.max(x - rectSize / 2, 0), imgWidth - rectSize);
                var rectY = Math.min(Math.max(y - rectSize / 2, 0), imgHeight - rectSize);

                // Do not update lastRectX and lastRectY here

                var zoomCanvas = document.getElementById('zoomCanvas');
                var zoomCtx = zoomCanvas.getContext('2d');

                zoomCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
                zoomCtx.drawImage(
                    img,
                    rectX / imgWidth * img.naturalWidth,
                    rectY / imgHeight * img.naturalHeight,
                    rectSize / imgWidth * img.naturalWidth,
                    rectSize / imgHeight * img.naturalHeight,
                    0,
                    0,
                    zoomCanvas.width,
                    zoomCanvas.height
                );
            }

            // Touch event handling on the main canvas
            canvas.addEventListener('touchstart', function(e) {
              if (e.target !== canvas) {
                return;
              }
              isTouchingCanvas = true;
              e.preventDefault();
            });

            canvas.addEventListener('touchmove', function(e) {
                if (!isTouchingCanvas) {
                  return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                var touch = e.touches[0];
                var rect = canvas.getBoundingClientRect();
                var x = touch.clientX - rect.left - imgX;
                var y = touch.clientY - rect.top - imgY;
              
                if (x >= 0 && x <= imgWidth && y >= 0 && y <= imgHeight) {
                  // Update the position of the red box
                  var rectSize = 50;
                  lastRectX = Math.min(Math.max(x - rectSize / 2, 0), imgWidth - rectSize);
                  lastRectY = Math.min(Math.max(y - rectSize / 2, 0), imgHeight - rectSize);
              
                  var square = document.getElementById('square');
                  square.style.left = imgX + lastRectX + 'px';
                  square.style.top = imgY + lastRectY + 'px';
                  square.style.display = 'block';
              
                  // Update the zoomed-in area
                  updateZoomedArea(lastRectX + rectSize / 2, lastRectY + rectSize / 2);
                }
              });

            canvas.addEventListener('touchend', function(e) {
              if (!isTouchingCanvas) {
                return;
              }
              isTouchingCanvas = false;
              e.preventDefault();
              e.stopImmediatePropagation();
            });

            // Event handling on zoomCanvas
            var zoomCanvas = document.getElementById('zoomCanvas');

            zoomCanvas.addEventListener('touchstart', function(e) {
              isTouchingZoom = true;
              e.preventDefault();
              e.stopPropagation();
            });

            // Throttled function to handle touchmove on zoomCanvas
            var handleZoomTouchMove = throttle(function(e) {
              if (!isTouchingZoom) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();

              var touch = e.touches[0];
              var rect = zoomCanvas.getBoundingClientRect();
              var x = touch.clientX - rect.left;
              var y = touch.clientY - rect.top;

              var zoomCtx = zoomCanvas.getContext('2d');
              try {
                var pixel = zoomCtx.getImageData(x, y, 1, 1).data;
                var r = pixel[0];
                var g = pixel[1];
                var b = pixel[2];
                var a = pixel[3];

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'COLOR_SELECTED',
                  r: r,
                  g: g,
                  b: b,
                  a: a
                }));
              } catch (error) {
                console.error('Error getting pixel data:', error);
              }
            }, 100); // Adjust the throttle limit as needed

            zoomCanvas.addEventListener('touchmove', handleZoomTouchMove);

            zoomCanvas.addEventListener('touchend', function(e) {
              if (!isTouchingZoom) {
                return;
              }
              isTouchingZoom = false;
              e.preventDefault();
              e.stopPropagation();

              var touch = e.changedTouches[0];
              var rect = this.getBoundingClientRect();
              var x = touch.clientX - rect.left;
              var y = touch.clientY - rect.top;

              var zoomCtx = this.getContext('2d');
              try {
                var pixel = zoomCtx.getImageData(x, y, 1, 1).data;
                var r = pixel[0];
                var g = pixel[1];
                var b = pixel[2];
                var a = pixel[3];

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'COLOR_SELECTED',
                  r: r,
                  g: g,
                  b: b,
                  a: a
                }));
              } catch (error) {
                console.error('Error getting pixel data:', error);
              }
            });

            document.getElementById('selectButton').addEventListener('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SELECT_BUTTON_PRESSED'
              }));
            });

            // Function to set the select button's color
            function setSelectButtonColor(rgba) {
              document.getElementById("selectButton").style.backgroundColor = rgba;
            }

            // Expose the function to the React Native side
            window.setSelectButtonColor = setSelectButtonColor;
          </script>
        </body>
      </html>
    `;
  }

  render() {
    const { isLoading, selectedColor } = this.state;

    if (isLoading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <WebView
          ref={(ref) => {
            this.webview = ref;
          }}
          source={{
            html: this.getWebViewContent(),
          }}
          onMessage={this.onMessage}
          style={styles.webview}
          javaScriptEnabled={true}
          scrollEnabled={false}
          onLoadEnd={() => {
            // Inject JavaScript to set the initial color
            const initialColor = this.state.selectedColor;
            const injectedJS = `
              window.setSelectButtonColor("${initialColor}");
              true; // Note: This is required for the WebView to execute the injected JS
            `;
            this.webview.injectJavaScript(injectedJS);
          }}
        />
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // Ensure no padding or margin is added here
  },
  webview: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
});
